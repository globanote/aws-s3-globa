import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {AuthProvider} from "react-oidc-context"; // oidc 인증 제공자

const cognitoAuthConfig = {
  authority: "https://cognito-idp.ap-northeast-2.amazonaws.com/ap-northeast-2_q4k5dfKvU",
  client_id: "dfjbvb8sjealspdl43k3rcm5i",
  redirect_uri: "http://localhost:3000/auth-callback",
  response_type: "code",
  scope: "email openid",
  onSigninCallback: () => {
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname.includes('/auth-callback') ? '/' : window.location.pathname
    );
  },
};
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
     <AuthProvider {...cognitoAuthConfig}>
    <App />
    </AuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
