import React, { useState, useEffect } from 'react';
import { IoStatsChartSharp, IoTime, IoCloudUpload, IoWallet, IoCalendarOutline } from 'react-icons/io5';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import '../../styles/dashboard.css';

function UsageTracker({ user }) {
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  
  // 더미 데이터 - 실제로는 API에서 가져온 데이터로 대체
  const monthlyData = {
    totalCost: "257,800원",
    percentChange: -5,
    breakdown: [
      { name: '토큰 사용량', value: 125000, cost: 125000, percent: 48.5, color: '#6366f1' },
      { name: '호출 횟수', value: 1423, cost: 85380, percent: 33.1, color: '#10b981' },
      { name: '연산 시간', value: '23.8시간', cost: 47420, percent: 18.4, color: '#f97316' }
    ]
  };

  // 원형 그래프 데이터
  const pieData = monthlyData.breakdown.map(item => ({
    name: item.name,
    value: item.cost,
    percent: item.percent,
    color: item.color
  }));

  // 이전 달 선택
  const handlePrevMonth = () => {
    setActiveMonth(prev => (prev === 0 ? 11 : prev - 1));
  };

  // 다음 달 선택
  const handleNextMonth = () => {
    setActiveMonth(prev => (prev === 11 ? 0 : prev + 1));
  };

  // 커스텀 툴팁 컴포넌트
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{payload[0].name}</p>
          <p className="tooltip-cost">{payload[0].value.toLocaleString()}원</p>
          <p className="tooltip-percent">{payload[0].payload.percent}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="usage-tracker">
      <div className="tracker-header">
        <div className="tracker-title">
          <IoStatsChartSharp className="header-icon" />
          <h2>월간 사용량 대시보드</h2>
        </div>
        <div className="month-selector">
          <button className="month-nav-btn" onClick={handlePrevMonth}>
            <span className="arrow">←</span>
          </button>
          <div className="current-month">
            <IoCalendarOutline />
            <span>{monthNames[activeMonth]}</span>
          </div>
          <button className="month-nav-btn" onClick={handleNextMonth}>
            <span className="arrow">→</span>
          </button>
        </div>
      </div>
      
      <div className="usage-overview">
        <div className="total-cost-card">
          <div className="cost-header">이번 달 총 사용 금액</div>
          <div className="cost-value">{monthlyData.totalCost}</div>
          <div className={`cost-change ${monthlyData.percentChange < 0 ? 'decrease' : 'increase'}`}>
            {monthlyData.percentChange < 0 ? '▼' : '▲'} {Math.abs(monthlyData.percentChange)}% (전월 대비)
          </div>
        </div>
        
        <div className="usage-chart-container">
          <div className="chart-title">비용 항목별 비율</div>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                layout="horizontal" 
                verticalAlign="bottom"
                align="center"
                payload={
                  pieData.map(item => ({
                    value: `${item.name} (${item.percent}%)`,
                    type: 'circle',
                    color: item.color,
                  }))
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="usage-details">
        {monthlyData.breakdown.map((item, index) => (
          <div className="detail-card" key={index}>
            <div className="detail-icon" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
              {index === 0 ? <IoCloudUpload /> : index === 1 ? <IoTime /> : <IoWallet />}
            </div>
            <div className="detail-info">
              <div className="detail-title">{item.name}</div>
              <div className="detail-metrics">
                <div className="detail-value">{typeof item.value === 'string' ? item.value : item.value.toLocaleString()}</div>
                <div className="detail-cost">{item.cost.toLocaleString()}원</div>
              </div>
            </div>
            <div className="detail-percent" style={{ color: item.color }}>{item.percent}%</div>
          </div>
        ))}
      </div>
      
      <div className="usage-summary">
        <div className="summary-title">월간 요약</div>
        <div className="summary-description">
          {monthNames[activeMonth]} 사용량 분석: 총 비용의 <span className="highlight" style={{ color: '#6366f1' }}>48.5%</span>가 토큰 사용,
          <span className="highlight" style={{ color: '#10b981' }}>33.1%</span>가 API 호출,
          <span className="highlight" style={{ color: '#f97316' }}>18.4%</span>가 연산 시간에 소요되었습니다.
          전월 대비 비용이 <span className="highlight positive">5% 감소</span>했습니다.
        </div>
      </div>
    </div>
  );
}

export default UsageTracker;