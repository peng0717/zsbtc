# 盐技师设备通 - 部署指南

## 1. 云端准备工作

### 1.1 打开微信开发者工具
- 已创建的「公众号网页」项目中，点击顶部「云开发」按钮进入控制台

### 1.2 创建数据库集合（3 个）
在「数据库」面板中手动创建以下集合：

| 集合名 | 用途 |
|--------|------|
| users | 用户表 |
| devices | 设备表 |
| borrow_records | 借用记录表 |

### 1.3 导入示例设备数据
打开 `database/init.js`，将其中的 sampleDevices 数据逐条添加到 devices 集合中。

### 1.4 添加管理员账号
在 users 集合中手动添加一条记录：
```
phone: "你的手机号"
realName: "你的姓名"
role: "管理员"
```

### 1.5 开启静态网站托管
云开发控制台 → 更多 → 静态网站托管 → 开通（免费额度足够）

## 2. 本地开发与构建

```bash
# 进入项目目录
cd device-web

# 安装依赖
npm install

# 本地开发（浏览器访问 http://localhost:3000）
npm run dev

# 构建生产版本
npm run build
```

## 3. 部署到云开发静态托管

构建后 `dist/` 目录即为最终产物。

方式一：微信开发者工具 → 云开发 → 静态网站托管 → 上传文件（将 dist 目录下所有文件拖入）

方式二：使用 cloudbase CLI
```bash
npm install -g @cloudbase/cli
tcb login
tcb hosting deploy dist/ -e cloud1-d0gjncdvg84d3f3e6
```

## 4. Web 应用访问

部署完成后，在静态网站托管的「设置」中获取默认域名，即可在微信内外访问。
将域名配置到公众号菜单中即可。

## 5. 关于验证码

当前版本使用模拟验证码（固定 123456）。正式上线前，可在云开发中配置腾讯云短信服务：
- 云开发控制台 → 扩展能力 → 短信
- 替换 Login.vue 中的 sendCode 逻辑

## 项目结构

```
device-web/
├── index.html
├── package.json
├── vite.config.js
├── database/
│   └── init.js              # 数据库初始化脚本
└── src/
    ├── main.js
    ├── style.css
    ├── App.vue               # 主布局（导航栏+TabBar）
    ├── router/index.js       # 路由配置
    ├── utils/cloud.js        # 云开发 SDK 初始化（环境ID已配置）
    └── views/
        ├── Login.vue         # 手机号+验证码登录/注册
        ├── Home.vue          # 设备列表（搜索+分页）
        ├── DeviceDetail.vue  # 设备详情
        ├── Borrow.vue        # 借用申请表单
        ├── MyBorrows.vue     # 我的借用记录
        ├── AdminApproval.vue # 管理员审批
        ├── AdminReturn.vue   # 归还确认
        └── AdminDevices.vue  # 设备管理（增删）
```