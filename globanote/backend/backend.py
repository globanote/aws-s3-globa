import os
import uuid
import json
import boto3
import tempfile
import shutil
import requests
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
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

# 로컬 저장 디렉토리 설정
LOCAL_STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test")
os.makedirs(LOCAL_STORAGE_DIR, exist_ok=True)
logger.info(f"Local storage directory: {LOCAL_STORAGE_DIR}")

# S3 클라이언트 초기화
s3_client = None
if AWS_ACCESS_KEY and AWS_SECRET_KEY and S3_BUCKET:
    s3_client = boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION
    )

# DynamoDB 클라이언트 초기화
dynamodb = None
if AWS_ACCESS_KEY and AWS_SECRET_KEY:
    dynamodb = boto3.resource(
        'dynamodb',
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION
    )

# DynamoDB 테이블 생성 함수
def create_dynamodb_table():
    try:
        if not dynamodb:
            logger.warning("DynamoDB client not initialized. Cannot create table.")
            return None
        
        # 테이블이 이미 존재하는지 확인
        existing_tables = dynamodb.meta.client.list_tables()['TableNames']
        if DYNAMODB_TABLE in existing_tables:
            logger.info(f"DynamoDB table {DYNAMODB_TABLE} already exists.")
            return dynamodb.Table(DYNAMODB_TABLE)
        
        # 테이블 생성
        table = dynamodb.create_table(
            TableName=DYNAMODB_TABLE,
            KeySchema=[
                {
                    'AttributeName': 'id',
                    'KeyType': 'HASH'  # 파티션 키
                }
            ],
            AttributeDefinitions=[
                {
                    'AttributeName': 'id',
                    'AttributeType': 'S'
                }
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        
        # 테이블이 생성될 때까지 대기
        table.meta.client.get_waiter('table_exists').wait(TableName=DYNAMODB_TABLE)
        logger.info(f"Created DynamoDB table: {DYNAMODB_TABLE}")
        return table
    
    except ClientError as e:
        logger.error(f"Error creating DynamoDB table: {e.response['Error']['Message']}")
        return None

# DynamoDB에 트랜스크립션 결과 저장 함수
def save_transcription_to_dynamodb(job_id, transcript_data, file_name=None):
    try:
        if not dynamodb:
            logger.warning("DynamoDB client not initialized. Cannot save transcript.")
            return None
        
        table = dynamodb.Table(DYNAMODB_TABLE)
        
        # 트랜스크립션 결과에서 필요한 정보 추출
        transcript_text = ""
        try:
            if "results" in transcript_data and "transcripts" in transcript_data["results"]:
                transcript_text = transcript_data["results"]["transcripts"][0]["transcript"]
            # 다른 가능한 구조 확인
            elif "transcripts" in transcript_data:
                transcript_text = transcript_data["transcripts"][0]["transcript"]
        except (KeyError, IndexError) as e:
            logger.warning(f"Could not extract transcript text: {str(e)}")
            transcript_text = "Transcript text extraction failed"
        
        # 파일 생성 날짜 추출 (현재 시간 사용)
        file_creation_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 현재 날짜 (저장 시점)
        current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 저장할 아이템 준비
        item = {
            'id': job_id,
            'fileName': file_name if file_name else f"{job_id}.json",
            'transcript': transcript_text,
            'fileCreationDate': file_creation_date,
            'currentDate': current_date
        }
        
        # DynamoDB에 아이템 저장
        response = table.put_item(Item=item)
        logger.info(f"Transcription data saved to DynamoDB: {job_id}")
        return response
    except Exception as e:
        logger.error(f"Error saving to DynamoDB: {str(e)}")
        return None

# Lifespan 이벤트 핸들러 정의
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시 실행할 코드
    if dynamodb:
        create_dynamodb_table()
    logger.info("Application startup: DynamoDB table check completed")
    
    yield  # 애플리케이션 실행 중
    
    # 종료 시 실행할 코드
    logger.info("Application shutdown")

# FastAPI 앱 생성 시 lifespan 매개변수 전달
app = FastAPI(lifespan=lifespan)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 업로드된 음성 파일 처리 엔드포인트
@app.post("/upload-audio")
async def upload_audio(
    audio_file: UploadFile = File(...),
    language_code: str = Form("ko-KR"),
    enable_speaker_diarization: str = Form("true"),
    max_speaker_count: str = Form("2"),
    convert_to_mp3: str = Form("false")
):
    try:
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as temp_file:
            shutil.copyfileobj(audio_file.file, temp_file)
            temp_file_path = temp_file.name
        
        # 파일 크기 확인
        file_size = os.path.getsize(temp_file_path)
        logger.info(f"Received audio file: {audio_file.filename}, size: {file_size} bytes")
        
        # 파일 확장자 확인
        file_ext = os.path.splitext(audio_file.filename)[1].lower()
        if file_ext not in ['.mp3', '.wav', '.flac', '.ogg']:
            os.unlink(temp_file_path)
            return {"error": "Unsupported file format. Supported formats: MP3, WAV, FLAC, OGG"}
        
        # MP3로 변환 (요청된 경우)
        final_file_path = temp_file_path
        if convert_to_mp3.lower() == "true" and file_ext != '.mp3':
            try:
                # 외부 프로세스로 ffmpeg 호출 (ffmpeg가 설치되어 있어야 함)
                import subprocess
                mp3_file_path = temp_file_path.replace(file_ext, '.mp3')
                
                # ffmpeg를 사용하여 변환
                subprocess.run([
                    'ffmpeg', '-i', temp_file_path, 
                    '-acodec', 'libmp3lame', '-ab', '128k', 
                    mp3_file_path
                ], check=True)
                
                # 원본 파일 삭제하고 MP3 파일 사용
                os.unlink(temp_file_path)
                final_file_path = mp3_file_path
                file_ext = '.mp3'
                logger.info(f"Converted to MP3: {final_file_path}")
            except Exception as e:
                logger.warning(f"Failed to convert to MP3: {str(e)}. Using original file.")
        
        # S3에 업로드 - audio 폴더에 저장
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename_base = os.path.splitext(os.path.basename(audio_file.filename))[0]
        s3_key = f"audio/{filename_base}_{timestamp}{file_ext}"
        
        if s3_client and S3_BUCKET:
            with open(final_file_path, 'rb') as file_data:
                s3_client.upload_fileobj(file_data, S3_BUCKET, s3_key)
            logger.info(f"File uploaded to S3: {s3_key}")
            s3_uri = f"s3://{S3_BUCKET}/{s3_key}"
        else:
            # S3가 구성되지 않은 경우 로컬에 저장
            local_path = os.path.join(LOCAL_STORAGE_DIR, f"{timestamp}_{audio_file.filename}")
            shutil.copy(final_file_path, local_path)
            logger.info(f"File saved locally: {local_path}")
            s3_uri = f"file://{local_path}"
        
        # 임시 파일 삭제
        if os.path.exists(final_file_path):
            os.unlink(final_file_path)
        
        # Transcribe 작업 시작
        transcribe_client = boto3.client(
            'transcribe',
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY,
            aws_secret_access_key=AWS_SECRET_KEY
        )
        
        job_name = f"transcribe-job-{timestamp}-{uuid.uuid4()}"
        
        # 화자 구분 설정
        transcription_settings = {}
        if enable_speaker_diarization.lower() == "true":
            transcription_settings = {
                "ShowSpeakerLabels": True,
                "MaxSpeakerLabels": int(max_speaker_count)
            }
        
        # Transcribe 작업 시작
        transcribe_client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={'MediaFileUri': s3_uri},
            MediaFormat=file_ext[1:],  # .mp3 -> mp3
            LanguageCode=language_code,
            OutputBucketName=S3_BUCKET,
            OutputKey=f"transcribe_results/{job_name}.json",  # 결과 JSON 저장 경로 지정
            Settings=transcription_settings
        )
        
        logger.info(f"Started transcription job: {job_name}")
        
        return {
            "success": True,
            "job_id": job_name,
            "message": "File uploaded and transcription job started"
        }
    
    except Exception as e:
        logger.error(f"Error processing uploaded file: {str(e)}")
        return {"error": f"Failed to process uploaded file: {str(e)}"}

# 작업 상태 확인 엔드포인트
@app.get("/job-status/{job_id}")
async def get_job_status(job_id: str):
    try:
        # S3에서 직접 트랜스크립션 결과 파일 찾기
        s3_key = f"transcribe_results/{job_id}.json"
        
        result = {
            "job_id": job_id,
            "status": "UNKNOWN"
        }
        
        try:
            # S3에서 JSON 파일 가져오기
            logger.info(f"Retrieving file from S3: {S3_BUCKET}/{s3_key}")
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
            file_content = response['Body'].read().decode('utf-8')
            transcript_data = json.loads(file_content)
            logger.info(f"Successfully retrieved file from S3, content size: {len(file_content)} bytes")
            
            # 파일이 존재하면 상태를 COMPLETED로 설정
            result["status"] = "COMPLETED"
            
            # 파일명 추출
            file_name = s3_key.split('/')[-1]
            
            # 기본 텍스트 추출 (화자 구분 없는 단순 텍스트)
            simple_transcript = transcript_data['results']['transcripts'][0]['transcript']
            
            # 화자 구분 결과 처리
            formatted_transcript = simple_transcript
            if 'speaker_labels' in transcript_data['results']:
                speakers = transcript_data['results']['speaker_labels']['speakers']
                segments = transcript_data['results']['speaker_labels']['segments']
                items = transcript_data['results']['items']
                
                # 화자별 텍스트 구성
                speaker_text = {}
                
                for segment in segments:
                    speaker_label = segment['speaker_label']
                    start_time = float(segment['start_time'])
                    end_time = float(segment['end_time'])
                    
                    if speaker_label not in speaker_text:
                        speaker_text[speaker_label] = []
                    
                    segment_items = [item for item in items 
                                    if 'start_time' in item 
                                    and float(item['start_time']) >= start_time 
                                    and float(item['end_time']) <= end_time]
                    
                    segment_text = ' '.join([item['alternatives'][0]['content'] for item in segment_items])
                    speaker_text[speaker_label].append(segment_text)
                
                # 화자별 텍스트 조합
                formatted_transcript_lines = []
                for speaker, texts in speaker_text.items():
                    for text in texts:
                        if text.strip():
                            formatted_transcript_lines.append(f"[{speaker}] {text}")
                
                formatted_transcript = '\n'.join(formatted_transcript_lines)
            
            # DynamoDB에 트랜스크립션 결과 저장
            db_result = save_transcription_to_dynamodb(job_id, transcript_data, file_name)
            if db_result:
                logger.info(f"Successfully saved transcription to DynamoDB for job: {job_id}")
                result["dynamodb_saved"] = True
            else:
                logger.warning(f"Failed to save transcription to DynamoDB for job: {job_id}")
                result["dynamodb_saved"] = False
            
            # 결과에 트랜스크립트 포함 (프론트엔드 표시용)
            result["transcript"] = formatted_transcript
            
        except s3_client.exceptions.NoSuchKey:
            # S3에 파일이 없는 경우 Transcribe API로 상태 확인
            logger.info(f"File not found in S3, checking job status via Transcribe API: {job_id}")
            
            transcribe_client = boto3.client(
                'transcribe',
                region_name=AWS_REGION,
                aws_access_key_id=AWS_ACCESS_KEY,
                aws_secret_access_key=AWS_SECRET_KEY
            )
            
            response = transcribe_client.get_transcription_job(
                TranscriptionJobName=job_id
            )
            
            job = response['TranscriptionJob']
            status = job['TranscriptionJobStatus']
            
            result["status"] = status
            
            if status == "COMPLETED":
                # 트랜스크립션 결과 가져오기
                transcript_uri = job['Transcript']['TranscriptFileUri']
                
                # 결과 파일 다운로드
                transcript_response = requests.get(transcript_uri)
                if transcript_response.status_code == 200:
                    transcript_data = transcript_response.json()
                    
                    # 파일명 추출 (S3 경로에서)
                    file_name = None
                    if 'OutputKey' in job:
                        file_name = job['OutputKey'].split('/')[-1]
                    elif 'Media' in job and 'MediaFileUri' in job['Media']:
                        file_name = job['Media']['MediaFileUri'].split('/')[-1]
                    
                    # 기본 텍스트 추출 (화자 구분 없는 단순 텍스트)
                    simple_transcript = transcript_data['results']['transcripts'][0]['transcript']
                    
                    # 화자 구분 결과 처리
                    formatted_transcript = simple_transcript
                    if 'speaker_labels' in transcript_data['results']:
                        speakers = transcript_data['results']['speaker_labels']['speakers']
                        segments = transcript_data['results']['speaker_labels']['segments']
                        items = transcript_data['results']['items']
                        
                        # 화자별 텍스트 구성
                        speaker_text = {}
                        
                        for segment in segments:
                            speaker_label = segment['speaker_label']
                            start_time = float(segment['start_time'])
                            end_time = float(segment['end_time'])
                            
                            if speaker_label not in speaker_text:
                                speaker_text[speaker_label] = []
                            
                            segment_items = [item for item in items 
                                            if 'start_time' in item 
                                            and float(item['start_time']) >= start_time 
                                            and float(item['end_time']) <= end_time]
                            
                            segment_text = ' '.join([item['alternatives'][0]['content'] for item in segment_items])
                            speaker_text[speaker_label].append(segment_text)
                        
                        # 화자별 텍스트 조합
                        formatted_transcript_lines = []
                        for speaker, texts in speaker_text.items():
                            for text in texts:
                                if text.strip():
                                    formatted_transcript_lines.append(f"[{speaker}] {text}")
                        
                        formatted_transcript = '\n'.join(formatted_transcript_lines)
                    
                    # DynamoDB에 트랜스크립션 결과 저장
                    db_result = save_transcription_to_dynamodb(job_id, transcript_data, file_name)
                    if db_result:
                        logger.info(f"Successfully saved transcription to DynamoDB for job: {job_id}")
                        result["dynamodb_saved"] = True
                    else:
                        logger.warning(f"Failed to save transcription to DynamoDB for job: {job_id}")
                        result["dynamodb_saved"] = False
                    
                    # 결과에 트랜스크립트 포함 (프론트엔드 표시용)
                    result["transcript"] = formatted_transcript
                
            elif status == "FAILED":
                result["error"] = job.get('FailureReason', 'Unknown error')
        
        return result
    
    except Exception as e:
        logger.error(f"Error checking job status: {str(e)}")
        return {"error": f"Failed to check job status: {str(e)}"}


# S3에서 Transcribe 결과 JSON 파일을 가져와 DynamoDB에 저장하는 엔드포인트
@app.post("/save-transcription-from-s3")
async def save_transcription_from_s3(
    s3_key: str = Form(...),  # S3에 저장된 JSON 파일 경로
    job_id: str = Form(None)  # 선택적 작업 ID (없으면 파일명에서 추출)
):
    try:
        if not s3_client or not S3_BUCKET:
            logger.error("S3 client not initialized or bucket not specified")
            raise HTTPException(status_code=400, detail="S3 client not initialized or bucket not specified")
        
        # S3에서 JSON 파일 가져오기
        try:
            logger.info(f"Retrieving file from S3: {S3_BUCKET}/{s3_key}")
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
            file_content = response['Body'].read().decode('utf-8')
            transcript_data = json.loads(file_content)
            logger.info(f"Successfully retrieved file from S3, content size: {len(file_content)} bytes")
        except Exception as e:
            logger.error(f"Error retrieving file from S3: {str(e)}")
            raise HTTPException(status_code=404, detail=f"Failed to retrieve file from S3: {str(e)}")
        
        # 파일명 추출
        file_name = s3_key.split('/')[-1]
        logger.info(f"Extracted file name: {file_name}")
        
        # 작업 ID 설정 (제공되지 않은 경우 파일명에서 추출)
        if not job_id:
            # 파일명에서 작업 ID 추출 시도
            job_id = file_name.replace('.json', '')
            logger.info(f"Generated job_id from filename: {job_id}")
        
        logger.info(f"Saving transcription to DynamoDB: job_id={job_id}, file_name={file_name}")
        
        # DynamoDB에 저장
        db_result = save_transcription_to_dynamodb(job_id, transcript_data, file_name)
        
        if db_result:
            logger.info(f"Successfully saved transcription to DynamoDB for job: {job_id}")
            return {
                "success": True,
                "message": f"Transcription saved to DynamoDB for job: {job_id}",
                "job_id": job_id,
                "file_name": file_name
            }
        else:
            logger.error(f"Failed to save transcription to DynamoDB for job: {job_id}")
            raise HTTPException(status_code=500, detail="Failed to save transcription to DynamoDB")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving transcription from S3: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save transcription from S3: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# 기능 정보 확인 엔드포인트
@app.get("/features")
async def get_features():
    features = {
        "supported_languages": ["en-US", "ko-KR", "ja-JP", "zh-CN"],
        "speaker_diarization": True,
        "max_speakers": 10,
        "dynamodb_enabled": dynamodb is not None,
        "s3_enabled": s3_client is not None
    }
    
    return features

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
