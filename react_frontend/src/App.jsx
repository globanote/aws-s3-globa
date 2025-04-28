import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import './styles.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState({
    name: 'Yunhee Kim',
    email: 'zyv@gmail.com',
    profileImage: '/profile.jpg',
    usage: {
      days: 7,
      totalAmount: '₩30,000'
    }
  });

  const handleLogin = (id, password) => {
    // 임시 로컬 데이터 참조 (실제 인증 로직은 추후 구현)
    if (id === 'admin' && password === 'admin') {
      setIsLoggedIn(true);
    } else {
      alert('아이디 또는 비밀번호가 잘못되었습니다.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <div className="app-container">
        <Sidebar user={user} onLogout={handleLogout} />
        <div className="content-container">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/meeting-reservation" element={<MeetingReservation />} />
            <Route path="/upcoming-meeting" element={<UpcomingMeeting />} />
            <Route path="/global-note-create" element={<GlobalNoteCreate />} />
            <Route path="/realtime-note" element={<RealtimeNote />} />
            <Route path="/ai-meeting-note" element={<AIMeetingNote />} />
            <Route path="/meeting-manager/:view" element={<MeetingManager />} />
            <Route path="/meeting-manager" element={<Navigate to="/meeting-manager/month" />} />
            {/* <Route path="*" element={<Navigate to="/" />} />*/}
            {/* 여기! 모든 다른 경로는 NotFound로 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;