<template>
  <div class="page-container admin-dashboard">
    <van-nav-bar title="数据看板" left-text="返回" left-arrow @click-left="$router.push('/home')" />

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

    <div class="dash-quick">
      <h3 class="quick-title">快捷入口</h3>
      <div class="quick-grid">
        <div class="quick-item" @click="$router.push('/admin/devices')">
          <van-icon name="wap-home-o" size="22" />
          <span>设备管理</span>
        </div>
        <div class="quick-item" @click="$router.push('/admin/approval')">
          <van-icon name="certificate" size="22" />
          <span>借用审批</span>
        </div>
        <div class="quick-item" @click="$router.push('/admin/borrow-return')">
          <van-icon name="exchange-o" size="22" />
          <span>借还管理</span>
        </div>
        <div class="quick-item" @click="$router.push('/admin/users')">
          <van-icon name="friends-o" size="22" />
          <span>用户管理</span>
        </div>
      </div>
    </div>

    <van-tabbar v-model="tabbarActive" :fixed="true" :placeholder="true">
      <van-tabbar-item icon="wap-home-o" to="/admin/devices">设备管理</van-tabbar-item>
      <van-tabbar-item icon="friends-o" to="/admin/users">用户管理</van-tabbar-item>
      <van-tabbar-item icon="certificate" to="/admin/approval">借用审批</van-tabbar-item>
      <van-tabbar-item icon="exchange" to="/admin/borrow-return">借还管理</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api.js'

const route = useRoute()
const tabbarActive = ref(0)
useTabbarWatch(tabbarActive, {
  '/admin/dashboard': 0
})

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
  } catch (e) { console.error('获取统计失败:', e) }
}

onMounted(fetchStats)
</script>

<style scoped>
.admin-dashboard { padding-bottom: 60px; }

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
</style>