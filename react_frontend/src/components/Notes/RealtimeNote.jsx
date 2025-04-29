import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MicRecorder from 'mic-recorder-to-mp3';
import '../../styles/notes.css';

const Mp3Recorder = new MicRecorder({ bitRate: 128 });

function RealtimeNote() {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [notes, setNotes] = useState([
    { time: '14:29', content: '금리에서 회의 진행 건에 관련해 회의를 진행하려고 합니다. 먼저는 오신 것들이 일지명해드리겠습니다.' },
    { time: '14:31', content: '금리 3.15%는 일반적이며, 이것이 어떤 의견 있으신가요? 전체 투표는개인과 사업자 평이나 같은 룰로 합니다.' }
  ]);
  const [messages, setMessages] = useState([
    { role: 'system', content: '어떤 도움이 필요하신가요?', time: '14:25' }
  ]);
  const [input, setInput] = useState('');

  // mp3 녹음 결과 blob 저장
  const audioBlobRef = useRef(null);

  // 녹음 시작
  const startRecording = async () => {
    try {
      await Mp3Recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('마이크 접근 권한이 필요합니다.');
      setIsRecording(false);
    }
  };

  // 녹음 중지
  const stopRecording = async () => {
    try {
      const [, blob] = await Mp3Recorder.stop().getMp3(); // buffer 미사용, eslint 경고 해결
      audioBlobRef.current = blob;
      setIsRecording(false);
      
      // 녹음이 완료되면 로컬에 파일 저장
      const audioUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = `recording_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(audioUrl);
    } catch (err) {
      alert('녹음 중 오류가 발생했습니다.');
      setIsRecording(false);
    }
  };

  // 녹음 버튼 토글
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Blob을 base64로 변환
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // 저장하기 버튼 클릭 시 Lambda 호출
  const handleSave = async () => {
    if (!audioBlobRef.current) {
      alert('녹음된 오디오가 없습니다.');
      return;
    }
    try {
      console.log('test1');
      const audioBase64 = await blobToBase64(audioBlobRef.current);
      console.log('test2');
      const response = await fetch('https://4u8cc1twf2.execute-api.ap-northeast-2.amazonaws.com/prod/record-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_data: audioBase64,
          file_format: 'mp3',
        }),
      });
      console.log('test3');
      const result = await response.json();
      
      console.log(result)
      if (result.success) {
        alert('저장 및 S3 업로드 성공!');
        navigate('/ai-meeting-note');
      } else {
        alert('오류: ' + (result.error || '저장 실패'));
      }
    } catch (err) {
      alert('저장 중 오류 발생: ' + err.message);
    }
  };

  // AWS Transcribe API 연동 예시 (더미)
  React.useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setNotes(prev => ([...prev, { time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), content: 'AWS Transcribe에서 받아온 새로운 노트입니다.' }]));
      }, 7000);
      return () => clearInterval(interval);
    }
  }, [isRecording]);

  const handleSendMessage = () => {
    if (!input.trim()) return;
    const newUserMessage = { 
      role: 'user', 
      content: input, 
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
    };
    setMessages([...messages, newUserMessage]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => ([...prev, {
        role: 'assistant',
        content: 'AI 답변 예시입니다.',
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }]));
    }, 1000);
  };

  // 미팅 정보/진행상황 더미
  const meetingInfo = {
    date: '2025/04/22',
    title: '인터뷰',
    purpose: '리더십 역량 중심의 인터뷰 대비 노트',
    duration: '58분',
    participants: 4
  };

  return (
    <div className="realtime-root">
      {/* 좌측: 정보+챗봇 */}
      <aside className="realtime-sidebar">
        <div className="sidebar-card">
          <h3>미팅정보</h3>
          <div className="info-row"><span>미팅 일자</span><span>{meetingInfo.date}</span></div>
          <div className="info-row"><span>미팅 제목</span><span>{meetingInfo.title}</span></div>
          <div className="info-row"><span>미팅 목적</span><span>{meetingInfo.purpose}</span></div>
        </div>
        <div className="sidebar-card">
          <h3>미팅 진행 사항</h3>
          <div className="info-row"><span>미팅시간</span><span>{meetingInfo.duration}</span></div>
          <div className="info-row"><span>참가인원</span><span>{meetingInfo.participants}명</span></div>
        </div>
        <div className="sidebar-card sidebar-chatbot">
          <h3>미팅 챗봇</h3>
          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
                <div className="message-time">{msg.time}</div>
              </div>
            ))}
          </div>
          <div className="chatbot-input">
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)}
              placeholder="챗봇에게 질문하세요..."
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            />
            <button onClick={handleSendMessage}>전송</button>
          </div>
        </div>
      </aside>
      {/* 중앙: 실시간 노트 */}
      <main className="realtime-main">
        <div className="note-title">글로바노트</div>
        <div className="note-card">
          <h3>실시간 노트</h3>
          <div className="note-list">
            {notes.map((note, idx) => (
              <div key={idx} className="note-line">
                <span className="note-time">{note.time}</span>
                <span className="note-content">{note.content}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
      {/* 하단: 녹음바 */}
      <footer className="realtime-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className={`record-btn ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
          >
            <span className="record-dot"></span>
            {isRecording ? '녹음 중지' : '녹음 시작'}
          </button>
          <button className="save-btn" onClick={handleSave}>저장하기</button>
        </div>
      </footer>
    </div>
  );
}

export default RealtimeNote;
