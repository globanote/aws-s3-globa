import React, { useState } from 'react';
import { FaUser, FaLock, FaEnvelope, FaArrowLeft } from 'react-icons/fa';

function Login({ onLogin }) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [signupData, setSignupData] = useState({
    id: '',
    password: '',
    confirmPassword: '',
    name: '',
    email: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(id, password);
  };

  const handlePasswordReset = (e) => {
    e.preventDefault();
    // 비밀번호 재설정 로직 구현
    alert('비밀번호 재설정 링크가 이메일로 전송되었습니다.');
    setShowPasswordReset(false);
  };

  const handleSignup = (e) => {
    e.preventDefault();
    // 회원가입 로직 구현
    alert('회원가입이 완료되었습니다.');
    setShowSignup(false);
  };

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (showPasswordReset) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <button className="back-button" onClick={() => setShowPasswordReset(false)}>
            <FaArrowLeft /> 돌아가기
          </button>
          <h2>비밀번호 재설정</h2>
          <form onSubmit={handlePasswordReset}>
            <div className="form-group">
              <label htmlFor="reset-email">이메일</label>
              <div className="input-with-icon">
                <FaEnvelope className="input-icon" />
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="이메일을 입력하세요"
                  required
                />
              </div>
            </div>
            <button type="submit" className="auth-btn primary">비밀번호 재설정 링크 전송</button>
          </form>
        </div>
      </div>
    );
  }

  if (showSignup) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <button className="back-button" onClick={() => setShowSignup(false)}>
            <FaArrowLeft /> 돌아가기
          </button>
          <h2>회원가입</h2>
          <form onSubmit={handleSignup}>
            <div className="form-group">
              <label htmlFor="signup-id">아이디</label>
              <div className="input-with-icon">
                <FaUser className="input-icon" />
                <input
                  id="signup-id"
                  type="text"
                  name="id"
                  value={signupData.id}
                  onChange={handleSignupChange}
                  placeholder="아이디를 입력하세요"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="signup-password">비밀번호</label>
              <div className="input-with-icon">
                <FaLock className="input-icon" />
                <input
                  id="signup-password"
                  type="password"
                  name="password"
                  value={signupData.password}
                  onChange={handleSignupChange}
                  placeholder="비밀번호를 입력하세요"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">비밀번호 확인</label>
              <div className="input-with-icon">
                <FaLock className="input-icon" />
                <input
                  id="confirm-password"
                  type="password"
                  name="confirmPassword"
                  value={signupData.confirmPassword}
                  onChange={handleSignupChange}
                  placeholder="비밀번호를 다시 입력하세요"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="name">이름</label>
              <div className="input-with-icon">
                <FaUser className="input-icon" />
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={signupData.name}
                  onChange={handleSignupChange}
                  placeholder="이름을 입력하세요"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="email">이메일</label>
              <div className="input-with-icon">
                <FaEnvelope className="input-icon" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={signupData.email}
                  onChange={handleSignupChange}
                  placeholder="이메일을 입력하세요"
                  required
                />
              </div>
            </div>
            <button type="submit" className="auth-btn primary">회원가입</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>로그인</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-id">아이디</label>
            <div className="input-with-icon">
              <FaUser className="input-icon" />
              <input
                id="login-id"
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="아이디를 입력하세요"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="login-password">비밀번호</label>
            <div className="input-with-icon">
              <FaLock className="input-icon" />
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
              />
            </div>
          </div>
          <button 
            type="button" 
            className="password-reset-btn"
            onClick={() => setShowPasswordReset(true)}
          >
            비밀번호를 잊으셨나요?
          </button>
          <button type="submit" className="auth-btn primary">로그인</button>
          <button 
            type="button" 
            className="auth-btn secondary"
            onClick={() => setShowSignup(true)}
          >
            회원가입
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login; 