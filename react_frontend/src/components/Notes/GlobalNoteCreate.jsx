import React from 'react';
import { useNavigate } from 'react-router-dom';

function GlobalNoteCreate() {
  const navigate = useNavigate();
  
  const handleCreateNew = () => {
    navigate('/realtime-note');
  };
  
  const handleUpload = () => {
    navigate('/ai-meeting-note');
  };

  return (
    <div className="global-note-creation">
      <h2>글로바노트 생성 이벤트</h2>
      <div className="options-container">
        <div className="option-info">
          <ul>
            <li>새 노트를 직접 작성할 수 있고</li>
            <li>녹음 녹화 파일을 업로드하여 자동 분석할 수 있다.</li>
          </ul>
        </div>
        
        <div className="option-buttons">
          <button className="create-btn" onClick={handleCreateNew}>새 노트 생성</button>
          <button className="upload-btn" onClick={handleUpload}>녹화 파일 업로드</button>
        </div>
      </div>
      
      <div className="note-options">
        <div className="note-creation">
          <h3>세노트 생성</h3>
          <div className="note-form">
            <div className="form-group">
              <label>노트 제목</label>
              <input type="text" placeholder="인터뷰" />
            </div>
            <div className="form-group">
              <label>노트 생성 제목</label>
              <textarea placeholder="의미있게 잘 정리된 의미에 맞게 노트"></textarea>
            </div>
            <button className="submit-btn">세 노트 생성</button>
          </div>
        </div>
        
        <div className="upload-option">
          <h3>녹음파일 업로드</h3>
          <div className="upload-area">
            <p>드래그 앤 드랍으로 파일을 이기에 옮겨주세요</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GlobalNoteCreate;