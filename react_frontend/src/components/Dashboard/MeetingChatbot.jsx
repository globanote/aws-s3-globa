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
  당신은 회의 도우미 AI 비서입니다. 회의 일정과 최근 회의 진행사항을 알고 있고, 회의 요약 요청할 경우에는 회의 내용을 요약 요청 템플릿에 맞춰 요약해야 합니다.
  최근 회의 진행사항을 요청할 경우에는 요약을 하지 않고 최근 회의 진행사항을 출력해주세요
  회의 일정 : 2025년 5월 9일 11시~12시까지 공하늘님, 박용현님과 함께 회의 있음.
  최근 회의 진행사항 : "2025년 5월 6일 요금계산회의를 진행했음."
  요약 요청 템플릿 : "다음 회의록을 1페이지 분량으로 요약해 주세요. 주요 안건, 결정 사항, 논의된 핵심 내용, 액션 아이템을 포함해 명확하고 간결하게 정리해 주세요. 문단 구분 없이 항목 중심으로 서술해 주세요. "
  요금 계산 회의 내용 : "[화자1] (00:01~00:02) 네
  [화자1] (00:03~00:04) W
  [화자1] (00:05~00:07) 에
  [화자1] (00:09~00:10) 네
  [화자1] (00:11~00:11) 그렇죠
  [화자1] (00:12~00:14) 붙어가지고 뭐 하는 것처럼
  [화자1] (00:15~00:16) 기
  [화자1] (00:19~00:21) 아 좋다던데
  [화자1] (00:27~00:34) 한컵 오셔셔
  [화자2] (00:35~00:39) 트랜스크라이브는 진짜 어떻게 계산해야 될지가
  [화자1] (00:40~00:49) 가치가 좀 더 참을 수 있어 너무 큰 거야
  [화자1] (00:50~00:50) 봐야지
  [화자1] (00:51~00:52) 어 일단 먹어야 돼
  [화자1] (00:53~00:55) 지금 지금
  [화자1] (00:56~00:56) 네
  [화자1] (00:57~00:57) 네
  [화자1] (00:58~01:08) 음 안 먹는다고 하면 어 먹으려고 계획하고 있었고 먹을 먹어
  [화자2] (01:08~01:11) 어 근데 그러기에는 요금이 되게 많이
  [화자1] (01:11~01:14) 나왔는데 친구
  [화자1] (01:15~01:17) 네
  [화자1] (01:18~01:21) 아
  [화자1] (01:24~01:26) 제
  [화자1] (01:29~01:32) 일 달러 밑에 사니까
  [화자2] (01:37~01:41) 아 이게 분당 가격이구나
  [화자1] (01:42~01:43) 그러니까
  [화자1] (01:45~01:48) 식사 맛있
  [화자1] (01:48~01:50) 여
  [화자1] (01:51~01:54) 있는데
  [화자2] (01:54~01:59) 잡은 게 삼십 분에
  [화자1] (02:03~02:04) 삼십이
  [화자2] (02:04~02:06) 분에 거에 열두
  [화자1] (02:08~02:10) 아니야 그런 건 다이어트가 아니야
  [화자1] (02:12~02:14) 혹시 어디에서
  [화자2] (02:15~02:28) 삼십 분 단위로 주에 삼 회 하면 한 달에 열두 번으로 계산하면은 팔 점 육사 달러 나 한 명당 네 한 명당
  [화자2] (02:32~02:35) 근데 이 트랜스크라이브는
  [화자2] (02:36~02:43) 사용하는 그 군에 달 따라서 요금이 달라져요
  [화자2] (02:44~03:09) 그러니까 월마다 처음 이십오만 분은 영 점 영이사 달러 거기부터 칠십오만 분까지는 영 점 영이로 백만 분이 초과되면은 영 점 영일 달러로 바뀌거든요 비용 계산하기가 좀 까다롭긴 한데 그냥 영 점 영이사로 계산했을 때는
  [화자2] (03:10~03:18) 사용자 한 명이 삼십 분 단위로 한 달에 열두 번 한다고 했을 때 팔 점 육사
  [화자2] (03:19~03:36) 용현 님이 그 뭐지 잡은 거에 그 사용자 수도 있어요 네 열 명 그러면은 네 주 삼 회 해서 한 달 사 주 잡으면은 트랜스크라이 팔십육 점사 달러.
  [화자2] (03:37~03:38) 네
  [화자2] (03:39~03:40) 그게 맞을 것 같아
  [화자1] (03:42~03:44) 이제 냉동부터만 달라가지고
  [화자1] (03:44~03:45) 그
  [화자1] (03:45~03:49) 기억도 안나 음 좀 낫지 않아
  [화자1] (03:50~03:51) 정말
  [화자1] (03:52~03:53) 기다려
  [화자1] (03:53~03:55) 시
  [화자1] (03:55~03:58) 선물처럼 이번주
  [화자1] (03:59~04:01) 안먹으면 안된다고
  [화자1] (04:02~04:03) 그
  [화자2] (04:05~04:09) 와 근데 트랜스크라이브 진짜 돈 많이 나가요
  [화자1] (04:10~04:12) 그런 거 보기 싫어해서
  [화자2] (04:14~04:22) 트랜스크라이브는 또 요금 티어가 세 개로 나눠놔가지고"
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
        content: '안녕하세요! 회의 도우미입니다. 회의 일정이나 진행사항에 대해 질문해 주세요.',
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
