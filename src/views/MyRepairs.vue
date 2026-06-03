<template>
  <div class="page-container my-repairs">
    <van-nav-bar title="我的报修" left-text="返回" left-arrow @click-left="$router.back()" />

    <div class="repair-list" v-if="!loading">
      <div v-for="r in repairs" :key="r.id" class="repair-card">
        <div class="repair-header">
          <span class="repair-device">{{ r.device_name }}</span>
          <span class="repair-type">{{ r.issue_type }}</span>
        </div>
        <div class="repair-status" :class="'repair-' + r.status">
          {{ statusText(r.status) }}
        </div>
        <div class="repair-desc">{{ r.description }}</div>
        <div class="repair-time">{{ r.created_at }}</div>
        <div class="repair-remark" v-if="r.handle_remark">
          <span class="remark-label">处理备注：</span>{{ r.handle_remark }}
        </div>
      </div>
      <van-empty v-if="repairs.length === 0" description="暂无报修记录" />
    </div>
    <van-loading v-else class="repair-loading" size="24" vertical>加载中...</van-loading>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api.js'

const repairs = ref([])
const loading = ref(false)

const statusText = (s) => ({ pending: '待处理', processing: '处理中', completed: '已完成', rejected: '已拒绝' }[s] || s)

onMounted(async () => {
  loading.value = true
  try {
    const res = await api.getMyRepairs()
    if (res.success) repairs.value = res.data
  } catch (e) {} finally { loading.value = false }
})
</script>

<style scoped>
.my-repairs { min-height: 100vh; background: var(--bg); }

.repair-list { padding: 0 16px 16px; }

.repair-card {
  background: var(--surface);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
}

.repair-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.repair-device { font-size: 15px; font-weight: 600; color: var(--text); }

.repair-type {
  font-size: 11px; font-weight: 500;
  padding: 2px 8px; border-radius: 4px;
  background: var(--primary-soft); color: var(--primary);
}

.repair-status {
  display: inline-block;
  font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 4px;
  margin-bottom: 8px;
}

.repair-pending    { background: #fff8e6; color: #b85c00; }
.repair-processing { background: var(--primary-soft); color: var(--primary); }
.repair-completed  { background: #e8f5eb; color: #1a7f3e; }
.repair-rejected   { background: #fef0f0; color: #c92a2a; }

.repair-desc {
  font-size: 13px; color: var(--text-secondary);
  margin-bottom: 6px; line-height: 1.5;
}

.repair-time { font-size: 11px; color: var(--text-hint); margin-bottom: 6px; }

.repair-remark {
  padding-top: 8px; border-top: 1px solid var(--divider);
  font-size: 12px; color: var(--text-hint);
}
.remark-label { font-weight: 500; color: var(--text-secondary); }

.repair-loading { display: flex; justify-content: center; padding-top: 40px; }
</style>
