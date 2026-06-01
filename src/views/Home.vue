<template>
  <div class="page-container home-page">
    <van-nav-bar title="设备借用系统" fixed placeholder>
      <template #left>
        <div class="nav-user">
          <span class="nav-avatar" @click="showProfile = true">{{ (userStore.name || 'U')[0] }}</span>
        </div>
      </template>
      <template #right>
        <van-icon name="scan" size="22" @click="goScan" class="nav-scan" style="margin-right: 16px;" />
        <van-icon name="cross" size="22" @click="logout" class="nav-logout" />
      </template>
    </van-nav-bar>

    <!-- 看板统计卡片 -->
    <div class="dash-cards">
      <div class="dash-card">
        <div class="dash-card-icon dash-icon-blue">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div class="dash-card-num">{{ stats.totalDevices }}</div>
        <div class="dash-card-label">设备总数</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon dash-icon-green">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>
        </div>
        <div class="dash-card-num">{{ stats.borrowedCount }}</div>
        <div class="dash-card-label">借用中</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon dash-icon-purple">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div class="dash-card-num">{{ stats.todayBorrows }}</div>
        <div class="dash-card-label">今日借用</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon dash-icon-red">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="dash-card-num">{{ stats.overdueCount }}</div>
        <div class="dash-card-label">逾期数量</div>
      </div>
    </div>

    <!-- 快捷入口 -->
    <div class="dash-quick">
      <h3 class="quick-title">快捷入口</h3>
      <div class="quick-grid">
        <div class="quick-item" @click="$router.push('/admin/devices')">
          <van-icon name="wap-home-o" size="22" />
          <span>设备管理</span>
        </div>
        <div class="quick-item" @click="$router.push('/admin/users')">
          <van-icon name="friends-o" size="22" />
          <span>用户管理</span>
        </div>
        <div class="quick-item" @click="$router.push('/admin/approval')">
          <van-icon name="checked" size="22" />
          <span>借用审批</span>
        </div>
        <div class="quick-item" @click="$router.push('/admin/borrow-return')">
          <van-icon name="exchange-o" size="22" />
          <span>借还管理</span>
        </div>
      </div>
    </div>

    <van-tabbar v-model="tabbarActive" :fixed="true" :placeholder="true">
      <van-tabbar-item icon="home-o" to="/home">首页</van-tabbar-item>
      <van-tabbar-item icon="notes-o" to="/my-borrows">借出列表</van-tabbar-item>
      <van-tabbar-item v-if="userStore.isAdmin" icon="setting-o" to="/admin/devices">管理</van-tabbar-item>
    </van-tabbar>

    <!-- 个人信息弹窗 -->
    <van-dialog v-model:show="showProfile" title="个人信息" show-cancel-button @confirm="onUpdateProfile">
      <div class="profile-form">
        <van-field v-model="profileForm.username" label="学工号" readonly />
        <van-field v-model="profileForm.name" label="姓名" placeholder="请输入姓名" />
        <van-field v-model="profileForm.phone" label="手机号" type="tel" placeholder="请输入手机号" maxlength="11" />
        <van-field v-model="profileForm.password" label="新密码" type="password" placeholder="至少8位，含大小写字母和数字" />
        <div class="pwd-strength" v-if="profileForm.password">
          <span :class="pwdCheck.len ? 'pass' : 'fail'">8位+</span>
          <span :class="pwdCheck.lower ? 'pass' : 'fail'">小写</span>
          <span :class="pwdCheck.upper ? 'pass' : 'fail'">大写</span>
          <span :class="pwdCheck.digit ? 'pass' : 'fail'">数字</span>
        </div>
        <van-field v-model="profileForm.confirmPassword" label="确认新密码" type="password" placeholder="再次输入新密码" />
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { api } from '../api.js'
import { useUserStore } from '../stores/user.js'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const tabbarActive = ref(0)
watch(() => route.path, (val) => {
  if (val === '/home') tabbarActive.value = 0
  else if (val === '/my-borrows') tabbarActive.value = 1
}, { immediate: true })

const stats = ref({
  totalDevices: 0,
  borrowedCount: 0,
  todayBorrows: 0,
  overdueCount: 0
})

const fetchStats = async () => {
  try {
    const res = await api.getDashboard()
    if (res.success) stats.value = res.data
  } catch (e) {}
}

const goScan = () => router.push('/scan')

const logout = () => {
  showConfirmDialog({
    title: '退出登录',
    message: '确定要退出当前账号吗？',
    confirmButtonText: '退出',
    cancelButtonText: '取消',
  }).then(() => {
    userStore.logout()
    router.push('/login')
  }).catch(() => {})
}

const showProfile = ref(false)
const profileForm = reactive({
  username: userStore.username || '',
  name: userStore.name || '',
  phone: '',
  password: '',
  confirmPassword: '',
})

watch(showProfile, async (val) => {
  if (val) {
    try {
      const res = await api.getMe()
      if (res.success) {
        profileForm.username = res.data.username
        profileForm.name = res.data.name
        profileForm.phone = res.data.phone || ''
      }
    } catch (e) {}
  }
})

const pwdCheck = computed(() => ({
  len: profileForm.password.length >= 8,
  lower: /[a-z]/.test(profileForm.password),
  upper: /[A-Z]/.test(profileForm.password),
  digit: /[0-9]/.test(profileForm.password),
}))

const validatePassword = (pwd) => {
  if (pwd.length < 8) return '密码长度不能少于8位'
  if (!/[a-z]/.test(pwd)) return '密码必须包含小写字母'
  if (!/[A-Z]/.test(pwd)) return '密码必须包含大写字母'
  if (!/[0-9]/.test(pwd)) return '密码必须包含数字'
  return null
}

const onUpdateProfile = async () => {
  if (!profileForm.name) {
    showToast('姓名不能为空')
    return
  }
  if (profileForm.password) {
    const pwdErr = validatePassword(profileForm.password)
    if (pwdErr) {
      showToast(pwdErr)
      return
    }
    if (profileForm.password !== profileForm.confirmPassword) {
      showToast('两次密码不一致')
      return
    }
  }
  try {
    const data = { name: profileForm.name, phone: profileForm.phone }
    if (profileForm.password) data.password = profileForm.password
    const res = await api.updateProfile(data)
    if (res.success) {
      userStore.updateProfile(res.data)
      profileForm.password = ''
      profileForm.confirmPassword = ''
      showToast('修改成功')
      showProfile.value = false
    } else {
      showToast(res.message)
    }
  } catch (e) {
    showToast('修改失败')
  }
}

onMounted(fetchStats)
</script>

<style scoped>
.home-page { padding-bottom: 60px; }

.nav-user { display: flex; align-items: center; }
.nav-avatar {
  width: 30px; height: 30px;
  border-radius: 50%;
  background: var(--primary-light);
  color: var(--primary);
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-scan { color: var(--primary); cursor: pointer; }
.nav-logout { color: var(--text-secondary); cursor: pointer; }

.dash-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px;
}

.dash-card {
  background: var(--surface);
  border-radius: 14px;
  padding: 20px 16px;
  box-shadow: var(--shadow-sm);
  text-align: center;
}
.dash-card-icon {
  width: 48px; height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 10px;
}
.dash-icon-blue   { background: #e8f0fe; color: #1e5dc9; }
.dash-icon-green  { background: #e8f5eb; color: #1a7f3e; }
.dash-icon-purple { background: #f3e8ff; color: #7c3aed; }
.dash-icon-red    { background: #fef0f0; color: #c92a2a; }

.dash-card-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}
.dash-card-label {
  font-size: 13px;
  color: var(--text-hint);
  margin-top: 4px;
}

.dash-quick {
  margin: 0 16px;
  background: var(--surface);
  border-radius: 14px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}
.quick-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 14px;
}
.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 12px;
}
.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  border-radius: 10px;
  background: #f7f8fb;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.quick-item:active { background: #eef1f7; }

.profile-form { padding: 4px 0; }

.pwd-strength {
  display: flex;
  gap: 6px;
  margin-top: 0;
  padding: 0 16px 4px;
  font-size: 11px;
}
.pwd-strength span {
  padding: 1px 8px;
  border-radius: 4px;
  font-weight: 500;
}
.pwd-strength .pass { background: #e8f5eb; color: #1a7f3e; }
.pwd-strength .fail { background: #fef0f0; color: #c92a2a; }
</style>