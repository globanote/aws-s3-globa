import React, { useState } from 'react';

function Login({ onLogin }) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // 실제 인증 로직은 추후 구현
    onLogin(id, password);
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>로그인</h2>
        <div className="form-group">
          <label htmlFor="login-id">아이디</label>
          <input
            id="login-id"
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="아이디를 입력하세요"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="login-password">비밀번호</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            required
          />
        </div>
        <button type="submit" className="login-btn">로그인</button>
      </form>
    </div>
  );
}

export default Login; 