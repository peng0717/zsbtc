<template>
  <div class="page-container repair-page">
    <van-nav-bar title="设备报修" left-text="返回" left-arrow @click-left="$router.back()" />

    <div class="repair-form">
      <div class="form-device">
        <span class="device-label">报修设备：</span>
        <span class="device-name">{{ device?.name }}</span>
        <span class="device-model" v-if="device?.model">{{ device?.model }}</span>
      </div>

      <van-field
        v-model="form.issue_type"
        label="故障类型"
        readonly is-link
        placeholder="请选择"
        @click="showTypePicker = true"
      />
      <van-field
        v-model="form.description"
        label="故障描述"
        type="textarea"
        rows="4"
        placeholder="请详细描述故障情况"
        :rules="[{ required: true, message: '请填写故障描述' }]"
      />

      <div class="image-upload">
        <div class="upload-label">故障图片（选填，最多3张）</div>
        <div class="upload-images">
          <div v-for="(img, i) in images" :key="i" class="upload-img-item">
            <img :src="img" class="upload-preview" />
            <van-icon name="clear" class="upload-remove" @click="removeImage(i)" />
          </div>
          <div v-if="images.length < 3" class="upload-add" @click="triggerUpload">
            <van-icon name="plus" size="24" color="#bbb" />
          </div>
          <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileChange" />
        </div>
      </div>

      <div class="form-submit">
        <van-button type="primary" round block :loading="submitting" @click="onSubmit">提交报修</van-button>
      </div>
    </div>

    <!-- 故障类型选择 -->
    <van-popup v-model:show="showTypePicker" position="bottom" round>
      <van-picker
        :columns="issueTypes"
        @confirm="(v) => { form.issue_type = v.selectedValues[0]; showTypePicker = false }"
        @cancel="showTypePicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { api } from '../api.js'

const route = useRoute()
const router = useRouter()

const device = ref(null)
const form = ref({ issue_type: '', description: '' })
const images = ref([])
const fileInput = ref(null)
const showTypePicker = ref(false)
const submitting = ref(false)
const issueTypes = ['硬件故障', '软件故障', '配件缺失', '其他']

onMounted(async () => {
  const deviceId = route.params.id
  if (deviceId) {
    try {
      const res = await api.getDevices()
      if (res.success) {
        device.value = res.data.find(d => d.id == deviceId)
      }
    } catch (e) {}
  }
})

const triggerUpload = () => {
  fileInput.value?.click()
}

const onFileChange = (e) => {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    images.value.push(ev.target.result)
  }
  reader.readAsDataURL(file)
  e.target.value = ''
}

const removeImage = (i) => {
  images.value.splice(i, 1)
}

const onSubmit = async () => {
  if (!device.value) {
    showToast('未找到设备信息')
    return
  }
  if (!form.value.issue_type) {
    showToast('请选择故障类型')
    return
  }
  if (!form.value.description.trim()) {
    showToast('请填写故障描述')
    return
  }
  submitting.value = true
  try {
    const res = await api.submitRepair({
      device_id: device.value.id,
      issue_type: form.value.issue_type,
      description: form.value.description,
      images: images.value.join(',')
    })
    if (res.success) {
      showToast('报修提交成功')
      setTimeout(() => router.back(), 1000)
    } else {
      showToast(res.message)
    }
  } catch (e) {
    showToast('提交失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.repair-page { min-height: 100vh; background: var(--bg); }

.repair-form { padding: 16px; }

.form-device {
  background: var(--surface);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-label { font-size: 14px; color: var(--text-hint); }
.device-name { font-size: 16px; font-weight: 600; color: var(--text); }
.device-model { font-size: 13px; color: var(--text-hint); }

.image-upload {
  background: var(--surface);
  border-radius: 12px;
  margin: 12px 0;
  padding: 16px;
}

.upload-label { font-size: 13px; color: var(--text-hint); margin-bottom: 10px; }

.upload-images {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.upload-img-item {
  position: relative;
  width: 80px; height: 80px;
  border-radius: 8px;
  overflow: hidden;
}

.upload-preview { width: 100%; height: 100%; object-fit: cover; }

.upload-remove {
  position: absolute;
  top: -4px; right: -4px;
  background: rgba(0,0,0,0.5);
  color: #fff;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
}

.upload-add {
  width: 80px; height: 80px;
  border-radius: 8px;
  border: 1.5px dashed #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.form-submit { margin-top: 24px; }
</style>
