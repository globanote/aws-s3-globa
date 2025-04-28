import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function UpcomingMeeting() {
  const location = useLocation();
  const navigate = useNavigate();
  const meeting = location.state?.meeting || {
    date: new Date(2025, 4, 23),
    title: '일반회의',
    time: '14:00',
    participants: ['김유리', '박지연']
  };
  
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="upcoming-meeting">
      <h2>예약된 미팅</h2>
      <div className="meeting-detail-card">
        <div className="meeting-header">
          <h3 className="meeting-title">{meeting.title}</h3>
          <div className="meeting-date">
            {meeting.date.getMonth() + 1}월 {meeting.date.getDate()}일 ({weekdays[meeting.date.getDay()]})
          </div>
        </div>
        
        <div className="meeting-info">
          <div className="info-group">
            <label>참석자:</label>
            <div className="participants">
              {meeting.participants.map((p, i) => (
                <div key={i} className="participant">
                  <div className="participant-avatar">{p.charAt(0)}</div>
                  <div className="participant-name">{p}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="info-group">
            <label>미팅 주제:</label>
            <div>전반적인 업무 현황 공유</div>
          </div>
          
          <div className="info-group">
            <label>미팅 링크:</label>
            <a href="#" className="meeting-link">https://meeting.zoom.us/j/123456789</a>
          </div>
        </div>
        
        <div className="button-group">
          <button className="edit-btn" onClick={() => navigate('/meeting-reservation', { state: { date: meeting.date } })}>
            미팅 수정
          </button>
          <button className="join-btn">미팅 참여</button>
          <button className="record-btn" onClick={() => navigate('/realtime-note')}>미팅 기록</button>
        </div>
      </div>
      
      <div className="related-documents">
        <h3>관련 문서</h3>
        <ul className="document-list">
          <li className="document-item">
            <div className="document-icon">📄</div>
            <div className="document-name">미팅 아젠다</div>
          </li>
          <li className="document-item">
            <div className="document-icon">📊</div>
            <div className="document-name">프로젝트 현황 보고서</div>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default UpcomingMeeting;