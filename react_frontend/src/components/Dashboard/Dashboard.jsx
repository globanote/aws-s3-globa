import React from 'react';
import { useNavigate } from 'react-router-dom';
import UsageTracker from './UsageTracker';
import MeetingChatbot from './MeetingChatbot';
import Calendar from './Calendar';
import '../../styles/dashboard.css';

function Dashboard({ user }) {
  const navigate = useNavigate();
  
  const handleDateClick = (date) => {
    console.log('Selected date:', date);
  };

  const handleScheduleClick = (schedule) => {
    console.log('Selected schedule:', schedule);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-top-section">
        <div className="dashboard-left">
          <UsageTracker user={user} />
        </div>
        <div className="dashboard-right">
          <MeetingChatbot />
        </div>
      </div>
      <div className="dashboard-bottom-section">
        <Calendar onDateClick={handleDateClick} onScheduleClick={handleScheduleClick} />
      </div>
    </div>
  );
}

export default Dashboard;