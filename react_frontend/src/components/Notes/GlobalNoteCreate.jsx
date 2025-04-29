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

  // 새노트 생성
  const handleCreate = () => {
    // 실제로는 서버에 저장 후 이동
    navigate('/realtime-note');
  };

  // 업로드
  const handleUpload = () => {
    // 실제로는 파일 업로드 후 이동
    navigate('/ai-meeting-note');
  };

  // 드래그 앤 드롭
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
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
              className="upload-drop-area"
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              {file ? (
                <div className="file-info">{file.name}</div>
              ) : (
                <div className="upload-placeholder">여기로 파일을 드래그 앤 드롭 하세요</div>
              )}
            </div>
            <div className="form-btns">
              <button className="main-btn" onClick={handleUpload} disabled={!file}>업로드</button>
              <button className="sub-btn" onClick={() => setMode(null)}>취소</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GlobalNoteCreate;