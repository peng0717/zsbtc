<template>
  <div class="page-container admin-borrowed">
    <van-nav-bar title="借出中" left-text="返回" left-arrow @click-left="$router.back()" />

    <van-list v-model:loading="loading" :finished="finished" @load="fetchRecords">
      <div
        v-for="r in records"
        :key="r.id"
        class="borrowed-card"
        :class="{ 'borrowed-overdue': isOverdue(r) }"
      >
        <div class="borrowed-top">
          <div class="borrowed-device">{{ r.device_name }}</div>
          <div class="borrowed-badges">
            <van-tag v-if="isOverdue(r)" type="danger" size="medium">逾期</van-tag>
            <span class="borrowed-qty">{{ r.qty }} 台</span>
          </div>
        </div>
        <div class="borrowed-body">
          <div class="borrowed-row">
            <span class="borrowed-label">借用人</span>
            <span>{{ r.username }}</span>
          </div>
          <div class="borrowed-row">
            <span class="borrowed-label">用途</span>
            <span>{{ r.purpose || '—' }}</span>
          </div>
          <div class="borrowed-row">
            <span class="borrowed-label">借用日期</span>
            <span>{{ r.borrow_date }}</span>
          </div>
          <div class="borrowed-row" :class="{ 'text-danger': isOverdue(r) }">
            <span class="borrowed-label">预计归还</span>
            <span :class="{ 'fw-bold': isOverdue(r) }">{{ r.expect_return || '—' }}</span>
          </div>
          <div class="borrowed-row">
            <span class="borrowed-label">审批人</span>
            <span>{{ r.approver || '—' }}</span>
          </div>
        </div>
      </div>
      <van-empty v-if="!loading && records.length === 0" description="当前无设备借出" />
    </van-list>

    <van-tabbar v-model="tabbarActive" :fixed="true" :placeholder="true">
      <van-tabbar-item icon="wap-home-o" to="/admin/devices">设备管理</van-tabbar-item>
      <van-tabbar-item icon="friends-o" to="/admin/users">用户管理</van-tabbar-item>
      <van-tabbar-item icon="certificate" to="/admin/approval">借用审批</van-tabbar-item>
      <van-tabbar-item icon="exchange" to="/admin/borrow-return">借还管理</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api.js'

const route = useRoute()
const tabbarActive = ref(3)
watch(() => route.path, (val) => {
  if (val === '/admin/devices') tabbarActive.value = 0
  else if (val === '/admin/users') tabbarActive.value = 1
  else if (val === '/admin/approval') tabbarActive.value = 2
  else if (val === '/admin/borrow-return') tabbarActive.value = 3
}, { immediate: true })

const records = ref([])
const loading = ref(false)
const finished = ref(false)

const isOverdue = (r) => {
  if (!r.expect_return) return false
  return new Date(r.expect_return) < new Date()
}

const fetchRecords = async () => {
  loading.value = true
  try {
    const res = await api.getBorrows({ status: 'approved' })
    if (res.success) records.value = res.data
    finished.value = true
  } catch (e) {} finally { loading.value = false }
}

onMounted(fetchRecords)
</script>

<style scoped>
.admin-borrowed { padding-bottom: 60px; }

.borrowed-card {
  background: var(--surface);
  margin: 8px 16px;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: var(--shadow-sm);
}
.borrowed-overdue {
  border-left: 3px solid var(--danger);
  background: #fffafa;
}
.borrowed-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.borrowed-device { font-size: 16px; font-weight: 600; color: var(--text); }
.borrowed-badges { display: flex; align-items: center; gap: 8px; }
.borrowed-qty {
  font-size: 13px;
  color: var(--text-secondary);
  background: #f0f3f8;
  padding: 2px 10px;
  border-radius: 4px;
}

.borrowed-body { margin-bottom: 4px; }
.borrowed-row {
  display: flex;
  padding: 3px 0;
  font-size: 13px;
  color: var(--text-secondary);
  gap: 8px;
}
.borrowed-label { color: var(--text-hint); width: 64px; flex-shrink: 0; }

.text-danger { color: var(--danger); }
.fw-bold { font-weight: 600; }
</style>
（内容由AI生成，仅供参考）
