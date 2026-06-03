<template>
  <div class="page-container admin-borrow-return">
    <van-nav-bar title="借还管理" left-text="返回" left-arrow @click-left="$router.back()">
      <template #right>
        <van-button size="small" type="default" @click="exportBorrows">导出</van-button>
        <van-icon name="scan" size="22" @click="$router.push('/scan')" class="nav-scan" style="margin-left:6px" />
      </template>
    </van-nav-bar>

    <van-tabs v-model:active="activeTab" sticky color="#1e5dc9" title-active-color="#1e5dc9">
      <van-tab title="借出中" name="borrowed" />
      <van-tab title="待归还" name="return" />
    </van-tabs>

    <!-- 借出中 -->
    <div v-show="activeTab === 'borrowed'">
      <van-list v-model:loading="loadingBorrowed" :finished="finishedBorrowed" @load="fetchBorrowed">
        <div
          v-for="r in borrowedRecords"
          :key="r.id"
          class="record-card"
          :class="{ 'record-overdue': isOverdue(r) }"
        >
          <div class="record-top">
            <div class="record-device">{{ r.device_name }}</div>
            <div class="record-badges">
              <van-tag v-if="isOverdue(r)" type="danger" size="medium">逾期</van-tag>
              <span class="record-qty">{{ r.qty }} 台</span>
            </div>
          </div>
          <div class="record-body">
            <div class="record-row">
              <span class="record-label">借用人</span>
              <span>{{ r.username }}</span>
            </div>
            <div class="record-row">
              <span class="record-label">用途</span>
              <span>{{ r.purpose || '—' }}</span>
            </div>
            <div class="record-row">
              <span class="record-label">借用日期</span>
              <span>{{ r.borrow_date }}</span>
            </div>
            <div class="record-row" :class="{ 'text-danger': isOverdue(r) }">
              <span class="record-label">预计归还</span>
              <span :class="{ 'fw-bold': isOverdue(r) }">{{ r.expect_return || '—' }}</span>
            </div>
            <div class="record-row">
              <span class="record-label">审批人</span>
              <span>{{ r.approver || '—' }}</span>
            </div>
          </div>
        </div>
        <van-empty v-if="!loadingBorrowed && borrowedRecords.length === 0" description="当前无设备借出" />
      </van-list>
    </div>

    <!-- 待归还 -->
    <div v-show="activeTab === 'return'">
      <van-list v-model:loading="loadingReturn" :finished="finishedReturn" @load="fetchReturn">
        <div
          v-for="r in returnRecords"
          :key="r.id"
          class="record-card"
          :class="{ 'record-overdue': isOverdueReturn(r) }"
        >
          <div class="record-top">
            <div class="record-device">{{ r.device_name }}</div>
            <div class="record-top-tags">
              <van-tag v-if="r.type === 'reserve'" type="warning" size="medium">预约</van-tag>
              <van-tag v-if="isOverdueReturn(r)" type="danger" size="medium">逾期</van-tag>
            </div>
          </div>
          <div class="record-body">
            <div class="record-row">
              <span class="record-label">借用人</span>
              <span>{{ r.username }}-{{ r.borrower_name }}</span>
            </div>
            <div class="record-row">
              <span class="record-label">数量</span>
              <span>{{ r.qty }} 台</span>
            </div>
            <div class="record-row">
              <span class="record-label">借用日期</span>
              <span>{{ r.borrow_date }}</span>
            </div>
            <div class="record-row" :class="{ 'text-danger': isOverdueReturn(r) }">
              <span class="record-label">预计归还</span>
              <span :class="{ 'fw-bold': isOverdueReturn(r) }">{{ r.expect_return || '—' }}</span>
            </div>
          </div>
          <button class="return-btn" @click="onReturn(r.id)">确认归还</button>
        </div>
        <van-empty v-if="!loadingReturn && returnRecords.length === 0" description="暂无待归还记录" />
      </van-list>
    </div>

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
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { api } from '../api.js'

const route = useRoute()
const activeTab = ref('borrowed')

const tabbarActive = ref(3)
watch(() => route.path, (val) => {
  if (val === '/admin/devices') tabbarActive.value = 0
  else if (val === '/admin/users') tabbarActive.value = 1
  else if (val === '/admin/approval') tabbarActive.value = 2
  else if (val === '/admin/borrow-return') tabbarActive.value = 3
  else if (val === '/admin/repairs') tabbarActive.value = 4
  else if (val === '/admin/maintenance') tabbarActive.value = 5
}, { immediate: true })

// 借出中
const borrowedRecords = ref([])
const loadingBorrowed = ref(false)
const finishedBorrowed = ref(false)

const isOverdue = (r) => {
  if (!r.expect_return) return false
  return new Date(r.expect_return) < new Date()
}

const fetchBorrowed = async () => {
  loadingBorrowed.value = true
  try {
    const res = await api.getBorrows({ status: 'approved' })
    if (res.success) borrowedRecords.value = res.data
    finishedBorrowed.value = true
  } catch (e) {} finally { loadingBorrowed.value = false }
}

// 待归还
const returnRecords = ref([])
const loadingReturn = ref(false)
const finishedReturn = ref(false)

const isOverdueReturn = (r) => {
  if (!r.expect_return) return false
  if (r.type === 'reserve') return false
  return new Date(r.expect_return) < new Date() && (r.status === 'approved' || r.status === 'borrowed')
}

const fetchReturn = async () => {
  loadingReturn.value = true
  try {
    const [res1, res2] = await Promise.all([
      api.getBorrows({ status: 'approved' }),
      api.getBorrows({ status: 'borrowed' })
    ])
    const data = []
    if (res1.success) data.push(...res1.data)
    if (res2.success) data.push(...res2.data)
    returnRecords.value = data
    finishedReturn.value = true
  } catch (e) {} finally { loadingReturn.value = false }
}

const onReturn = async (id) => {
  try {
    await showConfirmDialog({ title: '确认归还', message: '确认该设备已归还？' })
    const res = await api.returnDevice(id)
    if (res.success) { showToast('归还成功'); fetchReturn() }
    else showToast(res.message)
  } catch (e) {}
}

onMounted(() => {
  fetchBorrowed()
  fetchReturn()
})

const exportBorrows = async () => {
  try {
    const blob = await api.exportBorrows()
    const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'borrows.csv'; a.click()
    URL.revokeObjectURL(url)
    showToast('导出成功')
  } catch (e) { showToast('导出失败') }
}
</script>

<style scoped>
.admin-borrow-return { padding-bottom: 60px; }

.record-card {
  background: var(--surface);
  margin: 8px 16px;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: var(--shadow-sm);
}
.record-overdue {
  border-left: 3px solid var(--danger);
  background: #fffafa;
}
.record-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.record-device { font-size: 16px; font-weight: 600; color: var(--text); }
.record-badges { display: flex; align-items: center; gap: 8px; }
.record-top-tags { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.record-qty {
  font-size: 13px;
  color: var(--text-secondary);
  background: #f0f3f8;
  padding: 2px 10px;
  border-radius: 4px;
}

.record-body { margin-bottom: 4px; }
.record-row {
  display: flex;
  padding: 3px 0;
  font-size: 13px;
  color: var(--text-secondary);
  gap: 8px;
}
.record-label { color: var(--text-hint); width: 64px; flex-shrink: 0; }

.return-btn {
  width: 100%;
  height: 38px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition: all 0.15s var(--ease);
  margin-top: 8px;
}
.return-btn:active { transform: scale(0.98); }

.text-danger { color: var(--danger); }
.fw-bold { font-weight: 600; }
</style>
