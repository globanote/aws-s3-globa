import React, { useState, useEffect, useRef } from 'react';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import '../../styles/dashboard.css';

function MeetingChatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
      const conversationContext = messages
        .slice(-5)
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const prompt = `${conversationContext}\nUser: ${input}\nAssistant:`;

      const response = await bedrockClient.send(new InvokeModelCommand({
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      }));

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const aiResponse = responseBody.content[0].text;

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