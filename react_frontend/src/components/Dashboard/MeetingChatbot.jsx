import React, { useState, useEffect, useRef } from 'react';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import '../../styles/dashboard.css';

function MeetingChatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  // 사전 정보 정의
  const initialContext = `
  당신은 글로바노트 활용 도우미 AI 비서입니다. 글로바노트 생성방법, AI 미팅노트 활용 방법, 미팅 관리 활용 방법에 대해서 요청하면 알려주세요
  클로바 노트 생성방법 : "좌측 사이드바에서 글로바 노트를 누르면 실시간 녹음과 업로드 버튼이 나옵니다. 실시간 녹음의 경우 회의 제목, 목적, 인원을 입력하고 녹음 시작을 누르면 음성 녹음이 시작됩니다. 회의가 종료되면 녹음 중지를 누르고 회의 생성을 AI 미팅노트에서 확인 가능합니다. 
  업로드도 녹음과 동일하게 제목, 목적, 인원과 더불어 진행날짜를 입력하고 음성파일을 업로드하면 회의가 생성됩니다."
  AI 미팅노트 활용 방법 : "AI 미팅 노트 탭을 누르고 들어가면 Metting History에서 생성한 회의 리스트를 확인할 수 있습니다. 그리고 트랜스크립션 탭에서 History에 있는 회의를 누르면 트랜스크립션이 생성됩니다. AI 회의록 요약 탭에서는 History에 있는 회의를 누르고 요약하고자는 회의 형태를 선택한 후 요약 생성하기를 누르면 회의 요약이 생성됩니다."
  미팅 관리 활용 방법 : "미팅 관리 탭을 누르면 월별, 주별, 일별 캘린더를 확인가능 하며 회의를 예약할 날짜, 시간 등을 선택하면 회의 예약 화면이 나옵니다. 해당 화면에서 제목, 회의 시작/종료시간, 인원, 회의내용을 입력하고 만들기를 누르면 회의 예약이 가능합니다. 예약된 회의에 대한 대시보드는 캘린더 상단에 표시되며, 예약된 회의 리스트는 우측에서 따로 확인 가능하며 회의를 선택하면 수정 및 삭제도 가능합니다."
  `;

  // Initialize Bedrock client
  const bedrockClient = new BedrockRuntimeClient({
    region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 컴포넌트 마운트 시 시스템 메시지 추가
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: '안녕하세요! 글로바노트 활용 도우미입니다. 활용 방법에 대해 궁금한 점이 있으면 질문해 주세요.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, []);

  const handleSend = async () => {
    if (input.trim() === '') return;
    
    const newUserMessage = {
      role: 'user',
      content: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 사전 정보와 대화 내용을 함께 전달
      const messages = [
        {
          role: 'user',
          content: `${initialContext}\n\n${input}`
        }
      ];

      const response = await bedrockClient.send(new InvokeModelCommand({
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1000,
          messages: messages,
        }),
      }));

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      // 응답 구조 확인 및 처리
      let aiResponse = '';
      if (responseBody.content && Array.isArray(responseBody.content)) {
        aiResponse = responseBody.content[0].text;
      } else if (responseBody.content && responseBody.content.text) {
        aiResponse = responseBody.content.text;
      } else {
        console.log('Unexpected response structure:', responseBody);
        aiResponse = '응답 구조를 처리할 수 없습니다.';
      }

      const newAIMessage = {
        role: 'assistant',
        content: aiResponse,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, newAIMessage]);
    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage = {
        role: 'assistant',
        content: '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="meeting-chatbot">
      <h2>미팅 챗봇</h2>
      <div className="chatbot-container">
        <div className="chatbot-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
              <div className="message-time">{msg.time}</div>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant">
              <div className="message-content">답변을 생성하는 중...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chatbot-input">
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요..."
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading}>
          {isLoading ? '전송 중...' : '전송'}
        </button>
      </div>
    </div>
  );
}

export default MeetingChatbot;
