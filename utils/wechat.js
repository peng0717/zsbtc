const https = require('https');

function getAccessToken(appid, secret) {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.errcode) {
            reject(new Error(`获取access_token失败: ${json.errmsg}`));
          } else {
            resolve(json.access_token);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function sendTemplateMessage(accessToken, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
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
        try {
          const json = JSON.parse(data);
          if (json.errcode === 0) {
            resolve(json);
          } else {
            reject(new Error(`发送模板消息失败: ${json.errmsg}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sendApprovalNotify(deviceName, borrowerName, borrowTime) {
  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_APPSECRET;
  const openid = process.env.WECHAT_OPENID;
  const templateId = process.env.WECHAT_TEMPLATE_ID;

  if (!appid || !secret || !openid || !templateId) {
    console.error('[WeChat] 环境变量缺失，跳过通知');
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
