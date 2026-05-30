// 最小测试端点 - 不依赖任何数据库
module.exports = (req, res) => {
  res.json({ success: true, message: 'Vercel Serverless OK', time: new Date().toISOString() });
};