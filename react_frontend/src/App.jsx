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
      return {
        name: auth.user.profile.name || auth.user.profile.email || 'User',
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
  
  // 로그아웃 핸들러
  const handleLogout = () => {
    auth.removeUser();
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