<template>
  <div class="page-container my-borrows">
    <van-nav-bar :title="userStore.isAdmin ? '借出中' : '借出列表'" left-text="返回" left-arrow @click-left="$router.push('/home')" />

    <van-tabs v-if="!userStore.isAdmin" v-model:active="activeTab" @change="onTabChange" sticky color="#1e5dc9" title-active-color="#1e5dc9">
      <van-tab v-for="t in tabs" :key="t.value" :title="t.label" :name="t.value" />
    </van-tabs>

    <van-list v-model:loading="loading" :finished="finished" @load="fetchRecords" offset="20">
      <van-swipe-cell v-for="r in records" :key="r.id">
        <div
          class="record-card"
          :class="{ 'record-overdue': r.is_overdue }"
        >
          <div class="record-top">
            <div class="record-device">{{ r.device_name }}</div>
            <div class="record-top-right">
              <span v-if="r.is_overdue" class="overdue-tag">已逾期</span>
              <span v-if="userStore.isAdmin && r.type === 'reserve'" class="record-type-tag">预约</span>
              <span v-if="userStore.isAdmin" class="record-qty">{{ r.qty }} 台</span>
              <span v-else class="record-badge" :class="'badge--' + r.status">{{ statusText(r.status) }}</span>
            </div>
          </div>
          <div class="record-detail">
            <template v-if="userStore.isAdmin">
              <div class="record-row">
                <span class="record-label">借用人</span>
                <span>{{ r.username }}-{{ r.borrower_name || r.username }}</span>
              </div>
              <div class="record-row">
                <span class="record-label">用途</span>
                <span>{{ r.purpose || '—' }}</span>
              </div>
              <div class="record-row">
                <span class="record-label">借用日期</span>
                <span>{{ r.borrow_date }}</span>
              </div>
              <div class="record-row" :class="{ 'text-danger': r.is_overdue }">
                <span class="record-label">预计归还</span>
                <span :class="{ 'fw-bold': r.is_overdue }">{{ r.expect_return || '—' }}</span>
              </div>
              <div class="record-row">
                <span class="record-label">审批人</span>
                <span>{{ r.approver || '—' }}</span>
              </div>
            </template>
            <template v-else>
              <div class="record-row">
                <span class="record-label">借用日期</span>
                <span>{{ r.borrow_date }}</span>
              </div>
              <div class="record-row">
                <span class="record-label">预计归还</span>
                <span>{{ r.expect_return || '未填写' }}</span>
              </div>
              <div class="record-row">
                <span class="record-label">数量</span>
                <span>{{ r.qty }} 台</span>
              </div>
              <div class="record-row" v-if="r.purpose">
                <span class="record-label">用途</span>
                <span class="record-purpose">{{ r.purpose }}</span>
              </div>
              <div class="record-row record-reject" v-if="r.status === 'rejected' && r.reject_reason">
                <span class="record-label">拒绝原因</span>
                <span>{{ r.reject_reason }}</span>
              </div>
              <button
                v-if="r.type === 'reserve' && r.status === 'approved'"
                class="confirm-btn"
                @click="onConfirm(r.id)"
              >确认取用</button>
            </template>
          </div>
        </div>
        <template #right>
          <van-button square type="danger" text="删除" @click="onDelete(r.id, r.device_name)" />
        </template>
      </van-swipe-cell>
      <van-empty v-if="!loading && records.length === 0" :description="userStore.isAdmin ? '当前无设备借出' : '暂无记录'" />
    </van-list>

    <van-tabbar v-model="tabbarActive" :fixed="true" :placeholder="true">
      <van-tabbar-item icon="home-o" to="/home">首页</van-tabbar-item>
      <van-tabbar-item icon="notes-o" to="/my-borrows">借出列表</van-tabbar-item>
      <van-tabbar-item v-if="userStore.isAdmin" icon="setting-o" to="/admin/devices">管理</van-tabbar-item>
    </van-tabbar>

    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { api } from '../api.js'
import { useUserStore } from '../stores/user.js'
import { useTabbarWatch } from '../utils/useTabbar.js'

const route = useRoute()
const userStore = useUserStore()

const tabbarActive = ref(1)
useTabbarWatch(tabbarActive, {
  '/home': 0,
  '/my-borrows': 1,
  '/admin': 2
})

const activeTab = ref('all')
const records = ref([])
const loading = ref(false)
const finished = ref(false)

const tabs = [
  { label: '全部', value: 'all' },
  { label: '待审批', value: 'pending' },
  { label: '预约中', value: 'reserved' },
  { label: '已通过', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
  { label: '已归还', value: 'returned' },
]

const statusText = (s) => {
  const map = { pending: '待审批', reserved: '预约中', approved: '已通过', rejected: '已拒绝', returned: '已归还', borrowed: '使用中' }
  return map[s] || s
}

const fetchRecords = async () => {
  loading.value = true
  try {
    if (userStore.isAdmin) {
      const [res1, res2] = await Promise.all([
        api.getBorrows({ status: 'approved' }),
        api.getBorrows({ status: 'borrowed' })
      ])
      const data = []
      if (res1.success) data.push(...res1.data)
      if (res2.success) data.push(...res2.data)
      records.value = data
    } else {
      const params = {}
      if (activeTab.value !== 'all') params.status = activeTab.value
      const res = await api.getBorrows(params)
      if (res.success) records.value = res.data
    }
    finished.value = true
  } catch (e) {
    console.error('获取借用记录失败:', e)
  } finally { loading.value = false }
}

const onTabChange = () => {
  finished.value = false
  fetchRecords()
}

const onConfirm = async (id) => {
  try {
    await showConfirmDialog({ title: '确认取用', message: '确认已取到该设备？取用后库存将减少' })
    const res = await api.confirmBorrow(id)
    if (res.success) { showToast('确认取用成功'); fetchRecords() }
    else showToast(res.message)
  } catch (e) { showToast('操作失败') }
}

const onDelete = async (id, name) => {
  try {
    await showConfirmDialog({ title: '确认删除', message: `确定要删除设备"${name}"的借用记录吗？` })
    const res = await api.deleteBorrow(id)
    if (res.success) { showToast('删除成功'); fetchRecords() }
    else showToast(res.message)
  } catch (e) { showToast('操作失败') }
}

onMounted(fetchRecords)
</script>

<style scoped>
.my-borrows { padding-bottom: 60px; }

.record-card {
  background: var(--surface);
  margin: 8px 16px;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: var(--shadow-sm);
}
.record-overdue {
  border-left: 3px solid var(--danger);
  background: #fef5f5;
}
.record-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.record-device {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}
.record-top-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.overdue-tag {
  background: #fef0f0;
  color: #c92a2a;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}
.record-type-tag {
  background: #f3e8ff;
  color: #7c3aed;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}
.record-qty {
  font-size: 13px;
  color: var(--text-secondary);
  background: #f0f3f8;
  padding: 2px 10px;
  border-radius: 4px;
}
.record-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 6px;
  flex-shrink: 0;
}
.badge--pending  { background: #fef3e6; color: #b85c00; }
.badge--reserved { background: #f3e8ff; color: #7c3aed; }
.badge--approved { background: #e8f5eb; color: #1a7f3e; }
.badge--rejected { background: #fef0f0; color: #c92a2a; }
.badge--returned { background: #f0f1f5; color: #9090a2; }
.badge--borrowed { background: #e8f5eb; color: #1a7f3e; }

.record-detail { border-top: 1px solid var(--divider); padding-top: 10px; }
.record-row {
  display: flex;
  padding: 4px 0;
  font-size: 13px;
  color: var(--text-secondary);
  gap: 8px;
}
.record-label {
  color: var(--text-hint);
  width: 64px;
  flex-shrink: 0;
}
.record-purpose {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.record-reject { color: var(--danger); }
.record-reject .record-label { color: var(--danger); }

.text-danger { color: var(--danger); }
.fw-bold { font-weight: 600; }

.confirm-btn {
  width: 100%;
  height: 36px;
  margin-top: 10px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition: all 0.15s var(--ease);
}
.confirm-btn:active { transform: scale(0.98); }
</style>