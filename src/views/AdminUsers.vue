<template>
  <div class="page-container admin-users">
    <van-nav-bar title="用户管理" left-text="返回" left-arrow @click-left="$router.back()">
      <template #right>
        <van-button size="small" type="primary" @click="showAdd = true">添加</van-button>
      </template>
    </van-nav-bar>

    <van-list v-model:loading="loading" :finished="finished" @load="fetchUsers">
      <div v-for="u in users" :key="u.id" class="user-card">
        <div class="user-avatar">{{ (u.name || '?')[0] }}</div>
        <div class="user-body">
          <div class="user-name">{{ u.name }}</div>
          <div class="user-meta">
            <span>{{ u.username }}</span>
            <span class="user-role">{{ u.role }}</span>
            <span class="user-status" :class="u.status === 'active' ? 'status-active' : 'status-disabled'">
              {{ u.status === 'active' ? '正常' : '已禁用' }}
            </span>
          </div>
          <div class="user-phone" v-if="u.phone">{{ u.phone }}</div>
        </div>
        <div class="user-actions">
          <button class="act-btn act-edit" @click="openEdit(u)">编辑</button>
          <button
            v-if="u.status === 'active'"
            class="act-btn act-disable"
            @click="disableUser(u.id)"
          >禁用</button>
          <button
            v-else
            class="act-btn act-enable"
            @click="enableUser(u.id)"
          >启用</button>
        </div>
      </div>
    </van-list>

    <!-- 添加用户 -->
    <van-dialog v-model:show="showAdd" title="添加用户" show-cancel-button @confirm="onAdd">
      <div class="dialog-form">
        <van-field v-model="form.username" label="学工号" placeholder="请输入" />
        <van-field v-model="form.name" label="姓名" placeholder="请输入" />
        <van-field v-model="form.role" label="角色" readonly is-link placeholder="请选择" @click="showRoleAdd = true" />
        <van-field v-model="form.phone" label="电话" placeholder="可选" />
      </div>
    </van-dialog>

    <!-- 编辑用户 -->
    <van-dialog v-model:show="showEdit" title="编辑用户" show-cancel-button @confirm="onEdit">
      <div class="dialog-form">
        <van-field v-model="editForm.name" label="姓名" />
        <van-field v-model="editForm.role" label="角色" readonly is-link @click="showRoleEdit = true" />
        <van-field v-model="editForm.phone" label="电话" />
      </div>
    </van-dialog>

    <van-popup v-model:show="showRoleAdd" position="bottom" round>
      <van-picker :columns="roles" @confirm="(v) => { form.role = v.selectedValues[0]; showRoleAdd = false }" @cancel="showRoleAdd = false" />
    </van-popup>
    <van-popup v-model:show="showRoleEdit" position="bottom" round>
      <van-picker :columns="roles" @confirm="(v) => { editForm.role = v.selectedValues[0]; showRoleEdit = false }" @cancel="showRoleEdit = false" />
    </van-popup>

    <van-tabbar v-model="tabbarActive" :fixed="true" :placeholder="true">
      <van-tabbar-item icon="wap-home-o" to="/admin/devices">设备管理</van-tabbar-item>
      <van-tabbar-item icon="friends-o" to="/admin/users">用户管理</van-tabbar-item>
      <van-tabbar-item icon="checked" to="/admin/approval">借用审批</van-tabbar-item>
      <van-tabbar-item icon="exchange-o" to="/admin/borrow-return">借还管理</van-tabbar-item>
      <van-tabbar-item icon="orders-o" to="/admin/borrow">辅助登记</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import { api } from '../api.js'

const route = useRoute()
const tabbarActive = ref(1)
watch(() => route.path, (val) => {
  if (val === '/admin/devices') tabbarActive.value = 0
  else if (val === '/admin/users') tabbarActive.value = 1
  else if (val === '/admin/approval') tabbarActive.value = 2
  else if (val === '/admin/borrow-return') tabbarActive.value = 3
  else if (val === '/admin/borrow') tabbarActive.value = 4
}, { immediate: true })

const users = ref([])
const loading = ref(false)
const finished = ref(false)
const showAdd = ref(false)
const showEdit = ref(false)
const showRoleAdd = ref(false)
const showRoleEdit = ref(false)
const roles = ['学生', '教师', '管理员']

const form = ref({ username: '', name: '', role: '学生', phone: '' })
const editForm = ref({ id: '', name: '', role: '', phone: '' })

const fetchUsers = async () => {
  loading.value = true
  try {
    const res = await api.getUsers()
    if (res.success) users.value = res.data
    finished.value = true
  } catch (e) {} finally { loading.value = false }
}

const resetForm = () => {
  form.value = { username: '', name: '', role: '学生', phone: '' }
}

const onAdd = async () => {
  try {
    const res = await api.addUser({ ...form.value })
    if (res.success) { showToast('添加成功'); resetForm(); fetchUsers() }
    else showToast(res.message)
  } catch (e) { showToast('添加失败') }
}

const openEdit = (u) => {
  editForm.value = { id: u.id, name: u.name, role: u.role, phone: u.phone || '' }
  showEdit.value = true
}

const onEdit = async () => {
  try {
    const res = await api.updateUser(editForm.value.id, {
      name: editForm.value.name,
      role: editForm.value.role,
      phone: editForm.value.phone
    })
    if (res.success) { showToast('编辑成功'); showEdit.value = false; fetchUsers() }
    else showToast(res.message)
  } catch (e) { showToast('编辑失败') }
}

const disableUser = async (id) => {
  try {
    const res = await api.disableUser(id)
    if (res.success) { showToast('已禁用'); fetchUsers() }
    else showToast(res.message)
  } catch (e) {}
}

const enableUser = async (id) => {
  try {
    const res = await api.enableUser(id)
    if (res.success) { showToast('已启用'); fetchUsers() }
    else showToast(res.message)
  } catch (e) {}
}

onMounted(fetchUsers)
</script>

<style scoped>
.admin-users { padding-bottom: 60px; }

.user-card {
  display: flex;
  align-items: center;
  background: var(--surface);
  margin: 8px 16px;
  padding: 12px 14px;
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  gap: 12px;
}
.user-avatar {
  width: 42px; height: 42px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.user-body { flex: 1; min-width: 0; }
.user-name { font-size: 15px; font-weight: 600; color: var(--text); }
.user-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-hint);
}
.user-role {
  background: var(--primary-soft);
  color: var(--primary);
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.user-status {
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.status-active   { background: #e8f5eb; color: #1a7f3e; }
.status-disabled { background: #fef0f0; color: #c92a2a; }
.user-phone { font-size: 12px; color: var(--text-hint); margin-top: 2px; }

.user-actions { display: flex; gap: 6px; flex-shrink: 0; }
.act-btn {
  padding: 5px 12px;
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
.act-disable { border-color: var(--danger); color: var(--danger); }
.act-enable  { border-color: var(--success); color: var(--success); }

.dialog-form { padding: 4px 0; }
</style>
（内容由AI生成，仅供参考）
