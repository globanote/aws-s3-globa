// src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

// 환경 변수에서 API 엔드포인트 가져오기 (기본값 설정)
const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT;

module.exports = function(app) {
  app.use(
    '/prod',
    createProxyMiddleware({
      target: API_ENDPOINT,
      changeOrigin: true,
      secure: false,
      logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
      onProxyReq: (proxyReq, req) => {
        console.log('프록시 요청:', req.method, req.path);
      },
      onProxyRes: (proxyRes, req) => {
        console.log('프록시 응답:', proxyRes.statusCode);
      },
      onError: (err, req, res) => {
        console.error('프록시 오류:', err);
      }
    })
  );
};