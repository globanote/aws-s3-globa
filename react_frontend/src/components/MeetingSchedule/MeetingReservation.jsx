import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../../styles/meetingschedule.css';

function MeetingReservation() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedDate = location.state?.date || new Date();
  
  const [meetingInfo, setMeetingInfo] = useState({
    title: '인터뷰',
    time: '10:30',
    duration: 30,
    contact: 'zyv@gmail.com',
    message: '안정적으로 진행해 뵙고싶습니다. 잘부탁드립니다.'
  });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setMeetingInfo({
      ...meetingInfo,
      [name]: value
    });
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    // In a real app, this would send data to the server
    navigate('/');
  };
  
  const timeSlots = ['10:00', '10:30', '11:00', '11:30', '12:00'];

  return (
    <div className="meeting-reservation">
      <h2>미팅 스케줄 예약</h2>
      <div className="reservation-container">
        <div className="left-column">
          <div className="calendar-preview">
            <h3>날짜를 선택하세요.</h3>
            <div className="selected-month">
              {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월
            </div>
            <div className="calendar-mini">
              {/* Calendar mini view would go here */}
              <div className="selected-day">
                {selectedDate.getDate()}
              </div>
            </div>
          </div>
          <div className="time-slots">
            <h3>시간 선택</h3>
            <div className="time-slots-list">
              {timeSlots.map((time, idx) => (
                <div 
                  key={idx} 
                  className={`time-slot ${meetingInfo.time === time ? 'selected' : ''}`}
                  onClick={() => setMeetingInfo({...meetingInfo, time})}
                >
                  {time}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="right-column">
          <h3>미팅 정보</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>미팅 제목</label>
              <input 
                type="text" 
                name="title"
                value={meetingInfo.title}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>미팅 시간</label>
              <div>{meetingInfo.time}</div>
            </div>
            <div className="form-group">
              <label>미팅 기간</label>
              <select 
                name="duration"
                value={meetingInfo.duration}
                onChange={handleChange}
              >
                <option value="30">30분</option>
                <option value="60">60분</option>
                <option value="90">90분</option>
              </select>
            </div>
            <div className="form-group">
              <label>연락처</label>
              <input 
                type="email" 
                name="contact"
                value={meetingInfo.contact}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>미팅 요청 메세지</label>
              <textarea 
                name="message"
                value={meetingInfo.message}
                onChange={handleChange}
                rows="4"
              ></textarea>
            </div>
            <div className="button-group">
              <button type="submit" className="submit-btn">예약</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default MeetingReservation;