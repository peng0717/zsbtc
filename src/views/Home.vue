<template>
  <div class="page-container home-page">
    <van-nav-bar title="设备管理系统" fixed placeholder>
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

    <!-- 个人借用摘要 -->
    <div class="summary-card">
      <div class="summary-title">
        <span>我的借用</span>
        <span class="summary-sub" v-if="summary.borrowing === 0">暂无借用</span>
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-num summary-blue">{{ summary.borrowing }}</span>
          <span class="summary-label">借用中</span>
        </div>
        <div class="summary-item">
          <span class="summary-num summary-orange">{{ summary.toReturn }}</span>
          <span class="summary-label">待归还</span>
        </div>
        <div class="summary-item">
          <span class="summary-num summary-red">{{ summary.overdue }}</span>
          <span class="summary-label">已逾期</span>
        </div>
      </div>
    </div>

    <!-- 设备分类 + 搜索 -->
    <van-tabs v-model:active="activeCat" sticky color="#1e5dc9" title-active-color="#1e5dc9">
      <van-tab v-for="cat in categories" :key="cat" :title="cat" :name="cat" />
    </van-tabs>

    <van-search v-model="searchKey" shape="round" placeholder="搜索设备名称/型号" />

    <!-- 设备列表 -->
    <div class="device-list">
      <div
        v-for="d in filteredDevices"
        :key="d.id"
        class="device-card"
        @click="$router.push('/device/' + d.id)"
      >
        <img :src="getImgUrl(d.image) || placeholderImg" class="device-thumb" alt="" />
        <div class="device-info">
          <div class="device-name">{{ d.name }}</div>
          <div class="device-meta" v-if="d.model">{{ d.model }} · {{ d.category }}</div>
          <div class="device-stats">
            <span class="device-status" :class="'stat--' + d.status">{{ statusText(d.status) }}</span>
            <span class="device-avail">可借 {{ d.available }} / 共 {{ d.total }}</span>
          </div>
        </div>
        <van-icon name="arrow" class="device-arrow" />
      </div>
      <van-empty v-if="!loadingDevices && filteredDevices.length === 0" description="暂无设备" />
    </div>

    <!-- 底部 tabbar -->
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
  else if (val.startsWith('/admin')) tabbarActive.value = 2
}, { immediate: true })

// 个人借用摘要
const summary = ref({ borrowing: 0, toReturn: 0, overdue: 0 })

const fetchSummary = async () => {
  try {
    const res = await api.getMySummary()
    if (res.success) summary.value = res.data
  } catch (e) {}
}

// 设备列表
const devices = ref([])
const loadingDevices = ref(false)
const searchKey = ref('')
const activeCat = ref('全部')

const categories = computed(() => {
  const cats = [...new Set(devices.value.map(d => d.category).filter(Boolean))]
  return ['全部', ...cats]
})

const filteredDevices = computed(() => {
  let list = devices.value
  if (activeCat.value !== '全部') {
    list = list.filter(d => d.category === activeCat.value)
  }
  if (searchKey.value) {
    const kw = searchKey.value.toLowerCase()
    list = list.filter(d =>
      d.name.toLowerCase().includes(kw) ||
      (d.model && d.model.toLowerCase().includes(kw)) ||
      (d.category && d.category.toLowerCase().includes(kw))
    )
  }
  return list
})

const placeholderImg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjBmMmY2Ii8+PHRleHQgeD0iMzAiIHk9IjM0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYjBjMGQwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMCI+5Zu+54mHPC90ZXh0Pjwvc3ZnPg=='

const host = window.location.hostname
const getImgUrl = (img) => {
  if (!img) return ''
  if (img.startsWith('http') || img.startsWith('data:')) return img
  return `http://${host}:3001${img}`
}

const statusText = (s) => ({ normal: '正常', maintenance: '维修中', retired: '已下架' }[s] || s)

const fetchDevices = async () => {
  loadingDevices.value = true
  try {
    const res = await api.getDevices()
    if (res.success) devices.value = res.data
  } catch (e) {} finally {
    loadingDevices.value = false
  }
}

// 扫码
const goScan = () => router.push('/scan')

// 退出登录
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

// 个人信息
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
    } catch (e) {
      console.error('获取个人信息失败:', e)
    }
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

onMounted(() => {
  fetchSummary()
  fetchDevices()
})
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

/* 个人借用摘要 */
.summary-card {
  margin: 12px 16px;
  background: var(--surface);
  border-radius: 14px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}
.summary-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 14px;
}
.summary-sub { font-size: 12px; font-weight: 400; color: var(--text-hint); }
.summary-grid {
  display: flex;
  gap: 0;
}
.summary-item {
  flex: 1;
  text-align: center;
  position: relative;
}
.summary-item + .summary-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 1px;
  background: var(--divider);
}
.summary-num {
  display: block;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
}
.summary-blue   { color: #1e5dc9; }
.summary-orange { color: #e0a000; }
.summary-red    { color: #c92a2a; }
.summary-label {
  font-size: 12px;
  color: var(--text-hint);
  margin-top: 4px;
}

/* 设备列表 */
.device-list { padding: 0 16px 16px; }

.device-card {
  display: flex;
  align-items: center;
  background: var(--surface);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
  gap: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.device-card:active { background: #f7f9fc; }

.device-thumb {
  width: 52px; height: 52px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
  background: #f5f6fa;
}

.device-info { flex: 1; min-width: 0; }
.device-name { font-size: 15px; font-weight: 600; color: var(--text); }
.device-meta { font-size: 12px; color: var(--text-hint); margin-top: 2px; }
.device-stats { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.device-status {
  font-size: 11px; font-weight: 600;
  padding: 1px 8px; border-radius: 4px;
}
.stat--normal      { background: #e8f5eb; color: #1a7f3e; }
.stat--maintenance { background: #fef3e6; color: #b85c00; }
.stat--retired     { background: #fef0f0; color: #c92a2a; }
.device-avail { font-size: 12px; color: var(--text-hint); }

.device-arrow { color: #c0c4cc; flex-shrink: 0; }

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
