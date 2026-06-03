<template>
  <div class="scan-page">
    <van-nav-bar title="扫码借用" left-text="返回" left-arrow @click-left="goBack" fixed placeholder />

    <div class="scan-container">
      <div v-if="!scanning" class="scan-placeholder">
        <van-icon name="scan" size="48" color="#c0c0d0" />
        <p class="scan-tip">将设备上的二维码对准框内</p>
        <van-button type="primary" round block @click="startScan" class="scan-btn">开始扫码</van-button>
      </div>
      <div v-else id="qr-reader" class="qr-reader"></div>
    </div>

    <!-- 扫码结果 -->
    <van-dialog v-model:show="showResult" title="扫码结果" :show-cancel-button="false" @confirm="onResultConfirm">
      <div class="result-content">
        <div class="result-text">
          <van-icon name="qr" size="20" />
          <span>{{ scannedText }}</span>
        </div>
        <div v-if="matchStatus === 'searching'" class="result-searching">
          <van-loading size="20" /> 正在匹配设备...
        </div>
        <div v-else-if="matchStatus === 'single'" class="result-success">
          <van-icon name="success" color="#07c160" />
          <span>已匹配设备：{{ matchedDevice?.name }}</span>
        </div>
        <div v-if="matchStatus === 'single' && matchedDevice" class="result-actions">
          <van-button type="primary" round block @click="goBorrow">立即借用</van-button>
        </div>
        <div v-else-if="matchStatus === 'multiple'" class="result-multi">
          <p>找到多个匹配设备，请选择：</p>
          <div v-for="d in matchList" :key="d.id" class="multi-item" @click="selectDevice(d)">
            <span class="item-name">{{ d.name }}</span>
            <span class="item-model" v-if="d.model">{{ d.model }}</span>
            <span class="item-stock">可借 {{ d.available }}/{{ d.total }}</span>
          </div>
        </div>
        <div v-else-if="matchStatus === 'none'" class="result-fail">
          <van-icon name="fail" color="#ee0a24" />
          <span>未匹配到设备，请确认二维码是否正确</span>
        </div>
      </div>
    </van-dialog>

    <!-- 手动输入fallback -->
    <div class="manual-fallback">
      <van-field v-model="manualCode" placeholder="或手动输入编号/名称" clearable>
        <template #button>
          <van-button size="small" type="primary" @click="manualSearch">搜索</van-button>
        </template>
      </van-field>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { api } from '../api.js'

const router = useRouter()
const scanning = ref(false)
const showResult = ref(false)
const scannedText = ref('')
const matchStatus = ref('') // 'searching' | 'single' | 'multiple' | 'none'
const matchedDevice = ref(null)
const matchList = ref([])
const manualCode = ref('')
let html5QrCode = null

const goBack = () => {
  stopScan()
  router.back()
}

const startScan = async () => {
  scanning.value = true
  // 动态导入 html5-qrcode
  try {
    const { Html5Qrcode } = await import('html5-qrcode')
    html5QrCode = new Html5Qrcode('qr-reader')

    await html5QrCode.start(
      { facingMode: 'environment' },
      {
        fps: 30,
        qrbox: { width: 200, height: 200 },
        aspectRatio: 1.0,
        disableFlip: false,
      },
      onScanSuccess,
      () => {}
    )
  } catch (e) {
    scanning.value = false
    if (e.message && e.message.includes('Permission')) {
      showToast('请允许使用摄像头')
    } else {
      showToast('扫码启动失败，请手动输入')
    }
  }
}

const stopScan = async () => {
  if (html5QrCode) {
    try {
      await html5QrCode.stop()
    } catch (e) {}
    html5QrCode = null
  }
  scanning.value = false
}

const onScanSuccess = async (decodedText) => {
  await stopScan()
  scannedText.value = decodedText
  showResult.value = true
  matchStatus.value = 'searching'
  matchedDevice.value = null
  matchList.value = []
  await matchDevice(decodedText)
}

const matchDevice = async (text) => {
  try {
    // 优先按 qr_code 精确匹配
    const qrRes = await api.getDeviceByQr(text)
    if (qrRes.success) {
      matchedDevice.value = qrRes.data
      matchStatus.value = 'single'
      return
    }
  } catch (e) {}

  try {
    // 按设备名称搜索
    const res = await api.searchDevices(text)
    if (res.success) {
      const devices = res.data
      if (devices.length === 0) {
        matchStatus.value = 'none'
      } else if (devices.length === 1) {
        matchedDevice.value = devices[0]
        matchStatus.value = 'single'
      } else {
        matchList.value = devices
        matchStatus.value = 'multiple'
      }
      return
    }
  } catch (e) {}

  // 如果 searchDevices 无结果，尝试按 ID 精确匹配
  try {
    const id = parseInt(text)
    if (!isNaN(id)) {
      const res = await api.getDevices()
      if (res.success) {
        const device = res.data.find(d => d.id === id && d.status === 'normal')
        if (device) {
          matchedDevice.value = device
          matchStatus.value = 'single'
          return
        }
      }
    }
  } catch (e) {}

  matchStatus.value = 'none'
}

const selectDevice = (device) => {
  matchedDevice.value = device
  matchStatus.value = 'single'
}

const onResultConfirm = () => {
  showResult.value = false
  if (matchedDevice.value) {
    router.push(`/borrow/${matchedDevice.value.id}`)
  }
}

const goBorrow = () => {
  showResult.value = false
  if (matchedDevice.value) router.push(`/borrow/${matchedDevice.value.id}`)
}

const manualSearch = async () => {
  const text = manualCode.value.trim()
  if (!text) {
    showToast('请输入编号或名称')
    return
  }
  scannedText.value = text
  showResult.value = true
  matchStatus.value = 'searching'
  matchedDevice.value = null
  matchList.value = []
  await matchDevice(text)
}

onUnmounted(() => {
  stopScan()
})
</script>

<style scoped>
.scan-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 20px;
}

.scan-container {
  margin: 16px 16px 0;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.scan-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
}

.scan-tip {
  margin: 12px 0 20px;
  color: #999;
  font-size: 14px;
}

.scan-btn {
  width: 100%;
}

.qr-reader {
  width: 100%;
  aspect-ratio: 1;
}

.result-content {
  padding: 12px 16px;
}

.result-text {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #f5f6fa;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  word-break: break-all;
}

.result-searching {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  padding: 16px 0;
  color: #666;
}

.result-success {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 14px;
  color: #333;
}

.result-fail {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 14px;
  color: #ee0a24;
}

.result-multi p {
  margin: 0 0 8px;
  font-size: 13px;
  color: #666;
}

.multi-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #f5f6fa;
  border-radius: 8px;
  margin-bottom: 6px;
  cursor: pointer;
}

.multi-item:active {
  background: #e8e9ee;
}

.item-name {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.item-model {
  font-size: 12px;
  color: #999;
  flex: 1;
}

.item-stock {
  font-size: 12px;
  color: var(--primary);
}

.manual-fallback {
  margin: 16px;
}
</style>