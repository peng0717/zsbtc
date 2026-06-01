const https = require('https');

function getAccessToken(appid, secret) {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;
    console.log('[WeChat] 正在获取access_token, appid:', appid);
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log('[WeChat] access_token API 响应:', data);
        try {
          const json = JSON.parse(data);
          if (json.errcode) {
            reject(new Error(`获取access_token失败: errcode=${json.errcode}, errmsg=${json.errmsg}`));
          } else {
            console.log('[WeChat] access_token 获取成功');
            resolve(json.access_token);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      console.error('[WeChat] access_token 请求网络错误:', err.message);
      reject(err);
    });
  });
}

function sendTemplateMessage(accessToken, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    console.log('[WeChat] 正在发送模板消息, payload:', postData);
    const options = {
      hostname: 'api.weixin.qq.com',
      path: `/cgi-bin/message/template/send?access_token=${accessToken}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log('[WeChat] 模板消息 API 响应:', data);
        try {
          const json = JSON.parse(data);
          if (json.errcode === 0) {
            console.log('[WeChat] 模板消息发送成功');
            resolve(json);
          } else {
            reject(new Error(`发送模板消息失败: errcode=${json.errcode}, errmsg=${json.errmsg}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', (err) => {
      console.error('[WeChat] 模板消息请求网络错误:', err.message);
      reject(err);
    });
    req.write(postData);
    req.end();
  });
}

async function sendApprovalNotify(deviceName, borrowerName, borrowTime) {
  console.log('[WeChat] sendApprovalNotify 被调用, deviceName:', deviceName, ', borrowerName:', borrowerName, ', borrowTime:', borrowTime);

  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_APPSECRET;
  const openid = process.env.WECHAT_OPENID;
  const templateId = process.env.WECHAT_TEMPLATE_ID;

  if (!appid) console.error('[WeChat] 环境变量 WECHAT_APPID 缺失');
  if (!secret) console.error('[WeChat] 环境变量 WECHAT_APPSECRET 缺失');
  if (!openid) console.error('[WeChat] 环境变量 WECHAT_OPENID 缺失');
  if (!templateId) console.error('[WeChat] 环境变量 WECHAT_TEMPLATE_ID 缺失');

  if (!appid || !secret || !openid || !templateId) {
    console.error('[WeChat] 环境变量缺失，跳过通知。当前状态: appid=', !!appid, 'secret=', !!secret, 'openid=', !!openid, 'templateId=', !!templateId);
    return;
  }

  try {
    const token = await getAccessToken(appid, secret);
    await sendTemplateMessage(token, {
      touser: openid,
      template_id: templateId,
      data: {
        thing1: { value: deviceName },
        thing2: { value: borrowerName },
        time3: { value: borrowTime },
        remark: { value: '有新的借用申请待审批，请及时处理' },
      },
    });
    console.log('[WeChat] 审批通知发送成功');
  } catch (err) {
    console.error('[WeChat] 审批通知发送失败:', err.message);
  }
}

module.exports = { sendApprovalNotify };
