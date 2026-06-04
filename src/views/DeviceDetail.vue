<template>
  <div class="page-container">
    <van-nav-bar title="设备详情" left-text="返回" left-arrow @click-left="$router.back()" />

    <div class="detail-hero">
      <img :src="device.image || placeholderImg" class="detail-img" alt="设备图片" />
      <div class="detail-img-overlay" v-if="device.available <= 0">
        <span>暂无库存</span>
      </div>
    </div>

    <div class="detail-body">
      <div class="detail-header">
        <h2 class="detail-name">{{ device.name }}</h2>
        <span class="detail-cat">{{ device.category || '未分类' }}</span>
      </div>

      <div class="detail-info">
        <div class="info-row" v-if="device.model">
          <span class="info-label">型号</span>
          <span class="info-value">{{ device.model }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">状态</span>
          <span class="info-value">
            <span class="status-dot" :class="statusDotClass"></span>
            {{ statusLabel }}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">可借数量</span>
          <span class="info-value">
            <strong :class="device.available > 0 ? 'text-primary' : 'text-danger'">
              {{ device.available }}
            </strong>
            <span class="text-hint"> / {{ device.total }}</span>
          </span>
        </div>
        <div class="info-row" v-if="device.description">
          <span class="info-label">描述</span>
          <span class="info-value">{{ device.description }}</span>
        </div>
      </div>

      <button
        class="btn-borrow"
        :class="{ 'btn-disabled': !canBorrow }"
        :disabled="!canBorrow"
        @click="goBorrow"
      >
        {{ borrowButtonText }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { api } from '../api.js'
import { useUserStore } from '../stores/user.js'
import { placeholderImg } from '../utils/image.js'

const route = useRoute()
const router = useRouter()
const device = ref({})


const canBorrow = computed(() => {
  if (device.value.status !== 'normal') return false
  // 库存为0时可预约，库存>0时可直接借用或预约
  return true
})

const isReserve = computed(() => device.value.available <= 0)

const borrowButtonText = computed(() => {
  if (device.value.status !== 'normal') return '设备暂不可用'
  if (device.value.available <= 0) return '预约借用'
  return '立即申请借用'
})

const statusLabel = computed(() => {
  const map = { normal: '可借用', maintenance: '维修中', retired: '已下架' }
  return map[device.value.status] || device.value.status || '未知'
})

const statusDotClass = computed(() => {
  const map = { normal: 'status-dot--green', maintenance: 'status-dot--orange', retired: 'status-dot--red' }
  return map[device.value.status] || 'status-dot--gray'
})

const fetchDetail = async () => {
  try {
    const res = await api.getDevices()
    if (res.success) {
      const found = res.data.find(d => d.id == route.params.id)
      if (found) device.value = found
    }
  } catch (e) { showToast('加载失败') }
}

const goBorrow = () => {
  const userStore = useUserStore()
  if (!userStore.token) { router.push('/login'); return }
  const query = isReserve.value ? '?type=reserve' : ''
  router.push(`/borrow/${route.params.id}${query}`)
}

onMounted(fetchDetail)
</script>

<style scoped>
.detail-hero {
  position: relative;
  width: 100%;
  height: 240px;
  overflow: hidden;
  background: #eef2f8;
}
.detail-img { width: 100%; height: 100%; object-fit: cover; }
.detail-img-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 2px;
}

.detail-body { padding: 20px 16px 40px; }

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.detail-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
}
.detail-cat {
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 6px;
  flex-shrink: 0;
}

.detail-info { margin-bottom: 28px; }
.info-row {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px solid var(--divider);
  gap: 12px;
}
.info-row:last-child { border-bottom: none; }
.info-label {
  font-size: 14px;
  color: var(--text-hint);
  width: 72px;
  flex-shrink: 0;
}
.info-value { font-size: 14px; color: var(--text); flex: 1; }

.btn-borrow {
  width: 100%;
  height: 50px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  font-family: var(--font);
  letter-spacing: 2px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(30,93,201,0.22);
  transition: all 0.2s var(--ease);
}
.btn-borrow:active { transform: scale(0.98); transition: transform 0.1s; }
.btn-disabled {
  background: #d0d4dc;
  box-shadow: none;
  cursor: not-allowed;
}

.text-primary { color: var(--primary); }
.text-danger  { color: var(--danger); }
.text-hint    { color: var(--text-hint); }
</style>
（内容由AI生成，仅供参考）
