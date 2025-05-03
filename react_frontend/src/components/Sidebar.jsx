import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCalendarAlt, FaStickyNote, FaRobot, FaSignOutAlt, FaRegChartBar, 
  FaRegStickyNote, FaRegCalendarCheck, FaUserCircle, FaCog, FaClock } from 'react-icons/fa';
import { useAuth } from 'react-oidc-context'; // OIDC 인증 훅 사용
import '../styles/sidebar.css';
import { fetchUserQuota } from '../services/apiService'; // API 서비스 import

function Sidebar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef();
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // OIDC 인증 상태 사용
  const auth = useAuth();

  // 사용자 할당량 정보 가져오기 - auth.user.profile.sub를 사용
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      getUserQuotaData();
    }
  }, [auth.isAuthenticated, auth.user]);

  // API 데이터를 폴링하여 사용 시간 업데이트
  useEffect(() => {
    const updateInterval = setInterval(() => {
      if (auth.isAuthenticated && auth.user) {
        getUserQuotaData();
      }
    }, 60000); // 1분마다 업데이트
    
    return () => clearInterval(updateInterval);
  }, [auth.isAuthenticated, auth.user]);

  // 사용자 할당량 정보 가져오기 함수
  const getUserQuotaData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // OIDC에서 제공하는 idToken 사용
      const token = auth.user?.id_token;
      // Cognito 사용자 ID (sub)
      const userId = auth.user?.profile?.sub;
      
      console.log('인증 상태:', auth.isAuthenticated ? '인증됨' : '인증되지 않음');
      console.log('토큰 확인:', token ? '토큰 있음' : '토큰 없음');
      console.log('사용자 ID:', userId || '사용자 ID 없음');
      
      if (!token || !userId) {
        console.warn('인증 토큰 또는 사용자 ID가 없습니다. 기본 상태를 표시합니다.');
        setQuotaInfo({
          usedTime: 0,
          totalLimit: 18000,
          remainingTime: 18000,
          usedTimeFormatted: "0:00",
          totalLimitFormatted: "5:00:00",
          remainingTimeFormatted: "5:00:00",
          usagePercent: 0
        });
        return;
      }
      
      // API 호출하여 사용자 할당량 정보 가져오기
      const data = await fetchUserQuota(token, userId);
      console.log('사용자 할당량 데이터:', data);
      
      if (data) {
        // API 응답 데이터를 컴포넌트 상태에 설정
        setQuotaInfo({
          userId: data.userId,
          usedTime: data.usedTime || 0,
          totalLimit: data.totalLimit || 18000,
          remainingTime: data.remainingTime || 18000,
          isActive: data.isActive !== false,
          usedTimeFormatted: data.usedTimeFormatted || "0:00",
          totalLimitFormatted: data.totalLimitFormatted || "5:00:00",
          remainingTimeFormatted: data.remainingTimeFormatted || "5:00:00",
          usagePercent: data.usagePercent || 0,
          audioFilesCount: data.audioFilesCount || 0
        });
      }
    } catch (error) {
      console.error('사용자 할당량 가져오기 오류:', error);
      setError(error.message);
      
      // 오류 발생 시 기본 상태 표시
      setQuotaInfo({
        usedTime: 0,
        totalLimit: 18000,
        remainingTime: 18000,
        usedTimeFormatted: "0:00",
        totalLimitFormatted: "5:00:00",
        remainingTimeFormatted: "5:00:00",
        usagePercent: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGlobalNoteCreate = () => {
    navigate('/global-note-create');
  };

  const handleProfileClick = () => {
    fileInputRef.current.click();
  };

  const handleProfileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      alert('프로필 이미지가 업로드됩니다! (실제 업로드 로직은 구현 필요)');
    }
  };

  const handleLogout = () => {
    // OIDC 로그아웃 사용 (선택적)
    if (auth.isAuthenticated) {
      auth.signoutRedirect();
    } else {
      // 기존 로그아웃 함수 호출
      onLogout();
      navigate('/');
    }
  };

  // 디버깅용 인증 상태 확인 함수
  const checkAuthStatus = () => {
    console.log('=== 인증 상태 확인 ===');
    console.log('Auth 객체:', auth);
    console.log('인증됨:', auth.isAuthenticated);
    console.log('사용자 정보:', auth.user?.profile);
    console.log('Sub (사용자 ID):', auth.user?.profile?.sub);
    console.log('토큰:', auth.user?.id_token ? 'ID 토큰 있음' : 'ID 토큰 없음');
    console.log('만료까지 남은 시간:', auth.user?.expires_in);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">대시보드</div>
      <div className="sidebar-menu">
        <div 
          className={`sidebar-item ${location.pathname === '/' ? 'active' : ''}`} 
          onClick={() => navigate('/')}
        >
          <span className="icon"><FaRegChartBar /></span> 대시보드
        </div>
        <div 
          className={`sidebar-item ${location.pathname.includes('/ai-meeting-note') ? 'active' : ''}`} 
          onClick={() => navigate('/ai-meeting-note')}
        >
          <span className="icon"><FaRobot /></span> AI 미팅노트
        </div>
        <div 
          className={`sidebar-item ${location.pathname.includes('/meeting-manager') ? 'active' : ''}`} 
          onClick={() => navigate('/meeting-manager')}
        >
          <span className="icon"><FaRegCalendarCheck /></span> 미팅 관리
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*" 
          onChange={handleProfileChange} 
        />
      </div>
      
      <div className="sidebar-footer">
        <button className="global-note-btn" onClick={handleGlobalNoteCreate}>
          <FaRegStickyNote style={{ marginRight: 8 }} />
          글로바노트 생성
        </button>
        <div className="user-info">
          {isLoading ? (
            <div className="loading">로딩 중...</div>
          ) : error ? (
            <div className="error">데이터 로드 실패</div>
          ) : (
            <>
              <div className="usage-progress-bar">
                <div
                  className="usage-progress-fill"
                  style={{ 
                    width: `${quotaInfo?.usagePercent || 0}%`,
                    backgroundColor: (quotaInfo?.usagePercent || 0) > 80 ? '#ef4444' : 
                                    (quotaInfo?.usagePercent || 0) > 60 ? '#f97316' : '#6366f1'
                  }}
                ></div>
              </div>
              <div className="quota-detail">
                <span className="used-time">{quotaInfo?.usedTimeFormatted || '0:00'} / {quotaInfo?.totalLimitFormatted || '5:00:00'}</span>
                <span className="remaining-time">{quotaInfo?.remainingTimeFormatted || '5:00:00'} 남음</span>
              </div>
            </>
          )}
          <div className="user-profile">
            <div className="profile-image" onClick={handleProfileClick}>
              <FaUserCircle style={{ fontSize: 24, marginRight: 8, color: '#6366f1' }} />
            </div>
            <div className="user-name">{user.name}</div>
            <button className="settings-btn" onClick={() => navigate('/settings')}>
              <FaCog />
            </button>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            <FaSignOutAlt /> 로그아웃
          </button>
          {/* 디버깅용 버튼 (개발 중에만 사용) */}
          {process.env.NODE_ENV === 'development' && (
            <button 
              className="debug-btn" 
              onClick={checkAuthStatus}
              style={{ 
                fontSize: '0.7rem', 
                padding: '4px', 
                marginTop: '5px',
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              인증 확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;