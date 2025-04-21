import streamlit as st
import json
import uuid
import time
import requests
import logging
import os
from datetime import datetime
from typing import List, Dict
import io
from pydub import AudioSegment
import re
# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 백엔드 서버 설정
BACKEND_URL = "http://localhost:8000"
WEBSOCKET_URL = "ws://localhost:8000/ws"

# 페이지 설정
st.set_page_config(
    page_title="실시간 음성 인식 앱",
    page_icon="🎤",
    layout="wide"
)

# 세션 상태 초기화
if "transcript" not in st.session_state:
    st.session_state.transcript = []
if "is_recording" not in st.session_state:
    st.session_state.is_recording = False
if "transcription_jobs" not in st.session_state:
    st.session_state.transcription_jobs = {}
if "session_id" not in st.session_state:
    st.session_state.session_id = str(uuid.uuid4())

# 제목 및 설명
st.title("🎤 실시간 음성 인식 앱")
st.markdown("""
이 앱은 실시간으로 음성을 텍스트로 변환하고, 녹음을 중지하면 로컬 디렉토리에 저장합니다.
영어와 한국어를 지원하며, 최대 4명까지 화자를 구분할 수 있습니다.
""")

# 앱 시작 시 마이크 권한 안내
mic_info = st.sidebar.expander("마이크 권한 안내", expanded=True)
with mic_info:
    st.markdown("""
    ### 마이크 사용을 위한 안내
    
    이 앱은 브라우저를 통해 마이크에 접근합니다. 정상적인 작동을 위해:
    
    1. 브라우저에서 마이크 접근 권한을 허용해야 합니다.
    2. 녹음 버튼을 클릭하면 브라우저에서 마이크 접근 권한을 요청할 수 있습니다.
    3. 권한 요청 팝업이 나타나면 '허용'을 선택하세요.
    """)

# 작업 상태 확인 함수
def check_job_status(job_id):
    try:
        with st.spinner("작업 상태 확인 중..."):
            response = requests.get(f"{BACKEND_URL}/job-status/{job_id}")
            if response.status_code == 200:
                result = response.json()
                status = result.get("status")
                
                # 세션 상태 업데이트
                if job_id in st.session_state.transcription_jobs:
                    st.session_state.transcription_jobs[job_id]["status"] = status
                
                if status == "COMPLETED":
                    st.success("트랜스크립션이 완료되었습니다!")
                    
                    # 결과 표시
                    transcript = result.get("transcript", "")
                    if transcript:
                        st.write("### 트랜스크립션 결과")
                        
                        # 텍스트 영역에 결과 표시
                        st.text_area("텍스트", transcript, height=300)
                        
                        # 결과를 세션 상태에 저장
                        if job_id in st.session_state.transcription_jobs:
                            st.session_state.transcription_jobs[job_id]["transcript"] = transcript
                            
                            # 세션 상태의 트랜스크립트에도 추가
                            st.session_state.transcript.append(transcript)
                        
                        # 다운로드 링크 제공
                        if "text_url" in result:
                            st.markdown(f"[텍스트 파일 다운로드]({result['text_url']})")
                        
                        # 로컬 파일 경로 표시
                        if "local_text_path" in result:
                            st.info(f"텍스트 파일 저장 경로: {result['local_text_path']}")
                    else:
                        st.warning("트랜스크립션 결과가 없습니다.")
                elif status == "FAILED":
                    st.error(f"트랜스크립션 작업 실패: {result.get('error', '알 수 없는 오류')}")
                else:
                    st.info(f"현재 작업 상태: {status}")
                    st.info("처리가 완료될 때까지 기다려주세요. 잠시 후 다시 확인해보세요.")
                    
                    # 자동 새로고침 옵션
                    if st.button("상태 새로고침", key=f"refresh_{job_id}"):
                        check_job_status(job_id)
                
                return result
            else:
                st.error(f"작업 상태 확인 실패: {response.text}")
                return None
    except Exception as e:
        st.error(f"작업 상태 확인 중 오류 발생: {str(e)}")
        logger.error(f"작업 상태 확인 오류: {str(e)}", exc_info=True)
        return None

# WAV를 MP3로 변환하는 함수
def convert_wav_to_mp3(wav_data, output_filename):
    try:
        # 임시 WAV 파일 저장
        temp_wav_filename = f"temp_{uuid.uuid4()}.wav"
        with open(temp_wav_filename, "wb") as f:
            f.write(wav_data)
        
        # WAV를 MP3로 변환
        sound = AudioSegment.from_wav(temp_wav_filename)
        sound.export(output_filename, format="mp3", bitrate="128k")
        
        # 임시 WAV 파일 삭제
        os.remove(temp_wav_filename)
        
        return True
    except Exception as e:
        logger.error(f"MP3 변환 오류: {str(e)}", exc_info=True)
        return False

# 탭 생성
tab1, tab2 = st.tabs(["실시간 음성 인식", "음성 파일 업로드"])

with tab1:
    # 사이드바 설정
    with st.sidebar:
        st.header("설정")
        language = st.selectbox(
            "언어 선택",
            options=[("영어", "en-US"), ("한국어", "ko-KR")],
            format_func=lambda x: x[0],
            index=1  # 기본값을 한국어로 설정
        )[1]
        
        enable_speaker_diarization = st.checkbox("화자 구분 활성화", value=True)
        
        max_speaker_count = 2
        if enable_speaker_diarization:
            max_speaker_count = st.slider("최대 화자 수", min_value=2, max_value=4, value=2)
    
    # 녹음 섹션
    st.header("마이크 녹음")
    
    # st.audio_input을 사용한 녹음
    audio_data = st.audio_input("마이크로 녹음하기", key="audio_recorder")
    
    if audio_data is not None:
        # 녹음된 오디오 데이터 표시
        st.audio(audio_data, format="audio/wav")
        
        # 오디오 데이터 정보 표시
        st.info(f"오디오 데이터 크기: {len(audio_data.getvalue())} 바이트")
        
        # 백엔드로 전송 버튼
        if st.button("음성 인식 시작", key="start_recognition"):
            with st.spinner("음성을 텍스트로 변환 중..."):
                try:
                    # 현재 시간을 포함한 파일명 생성
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    mp3_filename = f"recorded_audio_{timestamp}.mp3"
                    
                    # WAV를 MP3로 변환
                    conversion_success = convert_wav_to_mp3(audio_data.getvalue(), mp3_filename)
                    
                    if conversion_success:
                        # MP3 파일 정보 출력
                        mp3_size = os.path.getsize(mp3_filename)
                        st.info(f"MP3 파일 생성 완료: {mp3_filename} ({mp3_size} 바이트)")
                        
                        # MP3 파일 재생
                        with open(mp3_filename, "rb") as mp3_file:
                            mp3_bytes = mp3_file.read()
                            st.audio(mp3_bytes, format="audio/mp3")
                        
                        # 백엔드로 MP3 파일 전송
                        with open(mp3_filename, "rb") as mp3_file:
                            files = {"audio_file": (mp3_filename, mp3_file, "audio/mp3")}
                            data = {
                                "language_code": language,
                                "enable_speaker_diarization": json.dumps(enable_speaker_diarization),
                                "max_speaker_count": str(max_speaker_count)
                            }
                            
                            response = requests.post(
                                f"{BACKEND_URL}/upload-audio",
                                files=files,
                                data=data
                            )
                    else:
                        # MP3 변환에 실패한 경우 WAV 파일 그대로 전송
                        st.warning("MP3 변환에 실패했습니다. WAV 파일을 직접 전송합니다.")
                        
                        # 임시 WAV 파일 저장
                        wav_filename = f"recorded_audio_{timestamp}.wav"
                        with open(wav_filename, "wb") as f:
                            f.write(audio_data.getvalue())
                        
                        with open(wav_filename, "rb") as wav_file:
                            files = {"audio_file": (wav_filename, wav_file, "audio/wav")}
                            data = {
                                "language_code": language,
                                "enable_speaker_diarization": json.dumps(enable_speaker_diarization),
                                "max_speaker_count": str(max_speaker_count)
                            }
                            
                            response = requests.post(
                                f"{BACKEND_URL}/upload-audio",
                                files=files,
                                data=data
                            )
                        
                        # 임시 WAV 파일 삭제
                        os.remove(wav_filename)
                    
                    if response.status_code == 200:
                        result = response.json()
                        job_id = result.get("job_id")
                        
                        if job_id:
                            st.success("오디오가 성공적으로 업로드되었습니다!")
                            st.info(f"트랜스크립션 작업 ID: {job_id}")
                            
                            # 작업 정보 저장
                            st.session_state.transcription_jobs[job_id] = {
                                "file_name": mp3_filename if conversion_success else wav_filename,
                                "language": language,
                                "speaker_diarization": enable_speaker_diarization,
                                "max_speakers": max_speaker_count,
                                "status": "IN_PROGRESS",
                                "timestamp": datetime.now().isoformat()
                            }
                            
                            # 작업 상태 확인 버튼
                            check_button_key = f"check_mic_{job_id}"
                            if st.button("작업 상태 확인", key=check_button_key):
                                job_result = check_job_status(job_id)
                                
                                # 자동으로 작업 상태 확인 시작
                                if job_result and job_result.get("status") != "COMPLETED":
                                    st.info("10초마다 자동으로 상태를 확인합니다...")
                                    
                                    # 진행 상태 표시
                                    progress_bar = st.progress(0)
                                    status_text = st.empty()
                                    
                                    for i in range(10):
                                        # 진행 상태 업데이트
                                        progress_bar.progress((i + 1) * 10)
                                        status_text.text(f"대기 중... ({i + 1}/10)")
                                        
                                        # 잠시 대기
                                        time.sleep(10)
                                        
                                        # 상태 확인
                                        job_result = check_job_status(job_id)
                                        if job_result and job_result.get("status") == "COMPLETED":
                                            break
                    else:
                        st.error(f"오디오 업로드 실패: {response.text}")
                
                except Exception as e:
                    st.error(f"오디오 처리 중 오류 발생: {str(e)}")
                    logger.error(f"오디오 처리 오류: {str(e)}", exc_info=True)
    
    # 실시간 트랜스크립션 결과 표시
    st.header("음성 인식 결과")
    
    transcript_container = st.container()
    with transcript_container:
        if st.session_state.transcript:
            for text in st.session_state.transcript:
                st.markdown(text)
        else:
            st.info("녹음을 시작하면 여기에 텍스트가 표시됩니다.")

with tab2:
    # 파일 업로드 섹션
    st.header("음성 파일 업로드")
    st.markdown("""
    업로드한 음성 파일을 텍스트로 변환합니다. 지원 형식: MP3, WAV, FLAC, OGG
    """)
    
    uploaded_file = st.file_uploader("음성 파일 선택", type=["mp3", "wav", "flac", "ogg"])
    
    if uploaded_file is not None:
        # 파일 정보 표시
        file_details = {
            "파일명": uploaded_file.name,
            "파일 크기": f"{uploaded_file.size / 1024:.2f} KB",
            "파일 타입": uploaded_file.type
        }
        st.write("### 파일 정보")
        for key, value in file_details.items():
            st.write(f"**{key}:** {value}")
        
        # 오디오 재생 위젯 표시
        st.audio(uploaded_file, format=uploaded_file.type)
        
        # 처리 옵션 선택
        st.write("### 처리 옵션")
        col1, col2 = st.columns(2)
        with col1:
            upload_language = st.selectbox(
                "언어 선택 (업로드 파일용)",
                options=[("영어", "en-US"), ("한국어", "ko-KR")],
                format_func=lambda x: x[0],
                index=1
            )[1]
        with col2:
            upload_speaker_diarization = st.checkbox("화자 구분 활성화 (업로드 파일용)", value=True)
        
        if upload_speaker_diarization:
            upload_max_speakers = st.slider("최대 화자 수 (업로드 파일용)", min_value=2, max_value=10, value=2)
        else:
            upload_max_speakers = 2
        
        # 처리 시작 버튼
        if st.button("파일 처리 시작"):
            with st.spinner("파일 업로드 및 처리 중..."):
                try:
                    # 파일 데이터 준비
                    file_content = uploaded_file.getvalue()
                    
                    # 파일 확장자 확인
                    file_ext = os.path.splitext(uploaded_file.name)[1].lower()
                    
                    # MP3가 아닌 경우 MP3로 변환
                    if file_ext != '.mp3':
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        temp_filename = f"temp_{timestamp}{file_ext}"
                        mp3_filename = f"uploaded_{timestamp}.mp3"
                        
                        # 임시 파일로 저장
                        with open(temp_filename, "wb") as f:
                            f.write(file_content)
                        
                        # 파일 형식에 따라 변환
                        try:
                            if file_ext == '.wav':
                                sound = AudioSegment.from_wav(temp_filename)
                            elif file_ext == '.flac':
                                sound = AudioSegment.from_file(temp_filename, format="flac")
                            elif file_ext == '.ogg':
                                sound = AudioSegment.from_ogg(temp_filename)
                            else:
                                sound = AudioSegment.from_file(temp_filename)
                            
                            sound.export(mp3_filename, format="mp3", bitrate="128k")
                            
                            # 임시 파일 삭제
                            os.remove(temp_filename)
                            
                            # MP3 파일로 업로드
                            with open(mp3_filename, "rb") as mp3_file:
                                files = {"audio_file": (mp3_filename, mp3_file, "audio/mp3")}
                                data = {
                                    "language_code": upload_language,
                                    "enable_speaker_diarization": json.dumps(upload_speaker_diarization),
                                    "max_speaker_count": str(upload_max_speakers)
                                }
                                
                                response = requests.post(
                                    f"{BACKEND_URL}/upload-audio",
                                    files=files,
                                    data=data
                                )
                            
                            # 변환된 MP3 파일 삭제
                            os.remove(mp3_filename)
                        except Exception as e:
                            st.warning(f"MP3 변환 실패: {str(e)}. 원본 파일을 그대로 업로드합니다.")
                            
                            # 변환 실패 시 원본 파일 그대로 업로드
                            files = {"audio_file": (uploaded_file.name, file_content, uploaded_file.type)}
                            data = {
                                "language_code": upload_language,
                                "enable_speaker_diarization": json.dumps(upload_speaker_diarization),
                                "max_speaker_count": str(upload_max_speakers)
                            }
                            
                            response = requests.post(
                                f"{BACKEND_URL}/upload-audio",
                                files=files,
                                data=data
                            )
                    else:
                        # 이미 MP3인 경우 그대로 업로드
                        files = {"audio_file": (uploaded_file.name, file_content, "audio/mp3")}
                        data = {
                            "language_code": upload_language,
                            "enable_speaker_diarization": json.dumps(upload_speaker_diarization),
                            "max_speaker_count": str(upload_max_speakers)
                        }
                        
                        response = requests.post(
                            f"{BACKEND_URL}/upload-audio",
                            files=files,
                            data=data
                        )
                    
                    if response.status_code == 200:
                        result = response.json()
                        st.success("파일이 성공적으로 업로드되었습니다!")
                        
                        # 작업 ID 저장
                        job_id = result.get("job_id")
                        if job_id:
                            # 작업 정보 저장
                            st.session_state.transcription_jobs[job_id] = {
                                "file_name": uploaded_file.name,
                                "language": upload_language,
                                "speaker_diarization": upload_speaker_diarization,
                                "max_speakers": upload_max_speakers,
                                "status": "IN_PROGRESS",
                                "timestamp": datetime.now().isoformat()
                            }
                            
                            st.info(f"트랜스크립션 작업이 시작되었습니다. 작업 ID: {job_id}")
                            st.info("처리가 완료되면 결과가 표시됩니다. 처리 시간은 파일 길이에 따라 다를 수 있습니다.")
                            
                            # 작업 상태 확인 버튼 추가
                            check_button_key = f"check_upload_{job_id}"
                            if st.button("작업 상태 확인", key=check_button_key):
                                job_result = check_job_status(job_id)
                                
                                # 자동으로 작업 상태 확인 시작
                                if job_result and job_result.get("status") != "COMPLETED":
                                    st.info("10초마다 자동으로 상태를 확인합니다...")
                                    
                                    # 진행 상태 표시
                                    progress_bar = st.progress(0)
                                    status_text = st.empty()
                                    
                                    for i in range(10):
                                        # 진행 상태 업데이트
                                        progress_bar.progress((i + 1) * 10)
                                        status_text.text(f"대기 중... ({i + 1}/10)")
                                        
                                        # 잠시 대기
                                        time.sleep(10)
                                        
                                        # 상태 확인
                                        job_result = check_job_status(job_id)
                                        if job_result and job_result.get("status") == "COMPLETED":
                                            break
                    else:
                        st.error(f"파일 업로드 실패: {response.text}")
                except Exception as e:
                    st.error(f"파일 업로드 중 오류 발생: {str(e)}")
                    logger.error(f"파일 업로드 오류: {str(e)}", exc_info=True)

# 이전 작업 결과 확인 섹션
# 이전 작업 결과 확인 섹션
st.header("이전 작업 결과 확인")

# 저장된 작업 목록 표시
if st.session_state.transcription_jobs:
    st.write("### 최근 작업 목록")
    
    # 작업을 시간순으로 정렬 (최신 작업이 먼저 표시되도록)
    sorted_jobs = sorted(
        st.session_state.transcription_jobs.items(),
        key=lambda x: x[1].get("timestamp", ""),
        reverse=True
    )
    
    for job_id, job_info in sorted_jobs:
        with st.expander(f"{job_info.get('file_name', '알 수 없는 파일')} ({job_id})"):
            st.write(f"**상태:** {job_info.get('status', '알 수 없음')}")
            st.write(f"**언어:** {job_info.get('language', '알 수 없음')}")
            st.write(f"**화자 구분:** {'활성화' if job_info.get('speaker_diarization') else '비활성화'}")
            st.write(f"**처리 시간:** {job_info.get('timestamp', '알 수 없음')}")
            
            # 완료된 작업인 경우 트랜스크립션 결과 표시
            if job_info.get("status") == "COMPLETED" and "transcript" in job_info:
                transcript = job_info["transcript"]
                
                # 화자 구분이 있는 경우 더 보기 좋게 표시
                if "[spk_" in transcript or "[speaker_" in transcript:
                    st.write("#### 트랜스크립션 결과")
                    lines = transcript.split('\n')
                    for line in lines:
                        if line.strip():
                            # 화자 레이블 추출
                            speaker_match = re.search(r'\[(spk_\d+|speaker_\d+)\]', line)
                            if speaker_match:
                                speaker = speaker_match.group(1)
                                text = line.replace(f"[{speaker}]", "").strip()
                                st.markdown(f"**{speaker}**: {text}")
                            else:
                                st.markdown(line)
                else:
                    # 일반 텍스트 표시
                    st.text_area(f"트랜스크립션 결과 ({job_id})", transcript, height=200)
            
            # 작업 상태 확인 버튼
            check_button_key = f"check_history_{job_id}"
            if st.button("상태 확인", key=check_button_key):
                check_job_status(job_id)
else:
    st.info("아직 처리된 작업이 없습니다.")

# 작업 ID로 직접 확인
st.write("### 작업 ID로 결과 확인")
job_id_input = st.text_input("작업 ID 입력")
if st.button("결과 확인") and job_id_input:
    check_job_status(job_id_input)

# 백엔드 상태 확인
@st.cache_resource
def check_backend_health():
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.status_code == 200:
            return True, "Backend is healthy"
        else:
            return False, f"Backend returned status code: {response.status_code}"
    except requests.exceptions.RequestException as e:
        return False, f"Cannot connect to backend: {str(e)}"

# UI에 백엔드 상태 표시
backend_healthy, message = check_backend_health()
if not backend_healthy:
    st.sidebar.error(f"백엔드 연결 문제: {message}")
    st.sidebar.info("백엔드 서버가 실행 중인지 확인하세요.")
else:
    st.sidebar.success("백엔드 연결 상태: 정상")

    # 백엔드 기능 정보 가져오기
    try:
        features_response = requests.get(f"{BACKEND_URL}/features", timeout=5)
        if features_response.status_code == 200:
            features = features_response.json()
            
            with st.sidebar.expander("백엔드 기능 정보"):
                st.write(f"**지원 언어:** {', '.join(features.get('supported_languages', []))}")
                st.write(f"**화자 구분 지원:** {'예' if features.get('speaker_diarization') else '아니오'}")
                st.write(f"**최대 화자 수:** {features.get('max_speakers', '알 수 없음')}")
                st.write(f"**샘플 레이트:** {features.get('sample_rate', '알 수 없음')} Hz")
                st.write(f"**SDK 버전:** {features.get('sdk_version', '알 수 없음')}")
    except:
        pass
