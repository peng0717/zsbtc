// Vercel Serverless Function 入口
// 所有 /api/* 请求路由到此，由 Express 应用处理
const app = require('../server.js');
module.exports = app;