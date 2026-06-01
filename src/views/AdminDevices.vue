<template>
  <div class="page-container admin-devices">
    <van-nav-bar title="设备管理" left-text="返回" left-arrow @click-left="$router.push('/home')">
      <template #right>
        <van-button size="small" type="primary" @click="showAdd = true">添加</van-button>
      </template>
    </van-nav-bar>

    <div class="admin-device-list">
      <div v-for="item in devices" :key="item.id" class="admin-card">
        <div class="admin-card-top">
          <img :src="getImgUrl(item.image) || placeholderImg" class="admin-card-thumb" alt="" />
          <div class="admin-card-info">
            <div class="admin-card-name">{{ item.name }}</div>
            <div class="admin-card-meta">
              <span v-if="item.model">{{ item.model }}</span>
              <span class="admin-card-cat">{{ item.category }}</span>
            </div>
            <div class="admin-card-stats">
              <span class="admin-stat" :class="'stat--' + item.status">{{ statusText(item.status) }}</span>
              <span class="admin-stat-text">可借 {{ item.available }} / 共 {{ item.total }}</span>
            </div>
          </div>
        </div>
        <div class="admin-card-actions">
          <button class="act-btn act-edit" @click="openEdit(item)">编辑</button>
          <button v-if="item.status !== 'retired'" class="act-btn act-retire" @click="retireDevice(item.id)">下架</button>
          <button v-if="item.status !== 'maintenance'" class="act-btn act-maintain" @click="maintenanceDevice(item.id)">维修</button>
          <button v-if="item.status === 'maintenance' || item.status === 'retired'" class="act-btn act-restore" @click="normalDevice(item.id)">恢复</button>
        </div>
      </div>
    </div>

    <!-- 添加设备 -->
    <van-dialog v-model:show="showAdd" title="添加设备" show-cancel-button @confirm="onAddDevice">
      <div class="dialog-form">
        <van-field v-model="form.name" label="设备名称" placeholder="请输入" />
        <van-field v-model="form.model" label="型号" placeholder="请输入" />
        <van-field v-model="form.category" label="分类" placeholder="选择或输入分类">
          <template #extra>
            <van-icon name="arrow-down" @click="showCat = true" />
          </template>
        </van-field>
        <van-field v-model="form.total" label="总数" type="number" placeholder="请输入" />
        <van-field v-model="form.description" label="描述" placeholder="请输入" type="textarea" rows="2" />
        <div class="image-field">
          <label class="image-field-label">设备图片</label>
          <input ref="imageInput" type="file" accept="image/*" @change="onImagePicked" hidden />
          <div class="image-upload-wrap">
            <div v-if="imagePreview" class="image-preview">
              <img :src="imagePreview" alt="预览" />
              <van-icon name="close" class="image-remove" @click="removeImage" />
            </div>
            <div v-else class="image-picker" @click="$refs.imageInput.click()">
              <van-icon name="photograph" size="20" />
              <span>拍照/相册</span>
            </div>
          </div>
        </div>
      </div>
    </van-dialog>

    <!-- 编辑设备 -->
    <van-dialog v-model:show="showEdit" title="编辑设备" show-cancel-button @confirm="onEditDevice">
      <div class="dialog-form">
        <van-field v-model="editForm.name" label="设备名称" />
        <van-field v-model="editForm.model" label="型号" />
        <van-field v-model="editForm.category" label="分类" placeholder="选择或输入分类">
          <template #extra>
            <van-icon name="arrow-down" @click="showCatEdit = true" />
          </template>
        </van-field>
        <van-field v-model="editForm.total" label="总数" type="number" />
        <van-field v-model="editForm.description" label="描述" type="textarea" rows="2" />
        <div class="image-field">
          <label class="image-field-label">设备图片</label>
          <input ref="editImageInput" type="file" accept="image/*" @change="onEditImagePicked" hidden />
          <div class="image-upload-wrap">
            <div v-if="editImagePreview" class="image-preview">
              <img :src="editImagePreview" alt="预览" />
              <van-icon name="close" class="image-remove" @click="removeEditImage" />
            </div>
            <div v-else class="image-picker" @click="$refs.editImageInput.click()">
              <van-icon name="photograph" size="20" />
              <span>拍照/相册</span>
            </div>
          </div>
        </div>
      </div>
    </van-dialog>

    <van-popup v-model:show="showCat" position="bottom" round>
      <van-picker :columns="categories" @confirm="(v) => { form.category = v.selectedValues[0]; showCat = false }" @cancel="showCat = false" />
    </van-popup>
    <van-popup v-model:show="showCatEdit" position="bottom" round>
      <van-picker :columns="categories" @confirm="(v) => { editForm.category = v.selectedValues[0]; showCatEdit = false }" @cancel="showCatEdit = false" />
    </van-popup>

    <van-tabbar v-model="tabbarActive" :fixed="true" :placeholder="true">
      <van-tabbar-item icon="wap-home-o" to="/admin/devices">设备管理</van-tabbar-item>
      <van-tabbar-item icon="friends-o" to="/admin/users">用户管理</van-tabbar-item>
      <van-tabbar-item icon="checked" to="/admin/approval">借用审批</van-tabbar-item>
      <van-tabbar-item icon="balance-o" to="/admin/borrow-return">借还管理</van-tabbar-item>
      <van-tabbar-item icon="add-o" to="/admin/borrow">辅助登记</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showToast, showConfirmDialog, showLoadingToast, closeToast } from 'vant'
import { api } from '../api.js'

const route = useRoute()
const tabbarActive = ref(0)
watch(() => route.path, (val) => {
  if (val === '/admin/devices') tabbarActive.value = 0
  else if (val === '/admin/users') tabbarActive.value = 1
  else if (val === '/admin/approval') tabbarActive.value = 2
  else if (val === '/admin/borrow-return') tabbarActive.value = 3
  else if (val === '/admin/borrow') tabbarActive.value = 4
}, { immediate: true })

const devices = ref([])
const showAdd = ref(false)
const showEdit = ref(false)
const showCat = ref(false)
const showCatEdit = ref(false)
const categories = computed(() => {
  const cats = [...new Set(devices.value.map(d => d.category).filter(Boolean))]
  return [...cats, '自定义']
})
const placeholderImg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjBmMmY2Ii8+PHRleHQgeD0iMzAiIHk9IjM0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYjBjMGQwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMCI+5Zu+54mHPC90ZXh0Pjwvc3ZnPg=='

const onCatConfirm = (v) => {
  const sel = v.selectedValues?.[0] || v.selectedOptions?.[0]?.text || ''
  if (sel === '自定义') {
    form.value.category = ''
  } else {
    form.value.category = sel
  }
  showCat.value = false
}
const onCatEditConfirm = (v) => {
  const sel = v.selectedValues?.[0] || v.selectedOptions?.[0]?.text || ''
  if (sel === '自定义') {
    editForm.value.category = ''
  } else {
    editForm.value.category = sel
  }
  showCatEdit.value = false
}

const form = ref({ name: '', model: '', category: '', total: 1, description: '' })
const editForm = ref({ id: '', name: '', model: '', category: '', total: 1, description: '' })
const imageFile = ref(null)
const imagePreview = ref('')
const editImageFile = ref(null)
const editImagePreview = ref('')
const uploading = ref(false)

const statusText = (s) => ({ normal: '正常', maintenance: '维修中', retired: '已下架' }[s] || s)

const host = window.location.hostname
const getImgUrl = (img) => {
  if (!img) return ''
  if (img.startsWith('http') || img.startsWith('data:')) return img
  return `http://${host}:3001${img}`
}

const fetchDevices = async () => {
  try {
    const res = await api.getDevices()
    if (res.success) devices.value = res.data
  } catch (e) {}
}

const resetForm = () => {
  form.value = { name: '', model: '', category: '', total: 1, description: '' }
  imageFile.value = null
  imagePreview.value = ''
}

const onImagePicked = (e) => {
  const file = e.target.files[0]
  if (!file) return
  imageFile.value = file
  const reader = new FileReader()
  reader.onload = (ev) => { imagePreview.value = ev.target.result }
  reader.readAsDataURL(file)
  // 重置input以便重复选择同一文件
  e.target.value = ''
}
const removeImage = () => {
  imageFile.value = null
  imagePreview.value = ''
}

const onEditImagePicked = (e) => {
  const file = e.target.files[0]
  if (!file) return
  editImageFile.value = file
  const reader = new FileReader()
  reader.onload = (ev) => { editImagePreview.value = ev.target.result }
  reader.readAsDataURL(file)
  e.target.value = ''
}
const removeEditImage = () => {
  editImageFile.value = null
  editImagePreview.value = ''
}

const uploadThenSave = async (data, file, isEdit, id) => {
  if (uploading.value) return
  uploading.value = true
  showLoadingToast({ message: '上传中...', forbidClick: true })
  try {
    let imageUrl = ''
    if (file) {
      const uploadRes = await api.uploadImage(file)
      if (uploadRes.success) {
        imageUrl = uploadRes.data.url
      } else {
        closeToast()
        showToast(uploadRes.message || '图片上传失败')
        return
      }
    }
    closeToast()
    const res = isEdit
      ? await api.updateDevice(id, { ...data, image: imageUrl || editForm.value.image || '' })
      : await api.addDevice({ ...data, image: imageUrl })
    if (res.success) {
      showToast(isEdit ? '编辑成功' : '添加成功')
      if (isEdit) showEdit.value = false
      else resetForm()
      fetchDevices()
    } else {
      showToast(res.message)
    }
  } catch (e) {
    closeToast()
    showToast(isEdit ? '编辑失败' : '添加失败')
  } finally {
    uploading.value = false
  }
}

const onAddDevice = async () => {
  await uploadThenSave(
    { ...form.value, total: parseInt(form.value.total) || 1 },
    imageFile.value,
    false
  )
}

const openEdit = (item) => {
  editForm.value = { ...item, total: String(item.total) }
  editImageFile.value = null
  editImagePreview.value = item.image
    ? (item.image.startsWith('http') ? item.image : `http://${window.location.hostname}:3001${item.image}`)
    : ''
  showEdit.value = true
}

const onEditDevice = async () => {
  await uploadThenSave(
    { ...editForm.value, total: parseInt(editForm.value.total) || 1 },
    editImageFile.value,
    true,
    editForm.value.id
  )
}

const retireDevice = async (id) => {
  try {
    await showConfirmDialog({ title: '确认下架', message: '下架后设备将不可借用' })
    const res = await api.retireDevice(id)
    if (res.success) { showToast('已下架'); fetchDevices() }
    else showToast(res.message)
  } catch (e) {}
}

const maintenanceDevice = async (id) => {
  try {
    const res = await api.maintenanceDevice(id)
    if (res.success) { showToast('已设为维修中'); fetchDevices() }
    else showToast(res.message)
  } catch (e) {}
}

const normalDevice = async (id) => {
  try {
    const res = await api.normalDevice(id)
    if (res.success) { showToast('已恢复'); fetchDevices() }
    else showToast(res.message)
  } catch (e) {}
}

onMounted(fetchDevices)
</script>

<style scoped>
.admin-devices { padding-bottom: 60px; }

.admin-device-list { padding: 8px 16px 16px; }

.admin-card {
  background: var(--surface);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
}
.admin-card-top { display: flex; gap: 12px; margin-bottom: 12px; }
.admin-card-thumb {
  width: 56px; height: 56px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
  background: #f5f6fa;
}
.admin-card-info { flex: 1; min-width: 0; }
.admin-card-name { font-size: 15px; font-weight: 600; color: var(--text); }
.admin-card-meta { font-size: 12px; color: var(--text-hint); margin-top: 3px; display: flex; gap: 8px; }
.admin-card-cat {
  background: var(--primary-soft);
  color: var(--primary);
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.admin-card-stats { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.admin-stat {
  font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 4px;
}
.stat--normal      { background: #e8f5eb; color: #1a7f3e; }
.stat--maintenance { background: #fef3e6; color: #b85c00; }
.stat--retired     { background: #fef0f0; color: #c92a2a; }
.admin-stat-text { font-size: 12px; color: var(--text-hint); }

.admin-card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 10px;
  border-top: 1px solid var(--divider);
}
.act-btn {
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font);
  border: 1.5px solid;
  cursor: pointer;
  background: var(--surface);
  transition: all 0.15s var(--ease);
}
.act-btn:active { transform: scale(0.96); }
.act-edit    { border-color: var(--primary); color: var(--primary); }
.act-retire  { border-color: var(--warning); color: var(--warning); }
.act-maintain { border-color: #e0a000; color: #e0a000; }
.act-restore { border-color: var(--success); color: var(--success); }
.act-delete  { border-color: var(--danger); color: var(--danger); }

.dialog-form { padding: 4px 0; }

.image-field {
  padding: 10px 16px;
}
.image-field-label {
  display: block;
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}
.image-upload-wrap {
  display: flex;
  justify-content: center;
}
.image-picker {
  width: 100%;
  height: 100px;
  border: 1.5px dashed #d0d5e0;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-hint);
  cursor: pointer;
  background: #f9fafc;
  transition: all 0.2s;
}
.image-picker:active { background: #f0f3f8; border-color: var(--primary); }
.image-preview {
  position: relative;
  width: 100%;
  height: 140px;
  border-radius: 10px;
  overflow: hidden;
  background: #f0f2f6;
}
.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.image-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  background: rgba(0,0,0,0.5);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
}
</style>
（内容由AI生成，仅供参考）
