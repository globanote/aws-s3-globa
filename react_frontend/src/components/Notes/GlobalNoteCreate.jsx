import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/notes.css';

function GlobalNoteCreate() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // 'create' | 'upload' | null
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // 새노트 생성
  const handleCreate = () => {
    // 실제로는 서버에 저장 후 이동
    navigate('/realtime-note');
  };

  // Presigned URL 요청
  const getPresignedUrl = async (file) => {
    try {
      const response = await fetch('https://8gszri48w4.execute-api.ap-northeast-2.amazonaws.com/prod/presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucket: 'globa-audio-bucket',
          key: `/test-user-123/recordings/${Date.now()}-${file.name}`,
          content_type: file.type,
          user_id: 'test-user-123' // 실제 구현시 사용자 ID를 동적으로 설정
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get presigned URL');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Error getting presigned URL:', error);
      throw error;
    }
  };

  // S3에 파일 업로드
  const uploadToS3 = async (presignedUrl, file) => {
    try {
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      return response;
    } catch (error) {
      console.error('Error uploading to S3:', error);
      throw error;
    }
  };

  // 파일 업로드 처리
  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploadStatus('uploading');
      setUploadProgress(0);

      // Presigned URL 요청
      const presignedUrl = await getPresignedUrl(file);
      
      // 파일 업로드
      await uploadToS3(presignedUrl, file);
      
      setUploadStatus('success');
      setUploadProgress(100);
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error.message);
    }
  };

  // 드래그 앤 드롭
  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('audio/')) {
      setFile(droppedFile);
      setUploadStatus('idle');
      setErrorMessage('');
    } else {
      setErrorMessage('오디오 파일만 업로드 가능합니다.');
    }
  };

  // 파일 선택 처리
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

  // 업로드 재시도
  const handleRetry = () => {
    setUploadStatus('idle');
    setErrorMessage('');
  };

  // AI 미팅 노트 페이지로 이동
  const handleNavigateToAIMeetingNote = () => {
    navigate('/ai-meeting-note');
  };

  // 업로드 취소 및 초기화
  const handleCancel = () => {
    setFile(null);
    setUploadStatus('idle');
    setErrorMessage('');
  };

  return (
    <div className="global-note-create-root">
      <div className="global-note-create-card">
        <h2>글로바노트 생성</h2>
        {!mode && (
          <div className="global-note-create-btns">
            <button className="main-btn" onClick={() => setMode('create')}>새 노트 생성</button>
            <button className="main-btn" onClick={() => setMode('upload')}>녹음 파일 업로드</button>
          </div>
        )}

        {mode === 'create' && (
          <div className="note-create-form animated">
            <h3>새 노트 생성</h3>
            <div className="form-group">
              <label>노트 제목</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 인터뷰" />
            </div>
            <div className="form-group">
              <label>노트 생성 목적</label>
              <textarea value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="노트의 목적을 입력하세요" />
            </div>
            <div className="form-group">
              <label>태그</label>
              <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="예: #면접 #리더십" />
            </div>
            <div className="form-btns">
              <button className="main-btn" onClick={handleCreate}>생성</button>
              <button className="sub-btn" onClick={() => setMode(null)}>취소</button>
            </div>
          </div>
        )}

        {mode === 'upload' && (
          <div className="note-upload-form animated">
            <h3>녹음 파일 업로드</h3>
            <div
              className={`upload-drop-area ${uploadStatus}`}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => document.getElementById('file-input').click()}
            >
              <input
                id="file-input"
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {uploadStatus === 'uploading' && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <div className="progress-text">업로드 중... {uploadProgress}%</div>
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
                  <div className="error-text">업로드 실패</div>
                  <div className="error-message">{errorMessage}</div>
                </div>
              )}
              {uploadStatus === 'idle' && (
                <>
                  {file ? (
                    <div className="file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <div>클릭하거나 파일을 여기로 드래그하세요</div>
                      <div className="upload-subtitle">지원 형식: MP3, WAV, M4A</div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="form-btns">
              {uploadStatus === 'idle' && (
                <>
                  <button 
                    className="main-btn" 
                    onClick={handleUpload} 
                    disabled={!file}
                  >
                    업로드
                  </button>
                  <button 
                    className="sub-btn" 
                    onClick={handleCancel}
                  >
                    취소
                  </button>
                </>
              )}
              {uploadStatus === 'success' && (
                <>
                  <button 
                    className="main-btn" 
                    onClick={handleNavigateToAIMeetingNote}
                  >
                    AI 미팅 노트로 이동
                  </button>
                  <button 
                    className="sub-btn" 
                    onClick={handleCancel}
                  >
                    새로 업로드
                  </button>
                </>
              )}
              {uploadStatus === 'error' && (
                <>
                  <button 
                    className="main-btn" 
                    onClick={handleRetry}
                  >
                    다시 시도
                  </button>
                  <button 
                    className="sub-btn" 
                    onClick={handleCancel}
                  >
                    취소
                  </button>
                </>
              )}
            </div>
            {errorMessage && uploadStatus !== 'error' && (
              <div className="error-message-container">
                {errorMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GlobalNoteCreate;