// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import Sidebar from './components/Sidebar';
import NotFound from './components/NotFound';
import Dashboard from './components/Dashboard/Dashboard';
import MeetingReservation from './components/MeetingSchedule/MeetingReservation';
import UpcomingMeeting from './components/MeetingSchedule/UpcomingMeeting';
import GlobalNoteCreate from './components/Notes/GlobalNoteCreate';
import RealtimeNote from './components/Notes/RealtimeNote';
import AIMeetingNote from './components/Notes/AIMeetingNote';
import MeetingManager from './components/MeetingSchedule/MeetingManager';
import Login from './components/Login';
import './styles/app.css';

function App() {
  const auth = useAuth();
  
  // Cognito 사용자 정보를 사용
  const getUserInfo = () => {
    if (auth.isAuthenticated && auth.user) {
      // 디버깅용 콘솔 로그 추가
      console.log('Auth User Profile:', auth.user.profile);
      
      // 닉네임을 찾기 위한 여러 필드 확인
      const displayName = 
        auth.user.profile.nickname || 
        auth.user.profile.name ||
        auth.user.profile.given_name ||
        auth.user.profile.preferred_username ||
        auth.user.profile.email?.split('@')[0] || // 이메일에서 사용자명 추출
        auth.user.profile.email || 
        'User';
      
      return {
        name: displayName,
        email: auth.user.profile.email || 'example@email.com',
        profileImage: '/profile.jpg',
        usage: {
          days: 7,
          totalAmount: '₩30,000'
        }
      };
    }
    
    // 기본값 반환
    return {
      name: 'Guest User',
      email: 'guest@example.com',
      profileImage: '/profile.jpg',
      usage: {
        days: 0,
        totalAmount: '₩0'
      }
    };
  };
  
  // 단순화된 로그아웃 함수
  const handleLogout = () => {
    // 로컬 사용자 정보만 제거
    auth.removeUser();
    
    // 성공적인 로그아웃 후 홈페이지로 리다이렉트
    window.location.href = '/';
  };

  // 로딩 중일 때
  if (auth.isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>로딩 중입니다...</p>
      </div>
    );
  }

  // 인증되지 않았을 때 Login 컴포넌트 렌더링
  if (!auth.isAuthenticated) {
    return <Login />;
  }

  // 사용자 정보 가져오기
  const user = getUserInfo();

  // 인증된 경우 앱 렌더링
  return (
    <Router>
      <div className="app-container">
        <Sidebar user={user} onLogout={handleLogout} />
        <div className="content-container">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/auth-callback" element={<Navigate to="/" />} />
            <Route path="/meeting-reservation" element={<MeetingReservation />} />
            <Route path="/upcoming-meeting" element={<UpcomingMeeting />} />
            <Route path="/global-note-create" element={<GlobalNoteCreate />} />
            <Route path="/realtime-note" element={<RealtimeNote />} />
            <Route path="/ai-meeting-note" element={<AIMeetingNote />} />
            <Route path="/meeting-manager/:view" element={<MeetingManager />} />
            <Route path="/meeting-manager" element={<Navigate to="/meeting-manager/month" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;