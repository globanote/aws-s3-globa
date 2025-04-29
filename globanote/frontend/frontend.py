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
import base64
from dotenv import load_dotenv


# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# 백엔드 서버 설정
BACKEND_URL = "http://localhost:8000"
WEBSOCKET_URL = "ws://localhost:8000/ws"

# pormpt arn 환경변수 설정
PROMPT_ARN1 = os.getenv("PROMPT_ARN1")
PROMPT_ARN2 = os.getenv("PROMPT_ARN2")
PROMPT_ARN3 = os.getenv("PROMPT_ARN3")


# 페이지 설정
st.set_page_config(page_title="음성 인식 및 요약 앱", page_icon="🎤", layout="wide")

# 세션 상태 초기화
if "transcript" not in st.session_state:
    st.session_state.transcript = []
if "is_recording" not in st.session_state:
    st.session_state.is_recording = False
if "transcription_jobs" not in st.session_state:
    st.session_state.transcription_jobs = {}
if "session_id" not in st.session_state:
    st.session_state.session_id = str(uuid.uuid4())
if "summaries" not in st.session_state:
    st.session_state.summaries = {}

# 제목 및 설명
st.title("🎤 음성 인식 및 요약 앱")
st.markdown(
    """이 앱은 음성을 텍스트로 변환하고 요약합니다. 두 가지 방법으로 사용할 수 있습니다:
1. 마이크로 직접 녹음하기
2. 오디오 파일 업로드하기

영어와 한국어를 지원하며, 최대 10명까지 화자를 구분할 수 있습니다.
"""
)

MEETING_TYPE_PROMPT_MAP = {
    "정보 공유 회의": {
        "description": "공지사항, 새 소식, 진행 상황 등을 전달하기 위한 회의",
        "prompt_arn": PROMPT_ARN1
    },
    "의사 결정 회의": {
        "description": "특정 사안에 대한 결정을 내리기 위한 회의",
        "prompt_arn": PROMPT_ARN2
    },
    "문제 해결 회의": {
        "description": "특정 문제나 장애를 해결하기 위해 아이디어를 모으는 회의",
        "prompt_arn": PROMPT_ARN3
    }
}

# 드롭다운 UI
MEETING_TYPE_LIST = list(MEETING_TYPE_PROMPT_MAP.keys())
selected_meeting_type = st.selectbox(
    "회의 종류를 선택하세요",
    MEETING_TYPE_LIST,
    help="\n".join([f"{k}: {v['description']}" for k, v in MEETING_TYPE_PROMPT_MAP.items()])
)
selected_prompt_arn = MEETING_TYPE_PROMPT_MAP[selected_meeting_type]["prompt_arn"]

# 요약 생성 함수 (순수 텍스트)
def generate_summary(job_id, prompt_arn):
    try:
        with st.spinner("요약 생성 중..."):
            response = requests.post(
                f"{BACKEND_URL}/summarize-transcript",
                data={"job_id": job_id, "prompt_arn": prompt_arn}
            )
            if response.status_code == 200:
                result = response.json()
                summary = result.get("summary", "")
                summary = re.sub(r'<.*?>', '', summary)
                st.session_state.summaries[job_id] = summary
                return summary
            else:
                st.error(f"요약 생성 실패: {response.text}")
                return None
    except Exception as e:
        st.error(f"요약 생성 중 오류 발생: {str(e)}")
        return None

# 작업 상태 확인 함수
def check_job_status(job_id):
    try:
        with st.spinner("작업 상태 확인 중..."):
            response = requests.get(f"{BACKEND_URL}/job-status/{job_id}")
            if response.status_code == 200:
                result = response.json()
                status = result.get("status")

                if job_id in st.session_state.transcription_jobs:
                    st.session_state.transcription_jobs[job_id]["status"] = status

                if status == "COMPLETED":
                    st.success("트랜스크립션이 완료되었습니다!")
                    transcript = result.get("transcript", "")
                    if transcript:
                        st.write("### 트랜스크립션 결과")
                        show_transcript_formatted(transcript)

                        if job_id in st.session_state.transcription_jobs:
                            st.session_state.transcription_jobs[job_id]["transcript"] = transcript
                            st.session_state.transcript.append(transcript)

                        if st.button("요약 생성", key=f"summarize_{job_id}"):
                            summary = generate_summary(job_id, selected_prompt_arn)
                            if summary:
                                st.write("### 요약 결과")
                                st.text_area("요약", summary, height=200, key=f"summary_result_{job_id}")

                        if job_id in st.session_state.summaries:
                            st.write("### 요약 결과")
                            st.text_area(
                                "요약",
                                st.session_state.summaries[job_id],
                                height=200,
                                key=f"existing_summary_{job_id}",
                            )

                        if "text_url" in result:
                            st.markdown(f"[텍스트 파일 다운로드]({result['text_url']})")
                        if "local_text_path" in result:
                            st.info(
                                f"텍스트 파일 저장 경로: {result['local_text_path']}"
                            )
                    else:
                        st.warning("트랜스크립션 결과가 없습니다.")
                elif status == "FAILED":
                    st.error(
                        f"트랜스크립션 작업 실패: {result.get('error', '알 수 없는 오류')}"
                    )
                else:
                    st.info(f"현재 작업 상태: {status}")
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

# 트랜스크립트 표시 함수 (시간 순서 & 화자별 출력)
def show_transcript_formatted(transcript: str):
    lines = transcript.split("\n")
    for line in lines:
        if line.strip():
            # [화자N] (00:00~00:03) 텍스트
            match = re.match(r"\[화자(\d+)\] \((\d{2}:\d{2}~\d{2}:\d{2})\) (.+)", line)
            if match:
                speaker_num = match.group(1)
                time_range = match.group(2)
                text = match.group(3)
                st.markdown(f"<div style='margin-bottom: 10px;'><strong>[화자{speaker_num}]</strong> <span style='color:gray'>({time_range})</span> {text}</div>", unsafe_allow_html=True)
            else:
                # 이전 방식 호환: [spk_0] 또는 [speaker_0] 등
                speaker_match = re.search(r"\[(spk_(\d+)|speaker_(\d+))\]", line)
                if speaker_match:
                    speaker_num = int(speaker_match.group(2) or speaker_match.group(3)) + 1
                    speaker_label = f"[화자{speaker_num}]"
                    text = re.sub(r"\[spk_\d+\]|\[speaker_\d+\]", "", line).strip()
                    st.markdown(f"<div style='margin-bottom: 10px;'><strong>{speaker_label}</strong> {text}</div>", unsafe_allow_html=True)
                else:
                    st.markdown(line)

# WAV를 MP3로 변환하는 함수
def convert_wav_to_mp3(wav_data, output_filename):
    try:
        temp_wav_filename = f"temp_{uuid.uuid4()}.wav"
        with open(temp_wav_filename, "wb") as f:
            f.write(wav_data)

        sound = AudioSegment.from_wav(temp_wav_filename)
        sound.export(output_filename, format="mp3", bitrate="128k")

        os.remove(temp_wav_filename)
        return True
    except Exception as e:
        logger.error(f"MP3 변환 오류: {str(e)}", exc_info=True)
        return False

# 녹음된 오디오 처리 함수
def process_recorded_audio(
    audio_data, language, enable_speaker_diarization, max_speaker_count
):
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        mp3_filename = f"recorded_audio_{timestamp}.mp3"

        conversion_success = convert_wav_to_mp3(audio_data.getvalue(), mp3_filename)

        if conversion_success:
            mp3_size = os.path.getsize(mp3_filename)
            st.info(f"MP3 파일 생성 완료: {mp3_filename} ({mp3_size} 바이트)")

            with open(mp3_filename, "rb") as mp3_file:
                mp3_bytes = mp3_file.read()
                st.audio(mp3_bytes, format="audio/mp3")

            job_id = process_audio_file(
                mp3_filename,
                mp3_filename,
                "audio/mp3",
                language,
                enable_speaker_diarization,
                max_speaker_count,
            )
            if os.path.exists(mp3_filename):
                os.remove(mp3_filename)

            return job_id
        else:
            st.warning("MP3 변환 실패, WAV 파일로 전송합니다.")

            wav_filename = f"recorded_audio_{timestamp}.wav"
            with open(wav_filename, "wb") as f:
                f.write(audio_data.getvalue())

            job_id = process_audio_file(
                wav_filename,
                wav_filename,
                "audio/wav",
                language,
                enable_speaker_diarization,
                max_speaker_count,
            )

            if os.path.exists(wav_filename):
                os.remove(wav_filename)

            return job_id
    except Exception as e:
        st.error(f"녹음 오디오 처리 오류: {str(e)}")
        logger.error(f"녹음 오디오 처리 오류: {str(e)}", exc_info=True)
        return None

# 오디오 파일 처리 함수 (녹음 & 업로드 공통)
def process_audio_file(
    file_path,
    file_name,
    file_type,
    language,
    enable_speaker_diarization,
    max_speaker_count,
):
    try:
        with st.spinner("오디오 파일 처리 중..."):
            with open(file_path, "rb") as audio_file:
                files = {"audio_file": (file_name, audio_file, file_type)}
                data = {
                    "language_code": language,
                    "enable_speaker_diarization": json.dumps(
                        enable_speaker_diarization
                    ),
                    "max_speaker_count": str(max_speaker_count),
                }
                response = requests.post(
                    f"{BACKEND_URL}/upload-audio", files=files, data=data
                )

            if response.status_code == 200:
                result = response.json()
                job_id = result.get("job_id")

                if job_id:
                    st.success("오디오 업로드 및 트랜스크립션 시작 성공!")
                    st.info(f"트랜스크립션 작업 ID: {job_id}")

                    st.session_state.transcription_jobs[job_id] = {
                        "file_name": file_name,
                        "language": language,
                        "speaker_diarization": enable_speaker_diarization,
                        "max_speakers": max_speaker_count,
                        "status": "IN_PROGRESS",
                        "timestamp": datetime.now().isoformat(),
                    }
                    return job_id
                else:
                    st.error("작업 ID를 받지 못했습니다.")
                    return None
            else:
                st.error(f"오디오 업로드 실패: {response.text}")
                return None
    except Exception as e:
        st.error(f"오디오 처리 오류: {str(e)}")
        logger.error(f"오디오 처리 오류: {str(e)}", exc_info=True)
        return None

# --- (이하 탭1, 탭2 구현부) ---

tab1, tab2 = st.tabs(["마이크 녹음", "음성 파일 업로드"])

with tab1:
    with st.sidebar:
        st.header("녹음 설정")
        language = st.selectbox(
            "언어 선택",
            options=[("영어", "en-US"), ("한국어", "ko-KR")],
            format_func=lambda x: x[0],
            index=1,
        )[1]
        enable_speaker_diarization = st.checkbox("화자 구분 활성화", value=True)
        max_speaker_count = 2
        if enable_speaker_diarization:
            max_speaker_count = st.slider(
                "최대 화자 수", min_value=2, max_value=10, value=6
            )

    st.header("마이크 녹음")
    audio_data = st.audio_input("마이크로 녹음하기", key="audio_recorder")

    if audio_data is not None:
        st.audio(audio_data, format="audio/wav")
        st.info(f"오디오 데이터 크기: {len(audio_data.getvalue())} 바이트")

        if st.button("음성 인식 시작", key="start_recognition"):
            job_id = process_recorded_audio(
                audio_data, language, enable_speaker_diarization, max_speaker_count
            )
            if job_id:
                if st.button("작업 상태 확인", key=f"check_mic_{job_id}"):
                    check_job_status(job_id)

    st.header("음성 인식 결과")
    transcript_container = st.container()
    with transcript_container:
        if st.session_state.transcript:
            for text in st.session_state.transcript:
                show_transcript_formatted(text)
        else:
            st.info("녹음을 시작하면 여기에 텍스트가 표시됩니다.")

with tab2:
    st.header("음성 파일 업로드")
    st.markdown(
        """
    업로드한 음성 파일을 텍스트로 변환합니다. 지원 형식: MP3, WAV, FLAC, OGG
    """
    )

    with st.sidebar:
        st.header("파일 업로드 설정")
        upload_language = st.selectbox(
            "언어 선택 (업로드 파일용)",
            options=[("영어", "en-US"), ("한국어", "ko-KR")],
            format_func=lambda x: x[0],
            index=1,
        )[1]
        upload_speaker_diarization = st.checkbox(
            "화자 구분 활성화 (업로드 파일용)", value=True
        )
        upload_max_speakers = 2
        if upload_speaker_diarization:
            upload_max_speakers = st.slider(
                "최대 화자 수 (업로드 파일용)", min_value=2, max_value=10, value=6
            )
    uploaded_file = st.file_uploader(
        "음성 파일 선택", type=["mp3", "wav", "flac", "ogg"]
    )

    if uploaded_file is not None:
        st.audio(uploaded_file, format=uploaded_file.type)
        if st.button("파일 처리 시작"):
            try:
                file_content = uploaded_file.getvalue()
                file_ext = os.path.splitext(uploaded_file.name)[1].lower()
                temp_filename = f"temp_{uuid.uuid4()}{file_ext}"
                with open(temp_filename, "wb") as f:
                    f.write(file_content)

                job_id = process_audio_file(
                    temp_filename,
                    uploaded_file.name,
                    uploaded_file.type,
                    upload_language,
                    upload_speaker_diarization,
                    upload_max_speakers,
                )

                if os.path.exists(temp_filename):
                    os.remove(temp_filename)

                if job_id:
                    if st.button("작업 상태 확인", key=f"check_upload_{job_id}"):
                        check_job_status(job_id)
            except Exception as e:
                st.error(f"파일 업로드 중 오류 발생: {str(e)}")
                logger.error(f"파일 업로드 오류: {str(e)}", exc_info=True)

# --- 이하 이전 작업 목록, 직접 작업ID 입력 조회 등은 그대로 유지 (필요 시 추가 수정 가능) ---

st.header("이전 작업 결과 확인")

# 저장된 작업 목록 표시
if st.session_state.transcription_jobs:
    st.write("### 최근 작업 목록")

    # 작업을 시간순으로 정렬 (최신 작업이 먼저 표시되도록)
    sorted_jobs = sorted(
        st.session_state.transcription_jobs.items(),
        key=lambda x: x[1].get("timestamp", ""),
        reverse=True,
    )

    for job_id, job_info in sorted_jobs:
        with st.expander(f"{job_info.get('file_name', '알 수 없는 파일')} ({job_id})"):
            st.write(f"**상태:** {job_info.get('status', '알 수 없음')}")
            st.write(f"**언어:** {job_info.get('language', '알 수 없음')}")
            st.write(
                f"**화자 구분:** {'활성화' if job_info.get('speaker_diarization') else '비활성화'}"
            )
            st.write(f"**처리 시간:** {job_info.get('timestamp', '알 수 없음')}")

            # 완료된 작업인 경우 트랜스크립션 결과 표시
            if job_info.get("status") == "COMPLETED" and "transcript" in job_info:
                transcript = job_info["transcript"]

                # 화자 구분이 있는 경우 더 보기 좋게 표시
                if "[spk_" in transcript or "[speaker_" in transcript:
                    st.write("#### 트랜스크립션 결과")
                    show_transcript_formatted(transcript)
                else:
                    # 일반 텍스트 표시
                    st.text_area(
                        f"트랜스크립션 결과 ({job_id})",
                        transcript,
                        height=200,
                        key=f"history_transcript_{job_id}",
                    )

                # 요약 버튼 추가
                if st.button("요약 생성", key=f"summarize_{job_id}"):
                    summary = generate_summary(job_id, selected_prompt_arn)
                    if summary:
                        st.write("### 요약 결과")
                        st.text_area("요약", summary, height=200, key=f"summary_result_{job_id}")
                # 이미 요약이 있는 경우 표시
                if job_id in st.session_state.summaries:
                    st.write("#### 요약 결과")
                    st.text_area(
                        "요약",
                        st.session_state.summaries[job_id],
                        height=150,
                        key=f"history_summary_existing_{job_id}",
                    )

            # 작업 상태 확인 버튼
            check_button_key = f"check_history_{job_id}"
            if st.button("상태 확인", key=check_button_key):
                check_job_status(job_id)
else:
    st.info("아직 처리된 작업이 없습니다.")

# 작업 ID로 직접 확인
st.write("### 작업 ID로 결과 확인")
job_id_input = st.text_input("작업 ID 입력")
if job_id_input:
    col1, col2 = st.columns(2)
    with col1:
        if st.button("결과 확인"):
            check_job_status(job_id_input)
    with col2:
        if st.button("요약 생성", key=f"summarize_direct_{job_id_input}"):
            summary = generate_summary(job_id_input)
            if summary:
                st.write("#### 요약 결과")
                st.text_area(
                    "요약", summary, height=150, key=f"direct_summary_{job_id_input}"
                )

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
                st.write(
                    f"**지원 언어:** {', '.join(features.get('supported_languages', []))}"
                )
                st.write(
                    f"**화자 구분 지원:** {'예' if features.get('speaker_diarization') else '아니오'}"
                )
                st.write(
                    f"**최대 화자 수:** {features.get('max_speakers', '알 수 없음')}"
                )
                st.write(
                    f"**녹음 지원:** {'예' if features.get('recording_enabled', True) else '아니오'}"
                )
                st.write(
                    f"**파일 업로드 지원:** {'예' if features.get('file_upload_enabled', True) else '아니오'}"
                )
                st.write(
                    f"**Bedrock 지원:** {'예' if features.get('bedrock_enabled') else '아니오'}"
                )
    except:
        pass
