import React, { useState, useEffect, useRef } from 'react'; // 🟢 useRef 추가
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import '../../styles/meetingschedule.css';
import { fetchMeetings, createMeeting, updateMeeting, deleteMeeting } from '../../services/apiService';
function MeetingManager() {
  const { view } = useParams();
  const navigate = useNavigate();
  const calendarRef = useRef(null);
  const auth = useAuth(); // react-oidc-context에서 인증 정보 가져오기
  const [isLoading, setIsLoading] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [createDate, setCreateDate] = useState(null);
  const [calendarView, setCalendarView] = useState('dayGridMonth');
  const [events, setEvents] = useState([
    {
      id: 1,
      title: 'Project Update',
      start: '2025-05-08T09:00:00',
      end: '2025-05-08T10:00:00',
      backgroundColor: '#bfdbfe',
      borderColor: '#3b82f6',
      extendedProps: {
        participants: ['김유리', '박지연', '이민호'],
        desc: '프로젝트 현황 공유 및 이슈 논의'
      }
    },
    {
      id: 2,
      title: 'Team Sync',
      start: '2025-05-08T11:00:00',
      end: '2025-05-08T12:00:00',
      backgroundColor: '#fed7aa',
      borderColor: '#f97316',
      extendedProps: {
        participants: ['김유리', '박지연'],
        desc: '팀 업무 동기화'
      }
    },
    {
      id: 3,
      title: 'Client Meeting',
      start: '2025-05-08T15:00:00',
      end: '2025-05-08T16:30:00',
      backgroundColor: '#fecaca',
      borderColor: '#ef4444',
      extendedProps: {
        participants: ['김유리', '박지연', '이민호', '정수진'],
        desc: '고객사 미팅 및 요구사항 정리'
      }
    }
  ]);

  // 🟢 FullCalendar 뷰 변경을 위한 함수 수정
  const changeView = (newView) => {
    navigate(`/meeting-manager/${newView}`);

    const viewMap = {
      month: 'dayGridMonth',
      week: 'timeGridWeek',
      day: 'timeGridDay'
    };

    const mappedView = viewMap[newView] || 'dayGridMonth';
    setCalendarView(mappedView);

    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.changeView(mappedView);
    }
  };

// 미팅 목록 가져오기
useEffect(() => {
  const loadMeetings = async () => {
    try {
      setIsLoading(true);
      
      // 인증 상태 확인
      if (!auth.isAuthenticated || !auth.user) {
        console.log('사용자가 인증되지 않았습니다. 기본 데이터를 사용합니다.');
        return; // 기본 더미 데이터 유지
      }
      
      // id_token 또는 access_token 가져오기
      const token = auth.user?.id_token || auth.user?.access_token;
      console.log('토큰 타입:', auth.user?.id_token ? 'id_token' : 'access_token');
      console.log('토큰 첫 30자:', token?.substring(0, 30));

      // API 호출하여 미팅 목록 가져오기
      const data = await fetchMeetings(token);
      
      // 응답 데이터 처리
      if (data && data.meetings) {
        console.log('미팅 데이터 수신:', data.meetings.length + '개 항목');
        
        // FullCalendar 형식으로 데이터 변환
        const formattedEvents = data.meetings.map(meeting => ({
          id: meeting.meetingId,
          title: meeting.title,
          start: meeting.start,
          end: meeting.end,
          backgroundColor: meeting.color?.backgroundColor || eventColors.default.backgroundColor,
          borderColor: meeting.color?.borderColor || eventColors.default.borderColor,
          extendedProps: {
            participants: meeting.participants,
            desc: meeting.description || ''
          }
        }));
        
        setEvents(formattedEvents);
      }
    } catch (error) {
      console.error('미팅 목록 로딩 오류:', error);
      // 오류 발생 시 사용자에게 알림 (선택 사항)
      // alert('미팅 목록을 불러오는 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  loadMeetings();
}, [auth.isAuthenticated, auth.user]);

  const handleDateClick = (arg) => {
    setCreateDate(arg.date);
    setShowCreateDialog(true);
  };

  const handleEventClick = (arg) => {
    const event = {
      id: arg.event.id,
      title: arg.event.title,
      start: new Date(arg.event.start),
      end: new Date(arg.event.end),
      time: `${new Date(arg.event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(arg.event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      participants: arg.event.extendedProps.participants,
      desc: arg.event.extendedProps.desc,
      backgroundColor: arg.event.backgroundColor,
      borderColor: arg.event.borderColor
    };
    setSelectedMeeting(event);
  };

   // 기존 함수 수정: handleCreateMeeting
   const handleCreateMeeting = async (meetingData) => {
    if (!auth.isAuthenticated) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    try {
      setIsLoading(true);
      const token = auth.user?.id_token || auth.user?.access_token;
      
      const result = await createMeeting(token, {
        title: meetingData.title,
        start: meetingData.start.toISOString(),
        end: meetingData.end.toISOString(),
        participants: meetingData.participants,
        description: meetingData.desc
      });
      console.log('미팅 생성 성공:', result);
      // 성공 시 로컬 상태 업데이트
      const newEvent = {
        id: result.meetingId,
        title: meetingData.title,
        start: meetingData.start.toISOString(),
        end: meetingData.end.toISOString(),
        ...eventColors.default,
        extendedProps: {
          participants: meetingData.participants,
          desc: meetingData.desc
        }
      };
      
      setEvents(prevEvents => [...prevEvents, newEvent]);
      setShowCreateDialog(false);
      
      alert('미팅이 성공적으로 생성되었습니다.');
    } catch (error) {
      console.error('미팅 생성 오류:', error);
      alert(`미팅 생성 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  

  const handleEditMeeting = async (meetingData) => {
    if (!auth.isAuthenticated) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    try {
      setIsLoading(true);
      const token = auth.user.access_token;
      
      await updateMeeting(token, meetingData.id, {
        title: meetingData.title,
        start: meetingData.start.toISOString(),
        end: meetingData.end.toISOString(),
        participants: meetingData.participants,
        description: meetingData.desc
      });
      
      // 로컬 상태 업데이트
      const updatedEvents = events.map(event => 
        event.id === meetingData.id ? {
          ...event,
          title: meetingData.title,
          start: meetingData.start.toISOString(),
          end: meetingData.end.toISOString(),
          extendedProps: {
            participants: meetingData.participants,
            desc: meetingData.desc
          }
        } : event
      );
      
      setEvents(updatedEvents);
      setSelectedMeeting(null);
      setShowEditDialog(false);
    } catch (error) {
      console.error('미팅 수정 오류:', error);
      alert(`미팅 수정 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMeeting = async (id) => {
    if (!auth.isAuthenticated) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    if (window.confirm('정말로 이 일정을 삭제하시겠습니까?')) {
      try {
        setIsLoading(true);
        const token = auth.user.access_token;
        
        await deleteMeeting(token, id);
        
        // 로컬 상태 업데이트
        setEvents(events.filter(event => event.id !== id));
        setSelectedMeeting(null);
      } catch (error) {
        console.error('미팅 삭제 오류:', error);
        alert(`미팅 삭제 중 오류가 발생했습니다: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 모달: 일정 상세
  const MeetingDetailModal = ({ meeting, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-detail modern-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h4 className="modal-title">{meeting.title}</h4>
          <button className="modal-close-icon" onClick={onClose}>×</button>
        </div>
        <div className="modal-content">
          <div className="modal-info-group">
            <div className="modal-info-label">시간</div>
            <div className="modal-info-value">{meeting.time}</div>
          </div>
          <div className="modal-info-group">
            <div className="modal-info-label">설명</div>
            <div className="modal-info-value modal-desc">{meeting.desc}</div>
          </div>
          <div className="modal-info-group">
            <div className="modal-info-label">참석자</div>
            <div className="modal-participants">
              {meeting.participants.map((p, i) => (
                <span key={i} className="modal-participant">{p}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="modal-edit-btn modern-button" onClick={() => {
            setShowEditDialog(true);
            onClose();
          }}>수정하기</button>
          <button className="modal-delete-btn modern-button-secondary" onClick={() => handleDeleteMeeting(meeting.id)}>삭제</button>
        </div>
      </div>
    </div>
  );

  // 모달: 일정 생성/수정
  const MeetingFormModal = ({ date, meeting, onSubmit, onClose, isEdit }) => {
    const [formData, setFormData] = useState(
      meeting ? {
        id: meeting.id,
        title: meeting.title,
        start: new Date(meeting.start),
        end: new Date(meeting.end),
        participants: meeting.participants.join(', '),
        desc: meeting.desc
      } : {
        title: '',
        start: date ? new Date(date) : new Date(),
        end: date ? new Date(new Date(date).getTime() + 60 * 60 * 1000) : new Date(new Date().getTime() + 60 * 60 * 1000),
        participants: '',
        desc: ''
      }
    );

    const handleSubmit = (e) => {
      e.preventDefault();
      onSubmit({
        ...formData,
        id: meeting ? meeting.id : Date.now(),
        participants: formData.participants.split(',').map(p => p.trim()).filter(p => p)
      });
    };

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-detail modern-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h4 className="modal-title">{isEdit ? '일정 수정' : '새 일정 만들기'}</h4>
            <button className="modal-close-icon" onClick={onClose}>×</button>
          </div>
          <form onSubmit={handleSubmit} className="modal-form">
            <div className="form-group">
              <label>제목</label>
              <input
                className="modern-input"
                placeholder="일정 제목을 입력하세요"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>시작 시간</label>
                <input
                  className="modern-input"
                  type="datetime-local"
                  value={formData.start.toISOString().slice(0, 16)}
                  onChange={e => setFormData({...formData, start: new Date(e.target.value)})}
                  required
                />
              </div>
              <div className="form-group">
                <label>종료 시간</label>
                <input
                  className="modern-input"
                  type="datetime-local"
                  value={formData.end.toISOString().slice(0, 16)}
                  onChange={e => setFormData({...formData, end: new Date(e.target.value)})}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>참석자</label>
              <input
                className="modern-input"
                placeholder="참석자 이름을 쉼표로 구분하여 입력하세요"
                value={formData.participants}
                onChange={e => setFormData({...formData, participants: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>설명</label>
              <textarea
                className="modern-textarea"
                placeholder="일정에 대한 설명을 입력하세요"
                value={formData.desc}
                onChange={e => setFormData({...formData, desc: e.target.value})}
                required
              />
            </div>
            <div className="modal-actions">
              <button type="submit" className="modern-button">
                {isEdit ? '수정하기' : '만들기'}
              </button>
              <button type="button" className="modern-button-secondary" onClick={onClose}>
                취소
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const KPICard = ({ title, value, color }) => (
    <div className="kpi-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );

  const upcomingEvents = events.filter(event => {
    const eventDate = new Date(event.start);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate >= today;
  }).sort((a, b) => new Date(a.start) - new Date(b.start));

  // 캘린더 이벤트 색상 설정
  const eventColors = {
    default: {
      backgroundColor: '#EEF2FF',
      borderColor: '#6366F1',
      textColor: '#4F46E5'
    },
    important: {
      backgroundColor: '#FEF2F2',
      borderColor: '#EF4444',
      textColor: '#DC2626'
    },
    casual: {
      backgroundColor: '#F0FDF4',
      borderColor: '#22C55E',
      textColor: '#16A34A'
    }
  };

  return (
    <div className="meeting-manager-container">
      <div className="kpi-dashboard modern-dashboard">
        <KPICard title="요청된 미팅" value={events.length} color="#6366F1" />
        <KPICard title="승인된 미팅" value={events.length} color="#22C55E" />
        <KPICard title="취소된 미팅" value={0} color="#EF4444" />
        <KPICard title="대기중인 미팅" value={0} color="#F59E0B" />
      </div>
      <div className="meeting-manager2col">
        <div className="manager-main modern-main">
          <div className="manager-header modern-header">
            <div className="view-selector modern-view-selector">
              <button 
                className={`view-btn modern-view-btn ${calendarView === 'dayGridMonth' ? 'active' : ''}`}
                onClick={() => changeView('month')}
              >
                월별
              </button>
              <button 
                className={`view-btn modern-view-btn ${calendarView === 'timeGridWeek' ? 'active' : ''}`}
                onClick={() => changeView('week')}
              >
                주별
              </button>
              <button 
                className={`view-btn modern-view-btn ${calendarView === 'timeGridDay' ? 'active' : ''}`}
                onClick={() => changeView('day')}
              >
                일별
              </button>
            </div>
          </div>
          <div className="calendar-container2 modern-calendar">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={calendarView}
              headerToolbar={{
                left: 'prev',
                center: 'title',
                right: 'next'
              }}
              events={events}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              height="100%"
              locale="ko"
              allDaySlot={false}
              slotMinTime="06:00:00"
              slotMaxTime="24:00:00"
              nowIndicator={true}
              editable={true}
              slotDuration="00:30:00"
              slotLabelInterval="01:00"
              expandRows={true}
              stickyHeaderDates={true}
              dayMaxEvents={true}
              eventClassNames="modern-event"
              dayCellClassNames="modern-day-cell"
              slotLabelClassNames="modern-slot-label"
              dayHeaderClassNames="modern-day-header"
            />
          </div>
        </div>
        <div className="manager-sidebar">
          <h3>예정된 미팅</h3>
          <div className="meeting-list">
            {upcomingEvents.map(event => (
              <div key={event.id} className="meeting-item" onClick={() => handleEventClick({ event })}>
                <div className="meeting-color" style={{ backgroundColor: event.backgroundColor }}></div>
                <div className="meeting-info">
                  <div className="meeting-title">{event.title}</div>
                  <div className="meeting-time">
                    {new Date(event.start).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <div className="meeting-participants">
                    {event.extendedProps.participants.map((participant, idx) => (
                      <div key={idx} className="participant-avatar">
                        {participant.charAt(0)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {selectedMeeting && <MeetingDetailModal meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} />}
      {showCreateDialog && (
        <MeetingFormModal
          date={createDate}
          onSubmit={handleCreateMeeting}
          onClose={() => setShowCreateDialog(false)}
          isEdit={false}
        />
      )}
      {showEditDialog && (
        <MeetingFormModal
          date={createDate}
          meeting={selectedMeeting}
          onSubmit={handleEditMeeting}
          onClose={() => setShowEditDialog(false)}
          isEdit={true}
        />
      )}
    </div>
  );
}

export default MeetingManager;
