<template>
  <div class="page-container admin-return">
    <van-nav-bar title="归还管理" left-text="返回" left-arrow @click-left="$router.back()">
      <template #right>
        <van-icon name="scan" size="22" @click="$router.push('/scan')" class="nav-scan" />
      </template>
    </van-nav-bar>

    <van-list v-model:loading="loading" :finished="finished" @load="fetchRecords">
      <div
        v-for="r in records"
        :key="r.id"
        class="return-card"
        :class="{ 'return-overdue': isOverdue(r) }"
      >
        <div class="return-top">
          <div class="return-device">{{ r.device_name }}</div>
          <div class="return-top-tags">
            <van-tag v-if="r.type === 'reserve'" type="warning" size="medium">预约</van-tag>
            <van-tag v-if="isOverdue(r)" type="danger" size="medium">逾期</van-tag>
          </div>
        </div>
        <div class="return-body">
          <div class="return-row">
            <span class="return-label">借用人</span>
            <span>{{ r.username }}-{{ r.borrower_name }}</span>
          </div>
          <div class="return-row">
            <span class="return-label">数量</span>
            <span>{{ r.qty }} 台</span>
          </div>
          <div class="return-row">
            <span class="return-label">借用日期</span>
            <span>{{ r.borrow_date }}</span>
          </div>
          <div class="return-row" :class="{ 'text-danger': isOverdue(r) }">
            <span class="return-label">预计归还</span>
            <span :class="{ 'fw-bold': isOverdue(r) }">{{ r.expect_return || '—' }}</span>
          </div>
        </div>
        <button class="return-btn" @click="onReturn(r.id)">确认归还</button>
      </div>
      <van-empty v-if="!loading && records.length === 0" description="暂无待归还记录" />
    </van-list>

    <van-tabbar v-model="tabbarActive" :fixed="true" :placeholder="true">
      <van-tabbar-item icon="wap-home-o" to="/admin/devices">设备管理</van-tabbar-item>
      <van-tabbar-item icon="friends-o" to="/admin/users">用户管理</van-tabbar-item>
      <van-tabbar-item icon="certificate" to="/admin/approval">借用审批</van-tabbar-item>
      <van-tabbar-item icon="exchange" to="/admin/borrow-return">借还管理</van-tabbar-item>
      <van-tabbar-item icon="add-o" to="/admin/borrow">辅助登记</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { api } from '../api.js'

const records = ref([])
const loading = ref(false)
const finished = ref(false)

const route = useRoute()
const tabbarActive = ref(3)
useTabbarWatch(tabbarActive, {
  '/admin/devices': 0, '/admin/users': 1, '/admin/approval': 2, '/admin/borrow-return': 3, '/admin/borrowed': 4, '/admin/return': 5
})

const isOverdue = (r) => {
  if (!r.expect_return) return false
  // 预约类型不显示逾期（尚未取用）
  if (r.type === 'reserve') return false
  return new Date(r.expect_return) < new Date() && (r.status === 'approved' || r.status === 'borrowed')
}

const fetchRecords = async () => {
  loading.value = true
  try {
    // 同时拉取 approved（直接借用已通过）和 borrowed（预约已取用）状态
    const [res1, res2] = await Promise.all([
      api.getBorrows({ status: 'approved' }),
      api.getBorrows({ status: 'borrowed' })
    ])
    const data = []
    if (res1.success) data.push(...res1.data)
    if (res2.success) data.push(...res2.data)
    records.value = data
    finished.value = true
  } catch (e) {} finally { loading.value = false }
}

const onReturn = async (id) => {
  try {
    await showConfirmDialog({ title: '确认归还', message: '确认该设备已归还？' })
    const res = await api.returnDevice(id)
    if (res.success) { showToast('归还成功'); fetchRecords() }
    else showToast(res.message)
  } catch (e) {}
}

onMounted(fetchRecords)
</script>

<style scoped>
.admin-return { padding-bottom: 60px; }

.return-card {
  background: var(--surface);
  margin: 8px 16px;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: var(--shadow-sm);
}
.return-overdue {
  border-left: 3px solid var(--danger);
  background: #fffafa;
}
.return-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.return-device { font-size: 16px; font-weight: 600; color: var(--text); }
.return-top-tags { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.return-body { margin-bottom: 14px; }
.return-row {
  display: flex;
  padding: 3px 0;
  font-size: 13px;
  color: var(--text-secondary);
  gap: 8px;
}
.return-label { color: var(--text-hint); width: 64px; flex-shrink: 0; }

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
}
.return-btn:active { transform: scale(0.98); }

.text-danger { color: var(--danger); }
.fw-bold { font-weight: 600; }
</style>
（内容由AI生成，仅供参考）
