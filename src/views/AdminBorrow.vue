<template>
  <div class="page-container admin-borrow">
    <van-nav-bar title="辅助登记" left-text="返回" left-arrow @click-left="$router.push('/home')" />

    <div class="borrow-form-wrap">
      <!-- 学工号搜索 -->
      <div class="search-section">
        <div class="section-title">借用人信息</div>
        <van-field
          v-model="username"
          label="学工号"
          placeholder="请输入学工号搜索用户"
          clearable
          @update:model-value="onSearchUser"
        />
        <div v-if="userResults.length > 0" class="search-results">
          <div
            v-for="u in userResults"
            :key="u.id"
            class="search-item"
            :class="{ selected: selectedUser && selectedUser.id === u.id }"
            @click="selectUser(u)"
          >
            <div class="search-item-left">
              <div class="search-item-avatar">{{ (u.name || '?')[0] }}</div>
              <div>
                <div class="search-item-name">{{ u.name }}</div>
                <div class="search-item-meta">{{ u.username }} · {{ u.role }}</div>
              </div>
            </div>
            <van-icon v-if="selectedUser && selectedUser.id === u.id" name="success" color="#1e5dc9" />
          </div>
        </div>
        <div v-if="selectedUser" class="selected-info">
          <van-tag type="primary" size="medium">{{ selectedUser.name }} - {{ selectedUser.username }} ({{ selectedUser.role }})</van-tag>
        </div>
      </div>

      <!-- 设备名称搜索 -->
      <div class="search-section">
        <div class="section-title">设备信息</div>
        <van-field
          v-model="deviceName"
          label="设备名称"
          placeholder="请输入设备名称"
          clearable
          @update:model-value="onSearchDevice"
        />
        <div v-if="deviceResults.length > 0" class="search-results">
          <div
            v-for="d in deviceResults"
            :key="d.id"
            class="search-item"
            :class="{ selected: selectedDevice && selectedDevice.id === d.id }"
            @click="selectDevice(d)"
          >
            <div class="search-item-left">
              <div class="search-item-avatar device-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e5dc9" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
              <div>
                <div class="search-item-name">{{ d.name }}</div>
                <div class="search-item-meta">{{ d.model || d.category }} · 可借 {{ d.available }}/{{ d.total }}</div>
              </div>
            </div>
            <van-icon v-if="selectedDevice && selectedDevice.id === d.id" name="success" color="#1e5dc9" />
          </div>
        </div>
        <div v-if="selectedDevice" class="selected-info">
          <van-tag type="primary" size="medium">{{ selectedDevice.name }} ({{ selectedDevice.model || '无型号' }}) - 可借 {{ selectedDevice.available }} 台</van-tag>
        </div>
      </div>

      <!-- 借用信息 -->
      <div class="search-section" v-if="selectedDevice">
        <div class="section-title">借用信息</div>
        <van-cell-group>
          <van-cell title="借用数量" center>
            <template #default>
              <van-stepper v-model="qty" :min="1" :max="selectedDevice.available || 1" theme="round" />
            </template>
          </van-cell>
          <van-field
            v-model="purpose"
            label="用途说明"
            type="textarea"
            placeholder="请说明借用用途"
            rows="2"
            autosize
          />
          <van-field
            v-model="expectReturn"
            label="预计归还"
            placeholder="选择日期"
          >
            <template #extra>
              <input type="date" v-model="expectReturn" :min="minDateStr" class="native-date-input" />
            </template>
          </van-field>
        </van-cell-group>
      </div>

      <div class="form-footer" v-if="selectedDevice">
        <button class="btn-submit" :disabled="!canSubmit || loading" @click="onSubmit">
          <span v-if="!loading">确认登记</span>
          <span v-else class="btn-spinner"></span>
        </button>
        <p class="form-hint">管理员当面确认后登记，无需审批</p>
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
import { ref, computed } from 'vue'
import { showToast } from 'vant'
import { api } from '../api.js'
import { useTabbarWatch } from '../utils/useTabbar.js'
const tabbarActive = ref(4)
useTabbarWatch(tabbarActive, {
  '/admin/devices': 0, '/admin/users': 1, '/admin/approval': 2, '/admin/borrow-return': 3, '/admin/borrowed': 4, '/admin/return': 5
})

const username = ref('')
const userResults = ref([])
const selectedUser = ref(null)
let userTimer = null

const deviceName = ref('')
const deviceResults = ref([])
const selectedDevice = ref(null)
let deviceTimer = null

const qty = ref(1)
const purpose = ref('')
const expectReturn = ref('')
const loading = ref(false)

const today = new Date()
const minDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const canSubmit = computed(() => selectedUser.value && selectedDevice.value && purpose.value && expectReturn.value)

const onSearchUser = (val) => {
  if (userTimer) clearTimeout(userTimer)
  if (!val) {
    userResults.value = []
    return
  }
  userTimer = setTimeout(async () => {
    try {
      const res = await api.searchUsers(val)
      if (res.success) {
        userResults.value = res.data
        if (res.data.length === 1 && (!selectedUser.value || selectedUser.value.id !== res.data[0].id)) {
          selectUser(res.data[0])
        }
      }
    } catch (e) { console.error('设备搜索失败:', e) }
  }, 400)
}

const selectUser = (u) => {
  selectedUser.value = u
  userResults.value = []
  username.value = u.username
}

const onSearchDevice = (val) => {
  if (deviceTimer) clearTimeout(deviceTimer)
  if (!val) {
    deviceResults.value = []
    return
  }
  deviceTimer = setTimeout(async () => {
    try {
      const res = await api.searchDevices(val)
      if (res.success) {
        deviceResults.value = res.data
        if (res.data.length === 1 && (!selectedDevice.value || selectedDevice.value.id !== res.data[0].id)) {
          selectDevice(res.data[0])
        }
      }
    } catch (e) { console.error('设备搜索失败:', e) }
  }, 400)
}

const selectDevice = (d) => {
  selectedDevice.value = d
  deviceResults.value = []
  deviceName.value = d.name
  qty.value = 1
}

const onSubmit = async () => {
  if (!canSubmit.value) return
  loading.value = true
  try {
    const res = await api.adminBorrow({
      username: selectedUser.value.username,
      device_id: selectedDevice.value.id,
      device_name: selectedDevice.value.name,
      qty: qty.value,
      purpose: purpose.value,
      expect_return: expectReturn.value
    })
    if (res.success) {
      showToast('登记成功')
      // 重置表单
      selectedUser.value = null
      username.value = ''
      userResults.value = []
      selectedDevice.value = null
      deviceName.value = ''
      deviceResults.value = []
      qty.value = 1
      purpose.value = ''
      expectReturn.value = ''
    } else {
      showToast(res.message)
    }
  } catch (e) {
    showToast('登记失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.admin-borrow { padding-bottom: 60px; }

.borrow-form-wrap { padding: 8px 16px; }

.search-section {
  background: var(--surface);
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  padding: 12px 16px 0;
}

.search-results {
  border-top: 1px solid var(--divider);
  margin-top: 8px;
}

.search-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid #f5f6fa;
  cursor: pointer;
  transition: background 0.15s;
}
.search-item:active { background: #f5f7ff; }
.search-item.selected { background: #f0f4ff; }
.search-item-left { display: flex; align-items: center; gap: 10px; }
.search-item-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.device-avatar { border-radius: 8px; }
.search-item-name { font-size: 14px; font-weight: 500; color: var(--text); }
.search-item-meta { font-size: 12px; color: var(--text-hint); margin-top: 1px; }

.selected-info {
  padding: 8px 16px 12px;
}

.form-footer { text-align: center; margin-top: 20px; }
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
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-submit:active { transform: scale(0.98); }
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