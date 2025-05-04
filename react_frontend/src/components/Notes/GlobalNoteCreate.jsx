import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import MicRecorder from 'mic-recorder-to-mp3';
import '../../styles/notes.css';

const Mp3Recorder = new MicRecorder({ bitRate: 128 });

function GlobalNoteCreate() {
  const REACT_APP_PRESIGN_API_URL = process.env.REACT_APP_PRESIGN_API_URL;
  const REACT_APP_MEETING_INFO_API_URL = process.env.REACT_APP_MEETING_INFO_API_URL;
  const REACT_APP_RECORD_AUDIO_API_URL = process.env.REACT_APP_RECORD_AUDIO_API_URL;
  const REACT_APP_DOCUMENT_API_URL = process.env.REACT_APP_DOCUMENT_API_URL;
  const REACT_APP_TRANSCRIPT_JOB_API_URL = process.env.REACT_APP_TRANSCRIPT_JOB_API_URL;
  const DOCUMENT_API_KEY = process.env.REACT_APP_DOCUMENT_API_KEY;
  const JOB_TRACKER_API_KEY = process.env.REACT_APP_JOB_TRACKER_API_KEY;

  const navigate = useNavigate();
  const auth = useAuth();

  const [mode, setMode] = useState(null);
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [participants, setParticipants] = useState(2);
  const [meetingDate, setMeetingDate] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  const [isRecording, setIsRecording] = useState(false);
  const audioBlobRef = useRef(null);
  const [file, setFile] = useState(null);

  // 참가 인원 드롭다운 옵션
  const participantOptions = Array.from({ length: 15 }, (_, i) => i + 2);

  // 사용자 정보
  const getIdToken = () => auth.user?.id_token || auth.user?.idToken || '';
  const getUserId = () => auth.user?.profile?.sub || 'guest-user';

  // 유니크 파일명 생성
  const createUniqueFilename = (ext = 'mp3') =>
    `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${ext}`;

  // Presigned URL 요청
  const getPresignedUrl = async (file, uniqueFilename) => {
    const userId = getUserId();
    const requestData = {
      bucket: "globa-audio-bucket",
      key: uniqueFilename,
      content_type: file.type,
      user_id: userId
    };
    const response = await fetch(REACT_APP_PRESIGN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    });
    if (!response.ok) throw new Error('Presigned URL 요청 실패');
    return (await response.json()).url;
  };

  // S3 업로드
  const uploadToS3 = async (presignedUrl, file) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      xhr.addEventListener('load', () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject());
      xhr.addEventListener('error', () => reject());
      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  };

  // blob to base64 변환
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const getMeetingPayload = (meetingId, nowStr, meeting_date, created_at, audio_filename) => ({
    user_id: getUserId(),
    id_token: getIdToken(),
    meeting_id: meetingId,
    title,
    purpose,
    participants_count: participants,
    meeting_date,
    created_at,
    audio_filename
  });

  // 녹음 제어 함수
  const startRecording = async () => {
    try {
      await Mp3Recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('마이크 접근 권한이 필요합니다.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      const [, blob] = await Mp3Recorder.stop().getMp3();
      audioBlobRef.current = blob;
      setIsRecording(false);
    } catch (err) {
      alert('녹음 중 오류가 발생했습니다.');
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // 파일 선택
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type.startsWith('audio/')) {
      setFile(selectedFile);
      setUploadStatus('idle');
      setErrorMessage('');
    } else {
      setErrorMessage('오디오 파일만 업로드 가능합니다.');
    }
  };

  // 실시간 녹음 "생성" 핸들러
  const handleCreate = async () => {
    setErrorMessage('');
    if (!title || !purpose) {
      setErrorMessage('제목과 목적을 입력하세요.');
      return;
    }
    if (!audioBlobRef.current) {
      setErrorMessage('녹음된 오디오가 없습니다.');
      return;
    }
    try {
      const idToken = getIdToken();
      const meetingId = `${getUserId()}-${Date.now()}`;
      const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const meeting_date = meetingDate || nowStr;
      const created_at = nowStr;
      const uniqueFilename = createUniqueFilename('mp3');
      const payload = getMeetingPayload(meetingId, nowStr, meeting_date, created_at, uniqueFilename);
      const audioBase64 = await blobToBase64(audioBlobRef.current);

      // 회의 정보 저장
      const meetingRes = await fetch(REACT_APP_MEETING_INFO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      // 음성파일 저장
      const audioRes = await fetch(REACT_APP_RECORD_AUDIO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          audio_data: audioBase64,
          file_format: 'mp3',
          id_token: idToken,
          meeting_id: meetingId,
          meeting_date,
          created_at,
          audio_filename: uniqueFilename
        }),
      });

      if (audioRes.status === 200 && meetingRes.status === 200) {
        navigate('/ai-meeting-note');
      } else {
        alert("오류가 발생하였습니다.")
        return;
      }
    } catch (err) {
      setErrorMessage(err.message || '저장 중 오류 발생');
    }
  };

  // 업로드 핸들러
  const handleUpload = async () => {
    setErrorMessage('');
    if (!title || !purpose || !meetingDate || !file) {
      setErrorMessage('필수 정보를 모두 입력하세요.');
      return;
    }

    try {
      setUploadStatus('uploading');
      setUploadProgress(0);

      const idToken = getIdToken();
      const userId = getUserId();
      const meetingId = `${userId}-${Date.now()}`;
      const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const fileExtension = file.name.split('.').pop();
      const uniqueFilename = createUniqueFilename(fileExtension);
      const formattedMeetingDate = meetingDate
        ? meetingDate.replace('T', ' ') // T를 공백으로 변경
        : nowStr;

      // 1. S3 업로드
      const presignedUrl = await getPresignedUrl(file, uniqueFilename);
      await uploadToS3(presignedUrl, file);

      // 2. Document API 호출
      const documentRes = await fetch(REACT_APP_DOCUMENT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': DOCUMENT_API_KEY
        },
        body: JSON.stringify({
          userId: userId,
          filePath: `users/${userId}/recordings/${uniqueFilename}`,
          meeting_id: meetingId,
          audio_filename: uniqueFilename
        }),
      });
      if (!documentRes.ok) throw new Error('문서 생성 실패');
      const { requestId } = await documentRes.json();

      // 3. Transcription 트래킹 API 호출
      const trackerRes = await fetch(REACT_APP_TRANSCRIPT_JOB_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': JOB_TRACKER_API_KEY
        },
        body: JSON.stringify({ requestId, action: "track" }),
      });
      if (!trackerRes.ok) throw new Error('트래킹 시작 실패');

      // 4. 회의 정보 저장
      const meetingRes = await fetch(REACT_APP_MEETING_INFO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(getMeetingPayload(
          meetingId,
          nowStr,
          formattedMeetingDate,
          nowStr,
          uniqueFilename
        )),
      });
      if (!meetingRes.ok) throw new Error('회의 정보 저장 실패');

      setUploadStatus('success');
      setUploadProgress(100);
      navigate('/ai-meeting-note');

    } catch (err) {
      setUploadStatus('error');
      setErrorMessage(err.message || '처리 중 오류 발생');
    }
  };

  return (
    <div className="global-note-create-root">
      <div className="global-note-create-card">
        <h2>글로바노트 생성</h2>
        {!mode && (
          <div className="global-note-create-btns">
            <button className="main-btn" onClick={() => setMode('create')}>실시간 녹음</button>
            <button className="main-btn" onClick={() => setMode('upload')}>녹음 파일 업로드</button>
          </div>
        )}
        {mode === 'create' && (
          <div className="note-create-form animated">
            <h3>실시간 음성 녹음 노트 생성</h3>
            <div className="form-group">
              <label>노트 제목</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 인터뷰" />
            </div>
            <div className="form-group">
              <label>노트 생성 목적</label>
              <textarea value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="노트의 목적을 입력하세요" />
            </div>
            <div className="form-group">
              <label>참가 인원</label>
              <select value={participants} onChange={e => setParticipants(Number(e.target.value))}>
                {participantOptions.map(n => (
                  <option key={n} value={n}>{n}명</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>음성 녹음</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  className={`record-btn ${isRecording ? 'recording' : ''}`}
                  onClick={toggleRecording}
                  type="button"
                >
                  <span className="record-dot"></span>
                  {isRecording ? '녹음 중지' : '녹음 시작'}
                </button>
                {audioBlobRef.current && !isRecording && (
                  <span style={{ color: 'green' }}>녹음 완료</span>
                )}
              </div>
            </div>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
            <div className="form-btns">
              <button className="main-btn" onClick={handleCreate}>생성</button>
              <button className="sub-btn" onClick={() => setMode(null)}>취소</button>
            </div>
          </div>
        )}
        {mode === 'upload' && (
          <div className="note-upload-form animated">
            <h3>녹음 파일 업로드 노트 생성</h3>
            <div className="form-group">
              <label>노트 제목</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 인터뷰" />
            </div>
            <div className="form-group">
              <label>노트 생성 목적</label>
              <textarea value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="노트의 목적을 입력하세요" />
            </div>
            <div className="form-group">
              <label>참가 인원</label>
              <select value={participants} onChange={e => setParticipants(Number(e.target.value))}>
                {participantOptions.map(n => (
                  <option key={n} value={n}>{n}명</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>회의 진행 날짜</label>
              <input
                type="datetime-local"
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                placeholder="YYYY-MM-DD HH-mm"
              />
            </div>
            <div className="form-group">
              <label>파일 업로드</label>
              <input type="file" accept="audio/*" onChange={handleFileSelect} />
              {file && <div className="file-info">{file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</div>}
            </div>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
            <div className="form-btns">
              <button className="main-btn" onClick={handleUpload} disabled={!file}>업로드</button>
              <button className="sub-btn" onClick={() => setMode(null)}>취소</button>
            </div>
            {uploadStatus === 'uploading' && (
              <div className="upload-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="progress-text">업로드 중입니다. 잠시만 기다려주세요... 진행률 : {uploadProgress}%</div>
              </div>
            )}
            {uploadStatus === 'success' && (
              <div className="upload-success">
                <div className="success-icon">✓</div>
                <div className="success-text">업로드 완료!</div>
              </div>
            )}
            {uploadStatus === 'error' && (
              <div className="upload-error">
                <div className="error-icon">!</div>
                <div className="error-text">업로드 실패: {errorMessage}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GlobalNoteCreate;
