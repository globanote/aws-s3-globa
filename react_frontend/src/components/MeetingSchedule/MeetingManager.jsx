import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function MeetingManager() {
  const { view } = useParams();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date(2025, 4, 8)); // May 8, 2025
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDate, setCreateDate] = useState(null);

  const meetings = [
    { id: 1, title: 'Project Update', time: '09:00 - 10:00', participants: ['김유리', '박지연', '이민호'], color: 'blue', date: '2025-05-08', desc: '프로젝트 현황 공유 및 이슈 논의' },
    { id: 2, title: 'Team Sync', time: '11:00 - 12:00', participants: ['김유리', '박지연'], color: 'orange', date: '2025-05-08', desc: '팀 업무 동기화' },
    { id: 3, title: 'Client Meeting', time: '15:00 - 16:30', participants: ['김유리', '박지연', '이민호', '정수진'], color: 'red', date: '2025-05-08', desc: '고객사 미팅 및 요구사항 정리' }
  ];

  const changeView = (newView) => {
    navigate(`/meeting-manager/${newView}`);
  };

  // 월/주/일 이동 핸들러
  const handlePrev = () => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (view === 'week') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
    } else if (view === 'day') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1));
    }
  };
  const handleNext = () => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (view === 'week') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
    } else if (view === 'day') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1));
    }
  };

  // 모달: 일정 상세
  const MeetingDetailModal = ({ meeting, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-detail" onClick={e => e.stopPropagation()}>
        <h4>{meeting.title}</h4>
        <div className="modal-time">{meeting.time}</div>
        <div className="modal-desc">{meeting.desc}</div>
        <div className="modal-participants">
          {meeting.participants.map((p, i) => (
            <span key={i} className="modal-participant">{p}</span>
          ))}
        </div>
        <button className="modal-close-btn" onClick={onClose}>닫기</button>
      </div>
    </div>
  );

  // 모달: 일정 생성
  const MeetingCreateModal = ({ date, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-detail" onClick={e => e.stopPropagation()}>
        <h4>일정 생성</h4>
        <div className="modal-time">{date ? `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}` : ''}</div>
        <input className="modal-input" placeholder="제목" />
        <input className="modal-input" placeholder="시간" />
        <textarea className="modal-input" placeholder="설명" />
        <button className="modal-close-btn" onClick={onClose}>닫기</button>
        <button className="modal-save-btn">저장</button>
      </div>
    </div>
  );

  // 캘린더 셀 클릭 핸들러
  const handleCellClick = (date) => {
    setCreateDate(date);
    setShowCreateDialog(true);
  };

  // 일정 클릭 핸들러
  const handleMeetingClick = (meeting) => {
    setSelectedMeeting(meeting);
  };

  // 월별 캘린더 그리드 생성
  const getMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid = [];
    let dayNum = 1;
    for (let i = 0; i < 6; i++) { // 6주
      for (let j = 0; j < 7; j++) {
        if ((i === 0 && j < firstDay) || dayNum > daysInMonth) {
          grid.push(null);
        } else {
          grid.push(new Date(year, month, dayNum));
          dayNum++;
        }
      }
    }
    return grid;
  };

  // 주간 캘린더 날짜 배열 생성
  const getWeekDates = () => {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - start.getDay()); // 일요일
    return Array.from({length: 7}, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  };

  // 일별 캘린더 시간대 배열
  const getDayHours = () => Array.from({length: 12}, (_, i) => i + 8);

  // 캘린더 뷰 렌더링 (월/주/일)
  const renderCalendarView = () => {
    if (view === 'month') {
      const grid = getMonthGrid();
      return (
        <div className="month-view">
          <div className="month-header">
            <h3>{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h3>
          </div>
          <div className="weekday-header">
            {['SUN','MON','TUE','WED','THU','FRI','SAT'].map((d, i) => <div key={i} className="weekday">{d}</div>)}
          </div>
          <div className="month-grid">
            {grid.map((date, idx) => date ? (
              <div
                key={idx}
                className={`calendar-day${date.toDateString() === new Date().toDateString() ? ' current' : ''}`}
                onClick={() => handleCellClick(date)}
              >
                <div className="day-number">{date.getDate()}</div>
                {meetings.filter(m => m.date === `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`).map((m, i) => (
                  <div
                    key={i}
                    className="day-event"
                    style={{backgroundColor: m.color === 'blue' ? '#bfdbfe' : m.color === 'orange' ? '#fed7aa' : '#fecaca'}}
                    onClick={e => { e.stopPropagation(); handleMeetingClick(m); }}
                  >
                    {m.title}
                  </div>
                ))}
              </div>
            ) : <div key={idx} className="calendar-day empty"></div>)}
          </div>
        </div>
      );
    }
    if (view === 'week') {
      const weekDates = getWeekDates();
      return (
        <div className="week-view">
          <div className="week-header">
            <h3>{weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}</h3>
          </div>
          <div className="weekday-header">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => <div key={i} className="weekday">{d}</div>)}
          </div>
          <div className="time-slots">
            {getDayHours().map(hour => (
              <div key={hour} className="time-slot">
                <div className="time-label">{hour}:00</div>
                <div className="time-grid">
                  {weekDates.map((date, j) => (
                    <div key={j} className="time-cell" onClick={() => handleCellClick(date)}></div>
                  ))}
                </div>
              </div>
            ))}
            {/* 예시: 이벤트 표시 (실제 구현시 시간대별 위치 계산 필요) */}
            <div className="week-event" style={{top: '30px', left: '85px', width: '14%', height: '60px', backgroundColor: '#bfdbfe'}} onClick={() => handleMeetingClick(meetings[0])}>
              Project Update
            </div>
            <div className="week-event" style={{top: '120px', left: '85px', width: '14%', height: '60px', backgroundColor: '#fed7aa'}} onClick={() => handleMeetingClick(meetings[1])}>
              Team Sync
            </div>
            <div className="week-event" style={{top: '280px', left: '85px', width: '14%', height: '90px', backgroundColor: '#fecaca'}} onClick={() => handleMeetingClick(meetings[2])}>
              Client Meeting
            </div>
          </div>
        </div>
      );
    }
    if (view === 'day') {
      return (
        <div className="day-view">
          <div className="day-header">
            <h3>{currentDate.toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</h3>
          </div>
          <div className="day-schedule">
            {getDayHours().map(hour => (
              <div key={hour} className="hour-slot" onClick={() => handleCellClick(currentDate)}>
                <div className="hour-label">{hour}:00</div>
                <div className="hour-content"></div>
              </div>
            ))}
            {/* 예시: 이벤트 표시 (실제 구현시 시간대별 위치 계산 필요) */}
            <div className="day-event" style={{top: '30px', left: '80px', right: '20px', height: '60px', backgroundColor: '#bfdbfe'}} onClick={() => handleMeetingClick(meetings[0])}>
              Meeting with HR Team
            </div>
            <div className="day-event" style={{top: '120px', left: '80px', right: '20px', height: '60px', backgroundColor: '#fed7aa'}} onClick={() => handleMeetingClick(meetings[1])}>
              Team Sync
            </div>
            <div className="day-event" style={{top: '280px', left: '80px', right: '20px', height: '90px', backgroundColor: '#fecaca'}} onClick={() => handleMeetingClick(meetings[2])}>
              Client Meeting
            </div>
          </div>
        </div>
      );
    }
    return <div>Invalid view</div>;
  };

  return (
    <div className="meeting-manager2col">
      <div className="manager-main">
        <div className="manager-header">
          <h2>미팅관리</h2>
          <div className="view-selector">
            <button 
              className={`view-btn ${view === 'month' ? 'active' : ''}`}
              onClick={() => changeView('month')}
            >
              Monthly
            </button>
            <button 
              className={`view-btn ${view === 'week' ? 'active' : ''}`}
              onClick={() => changeView('week')}
            >
              Weekly
            </button>
            <button 
              className={`view-btn ${view === 'day' ? 'active' : ''}`}
              onClick={() => changeView('day')}
            >
              Daily
            </button>
          </div>
        </div>
        <div className="calendar-container2">
          <div className="calendar-navigation">
            <button className="prev-btn" onClick={handlePrev}>←</button>
            {renderCalendarView()}
            <button className="next-btn" onClick={handleNext}>→</button>
          </div>
        </div>
      </div>
      <div className="manager-sidebar">
        <h3>예정된 미팅</h3>
        <div className="meeting-list">
          {meetings.map(meeting => (
            <div key={meeting.id} className="meeting-item" onClick={() => handleMeetingClick(meeting)}>
              <div className="meeting-color" style={{backgroundColor: meeting.color === 'blue' ? '#bfdbfe' : meeting.color === 'orange' ? '#fed7aa' : '#fecaca'}}></div>
              <div className="meeting-info">
                <div className="meeting-title">{meeting.title}</div>
                <div className="meeting-time">{meeting.time}</div>
                <div className="meeting-participants">
                  {meeting.participants.map((participant, idx) => (
                    <div key={idx} className="participant-avatar">
                      {participant.charAt(0)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* 일정 상세 모달 */}
        {selectedMeeting && <MeetingDetailModal meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} />}
        {/* 일정 생성 모달 */}
        {showCreateDialog && <MeetingCreateModal date={createDate} onClose={() => setShowCreateDialog(false)} />}
      </div>
    </div>
  );
}

export default MeetingManager;