import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FaCalendarAlt, 
  FaStickyNote, 
  FaRobot, 
  FaSignOutAlt, 
  FaRegChartBar, 
  FaRegStickyNote, 
  FaRegCalendarCheck, 
  FaUserCircle, 
  FaCog
} from 'react-icons/fa';
import { useAuth } from 'react-oidc-context';
import '../styles/sidebar.css';
import { fetchUserQuota } from '../services/apiService';

function Sidebar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef();
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMounted, setIsMounted] = useState(true); // 컴포넌트 마운트 상태 추적
  
  // OIDC 인증 상태 사용
  const auth = useAuth();

  // 컴포넌트 마운트 확인
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false); // 컴포넌트 언마운트 시 상태 변경
    };
  }, []);

  // 사용자 할당량 정보 가져오기
  useEffect(() => {
    let isActive = true; // 비동기 작업 관리를 위한 플래그

    const fetchData = async () => {
      if (auth.isAuthenticated && auth.user) {
        await getUserQuotaData(isActive);
      }
    };

    if (isMounted) {
      fetchData();
    }

    return () => {
      isActive = false; // 클린업 함수에서 플래그 변경
    };
  }, [auth.isAuthenticated, auth.user, isMounted]);

  // API 데이터를 폴링하여 사용 시간 업데이트
  useEffect(() => {
    let updateInterval;
    
    if (isMounted) {
      updateInterval = setInterval(() => {
        if (auth.isAuthenticated && auth.user && isMounted) {
          getUserQuotaData(true);
        }
      }, 60000); // 1분마다 업데이트
    }
    
    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, [auth.isAuthenticated, auth.user, isMounted]);

  // 사용자 할당량 정보 가져오기 함수
  const getUserQuotaData = async (isActive) => {
    if (!isActive || !isMounted) return; // 컴포넌트가 언마운트되었거나 비동기 작업이 취소된 경우 실행 중단

    try {
      setIsLoading(true);
      setError(null);
      
      // OIDC에서 제공하는 idToken 사용
      const token = auth.user?.id_token;
      // Cognito 사용자 ID (sub)
      const userId = auth.user?.profile?.sub;
      
      if (!token || !userId) {
        console.warn('인증 토큰 또는 사용자 ID가 없습니다. 기본 상태를 표시합니다.');
        if (isActive && isMounted) {
          setQuotaInfo({
            usedTime: 0,
            totalLimit: 18000,
            remainingTime: 18000,
            usedTimeFormatted: "0:00",
            totalLimitFormatted: "5:00:00",
            remainingTimeFormatted: "5:00:00",
            usagePercent: 0
          });
        }
        return;
      }
      
      // API 호출하여 사용자 할당량 정보 가져오기
      const data = await fetchUserQuota(token, userId);
      
      if (data && isActive && isMounted) {
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
      if (isActive && isMounted) {
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
      }
    } finally {
      if (isActive && isMounted) {
        setIsLoading(false);
      }
    }
  };

  // 페이지 이동 처리 함수
  const handleNavigate = (path) => {
    if (isMounted) {
      navigate(path);
    }
  };

  const handleGlobalNoteCreate = () => {
    if (isMounted) {
      handleNavigate('/global-note-create');
    }
  };

  const handleProfileClick = () => {
    if (fileInputRef.current && isMounted) {
      fileInputRef.current.click();
    }
  };

  const handleProfileChange = (e) => {
    if (e.target.files && e.target.files[0] && isMounted) {
      alert('프로필 이미지가 업로드됩니다! (실제 업로드 로직은 구현 필요)');
    }
  };

  const handleLogout = () => {
    if (!isMounted) return;

    // OIDC 로그아웃 사용 (선택적)
    if (auth.isAuthenticated) {
      auth.signoutRedirect();
    } else {
      // 기존 로그아웃 함수 호출
      onLogout();
      handleNavigate('/');
    }
  };

  // 이 부분이 실제로 DOM에 렌더링되는 JSX
  return (
    <div className="sidebar">
      <div className="sidebar-header">대시보드</div>
      <div className="sidebar-menu">
        <div 
          className={`sidebar-item ${location.pathname === '/' ? 'active' : ''}`} 
          onClick={() => handleNavigate('/')}
        >
          <span className="icon"><FaRegChartBar /></span> <span>대시보드</span>
        </div>
        <div 
          className={`sidebar-item ${location.pathname.includes('/ai-meeting-note') ? 'active' : ''}`} 
          onClick={() => handleNavigate('/ai-meeting-note')}
        >
          <span className="icon"><FaRobot /></span> <span>AI 미팅노트</span>
        </div>
        <div 
          className={`sidebar-item ${location.pathname.includes('/meeting-manager') ? 'active' : ''}`} 
          onClick={() => handleNavigate('/meeting-manager')}
        >
          <span className="icon"><FaRegCalendarCheck /></span> <span>미팅 관리</span>
        </div>
      </div>
      
      <div className="sidebar-footer">
        <button className="global-note-btn" onClick={handleGlobalNoteCreate}>
          <FaRegStickyNote style={{ marginRight: 8 }} />
          <span>글로벌노트 생성</span>
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
              <FaUserCircle style={{ fontSize: 24, color: '#6366f1' }} />
            </div>
            <div className="user-name">{user?.name || '사용자'}</div>
            <button className="settings-btn" onClick={() => handleNavigate('/settings')}>
              <FaCog />
            </button>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            <FaSignOutAlt /> <span>로그아웃</span>
          </button>
        </div>
      </div>
      
      {/* 파일 input은 DOM 트리에서 항상 존재하게 하여 ref 참조 오류 방지 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="image/*" 
        onChange={handleProfileChange} 
      />
    </div>
  );
}

export default Sidebar;