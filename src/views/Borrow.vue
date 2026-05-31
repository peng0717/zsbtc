<template>
  <div class="page-container">
    <van-nav-bar :title="isReserve ? '预约借用' : '申请借用'" left-text="返回" left-arrow @click-left="$router.push('/home')" />

    <!-- 设备搜索 -->
    <div class="borrow-search">
      <van-field
        v-model="deviceKeyword"
        label="设备名称"
        placeholder="输入设备名称搜索"
        clearable
        @update:model-value="onSearchDevice"
      />
      <div v-if="deviceResults.length > 0" class="device-results">
        <div
          v-for="d in deviceResults"
          :key="d.id"
          class="device-result-item"
          :class="{ selected: selectedDevice && selectedDevice.id === d.id }"
          @click="selectDevice(d)"
        >
          <div class="device-result-left">
            <div class="device-result-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e5dc9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div>
              <div class="device-result-name">{{ d.name }}</div>
              <div class="device-result-meta">
                <span v-if="d.model">{{ d.model }}</span>
                <span v-if="d.category">{{ d.category }}</span>
                <span class="device-avail">可借 {{ d.available }} 台</span>
              </div>
            </div>
          </div>
          <van-icon v-if="selectedDevice && selectedDevice.id === d.id" name="success" color="#1e5dc9" />
        </div>
      </div>
      <div v-if="selectedDevice" class="selected-tag">
        <van-tag type="primary" size="medium">已选: {{ selectedDevice.name }} (可借 {{ selectedDevice.available }} 台)</van-tag>
      </div>
    </div>

    <div class="borrow-header" v-if="selectedDevice">
      <div class="borrow-device-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e5dc9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      </div>
      <div>
        <div class="borrow-device-name">{{ selectedDevice.name }}</div>
        <div class="borrow-device-stock">
          <template v-if="isReserve">
            预约借用 <strong>{{ qty }}</strong> 台
          </template>
          <template v-else>
            剩余可借 <strong>{{ selectedDevice.available }}</strong> 台
          </template>
        </div>
      </div>
    </div>

    <van-form @submit="onSubmit" class="borrow-form" v-if="selectedDevice">
      <div class="form-section">
        <van-cell-group>
          <van-cell title="借用数量" center>
            <template #default>
              <van-stepper v-model="qty" :min="1" :max="maxQty" theme="round" />
            </template>
          </van-cell>
          <van-field
            v-model="purpose"
            name="purpose"
            label="用途说明"
            type="textarea"
            placeholder="请详细说明借用用途..."
            rows="3"
            autosize
            :rules="[{ required: true, message: '请输入借用用途' }]"
          />
          <van-field
            v-model="expectReturn"
            name="expectReturn"
            label="预计归还"
            placeholder="选择日期"
            :rules="[{ required: true, message: '请选择预计归还日期' }]"
          >
            <template #extra>
              <input type="date" v-model="expectReturn" :min="minDateStr" class="native-date-input" />
            </template>
          </van-field>
          <van-field
            v-if="isReserve"
            v-model="reserveDays"
            name="reserveDays"
            label="借用天数"
            type="number"
            placeholder="预计借用天数"
            @update:model-value="onDaysChange"
          />
        </van-cell-group>
      </div>

      <div class="form-footer">
        <button class="btn-submit" type="submit" :disabled="loading">
          <span v-if="!loading">{{ isReserve ? '提交预约' : '提交申请' }}</span>
          <span v-else class="btn-spinner"></span>
        </button>
        <p class="form-hint">{{ isReserve ? '预约后需等待管理员审批，通过后确认取用' : '提交后需等待管理员审批' }}</p>
      </div>
    </van-form>

    <van-empty v-if="!selectedDevice && !searching" description="请搜索并选择要借用的设备" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { api } from '../api.js'

const route = useRoute()
const router = useRouter()

const deviceKeyword = ref('')
const deviceResults = ref([])
const selectedDevice = ref(null)
const searching = ref(false)
let searchTimer = null

const qty = ref(1)
const purpose = ref('')
const expectReturn = ref('')
const reserveDays = ref('')
const loading = ref(false)

const isReserve = computed(() => route.query.type === 'reserve')
const maxQty = computed(() => {
  if (!selectedDevice.value) return 1
  if (isReserve.value) return Math.max(selectedDevice.value.total || 1, 10)
  return selectedDevice.value.available || 1
})

const today = new Date()
const minDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const onSearchDevice = (val) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!val) {
    deviceResults.value = []
    return
  }
  searching.value = true
  searchTimer = setTimeout(async () => {
    try {
      const res = await api.searchDevices(val)
      if (res.success) {
        deviceResults.value = res.data
        if (res.data.length === 1) {
          selectDevice(res.data[0])
        }
      }
    } catch (e) { /* ignore */ }
    searching.value = false
  }, 400)
}

const selectDevice = (d) => {
  selectedDevice.value = d
  deviceResults.value = []
  deviceKeyword.value = d.name
  qty.value = 1
}

const onDaysChange = (val) => {
  const days = parseInt(val)
  if (!days || days <= 0) {
    expectReturn.value = ''
    return
  }
  const d = new Date()
  d.setDate(d.getDate() + days)
  expectReturn.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 兼容旧入口：从设备详情页通过路由参数跳转时自动加载
const fetchDeviceById = async () => {
  const deviceId = route.params.deviceId
  if (!deviceId) return
  try {
    const res = await api.getDevices()
    if (res.success) {
      const found = res.data.find(d => d.id == deviceId)
      if (found) {
        selectedDevice.value = found
        deviceKeyword.value = found.name
      }
    }
  } catch (e) { /* ignore */ }
}

const onSubmit = async () => {
  if (!selectedDevice.value) return
  loading.value = true
  try {
    const payload = {
      device_id: selectedDevice.value.id,
      qty: qty.value,
      purpose: purpose.value,
      expect_return: expectReturn.value
    }
    if (isReserve.value) payload.type = 'reserve'
    const res = await api.borrow(payload)
    if (res.success) {
      showToast(isReserve.value ? '预约已提交' : '申请已提交')
      router.push('/my-borrows')
    } else {
      showToast(res.message)
    }
  } catch (e) {
    showToast('提交失败')
  } finally {
    loading.value = false
  }
}

onMounted(fetchDeviceById)
</script>

<style scoped>
.borrow-search {
  background: var(--surface);
  margin: 12px 16px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.device-results {
  border-top: 1px solid var(--divider);
}

.device-result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid #f5f6fa;
  cursor: pointer;
  transition: background 0.15s;
}
.device-result-item:active { background: #f5f7ff; }
.device-result-item.selected { background: #f0f4ff; }
.device-result-left { display: flex; align-items: center; gap: 10px; }
.device-result-icon {
  width: 40px; height: 40px;
  background: var(--primary-soft);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.device-result-name { font-size: 14px; font-weight: 500; color: var(--text); }
.device-result-meta {
  display: flex; gap: 6px; align-items: center;
  margin-top: 2px; font-size: 12px; color: var(--text-hint);
}
.device-avail { color: var(--primary); font-weight: 500; }

.selected-tag { padding: 8px 16px 12px; }

.borrow-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 16px;
  background: var(--surface);
  margin: 12px 16px;
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}
.borrow-device-icon {
  width: 48px; height: 48px;
  background: var(--primary-soft);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.borrow-device-name { font-size: 16px; font-weight: 600; color: var(--text); }
.borrow-device-stock { font-size: 13px; color: var(--text-hint); margin-top: 2px; }
.borrow-device-stock strong { color: var(--primary); }

.borrow-form { padding: 0 16px; }
.form-section { margin-bottom: 24px; }

.form-footer { text-align: center; }
.btn-submit {
  width: 100%;
  height: 48px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  font-family: var(--font);
  letter-spacing: 2px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(30,93,201,0.2);
  transition: all 0.2s var(--ease);
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-submit:active { transform: scale(0.98); transition: transform 0.1s; }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
.form-hint { font-size: 12px; color: var(--text-hint); margin-top: 10px; }

.btn-spinner {
  width: 20px; height: 20px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.native-date-input {
  border: none;
  font-size: 14px;
  text-align: right;
  background: transparent;
  color: var(--text);
  padding: 0;
  outline: none;
  font-family: var(--font);
}
</style>