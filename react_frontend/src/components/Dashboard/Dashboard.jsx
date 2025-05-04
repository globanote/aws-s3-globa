import React from 'react';
import { useNavigate } from 'react-router-dom';
import UsageTracker from './UsageTracker';
import MeetingChatbot from './MeetingChatbot';
import '../../styles/dashboard.css';

function Dashboard({ user }) {
  const navigate = useNavigate();
  
  // 더미 사용자 데이터 (실제로는 props에서 받은 데이터 사용)
  const dummyUser = {
    name: "사용자",
    usage: {
      days: 30,
      totalAmount: "257,800원",
      usagePercent: 75
    }
  };
  
  // 실제 사용자 데이터가 없는 경우 더미 데이터 사용
  const userData = user || dummyUser;

  return (
    <div className="dashboard-container">
      <div className="dashboard-top-section">
        <div className="dashboard-left">
          <UsageTracker user={userData} />
        </div>
        <div className="dashboard-right">
          <MeetingChatbot />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;