<template>
  <div class="page-container admin-approval">
    <van-nav-bar title="审批管理" left-text="返回" left-arrow @click-left="$router.back()" />

    <van-list v-model:loading="loading" :finished="finished" @load="fetchRecords">
      <div v-for="r in records" :key="r.id" class="approval-card">
        <div class="approval-header">
          <div class="approval-device">{{ r.device_name }}</div>
          <div class="approval-tags">
            <span v-if="r.type === 'reserve'" class="approval-type-tag">预约</span>
            <span class="approval-qty">{{ r.qty }} 台</span>
          </div>
        </div>
        <div class="approval-body">
          <div class="approval-row">
            <span class="approval-label">申请人</span>
            <span class="approval-value">{{ r.username }}-{{ r.borrower_name }}</span>
          </div>
          <div class="approval-row">
            <span class="approval-label">用途</span>
            <span class="approval-value">{{ r.purpose || '—' }}</span>
          </div>
          <div class="approval-row">
            <span class="approval-label">预计归还</span>
            <span class="approval-value">{{ r.expect_return || '—' }}</span>
          </div>
          <div class="approval-row">
            <span class="approval-label">申请时间</span>
            <span class="approval-value">{{ r.borrow_date }}</span>
          </div>
        </div>
        <div class="approval-actions">
          <button class="approve-btn approve-yes" @click="onApprove(r.id)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 6.5 11.5 13 5"/></svg>
            通过
          </button>
          <button class="approve-btn approve-no" @click="openReject(r.id)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
            拒绝
          </button>
        </div>
      </div>
      <van-empty v-if="!loading && error" description="加载失败" image="error">
        <van-button round type="primary" size="small" @click="fetchRecords">点击重试</van-button>
      </van-empty>
      <van-empty v-else-if="!loading && records.length === 0" description="暂无待审批记录" />
    </van-list>

    <van-dialog v-model:show="showReject" title="拒绝原因" show-cancel-button @confirm="onReject">
      <div class="dialog-form">
        <van-field v-model="rejectReason" type="textarea" rows="3" placeholder="请输入拒绝原因" />
      </div>
    </van-dialog>

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
import { showToast } from 'vant'
import { api } from '../api.js'
import { useTabbarWatch } from '../utils/useTabbar.js'
const tabbarActive = ref(2)
useTabbarWatch(tabbarActive, {
  '/admin/devices': 0, '/admin/users': 1, '/admin/approval': 2, '/admin/borrow-return': 3, '/admin/borrowed': 4, '/admin/return': 5
})

const records = ref([])
const loading = ref(false)
const error = ref(false)
const finished = ref(false)
const showReject = ref(false)
const rejectReason = ref('')
const rejectId = ref(null)
const approving = ref(false)

const fetchRecords = async () => {
  loading.value = true
  error.value = false
  try {
    const [res1, res2] = await Promise.all([
      api.getBorrows({ status: 'pending' }),
      api.getBorrows({ status: 'reserved' })
    ])
    const data = []
    if (res1.success) data.push(...res1.data)
    if (res2.success) data.push(...res2.data)
    records.value = data
    finished.value = true
  } catch (e) { console.error('获取审批列表失败:', e); error.value = true } finally { loading.value = false }
}

const onApprove = async (id) => {
  if (approving.value) return
  approving.value = true
  try {
    const res = await api.approveBorrow(id)
    if (res.success) { showToast('审批通过'); fetchRecords() }
    else showToast(res.message)
  } catch (e) { showToast('操作失败') }
  finally { approving.value = false }
}

const openReject = (id) => {
  rejectId.value = id
  rejectReason.value = ''
  showReject.value = true
}

const onReject = async () => {
  if (!rejectId.value || approving.value) return
  approving.value = true
  try {
    const res = await api.rejectBorrow(rejectId.value, rejectReason.value)
    if (res.success) { showToast('已拒绝'); fetchRecords() }
    else showToast(res.message)
  } catch (e) { showToast('操作失败') }
  finally { approving.value = false; showReject.value = false }
}

onMounted(fetchRecords)
</script>

<style scoped>
.admin-approval { padding-bottom: 60px; }

.approval-card {
  background: var(--surface);
  margin: 8px 16px;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: var(--shadow-sm);
}
.approval-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.approval-device { font-size: 16px; font-weight: 600; color: var(--text); }
.approval-tags { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.approval-type-tag {
  background: #f3e8ff;
  color: #7c3aed;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}
.approval-qty {
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 6px;
}

.approval-body { margin-bottom: 14px; }
.approval-row {
  display: flex;
  padding: 3px 0;
  font-size: 13px;
  color: var(--text-secondary);
  gap: 8px;
}
.approval-label { color: var(--text-hint); width: 64px; flex-shrink: 0; }
.approval-value { flex: 1; }

.approval-actions {
  display: flex;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--divider);
}
.approve-btn {
  flex: 1;
  height: 40px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s var(--ease);
}
.approve-btn:active { transform: scale(0.97); }
.approve-yes { background: #e8f5eb; color: #1a7f3e; }
.approve-yes:hover { background: #d4edda; }
.approve-no  { background: #fef0f0; color: #c92a2a; }
.approve-no:hover  { background: #fce4e4; }

.dialog-form { padding: 0 4px 8px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
</style>
（内容由AI生成，仅供参考）
