import os
import uuid
import json
import boto3
import tempfile
import shutil
import requests
import base64
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from botocore.exceptions import ClientError
import logging
from dotenv import load_dotenv

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# AWS 설정 - 환경 변수에서 가져오기
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY")
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET = os.getenv("S3_BUCKET")
DYNAMODB_TABLE = os.getenv("DYNAMODB_TABLE")

LOCAL_STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test")
os.makedirs(LOCAL_STORAGE_DIR, exist_ok=True)
logger.info(f"Local storage directory: {LOCAL_STORAGE_DIR}")

# S3 클라이언트 초기화
s3_client = None
if AWS_ACCESS_KEY and AWS_SECRET_KEY and S3_BUCKET:
    s3_client = boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION,
    )

# DynamoDB 클라이언트 초기화
dynamodb = None
if AWS_ACCESS_KEY and AWS_SECRET_KEY:
    dynamodb = boto3.resource(
        "dynamodb",
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION,
    )

# Bedrock 클라이언트 초기화
bedrock_runtime = None
if AWS_ACCESS_KEY and AWS_SECRET_KEY:
    try:
        bedrock_runtime = boto3.client(
            service_name="bedrock-runtime",
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY,
            aws_secret_access_key=AWS_SECRET_KEY,
        )
        logger.info("Bedrock client initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing Bedrock client: {str(e)}")

def create_dynamodb_table():
    try:
        if not dynamodb:
            logger.warning("DynamoDB client not initialized. Cannot create table.")
            return None
        existing_tables = dynamodb.meta.client.list_tables()["TableNames"]
        if DYNAMODB_TABLE in existing_tables:
            logger.info(f"DynamoDB table {DYNAMODB_TABLE} already exists.")
            return dynamodb.Table(DYNAMODB_TABLE)
        table = dynamodb.create_table(
            TableName=DYNAMODB_TABLE,
            KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
            ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
        )
        table.meta.client.get_waiter("table_exists").wait(TableName=DYNAMODB_TABLE)
        logger.info(f"Created DynamoDB table: {DYNAMODB_TABLE}")
        return table
    except ClientError as e:
        logger.error(f"Error creating DynamoDB table: {e.response['Error']['Message']}")
        return None

def save_transcription_to_dynamodb(job_id, transcript_data, file_name=None):
    try:
        if not dynamodb:
            logger.warning("DynamoDB client not initialized. Cannot save transcript.")
            return None
        table = dynamodb.Table(DYNAMODB_TABLE)
        transcript_text = ""
        try:
            if (
                "results" in transcript_data
                and "transcripts" in transcript_data["results"]
            ):
                transcript_text = transcript_data["results"]["transcripts"][0][
                    "transcript"
                ]
            elif "transcripts" in transcript_data:
                transcript_text = transcript_data["transcripts"][0]["transcript"]
        except (KeyError, IndexError) as e:
            logger.warning(f"Could not extract transcript text: {str(e)}")
            transcript_text = "Transcript text extraction failed"
        file_creation_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        item = {
            "id": job_id,
            "fileName": file_name if file_name else f"{job_id}.json",
            "transcript": transcript_text,
            "fileCreationDate": file_creation_date,
            "currentDate": current_date,
        }
        response = table.put_item(Item=item)
        logger.info(f"Transcription data saved to DynamoDB: {job_id}")
        return response
    except Exception as e:
        logger.error(f"Error saving to DynamoDB: {str(e)}")
        return None

def summarize_text_with_bedrock_promptmgmt(text, prompt_arn):
    try:
        response = bedrock_runtime.converse(
            modelId=prompt_arn,
            promptVariables={
                "content": {
                    "text": text
                }
            }
        )
        # 안전하게 중첩된 값을 추출
        summary = None
        try:
            summary = (
                response.get("output", {})
                        .get("message", {})
                        .get("content", [{}])[0]
                        .get("text", "")
            )
        except Exception as e:
            logger.error(f"Error extracting summary: {str(e)}")
            summary = str(response)
        return summary
    except Exception as e:
        logger.error(f"Error in summarize_text_with_bedrock_promptmgmt: {str(e)}")
        return f"요약 생성 중 오류가 발생했습니다: {str(e)}"



    
def update_dynamodb_with_summary(job_id, summary):
    try:
        if not dynamodb:
            logger.warning(
                "DynamoDB client not initialized. Cannot update with summary."
            )
            return None
        table = dynamodb.Table(DYNAMODB_TABLE)
        response = table.update_item(
            Key={"id": job_id},
            UpdateExpression="set summary = :s",
            ExpressionAttributeValues={":s": summary},
            ReturnValues="UPDATED_NEW",
        )
        logger.info(f"Summary updated in DynamoDB for job: {job_id}")
        return response
    except Exception as e:
        logger.error(f"Error updating DynamoDB with summary: {str(e)}")
        return None

@asynccontextmanager
async def lifespan(app: FastAPI):
    if dynamodb:
        create_dynamodb_table()
    logger.info("Application startup: DynamoDB table check completed")
    yield
    logger.info("Application shutdown")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 음성 파일 업로드 엔드포인트
@app.post("/upload-audio")
async def upload_audio(
    audio_file: UploadFile = File(...),
    language_code: str = Form("ko-KR"),
    enable_speaker_diarization: str = Form("true"),
    max_speaker_count: str = Form("10"),  # <- 추가
    convert_to_mp3: str = Form("false"),
):
    try:
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=os.path.splitext(audio_file.filename)[1]
        ) as temp_file:
            shutil.copyfileobj(audio_file.file, temp_file)
            temp_file_path = temp_file.name

        file_size = os.path.getsize(temp_file_path)
        logger.info(
            f"Received audio file: {audio_file.filename}, size: {file_size} bytes"
        )

        file_ext = os.path.splitext(audio_file.filename)[1].lower()
        if file_ext not in [".mp3", ".wav", ".flac", ".ogg"]:
            os.unlink(temp_file_path)
            return {
                "error": "Unsupported file format. Supported formats: MP3, WAV, FLAC, OGG"
            }

        final_file_path = temp_file_path
        if convert_to_mp3.lower() == "true" and file_ext != ".mp3":
            try:
                import subprocess

                mp3_file_path = temp_file_path.replace(file_ext, ".mp3")
                subprocess.run(
                    [
                        "ffmpeg",
                        "-i",
                        temp_file_path,
                        "-acodec",
                        "libmp3lame",
                        "-ab",
                        "128k",
                        mp3_file_path,
                    ],
                    check=True,
                )
                os.unlink(temp_file_path)
                final_file_path = mp3_file_path
                file_ext = ".mp3"
                logger.info(f"Converted to MP3: {final_file_path}")
            except Exception as e:
                logger.warning(
                    f"Failed to convert to MP3: {str(e)}. Using original file."
                )

        # 파일명 그대로 사용 (중복 방지를 위해 타임스탬프 추가)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename_base = os.path.splitext(os.path.basename(audio_file.filename))[0]
        s3_key = f"audio/{filename_base}_{timestamp}{file_ext}"
        
        # S3에 업로드
        if s3_client and S3_BUCKET:
            with open(final_file_path, "rb") as file_data:
                s3_client.upload_fileobj(file_data, S3_BUCKET, s3_key)
            logger.info(f"File uploaded to S3: {s3_key}")
            s3_uri = f"s3://{S3_BUCKET}/{s3_key}"
        else:
            local_path = os.path.join(
                LOCAL_STORAGE_DIR, f"{filename_base}_{timestamp}{file_ext}"
            )
            shutil.copy(final_file_path, local_path)
            logger.info(f"File saved locally: {local_path}")
            s3_uri = f"file://{local_path}"
        
        # 임시 파일 삭제
        if os.path.exists(final_file_path):
            os.unlink(final_file_path)
        
        # Transcribe 작업 시작
        transcribe_client = boto3.client(
            "transcribe",
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY,
            aws_secret_access_key=AWS_SECRET_KEY,
        )
        job_name = f"transcribe-job-{timestamp}-{uuid.uuid4()}"
        transcription_settings = {}
        if enable_speaker_diarization.lower() == "true":
            transcription_settings = {
                "ShowSpeakerLabels": True,
                "MaxSpeakerLabels": int(max_speaker_count),  # <- 수정: 슬라이더 값 반영
            }
        transcribe_client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": s3_uri},
            MediaFormat=file_ext[1:],
            LanguageCode=language_code,
            OutputBucketName=S3_BUCKET,
            OutputKey=f"transcribe_results/{job_name}.json",
            Settings=transcription_settings,
        )
        return {"success": True, "job_id": job_name, "message": "File uploaded and transcription job started"}
    except Exception as e:
        logger.error(f"Error processing uploaded file: {str(e)}")
        return {"error": f"Failed to process uploaded file: {str(e)}"}

# 음성 녹음 데이터 처리 엔드포인트
@app.post("/record-audio")
async def record_audio(
    audio_data: dict = Body(...),
    language_code: str = Form("ko-KR"),
    enable_speaker_diarization: str = Form("true"),
    max_speaker_count: str = Form("10"),
):
    try:
        # Base64 인코딩된 오디오 데이터 추출
        audio_base64 = audio_data.get("audio_data", "")
        if not audio_base64:
            return {"error": "No audio data provided"}
        
        # 파일 형식 확인 (기본값 WAV)
        file_format = audio_data.get("file_format", "wav").lower()
        file_ext = f".{file_format}"
        
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            # Base64 디코딩 후 파일로 저장
            audio_bytes = base64.b64decode(audio_base64.split(",")[1] if "," in audio_base64 else audio_base64)
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        
        file_size = os.path.getsize(temp_file_path)
        logger.info(f"Received recorded audio, size: {file_size} bytes")
        
        # 녹음 파일명 생성 (타임스탬프 포함)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename_base = f"recording_{timestamp}"
        s3_key = f"audio/{filename_base}{file_ext}"
        
        # S3에 업로드
        if s3_client and S3_BUCKET:
            with open(temp_file_path, "rb") as file_data:
                s3_client.upload_fileobj(file_data, S3_BUCKET, s3_key)
            logger.info(f"File uploaded to S3: {s3_key}")
            s3_uri = f"s3://{S3_BUCKET}/{s3_key}"
        else:
            local_path = os.path.join(
                LOCAL_STORAGE_DIR, f"{filename_base}{file_ext}"
            )
            shutil.copy(temp_file_path, local_path)
            logger.info(f"File saved locally: {local_path}")
            s3_uri = f"file://{local_path}"
        
        # 임시 파일 삭제
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        
        # Transcribe 작업 시작
        transcribe_client = boto3.client(
            "transcribe",
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY,
            aws_secret_access_key=AWS_SECRET_KEY,
        )

        job_name = f"transcribe-job-{timestamp}-{uuid.uuid4()}"

        # 화자 구분 설정
        transcription_settings = {}
        if enable_speaker_diarization.lower() == "true":
            transcription_settings = {
                "ShowSpeakerLabels": True,
                "MaxSpeakerLabels": int(max_speaker_count),
            }

        # Transcribe 작업 시작
        transcribe_client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": s3_uri},
            MediaFormat=file_ext[1:],  # .wav -> wav
            LanguageCode=language_code,
            OutputBucketName=S3_BUCKET,
            OutputKey=f"transcribe_results/{job_name}.json",
            Settings=transcription_settings,
        )

        logger.info(f"Started transcription job: {job_name}")
        
        return {
            "success": True,
            "job_id": job_name,
            "s3_key": s3_key,
            "message": "Audio recorded and transcription job started",
        }
        
    except Exception as e:
        logger.error(f"Error processing recorded audio: {str(e)}")
        return {"error": f"Failed to process recorded audio: {str(e)}"}


# 작업 상태 확인 엔드포인트
@app.get("/job-status/{job_id}")
async def get_job_status(job_id: str):
    try:
        s3_key = f"transcribe_results/{job_id}.json"
        result = {"job_id": job_id, "status": "UNKNOWN"}

        try:
            logger.info(f"Retrieving file from S3: {S3_BUCKET}/{s3_key}")
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
            file_content = response["Body"].read().decode("utf-8")
            transcript_data = json.loads(file_content)
            logger.info(
                f"Successfully retrieved file from S3, content size: {len(file_content)} bytes"
            )
            result["status"] = "COMPLETED"
            file_name = s3_key.split("/")[-1]
            simple_transcript = transcript_data["results"]["transcripts"][0][
                "transcript"
            ]

            # ----------- [변경: 시간순 대화 흐름 트랜스크립트 생성] -----------
            formatted_transcript = simple_transcript
            if "speaker_labels" in transcript_data["results"]:
                segments = transcript_data["results"]["speaker_labels"]["segments"]
                items = transcript_data["results"]["items"]

                # 각 segment(발화 단위)별로 시간순 정렬
                formatted_transcript_lines = []
                for segment in segments:
                    speaker_label = segment["speaker_label"]
                    start_time = float(segment["start_time"])
                    end_time = float(segment["end_time"])
                    # 해당 segment의 단어 추출
                    segment_items = [
                        item for item in items
                        if "start_time" in item and "end_time" in item
                        and float(item["start_time"]) >= start_time
                        and float(item["end_time"]) <= end_time
                    ]
                    segment_text = " ".join(
                        [item["alternatives"][0]["content"] for item in segment_items]
                    )
                    if segment_text.strip():
                        # 화자 번호 추출
                        spk_num = 1
                        if speaker_label.startswith("spk_"):
                            try:
                                spk_num = int(speaker_label.split("_")[1]) + 1
                            except:
                                pass
                        # 시간 포맷 (00:00~00:03)
                        def sec2str(sec):
                            m, s = divmod(int(sec), 60)
                            return f"{m:02}:{s:02}"
                        time_str = f"{sec2str(start_time)}~{sec2str(end_time)}"
                        formatted_transcript_lines.append(
                            f"[화자{spk_num}] ({time_str}) {segment_text}"
                        )
                formatted_transcript = "\n".join(formatted_transcript_lines)
            # -------------------------------------------------------------

            db_result = save_transcription_to_dynamodb(
                job_id, transcript_data, file_name
            )
            if db_result:
                logger.info(
                    f"Successfully saved transcription to DynamoDB for job: {job_id}"
                )
                result["dynamodb_saved"] = True
            else:
                logger.warning(
                    f"Failed to save transcription to DynamoDB for job: {job_id}"
                )
                result["dynamodb_saved"] = False

            result["transcript"] = formatted_transcript

        except s3_client.exceptions.NoSuchKey:
            # ... (생략: Transcribe API로 직접 조회하는 부분 동일하게 위와 같은 방식으로 수정)
            # 아래도 동일하게 formatted_transcript를 위와 같이 생성

            transcribe_client = boto3.client(
                "transcribe",
                region_name=AWS_REGION,
                aws_access_key_id=AWS_ACCESS_KEY,
                aws_secret_access_key=AWS_SECRET_KEY,
            )
            response = transcribe_client.get_transcription_job(
                TranscriptionJobName=job_id
            )

            job = response["TranscriptionJob"]
            status = job["TranscriptionJobStatus"]

            result["status"] = status

            if status == "COMPLETED":
                transcript_uri = job["Transcript"]["TranscriptFileUri"]
                transcript_response = requests.get(transcript_uri)
                if transcript_response.status_code == 200:
                    transcript_data = transcript_response.json()
                    file_name = None
                    if "OutputKey" in job:
                        file_name = job["OutputKey"].split("/")[-1]
                    elif "Media" in job and "MediaFileUri" in job["Media"]:
                        file_name = job["Media"]["MediaFileUri"].split("/")[-1]
                    simple_transcript = transcript_data["results"]["transcripts"][0][
                        "transcript"
                    ]
                    formatted_transcript = simple_transcript
                    if "speaker_labels" in transcript_data["results"]:
                        segments = transcript_data["results"]["speaker_labels"]["segments"]
                        items = transcript_data["results"]["items"]
                        formatted_transcript_lines = []
                        for segment in segments:
                            speaker_label = segment["speaker_label"]
                            start_time = float(segment["start_time"])
                            end_time = float(segment["end_time"])
                            segment_items = [
                                item for item in items
                                if "start_time" in item and "end_time" in item
                                and float(item["start_time"]) >= start_time
                                and float(item["end_time"]) <= end_time
                            ]
                            segment_text = " ".join(
                                [item["alternatives"][0]["content"] for item in segment_items]
                            )
                            if segment_text.strip():
                                spk_num = 1
                                if speaker_label.startswith("spk_"):
                                    try:
                                        spk_num = int(speaker_label.split("_")[1]) + 1
                                    except:
                                        pass
                                def sec2str(sec):
                                    m, s = divmod(int(sec), 60)
                                    return f"{m:02}:{s:02}"
                                time_str = f"{sec2str(start_time)}~{sec2str(end_time)}"
                                formatted_transcript_lines.append(
                                    f"[화자{spk_num}] ({time_str}) {segment_text}"
                                )
                        formatted_transcript = "\n".join(formatted_transcript_lines)

                    db_result = save_transcription_to_dynamodb(
                        job_id, transcript_data, file_name
                    )
                    if db_result:
                        logger.info(
                            f"Successfully saved transcription to DynamoDB for job: {job_id}"
                        )
                        result["dynamodb_saved"] = True
                    else:
                        logger.warning(
                            f"Failed to save transcription to DynamoDB for job: {job_id}"
                        )
                        result["dynamodb_saved"] = False

                    result["transcript"] = formatted_transcript

            elif status == "FAILED":
                result["error"] = job.get("FailureReason", "Unknown error")

        return result

    except Exception as e:
        logger.error(f"Error checking job status: {str(e)}")
        return {"error": f"Failed to check job status: {str(e)}"}


# 요약 생성 엔드포인트
@app.post("/summarize-transcript")
async def summarize_transcript(request: Request):
    form = await request.form()
    job_id = form.get("job_id")
    prompt_arn = form.get("prompt_arn")

    if not job_id:
        raise HTTPException(status_code=400, detail="job_id is required")
    if not prompt_arn:
        raise HTTPException(status_code=400, detail="prompt_arn is required")

    table = dynamodb.Table(DYNAMODB_TABLE)
    resp = table.get_item(Key={"id": job_id})
    if "Item" not in resp:
        raise HTTPException(
            status_code=404, detail=f"Transcript not found for job: {job_id}"
        )
    item = resp["Item"]
    transcript_text = item.get("transcript", "")
    if not transcript_text:
        raise HTTPException(status_code=400, detail="Transcript is empty")

    summary = summarize_text_with_bedrock_promptmgmt(transcript_text, prompt_arn)
    if not summary:
        raise HTTPException(status_code=500, detail="Bedrock summary failed")
    update_dynamodb_with_summary(job_id, summary)
    return {
        "success": True,
        "job_id": job_id,
        "summary": summary,
        "message": "Summary generated and saved successfully",
    }

# 트랜스크립션 및 요약 조회 엔드포인트
@app.get("/get-transcript/{job_id}")
async def get_transcript(job_id: str):
    try:
        if not dynamodb:
            logger.error("DynamoDB client not initialized. Cannot retrieve transcript.")
            raise HTTPException(
                status_code=400, detail="DynamoDB client not initialized"
            )

        table = dynamodb.Table(DYNAMODB_TABLE)
        response = table.get_item(Key={"id": job_id})
        if "Item" not in response:
            logger.error(f"Transcript not found in DynamoDB for job: {job_id}")
            raise HTTPException(
                status_code=404, detail=f"Transcript not found for job: {job_id}"
            )

        item = response["Item"]
        result = {
            "job_id": job_id,
            "fileName": item.get("fileName", ""),
            "transcript": item.get("transcript", ""),
            "fileCreationDate": item.get("fileCreationDate", ""),
            "currentDate": item.get("currentDate", ""),
        }

        if "summary" in item:
            result["summary"] = item["summary"]

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving transcript: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve transcript: {str(e)}"
        )

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/features")
async def get_features():
    features = {
        "supported_languages": ["en-US", "ko-KR", "ja-JP", "zh-CN"],
        "speaker_diarization": True,
        "max_speakers": 10,
        "dynamodb_enabled": dynamodb is not None,
        "s3_enabled": s3_client is not None,
        "bedrock_enabled": bedrock_runtime is not None,
        "recording_enabled": True,
        "file_upload_enabled": True,
    }
    return features

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)