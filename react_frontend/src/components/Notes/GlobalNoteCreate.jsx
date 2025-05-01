import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context'; // Cognito 사용자 정보 사용을 위해 추가
import '../../styles/notes.css';

function GlobalNoteCreate() {
  const navigate = useNavigate();
  const auth = useAuth(); // auth 추가
  
  const [mode, setMode] = useState(null); // 'create' | 'upload' | null
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // 사용자 정보 가져오기
  const getUserId = () => {
    if (auth.isAuthenticated && auth.user) {
      return auth.user.profile.sub || 'guest-user';
    }
    return 'guest-user';
  };

  // 새노트 생성
  const handleCreate = () => {
    // 실제로는 서버에 저장 후 이동
    navigate('/realtime-note');
  };

  // Presigned URL 요청 - 수정됨
  const getPresignedUrl = async (file) => {
    try {
      const userId = getUserId();
      // 파일 확장자 가져오기
      const fileExtension = file.name.split('.').pop();
      // 고유한 파일명 생성 (타임스탬프 + 랜덤 문자열)
      const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;
      
      // API 요청 데이터
      const requestData = {
        bucket: "globa-audio-bucket",
        key: uniqueFilename,
        content_type: file.type,
        user_id: userId
      };
      
      console.log('Sending presigned URL request with data:', requestData);
      
      // mode: 'cors' 명시적 지정 및 기타 헤더 추가
      const response = await fetch('https://8gszri48w4.execute-api.ap-northeast-2.amazonaws.com/prod/presign', {
        method: 'POST',
        mode: 'cors', // CORS 모드 명시적 설정
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Presigned URL response:', data);
      return data.url;
    } catch (error) {
      console.error('Error getting presigned URL:', error);
      throw error;
    }
  };

  // 테스트용 직접 업로드 함수
  const directFileUpload = async () => {
    if (!file) return;
    
    try {
      setUploadStatus('uploading');
      setUploadProgress(10); // 초기 진행 상태 표시
      
      // FormData 사용하여 파일 직접 업로드
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', getUserId());
      
      // 프록시 서버나 직접 업로드 엔드포인트가 있다면 사용
      const uploadResponse = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('File upload failed');
      }
      
      setUploadStatus('success');
      setUploadProgress(100);
      
      return true;
    } catch (error) {
      console.error('Direct upload failed:', error);
      setUploadStatus('error');
      setErrorMessage(error.message || '업로드 중 오류가 발생했습니다');
      return false;
    }
  };

  // S3에 파일 업로드 - 수정됨
  const uploadToS3 = async (presignedUrl, file) => {
    try {
      console.log('Uploading file to:', presignedUrl);
      
      // 파일 업로드 진행 상황 모니터링을 위한 XMLHttpRequest 사용
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentComplete);
            console.log(`Upload progress: ${percentComplete}%`);
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('Upload successful');
            resolve(xhr.response);
          } else {
            console.error('Upload failed with status:', xhr.status);
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });
        
        xhr.addEventListener('error', (e) => {
          console.error('XHR error event:', e);
          reject(new Error('Upload failed due to network error'));
        });
        
        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
    } catch (error) {
      console.error('Error in uploadToS3:', error);
      throw error;
    }
  };

  // 파일 업로드 처리 - 수정됨
  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploadStatus('uploading');
      setUploadProgress(0);
      console.log('Starting upload process for file:', file.name);

      // Presigned URL 요청
      console.log('Requesting presigned URL...');
      const presignedUrl = await getPresignedUrl(file);
      console.log('Received presigned URL:', presignedUrl);
      
      // 파일 업로드
      console.log('Starting S3 upload...');
      await uploadToS3(presignedUrl, file);
      
      setUploadStatus('success');
      setUploadProgress(100);
      console.log('Upload completed successfully');
    } catch (error) {
      console.error('Upload process failed:', error);
      setUploadStatus('error');
      setErrorMessage(error.message || '업로드 중 오류가 발생했습니다.');
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