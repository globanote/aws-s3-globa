# backend.py
import os
import uuid
import json
import asyncio
import boto3
import wave
import tempfile
import shutil
import requests
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.model import TranscriptEvent
from botocore.exceptions import ClientError
from typing import Dict, List
import logging
from dotenv import load_dotenv
# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AWS 설정 - 환경 변수에서 가져오기
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY")
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET = os.getenv("S3_BUCKET")

# 로컬 저장 디렉토리 설정
LOCAL_STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test")
os.makedirs(LOCAL_STORAGE_DIR, exist_ok=True)
logger.info(f"Local storage directory: {LOCAL_STORAGE_DIR}")

# S3 클라이언트 초기화 (선택적)
s3_client = None
if AWS_ACCESS_KEY and AWS_SECRET_KEY and S3_BUCKET:
    s3_client = boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION
    )

# 활성 WebSocket 연결 저장
active_connections: Dict[str, WebSocket] = {}
# 오디오 청크 저장
audio_chunks: Dict[str, List[bytes]] = {}
# 트랜스크립션 결과 저장
transcription_results: Dict[str, List[str]] = {}

# 고정된 샘플 레이트 정의
SAMPLE_RATE = 16000

class MyTranscriptResultStreamHandler(TranscriptResultStreamHandler):
    def __init__(self, session_id):
        # 고정된 샘플 레이트 사용
        super().__init__(SAMPLE_RATE)
        self.session_id = session_id
        if session_id not in transcription_results:
            transcription_results[session_id] = []
        
    # handle_events 메서드 오버라이드 - output_stream 파라미터 추가
    async def handle_events(self, output_stream):
        async for event in output_stream:
            if event.transcript:
                await self.handle_transcript_event(event)
        
    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        results = transcript_event.transcript.results
        if len(results) > 0:
            transcript = results[0]
            if not transcript.is_partial:
                # 최종 결과
                transcript_text = transcript.alternatives[0].transcript
                speaker_labels = []
                
                # 화자 구분 정보가 있는 경우
                if hasattr(transcript, 'speaker_labels') and transcript.speaker_labels:
                    for segment in transcript.speaker_labels.segments:
                        speaker_labels.append({
                            "speaker_label": segment.speaker_label,
                            "start_time": segment.start_time,
                            "end_time": segment.end_time
                        })
                        
                # 트랜스크립션 결과 저장
                if speaker_labels:
                    for label in speaker_labels:
                        speaker = label.get("speaker_label", "")
                        formatted_text = f"[{speaker}] {transcript_text}"
                        transcription_results[self.session_id].append(formatted_text)
                else:
                    transcription_results[self.session_id].append(transcript_text)
                
                # WebSocket을 통해 결과 전송
                if self.session_id in active_connections:
                    await active_connections[self.session_id].send_json({
                        "type": "transcript",
                        "is_partial": False,
                        "text": transcript_text,
                        "speaker_labels": speaker_labels
                    })
            else:
                # 부분 결과
                transcript_text = transcript.alternatives[0].transcript
                if self.session_id in active_connections:
                    await active_connections[self.session_id].send_json({
                        "type": "transcript",
                        "is_partial": True,
                        "text": transcript_text
                    })

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info(f"WebSocket connection accepted for session: {session_id}")
    active_connections[session_id] = websocket
    audio_chunks[session_id] = []
    transcription_results[session_id] = []
    
    # 트랜스크립션 클라이언트 설정
    client = TranscribeStreamingClient(region=AWS_REGION)
    
    try:
        # 하트비트 메시지 처리를 위한 태스크
        async def heartbeat():
            while True:
                await asyncio.sleep(30)  # 30초마다 하트비트 체크
                try:
                    await websocket.send_json({"type": "Heartbeat"})
                    logger.debug("Heartbeat sent")
                except:
                    logger.warning("Failed to send heartbeat")
                    break
        
        heartbeat_task = asyncio.create_task(heartbeat())
        
        # 언어 및 화자 구분 설정 수신
        config = await websocket.receive_json()
        logger.info(f"Received configuration: {config}")
        language_code = config.get("language_code", "en-US")
        enable_speaker_diarization = config.get("enable_speaker_diarization", False)
        max_speaker_count = config.get("max_speaker_count", 4)
        
        # 스트림 설정 - 기본 파라미터
        stream_params = {
            "media_encoding": "pcm",
            "media_sample_rate_hz": SAMPLE_RATE,
            "language_code": language_code,
            "enable_partial_results_stabilization": True,
            "partial_results_stability": "high"
        }
        
        # 화자 구분 활성화 시 로그만 남기고 파라미터는 추가하지 않음
        if enable_speaker_diarization:
            logger.warning(f"Speaker diarization requested with {max_speaker_count} speakers, but may not be supported in the current SDK version")

        logger.info(f"Starting stream with parameters: {stream_params}")

        # 스트림 시작 (handle_events 파라미터 없이)
        handler = MyTranscriptResultStreamHandler(session_id)
        stream = await client.start_stream_transcription(**stream_params)

        # 핸들러 이벤트 처리를 위한 태스크 생성
        # 수정된 부분: handler.handle_events 메서드에 output_stream 전달
        handler_task = asyncio.create_task(handler.handle_events(stream.output_stream))
        
        # 오디오 데이터 수신 및 처리
        chunk_count = 0
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_bytes(), timeout=5.0)
                audio_chunks[session_id].append(data)
                await stream.input_stream.send_audio_event(audio_chunk=data)
                chunk_count += 1
                if chunk_count % 10 == 0:  # 로그 스패밍 방지
                    logger.info(f"Received {chunk_count} audio chunks for session {session_id}")
            except asyncio.TimeoutError:
                logger.debug("Timeout waiting for audio data, continuing...")
                continue
            except Exception as e:
                logger.error(f"Error receiving audio data: {str(e)}")
                break
            
    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {session_id}")
    except Exception as e:
        logger.error(f"Error in WebSocket connection: {str(e)}")
    finally:
        logger.info(f"Cleaning up resources for session: {session_id}")
        if session_id in active_connections:
            del active_connections[session_id]
        
        # 스트림 종료
        if 'stream' in locals():
            await stream.input_stream.end_stream()
            logger.info("Transcription stream ended")
        
        # 핸들러 태스크 취소
        if 'handler_task' in locals():
            handler_task.cancel()
            logger.info("Handler task cancelled")
        
        # 하트비트 태스크 취소
        if 'heartbeat_task' in locals():
            heartbeat_task.cancel()
            logger.info("Heartbeat task cancelled")

@app.post("/save-audio/{session_id}")
async def save_audio(session_id: str):
    if session_id not in audio_chunks or not audio_chunks[session_id]:
        logger.warning(f"No audio data found for session: {session_id}")
        return {"error": "No audio data found for this session"}
    
    try:
        # 오디오 데이터 합치기
        audio_data = b''.join(audio_chunks[session_id])
        logger.info(f"Combined audio data size: {len(audio_data)} bytes")
        
        # 현재 시간을 포함한 파일명 생성
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        audio_filename = f"{session_id}_{timestamp}.mp3"
        text_filename = f"{session_id}_{timestamp}.txt"
        
        # 로컬에 오디오 파일 저장 (mp3 포맷)
        audio_path = os.path.join(LOCAL_STORAGE_DIR, audio_filename)
        
        # mp3 파일 헤더 추가하여 저장
        with wave.open(audio_path, 'wb') as mp3_file:
            mp3_file.setnchannels(1)  # 모노
            mp3_file.setsampwidth(2)  # 16-bit
            mp3_file.setframerate(SAMPLE_RATE)  # 고정된 샘플 레이트 사용
            mp3_file.writeframes(audio_data)
        
        logger.info(f"Audio saved to: {audio_path}")
        
        # 트랜스크립션 결과를 텍스트 파일로 저장
        text_path = os.path.join(LOCAL_STORAGE_DIR, text_filename)
        with open(text_path, 'w', encoding='utf-8') as text_file:
            if session_id in transcription_results and transcription_results[session_id]:
                text_file.write('\n'.join(transcription_results[session_id]))
                logger.info(f"Saved {len(transcription_results[session_id])} transcription results")
            else:
                text_file.write("No transcription results available.")
                logger.warning("No transcription results available to save")
        
        logger.info(f"Text saved to: {text_path}")
        
        result = {
            "success": True,
            "file_name": audio_filename,
            "local_audio_path": audio_path,
            "local_text_path": text_path,
        }
        
        # S3에도 저장 (선택적)
        if s3_client and S3_BUCKET:
            try:
                # S3에 오디오 파일 업로드
                s3_client.put_object(
                    Bucket=S3_BUCKET,
                    Key=f"audio/{audio_filename}",
                    Body=audio_data,
                    ContentType="audio/mp3"
                )
                
                # S3에 텍스트 파일 업로드
                text_content = '\n'.join(transcription_results[session_id]) if session_id in transcription_results else "No transcription results available."
                s3_client.put_object(
                    Bucket=S3_BUCKET,
                    Key=f"text/{text_filename}",
                    Body=text_content,
                    ContentType="text/plain"
                )
                
                # S3 URL 생성
                audio_s3_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/audio/{audio_filename}"
                text_s3_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/text/{text_filename}"
                
                result["s3_audio_url"] = audio_s3_url
                result["s3_text_url"] = text_s3_url
                logger.info(f"Files uploaded to S3: {S3_BUCKET}")
            except Exception as e:
                logger.warning(f"S3 upload warning (continuing anyway): {str(e)}")
        
        # 업로드 후 로컬 데이터 정리
        del audio_chunks[session_id]
        if session_id in transcription_results:
            del transcription_results[session_id]
        
        return result
    
    except Exception as e:
        logger.error(f"Error saving files: {str(e)}")
        return {"error": f"Failed to save files: {str(e)}"}

# 업로드된 음성 파일 처리 엔드포인트
@app.post("/upload-audio")
async def upload_audio(
    audio_file: UploadFile = File(...),
    language_code: str = Form("ko-KR"),
    enable_speaker_diarization: str = Form("true"),
    max_speaker_count: str = Form("2"),
    convert_to_mp3: str = Form("false")  # 새로운 파라미터 추가
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
        
        result = {
            "job_id": job_id,
            "status": status
        }
        
        if status == "COMPLETED":
            # 트랜스크립션 결과 가져오기
            transcript_uri = job['Transcript']['TranscriptFileUri']
            
            # 결과 파일 다운로드
            transcript_response = requests.get(transcript_uri)
            if transcript_response.status_code == 200:
                transcript_data = transcript_response.json()
                
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
                
                # 결과 저장 - 텍스트 파일
                text_filename = f"{job_id}_transcript.txt"
                text_path = os.path.join(LOCAL_STORAGE_DIR, text_filename)
                
                with open(text_path, 'w', encoding='utf-8') as text_file:
                    text_file.write(formatted_transcript)
                
                logger.info(f"Transcription saved to: {text_path}")
                
                # S3에 텍스트 파일 저장 (text 폴더에)
                if s3_client and S3_BUCKET:
                    # text 폴더에 저장
                    s3_text_key = f"text/{text_filename}"
                    s3_client.put_object(
                        Bucket=S3_BUCKET,
                        Key=s3_text_key,
                        Body=formatted_transcript,
                        ContentType="text/plain"
                    )
                    
                    text_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_text_key}"
                    result["text_url"] = text_url
                    logger.info(f"Text file uploaded to S3: {s3_text_key}")
                
                result["transcript"] = formatted_transcript
                result["local_text_path"] = text_path
            
        elif status == "FAILED":
            result["error"] = job.get('FailureReason', 'Unknown error')
        
        return result
    
    except Exception as e:
        logger.error(f"Error checking job status: {str(e)}")
        return {"error": f"Failed to check job status: {str(e)}"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# 다중 언어 지원 여부 확인 엔드포인트 추가
@app.get("/features")
async def get_features():
    features = {
        "supported_languages": ["en-US", "ko-KR", "ja-JP", "zh-CN"],
        "speaker_diarization": True,
        "max_speakers": 10,
        "partial_results": True,
        "sample_rate": SAMPLE_RATE,
        "sdk_version": "Check amazon-transcribe package version"
    }
    
    # SDK 버전 확인 시도
    try:
        import pkg_resources
        features["sdk_version"] = pkg_resources.get_distribution("amazon-transcribe").version
    except Exception as e:
        features["sdk_version"] = f"Unknown (error: {str(e)})"
    
    return features

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
