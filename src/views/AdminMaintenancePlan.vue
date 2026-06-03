<template>
  <div class="page-container admin-maintenance">
    <van-nav-bar title="维护计划" left-text="返回" left-arrow @click-left="$router.back()">
      <template #right>
        <van-button size="small" type="primary" @click="openCreate">新建</van-button>
      </template>
    </van-nav-bar>

    <div class="maintenance-list" v-if="!loading">
      <div v-for="p in plans" :key="p.id" class="plan-card">
        <div class="plan-header">
          <span class="plan-name">{{ p.plan_name }}</span>
          <span class="plan-status" :class="p.status === 'active' ? 'plan-active' : 'plan-paused'">
            {{ p.status === 'active' ? '进行中' : '已暂停' }}
          </span>
        </div>
        <div class="plan-meta">
          <span class="plan-device">{{ p.device_name }}</span>
          <span class="plan-freq">每 {{ p.frequency_days }} 天</span>
        </div>
        <div class="plan-dates">
          <div><span class="date-label">上次维护：</span>{{ p.last_maintained_at || '暂无' }}</div>
          <div><span class="date-label">下次维护：</span>{{ p.next_maintain_at || '待计算' }}</div>
        </div>
        <div class="plan-actions">
          <button class="act-btn act-do" @click="openExecute(p)">执行维护</button>
          <button class="act-btn act-edit" @click="openEdit(p)">编辑</button>
          <button v-if="p.status === 'active'" class="act-btn act-pause" @click="toggleStatus(p, 'paused')">暂停</button>
          <button v-else class="act-btn act-resume" @click="toggleStatus(p, 'active')">恢复</button>
          <button class="act-btn act-delete" @click="onDelete(p.id)">删除</button>
        </div>
      </div>
      <van-empty v-if="plans.length === 0" description="暂无维护计划" />
    </div>
    <van-loading v-else class="plan-loading" size="24" vertical>加载中...</van-loading>

    <!-- 维护日志 -->
    <div class="log-section" v-if="logs.length">
      <h3 class="log-title">最近维护日志</h3>
      <div v-for="log in logs" :key="log.id" class="log-card">
        <div class="log-meta">
          <span>{{ log.device_name }}</span>
          <span class="log-handler">操作人：{{ log.handler_name }}</span>
        </div>
        <div class="log-result" v-if="log.result">{{ log.result }}</div>
        <div class="log-time">{{ log.created_at }}</div>
      </div>
    </div>

    <!-- 新建/编辑弹窗 -->
    <van-dialog v-model:show="showForm" :title="editing ? '编辑维护计划' : '新建维护计划'" show-cancel-button @confirm="onSave">
      <div class="dialog-form">
        <van-field v-model="form.plan_name" label="计划名" placeholder="如：月度巡检" />
        <van-field v-model="form.frequency_days" label="周期（天）" type="number" placeholder="如：30" />
        <van-field v-model="form.description" label="描述" type="textarea" rows="2" placeholder="维护内容描述（可选）" />
        <van-field v-model="selectedDeviceName" label="设备" readonly is-link placeholder="点击选择设备" @click="showDevicePicker = true" />
      </div>
    </van-dialog>

    <van-popup v-model:show="showDevicePicker" position="bottom" round :style="{ height: '60%' }">
      <div class="picker-header">
        <span>选择设备</span>
        <van-icon name="cross" size="20" @click="showDevicePicker = false" />
      </div>
      <div class="picker-list">
        <div
          v-for="d in devices"
          :key="d.id"
          class="picker-item"
          :class="{ 'picker-item--active': form.device_id === d.id }"
          @click="selectDevice(d)"
        >
          <span>{{ d.name }}</span>
          <span class="picker-item-model" v-if="d.model">{{ d.model }}</span>
        </div>
        <van-empty v-if="devices.length === 0" description="暂无设备" />
      </div>
    </van-popup>

    <!-- 执行维护弹窗 -->
    <van-dialog v-model:show="showExecute" title="执行维护" show-cancel-button @confirm="onExecute">
      <div class="dialog-form">
        <div class="execute-info">
          <div><strong>设备：</strong>{{ executeTarget?.device_name }}</div>
          <div><strong>计划：</strong>{{ executeTarget?.plan_name }}</div>
        </div>
        <van-field v-model="executeResult" label="维护结果" type="textarea" rows="3" placeholder="记录维护结果（可选）" />
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
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { api } from '../api.js'

const route = useRoute()
const tabbarActive = ref(5)
watch(() => route.path, (val) => {
  if (val === '/admin/devices') tabbarActive.value = 0
  else if (val === '/admin/users') tabbarActive.value = 1
  else if (val === '/admin/approval') tabbarActive.value = 2
  else if (val === '/admin/borrow-return') tabbarActive.value = 3
  else if (val === '/admin/repairs') tabbarActive.value = 4
  else if (val === '/admin/maintenance') tabbarActive.value = 5
}, { immediate: true })

const plans = ref([])
const devices = ref([])
const logs = ref([])
const loading = ref(false)
const showForm = ref(false)
const showDevicePicker = ref(false)
const showExecute = ref(false)
const editing = ref(false)
const selectedDeviceName = ref('')

const executeTarget = ref(null)
const executeResult = ref('')

const form = ref({ id: '', device_id: '', plan_name: '', frequency_days: 30, description: '' })

const fetchPlans = async () => {
  loading.value = true
  try {
    const [planRes, deviceRes, logRes] = await Promise.all([
      api.getPlans(),
      api.getDevices(),
      api.getLogs()
    ])
    if (planRes.success) plans.value = planRes.data
    if (deviceRes.success) devices.value = deviceRes.data.filter(d => d.status !== 'deleted')
    if (logRes.success) logs.value = logRes.data
  } catch (e) {} finally { loading.value = false }
}

const openCreate = () => {
  editing.value = false
  form.value = { id: '', device_id: '', plan_name: '', frequency_days: 30, description: '' }
  selectedDeviceName.value = ''
  showForm.value = true
}

const openEdit = (plan) => {
  editing.value = true
  form.value = { ...plan, frequency_days: String(plan.frequency_days) }
  selectedDeviceName.value = plan.device_name || ''
  showForm.value = true
}

const selectDevice = (d) => {
  form.value.device_id = d.id
  selectedDeviceName.value = d.name
  showDevicePicker.value = false
}

const onSave = async () => {
  if (!form.value.plan_name || !form.value.frequency_days || !form.value.device_id) {
    showToast('请填写必填项')
    return
  }
  try {
    const data = {
      device_id: form.value.device_id,
      plan_name: form.value.plan_name,
      frequency_days: parseInt(form.value.frequency_days),
      description: form.value.description
    }
    const res = editing.value
      ? await api.updatePlan(form.value.id, { ...data, status: undefined })
      : await api.createPlan(data)
    if (res.success) {
      showToast(editing.value ? '更新成功' : '创建成功')
      showForm.value = false
      fetchPlans()
    } else {
      showToast(res.message)
    }
  } catch (e) { showToast('操作失败') }
}

const toggleStatus = async (plan, newStatus) => {
  try {
    const res = await api.updatePlan(plan.id, { status: newStatus })
    if (res.success) { showToast(newStatus === 'active' ? '已恢复' : '已暂停'); fetchPlans() }
    else showToast(res.message)
  } catch (e) {}
}

const onDelete = async (id) => {
  try {
    await showConfirmDialog({ title: '确认删除', message: '确定要删除该维护计划吗？' })
    const res = await api.deletePlan(id)
    if (res.success) { showToast('已删除'); fetchPlans() }
    else showToast(res.message)
  } catch (e) {}
}

const openExecute = (plan) => {
  executeTarget.value = plan
  executeResult.value = ''
  showExecute.value = true
}

const onExecute = async () => {
  try {
    const res = await api.createLog({
      plan_id: executeTarget.value.id,
      device_id: executeTarget.value.device_id,
      result: executeResult.value
    })
    if (res.success) {
      showToast('维护已记录')
      showExecute.value = false
      fetchPlans()
    } else {
      showToast(res.message)
    }
  } catch (e) { showToast('操作失败') }
}

onMounted(fetchPlans)
</script>

<style scoped>
.admin-maintenance { padding-bottom: 60px; }

.maintenance-list { padding: 0 16px 16px; }

.plan-card {
  background: var(--surface);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
}

.plan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.plan-name { font-size: 15px; font-weight: 600; color: var(--text); }

.plan-active {
  font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 4px;
  background: #e8f5eb; color: #1a7f3e;
}

.plan-paused {
  font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 4px;
  background: #fef0f0; color: #c92a2a;
}

.plan-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-hint);
  margin-bottom: 8px;
}

.plan-device { color: var(--primary); font-weight: 500; }

.plan-dates {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 10px;
  line-height: 1.8;
}
.date-label { color: var(--text-hint); }

.plan-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid var(--divider);
}

.act-btn {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  font-family: var(--font);
  border: 1.5px solid;
  cursor: pointer;
  background: var(--surface);
  transition: all 0.15s;
}
.act-btn:active { transform: scale(0.96); }
.act-do     { border-color: var(--success); color: var(--success); }
.act-edit   { border-color: var(--primary); color: var(--primary); }
.act-pause  { border-color: #e0a000; color: #e0a000; }
.act-resume { border-color: var(--success); color: var(--success); }
.act-delete { border-color: var(--danger); color: var(--danger); }

.plan-loading { display: flex; justify-content: center; padding-top: 40px; }

.log-section { margin: 0 16px 16px; }
.log-title { font-size: 15px; font-weight: 600; color: var(--text); margin: 0 0 10px; }

.log-card {
  background: var(--surface);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 8px;
  box-shadow: var(--shadow-sm);
  font-size: 12px;
}

.log-meta {
  display: flex;
  justify-content: space-between;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 4px;
}
.log-handler { color: var(--text-hint); font-weight: 400; }

.log-result {
  color: var(--text-hint);
  margin-bottom: 4px;
  line-height: 1.4;
}

.log-time { color: var(--text-hint); font-size: 11px; }

.dialog-form { padding: 4px 0; }

.execute-info {
  padding: 10px 16px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
  background: #f9fafc;
  border-bottom: 1px solid var(--divider);
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid #f0f0f0;
}

.picker-list {
  padding: 8px 0;
  max-height: calc(60vh - 60px);
  overflow-y: auto;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  cursor: pointer;
  font-size: 14px;
}

.picker-item:active { background: #f5f6fa; }

.picker-item--active {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}

.picker-item-model { font-size: 12px; color: var(--text-hint); }
</style>
