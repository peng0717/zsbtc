<template>
  <div class="page-container admin-repairs">
    <van-nav-bar title="报修管理" left-text="返回" left-arrow @click-left="$router.back()">
      <template #right>
        <van-button size="small" type="default" @click="exportRepairs">导出</van-button>
      </template>
    </van-nav-bar>

    <van-tabs v-model:active="activeTab" sticky color="#1e5dc9" title-active-color="#1e5dc9">
      <van-tab title="待处理" name="pending" />
      <van-tab title="处理中" name="processing" />
      <van-tab title="已完成" name="completed" />
      <van-tab title="已拒绝" name="rejected" />
    </van-tabs>

    <div class="repair-list" v-if="!loading">
      <div v-for="r in filteredList" :key="r.id" class="repair-card">
        <div class="repair-header">
          <span class="repair-device">{{ r.device_name }}</span>
          <span class="repair-type">{{ r.issue_type }}</span>
        </div>
        <div class="repair-meta">
          <span>报修人：{{ r.user_name }}</span>
          <span class="repair-status" :class="'repair-' + r.status">{{ statusText(r.status) }}</span>
        </div>
        <div class="repair-desc">{{ r.description }}</div>
        <div class="repair-time">{{ r.created_at }}</div>
        <div class="repair-actions" v-if="r.status === 'pending'">
          <button class="act-btn act-accept" @click="handleRepair(r, 'processing')">受理</button>
          <button class="act-btn act-complete" @click="handleRepair(r, 'completed')">完成</button>
          <button class="act-btn act-reject" @click="handleRepair(r, 'rejected')">拒绝</button>
        </div>
        <div class="repair-remark" v-if="r.handle_remark">
          <span class="remark-label">处理备注：</span>{{ r.handle_remark }}
        </div>
      </div>
      <van-empty v-if="filteredList.length === 0" description="暂无记录" />
    </div>
    <van-loading v-else class="repair-loading" size="24" vertical>加载中...</van-loading>

    <!-- 处理弹窗 -->
    <van-dialog v-model:show="showHandle" title="处理报修" show-cancel-button @confirm="onHandleConfirm">
      <div class="dialog-form">
        <van-field v-model="handleRemark" label="处理备注" type="textarea" rows="3" placeholder="请输入处理备注（可选）" />
      </div>
    </van-dialog>

    <van-tabbar v-model="tabbarActive" :fixed="true" :placeholder="true">
      <van-tabbar-item icon="wap-home-o" to="/admin/devices">设备管理</van-tabbar-item>
      <van-tabbar-item icon="friends-o" to="/admin/users">用户管理</van-tabbar-item>
      <van-tabbar-item icon="certificate" to="/admin/approval">借用审批</van-tabbar-item>
      <van-tabbar-item icon="exchange" to="/admin/borrow-return">借还管理</van-tabbar-item>
      <van-tabbar-item icon="records-o" to="/admin/repairs">报修</van-tabbar-item>
      <van-tabbar-item icon="todo-list-o" to="/admin/maintenance">维护</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import { api } from '../api.js'

const route = useRoute()
const tabbarActive = ref(4)
watch(() => route.path, (val) => {
  if (val === '/admin/devices') tabbarActive.value = 0
  else if (val === '/admin/users') tabbarActive.value = 1
  else if (val === '/admin/approval') tabbarActive.value = 2
  else if (val === '/admin/borrow-return') tabbarActive.value = 3
  else if (val === '/admin/repairs') tabbarActive.value = 4
  else if (val === '/admin/maintenance') tabbarActive.value = 5
}, { immediate: true })

const activeTab = ref('pending')
const repairs = ref([])
const loading = ref(false)
const showHandle = ref(false)
const handleRemark = ref('')
const handleTarget = ref(null)
const handleStatus = ref('')

const statusText = (s) => ({ pending: '待处理', processing: '处理中', completed: '已完成', rejected: '已拒绝' }[s] || s)

const filteredList = computed(() => {
  return repairs.value.filter(r => r.status === activeTab.value)
})

const fetchRepairs = async () => {
  loading.value = true
  try {
    const res = await api.getRepairs()
    if (res.success) repairs.value = res.data
  } catch (e) {} finally { loading.value = false }
}

const handleRepair = (repair, status) => {
  handleTarget.value = repair
  handleStatus.value = status
  handleRemark.value = ''
  showHandle.value = true
}

const onHandleConfirm = async () => {
  try {
    const res = await api.handleRepair(handleTarget.value.id, {
      status: handleStatus.value,
      handle_remark: handleRemark.value
    })
    if (res.success) {
      showToast('处理成功')
      showHandle.value = false
      fetchRepairs()
    } else {
      showToast(res.message)
    }
  } catch (e) {
    showToast('处理失败')
  }
}

const exportRepairs = async () => {
  try {
    const res = await api.exportRepairs()
    const blob = new Blob([res], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'repairs.csv'
    a.click()
    URL.revokeObjectURL(url)
    showToast('导出成功')
  } catch (e) {
    showToast('导出失败')
  }
}

onMounted(fetchRepairs)
</script>

<style scoped>
.admin-repairs { padding-bottom: 60px; }

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
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--primary-soft);
  color: var(--primary);
}

.repair-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-hint);
  margin-bottom: 8px;
}

.repair-pending    { color: #e0a000; font-weight: 600; }
.repair-processing { color: var(--primary); font-weight: 600; }
.repair-completed  { color: var(--success); font-weight: 600; }
.repair-rejected   { color: var(--danger); font-weight: 600; }

.repair-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  line-height: 1.5;
}

.repair-time {
  font-size: 11px;
  color: var(--text-hint);
  margin-bottom: 8px;
}

.repair-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--divider);
}

.act-btn {
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font);
  border: 1.5px solid;
  cursor: pointer;
  background: var(--surface);
  transition: all 0.15s;
}
.act-btn:active { transform: scale(0.96); }
.act-accept   { border-color: var(--primary); color: var(--primary); }
.act-complete { border-color: var(--success); color: var(--success); }
.act-reject   { border-color: var(--danger); color: var(--danger); }

.repair-remark {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--divider);
  font-size: 12px;
  color: var(--text-hint);
}
.remark-label { font-weight: 500; color: var(--text-secondary); }

.repair-loading { display: flex; justify-content: center; padding-top: 40px; }

.dialog-form { padding: 4px 0; }
</style>
