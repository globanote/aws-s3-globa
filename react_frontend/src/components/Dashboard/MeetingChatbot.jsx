import React, { useState } from 'react';

function MeetingChatbot() {
  const [messages, setMessages] = useState([
    { role: 'system', content: '대화 하이스토리', time: '10:15' },
    { role: 'user', content: '안녕하세요, 내일 미팅 일정을 알려주세요.', time: '10:16' },
    { role: 'assistant', content: '안녕하세요! 내일 미팅 일정은 다음과 같습니다: 오전 10시 - 팀 스탠드업, 오후 2시 - 클라이언트 미팅입니다.', time: '10:16' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim() === '') return;
    
    const newUserMessage = { role: 'user', content: input, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
    
    setMessages([...messages, newUserMessage]);
    setInput('');
    
    // Simulate AI response (in a real app, this would be an API call)
    setTimeout(() => {
      const newAIMessage = { 
        role: 'assistant', 
        content: '네, 도와드리겠습니다. 더 필요한 정보가 있으신가요?', 
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
      };
      setMessages(prev => [...prev, newAIMessage]);
    }, 1000);
  };

  return (
    <div className="meeting-chatbot">
      <h2>미팅 챗봇</h2>
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
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요..."
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend}>전송</button>
      </div>
    </div>
  );
}

export default MeetingChatbot;