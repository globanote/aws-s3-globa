// Login.jsx
import React from 'react';
import { useAuth } from 'react-oidc-context';
import { FaUser, FaSpinner } from 'react-icons/fa';
import '../styles/login.css';

function Login() {
  const auth = useAuth();
  
  // 로그아웃 리다이렉트 함수
  const signOutRedirect = () => {
    const clientId = "dfjbvb8sjealspdl43k3rcm5i";
    // 로컬 개발 환경에 맞게 로그아웃 URL 설정
    const logoutUri = "http://localhost:3000";
    const cognitoDomain = "https://ap-northeast-2q4k5dfkvu.auth.ap-northeast-2.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  // auth가 undefined인 경우 로딩 화면 표시
  if (!auth) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="loading">
            <FaSpinner className="spin-icon" />
            <p>인증 컨텍스트 초기화 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // 로딩 중일 때 표시
  if (auth.isLoading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="loading">
            <FaSpinner className="spin-icon" />
            <p>로딩 중입니다...</p>
          </div>
        </div>
      </div>
    );
  }

  // 에러 발생 시 표시
  if (auth.error) {
    return (
      <div className="auth-container">
        <div className="auth-card error-card">
          <h2>오류가 발생했습니다</h2>
          <p>{auth.error.message}</p>
          <button 
            className="auth-btn primary" 
            onClick={() => window.location.reload()}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 로그인 화면
  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>글로봐 서비스에 오신 것을 환영합니다</h2>
        <p className="login-desc">
          AWS Cognito 계정으로 로그인하여 서비스를 이용해 보세요.
        </p>
        <div className="button-group">
          <button 
            className="auth-btn primary" 
            onClick={() => auth.signinRedirect()}
          >
            로그인
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;