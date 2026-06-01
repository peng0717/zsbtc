<template>
  <div class="page-container home-page">
    <van-nav-bar title="设备列表" fixed placeholder>
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

    <van-search v-model="keyword" placeholder="搜索设备名称或型号..." @search="onSearch" shape="round" />

    <van-tabs v-model:active="activeTab" @change="onTabChange" sticky offset-top="46" color="#1e5dc9" title-active-color="#1e5dc9">
      <van-tab v-for="cat in categories" :key="cat.value" :title="cat.label" :name="cat.value" />
    </van-tabs>

    <div class="device-list">
      <div
        v-for="item in filteredDevices"
        :key="item.id"
        class="device-card"
        @click="goDetail(item.id)"
      >
        <div class="device-thumb">
          <img :src="item.image || placeholderImg" :alt="item.name" />
        </div>
        <div class="device-body">
          <div class="device-name">{{ item.name }}</div>
          <div class="device-meta">
            <span v-if="item.model" class="device-model">{{ item.model }}</span>
            <span class="device-cat">{{ item.category }}</span>
          </div>
          <div class="device-stock">
            <span class="stock-bar">
              <span class="stock-fill" :style="{ width: stockPercent(item) + '%' }"></span>
            </span>
            <span class="stock-text" :class="item.available === 0 ? 'stock-out' : ''">
              可借 {{ item.available }} / {{ item.total }}
            </span>
          </div>
        </div>
        <div class="device-arrow">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#c0c0d0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>

      <van-empty v-if="filteredDevices.length === 0 && !loading" description="暂无设备" />
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
const keyword = ref('')
const activeTab = ref('all')
const devices = ref([])
const loading = ref(true)

const placeholderImg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZjBmMmY2Ii8+PHRleHQgeD0iNDAiIHk9IjQ0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYjBjMGQwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiI+5Zu+54mHPC90ZXh0Pjwvc3ZnPg=='

const categories = computed(() => {
  const cats = [...new Set(devices.value.map(d => d.category).filter(Boolean))]
  return [
    { label: '全部', value: 'all' },
    ...cats.map(c => ({ label: c, value: c }))
  ]
})

const tabbarActive = ref(0)
watch(() => route.path, (val) => {
  if (val === '/home') tabbarActive.value = 0
  else if (val === '/my-borrows') tabbarActive.value = 1
}, { immediate: true })

const filteredDevices = computed(() => {
  let list = devices.value
  if (activeTab.value !== 'all') list = list.filter(d => d.category === activeTab.value)
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    list = list.filter(d => d.name.toLowerCase().includes(kw) || (d.model && d.model.toLowerCase().includes(kw)))
  }
  return list
})

const stockPercent = (item) => {
  if (item.total <= 0) return 0
  return Math.round((item.available / item.total) * 100)
}

const fetchDevices = async () => {
  loading.value = true
  try {
    const res = await api.getDevices({ status: 'normal' })
    if (res.success) devices.value = res.data
  } catch (e) {} finally { loading.value = false }
}

const onSearch = () => {}
const onTabChange = () => {}
const goDetail = (id) => router.push(`/device/${id}`)

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

onMounted(fetchDevices)
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

.device-list { padding: 4px 16px 16px; }

.device-card {
  display: flex;
  align-items: center;
  background: var(--surface);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  cursor: pointer;
  transition: box-shadow 0.2s var(--ease), transform 0.2s var(--ease);
  gap: 12px;
}
.device-card:active {
  box-shadow: 0 4px 14px rgba(0,0,0,0.06);
  transform: scale(0.99);
}

.device-thumb {
  width: 64px; height: 64px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f5f6fa;
}
.device-thumb img {
  width: 100%; height: 100%;
  object-fit: cover;
}

.device-body { flex: 1; min-width: 0; }
.device-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.device-meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-hint);
}
.device-cat {
  background: var(--primary-soft);
  color: var(--primary);
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.device-stock { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.stock-bar {
  width: 80px; height: 4px;
  background: #e8e9ee;
  border-radius: 2px;
  overflow: hidden;
  flex-shrink: 0;
}
.stock-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 2px;
  transition: width 0.4s var(--ease);
}
.stock-text { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
.stock-out { color: var(--danger); font-weight: 600; }

.device-arrow { flex-shrink: 0; margin-left: 4px; }

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