const axios = require('axios');

const APP_TOKEN = 'AT_b72oEvAA77pDsVDIy6BLOthY9UokxVoZ';
const WXPUSHER_API_URL = 'https://wxpusher.zjiecode.com/api/send/message';

/**
 * 发送 WxPusher 微信通知
 * @param {string} uid - 接收用户的 UID
 * @param {string} title - 通知标题
 * @param {string} content - 通知内容（支持 HTML）
 * @returns {Promise} - 返回 Promise，失败时静默记录日志
 */
async function sendWxPusherNotify(uid, title, content) {
  try {
    const response = await axios.post(WXPUSHER_API_URL, {
      appToken: APP_TOKEN,
      contentType: 1,
      contentFormat: 2,
      uids: [uid],
      content: content,
      summary: title
    }, {
      timeout: 5000 // 5秒超时
    });

    if (response.data && response.data.code === 1000) {
      console.log(`[WxPusher] 通知发送成功: ${title}`);
      return { success: true, data: response.data };
    } else {
      console.error(`[WxPusher] 通知发送失败: ${response.data?.msg || '未知错误'}`);
      return { success: false, error: response.data?.msg };
    }
  } catch (error) {
    console.error(`[WxPusher] 发送通知异常: ${error.message}`);
    // 静默失败，不阻塞主流程
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendWxPusherNotify
};
