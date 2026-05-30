<template>
  <div class="login-root">
    <div class="login-bg"></div>
    <div class="login-card">
      <div class="login-brand">
        <img src="/assets/logo.png" class="login-logo" alt="校徽" />
        <div class="login-divider"></div>
        <h1 class="login-title">掌上设备通</h1>
        <p class="login-sub">校园设备借用管理平台</p>
      </div>

      <div class="login-form">
        <div class="input-group">
          <label class="input-label">学工号</label>
          <input
            v-model="username"
            type="text"
            class="input-field"
            placeholder="请输入学工号"
            autocomplete="username"
          />
        </div>
        <div class="input-group">
          <label class="input-label">密码</label>
          <input
            v-model="password"
            type="password"
            class="input-field"
            placeholder="请输入密码"
            autocomplete="current-password"
            @keyup.enter="onLogin"
          />
        </div>

        <button class="btn-primary" :disabled="loading" @click="onLogin">
          <span v-if="!loading">登 录</span>
          <span v-else class="btn-spinner"></span>
        </button>
      </div>

      <p class="login-register" @click="showRegister = true">
        没有账号？<span>立即注册</span>
      </p>
    </div>

    <!-- 注册弹窗 -->
    <van-dialog v-model:show="showRegister" title="注册账号" show-cancel-button @confirm="onRegister">
      <div class="register-form">
        <div class="input-group">
          <label class="input-label">学工号</label>
          <input v-model="regForm.username" type="text" class="input-field" placeholder="请输入学工号" />
        </div>
        <div class="input-group">
          <label class="input-label">姓名</label>
          <input v-model="regForm.name" type="text" class="input-field" placeholder="请输入姓名" />
        </div>
        <div class="input-group">
          <label class="input-label">手机号</label>
          <input v-model="regForm.phone" type="tel" class="input-field" placeholder="请输入手机号" maxlength="11" />
        </div>
        <div class="input-group">
          <label class="input-label">身份</label>
          <select v-model="regForm.role" class="input-field input-select">
            <option value="学生">学生</option>
            <option value="教师">教师</option>
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">密码</label>
          <input v-model="regForm.password" type="password" class="input-field" placeholder="至少6位" />
        </div>
        <div class="input-group">
          <label class="input-label">确认密码</label>
          <input v-model="regForm.confirmPassword" type="password" class="input-field" placeholder="再次输入密码" />
        </div>
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { api } from '../api.js'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const showRegister = ref(false)

const regForm = reactive({
  username: '',
  name: '',
  password: '',
  confirmPassword: '',
  phone: '',
  role: '学生'
})

const resetRegForm = () => {
  regForm.username = ''
  regForm.name = ''
  regForm.password = ''
  regForm.confirmPassword = ''
  regForm.phone = ''
  regForm.role = '学生'
}

const doLogin = async () => {
  if (!username.value || !password.value) {
    showToast('请输入学工号和密码')
    return
  }
  loading.value = true
  try {
    const res = await api.login({ username: username.value, password: password.value })
    if (res.success) {
      const { token, user } = res.data
      localStorage.setItem('token', token)
      localStorage.setItem('userId', user.id)
      localStorage.setItem('username', user.username)
      localStorage.setItem('name', user.name)
      localStorage.setItem('role', user.role)
      return { success: true, role: user.role }
    } else {
      showToast(res.message)
      return { success: false }
    }
  } catch (e) {
    showToast('网络错误，请稍后重试')
    return { success: false }
  } finally {
    loading.value = false
  }
}

const onLogin = async () => {
  const result = await doLogin()
  if (result.success) router.push('/home')
}

const onRegister = async () => {
  if (!regForm.username || !regForm.name || !regForm.password || !regForm.confirmPassword) {
    showToast('请填写所有字段')
    return
  }
  if (regForm.password.length < 6) {
    showToast('密码长度不能少于6位')
    return
  }
  if (regForm.password !== regForm.confirmPassword) {
    showToast('两次密码不一致')
    return
  }
  if (!/^1[3-9]\d{9}$/.test(regForm.phone)) {
    showToast('请输入正确的手机号')
    return
  }
  try {
    const res = await api.register({
      username: regForm.username,
      name: regForm.name,
      password: regForm.password,
      phone: regForm.phone,
      role: regForm.role
    })
    if (res.success) {
      showToast('注册成功，请登录')
      showRegister.value = false
      resetRegForm()
    } else {
      showToast(res.message)
    }
  } catch (e) {
    showToast('网络错误，请稍后重试')
  }
}
</script>

<style scoped>
.login-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f4f5f8;
  position: relative;
  overflow: hidden;
  padding: 40px 20px;
}

.login-bg {
  position: absolute;
  top: -60%;
  left: -20%;
  width: 140%;
  height: 80%;
  background: linear-gradient(160deg, #eaf2fb 0%, #d4e4f7 40%, #eef3f9 100%);
  border-radius: 0 0 60% 60%;
  z-index: 0;
}

.login-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 380px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03);
  padding: 44px 28px 32px;
}

.login-brand { text-align: center; margin-bottom: 28px; }
.login-logo {
  width: 100px;
  height: 100px;
  object-fit: contain;
  border-radius: 18px;
  box-shadow: 0 4px 16px rgba(30,93,201,0.12);
  background: #fff;
  padding: 6px;
}
.login-divider {
  width: 32px;
  height: 3px;
  background: var(--primary);
  margin: 16px auto 12px;
  border-radius: 2px;
}
.login-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 4px;
}
.login-sub { font-size: 13px; color: var(--text-hint); margin-top: 4px; }

.login-form { margin-bottom: 20px; }

.input-group { margin-bottom: 14px; }
.input-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
  padding-left: 2px;
}
.input-field {
  width: 100%;
  height: 46px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 0 14px;
  font-size: 15px;
  font-family: var(--font);
  color: var(--text);
  background: #f9fafc;
  outline: none;
  transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), background 0.2s var(--ease);
}
.input-field:focus {
  border-color: var(--primary);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(30,93,201,0.08);
}
.input-field::placeholder { color: #b8b8c8; }

.btn-primary {
  width: 100%;
  height: 46px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  font-family: var(--font);
  letter-spacing: 4px;
  cursor: pointer;
  margin-top: 8px;
  box-shadow: 0 4px 14px rgba(30,93,201,0.2);
  transition: all 0.2s var(--ease);
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-primary:active { transform: scale(0.98); opacity: 0.9; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-spinner {
  width: 20px; height: 20px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.login-register {
  text-align: center;
  font-size: 13px;
  color: var(--text-hint);
  padding-top: 16px;
  border-top: 1px solid var(--divider);
  cursor: pointer;
}
.login-register span { color: var(--primary); font-weight: 500; }

.login-icp {
  position: relative;
  z-index: 1;
  margin-top: 20px;
  font-size: 12px;
  color: #b8b8c8;
  text-align: center;
}

.register-form { padding: 8px 0; }
.register-form .input-field {
  border-width: 2px;
  border-color: #c8ccd6;
}
.register-form .input-field:focus {
  border-color: var(--primary);
}
.input-select {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3e%3cpath fill='%239090a2' d='M6 8L1 3h10z'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
  cursor: pointer;
}
</style>
（内容由AI生成，仅供参考）
