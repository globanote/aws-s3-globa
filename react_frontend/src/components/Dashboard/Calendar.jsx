import React, { useState } from 'react';
import '../../styles/dashboard.css';

function Calendar({ onDateClick, onScheduleClick }) {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 4, 1)); // May 2025
  const today = new Date();
  
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  
  const schedules = [
    { date: new Date(2025, 4, 13), title: '인터뷰', time: '10:30', participants: ['김유리', '박지연'] },
    { date: new Date(2025, 4, 23), title: '일반회의', time: '14:00', participants: ['김유리'] },
    { date: new Date(2025, 4, 24), title: '일간회의(포로젝트)', time: '11:00', participants: ['박지연'] },
    { date: new Date(2025, 4, 25), title: '일간회의(팀미팅)', time: '10:00', participants: ['김유리', '박지연'] },
    { date: new Date(2025, 4, 26), title: '월정리회의', time: '15:00', participants: ['김유리'] },
    { date: new Date(2025, 4, 29), title: '여유계획', time: '16:00', participants: ['박지연'] }
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Create calendar days
  const calendarDays = [];
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  
  // Add weekday headers
  for (let i = 0; i < 7; i++) {
    calendarDays.push(
      <div key={`header-${i}`} className="calendar-cell header">
        {weekdays[i]}
      </div>
    );
  }
  
  // Add empty cells for days before the first day of month
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="calendar-cell empty"></div>);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const hasSchedule = schedules.some(s => 
      s.date.getDate() === day && 
      s.date.getMonth() === currentDate.getMonth() && 
      s.date.getFullYear() === currentDate.getFullYear()
    );
    
    const isToday = 
      day === today.getDate() && 
      currentDate.getMonth() === today.getMonth() && 
      currentDate.getFullYear() === today.getFullYear();
    
    calendarDays.push(
      <div 
        key={`day-${day}`} 
        className={`calendar-cell ${hasSchedule ? 'has-schedule' : ''} ${isToday ? 'today' : ''}`}
        onClick={() => onDateClick(date)}
      >
        {day}
        {hasSchedule && <div className="schedule-indicator"></div>}
      </div>
    );
  }

  return (
    <div className="calendar-container">
      <div className="calendar-left">
        <h2>미팅 스케줄</h2>
        <div className="calendar-header">
          <div className="month-navigation">
            <button onClick={handlePrevMonth} className="month-nav-btn">◀</button>
            <h3>{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h3>
            <button onClick={handleNextMonth} className="month-nav-btn">▶</button>
          </div>
        </div>
        <div className="calendar-grid">
          {calendarDays}
        </div>
      </div>
      <div className="upcoming-schedules">
        <h2>예정된 미팅</h2>
        <ul className="schedule-list">
          {schedules.map((schedule, idx) => (
            <li key={idx} className="schedule-item" onClick={() => onScheduleClick(schedule)}>
              <div className="schedule-date">
                {schedule.date.getMonth() + 1}월 {schedule.date.getDate()}일 ({weekdays[schedule.date.getDay()]})
              </div>
              <div className="schedule-title">{schedule.title}</div>
              <div className="schedule-participants">
                {schedule.participants.map((p, i) => (
                  <span key={i} className="participant">{p}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Calendar;