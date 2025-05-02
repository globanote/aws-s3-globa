import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import MicRecorder from 'mic-recorder-to-mp3';
import '../../styles/notes.css';

const Mp3Recorder = new MicRecorder({ bitRate: 128 });

function RealtimeNote() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [notes, setNotes] = useState([
    { time: '14:29', content: '금리에서 회의 진행 건에 관련해 회의를 진행하려고 합니다. 먼저는 오신 것들이 일지명해드리겠습니다.' },
    { time: '14:31', content: '금리 3.15%는 일반적이며, 이것이 어떤 의견 있으신가요? 전체 투표는개인과 사업자 평이나 같은 룰로 합니다.' }
  ]);
  const [messages, setMessages] = useState([
    { role: 'system', content: '어떤 도움이 필요하신가요?', time: '14:25' }
  ]);
  const [input, setInput] = useState('');

  const audioBlobRef = useRef(null);

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

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSave = async () => {
    if (!audioBlobRef.current) {
      alert('녹음된 오디오가 없습니다.');
      return;
    }
    try {
      const audioBase64 = await blobToBase64(audioBlobRef.current);

      if (!auth.isAuthenticated || !auth.user) {
        alert('로그인이 필요합니다.');
        return;
      }

      // id_token 추출
      const idToken = auth.user.id_token || auth.user.idToken;
      if (!idToken) {
        alert('ID 토큰을 가져올 수 없습니다.');
        return;
      }

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken.trim()}`,
        },
        body: JSON.stringify({
          audio_data: audioBase64,
          file_format: 'mp3',
          id_token: idToken // Lambda로 id_token 전달
        }),
      };

      const response = await fetch('https://4u8cc1twf2.execute-api.ap-northeast-2.amazonaws.com/prod/record-audio', requestOptions);
      const result = await response.json();
      
      // 응답 상태와 결과 확인
      if (response.status === 200) {
        console.log('API 요청 성공:', result);
        navigate('/ai-meeting-note');
      } else {
        console.error('API 요청 실패:', {
          status: response.status,
          statusText: response.statusText,
          result: result
        });
      }
    } catch (err) {
      console.error('저장 중 오류 발생:', err.message);
    }
  };

  // AWS Transcribe API 연동 예시 (더미)
  React.useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setNotes(prev => ([...prev, { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), content: 'AWS Transcribe에서 받아온 새로운 노트입니다.' }]));
      }, 7000);
      return () => clearInterval(interval);
    }
  }, [isRecording]);

  const handleSendMessage = () => {
    if (!input.trim()) return;
    const newUserMessage = {
      role: 'user',
      content: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([...messages, newUserMessage]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => ([...prev, {
        role: 'assistant',
        content: 'AI 답변 예시입니다.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
