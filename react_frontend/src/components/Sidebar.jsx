import React, { useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCalendarAlt, FaStickyNote, FaRobot, FaSignOutAlt } from 'react-icons/fa';

function Sidebar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef();
  
  const handleGlobalNoteCreate = () => {
    navigate('/global-note-create');
  };

  const handleProfileClick = () => {
    fileInputRef.current.click();
  };

  const handleProfileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      alert('프로필 이미지가 업로드됩니다! (실제 업로드 로직은 구현 필요)');
      // 실제 업로드 로직은 이곳에 구현
    }
  };

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">대시보드</div>
      <div className="sidebar-menu">
        <div 
          className={`sidebar-item ${location.pathname === '/' ? 'active' : ''}`} 
          onClick={() => navigate('/')}
        >
          <span className="icon">📊</span> 대시보드
        </div>
        <div 
          className={`sidebar-item ${location.pathname.includes('/ai-meeting-note') ? 'active' : ''}`} 
          onClick={() => navigate('/ai-meeting-note')}
        >
          <span className="icon">🤖</span> AI 미팅노트
        </div>
        <div 
          className={`sidebar-item ${location.pathname.includes('/meeting-manager') ? 'active' : ''}`} 
          onClick={() => navigate('/meeting-manager')}
        >
          <span className="icon">📅</span> 미팅 관리
        </div>
      </div>
      <div className="sidebar-footer">
        <button className="global-note-btn" onClick={handleGlobalNoteCreate}>
          글로바노트 생성
        </button>
        <div className="user-info">
          <div className="usage-info">
            {user.usage.days}일 ({user.usage.totalAmount})
          </div>
          <div className="usage-progress-bar">
          <div
            className="usage-progress-fill"
            style={{ width: `${user.usage.percent ?? 100}%` }}
          ></div>
        </div>
          <div className="user-profile">
            <div className="user-name">{user.name}</div>
            <button className="settings-btn">⚙️</button>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            <FaSignOutAlt /> 로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;