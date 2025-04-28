import React from 'react';

function UsageTracker({ user }) {
  const dummyStats = {
    meetingTime: '미팅 시간 비 그래프 (7주평균)',
    activeUsers: '음성 분석 사용자 그래프 (7주평균) 가격',
    newUsers: '첫번 사용량 7주평균 가격'
  };

  return (
    <div className="usage-tracker">
      <h2>사용량 추적 대시보드</h2>
      <div className="usage-header">
        <div className="days-used">{user.usage.days}일</div>
        <div className="total-amount">총 청구비용: {user.usage.totalAmount}</div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>{dummyStats.meetingTime}</h3>
          <div className="stat-graph" style={{ height: '120px', background: 'rgba(0,0,255,0.1)' }}></div>
        </div>
        <div className="stat-card">
          <h3>{dummyStats.activeUsers}</h3>
          <div className="stat-graph" style={{ height: '120px', background: 'rgba(0,0,255,0.1)' }}></div>
        </div>
        <div className="stat-card">
          <h3>{dummyStats.newUsers}</h3>
          <div className="stat-graph" style={{ height: '120px', background: 'rgba(0,0,255,0.1)' }}></div>
        </div>
      </div>
    </div>
  );
}

export default UsageTracker;