import axios from 'axios'
import { useUserStore } from './stores/user.js'

const http = axios.create({ baseURL: '/api' })

http.interceptors.request.use(config => {
  // 动态从 Pinia store 获取 token
  const userStore = useUserStore()
  if (userStore.token) config.headers.Authorization = `Bearer ${userStore.token}`
  return config
})

http.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      const userStore = useUserStore()
      userStore.logout()
      window.location.href = '/#/login'
    }
    return Promise.reject(err)
  }
)

export const api = {
  login: (data) => http.post('/auth/login', data),
  register: (data) => http.post('/auth/register', data),
  getMe: () => http.get('/auth/me'),
  getUsers: () => http.get('/users'),
  addUser: (data) => http.post('/users', data),
  updateUser: (id, data) => http.put(`/users/${id}`, data),
  disableUser: (id) => http.patch(`/users/${id}/disable`),
  enableUser: (id) => http.patch(`/users/${id}/enable`),
  getDevices: (params) => http.get('/devices', { params }),
  addDevice: (data) => http.post('/devices', data),
  updateDevice: (id, data) => http.put(`/devices/${id}`, data),
  retireDevice: (id) => http.patch(`/devices/${id}/retire`),
  batchUpdateDevices: (ids, status, remark) => http.patch('/devices/batch', { ids, status, remark }),
  getDeviceHistory: (id) => http.get(`/devices/${id}/history`),
  maintenanceDevice: (id) => http.patch(`/devices/${id}/maintenance`),
  normalDevice: (id) => http.patch(`/devices/${id}/normal`),
  deleteDevice: (id) => http.delete(`/devices/${id}`),
  getDeviceByQr: (qrCode) => http.get(`/devices/by-qr/${encodeURIComponent(qrCode)}`),
  getBorrows: (params) => http.get('/borrows', { params }),
  borrow: (data) => http.post('/borrows', data),
  approveBorrow: (id) => http.put(`/borrows/${id}/approve`),
  rejectBorrow: (id, reason) => http.put(`/borrows/${id}/reject`, { reason }),
  confirmBorrow: (id) => http.put(`/borrows/${id}/confirm`),
  returnDevice: (id) => http.put(`/borrows/${id}/return`),
  deleteBorrow: (id) => http.delete(`/borrows/${id}`),
  updateProfile: (data) => http.put('/auth/profile', data),
  uploadImage: (file) => {
    const formData = new FormData()
    formData.append('image', file)
    return http.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  searchDevices: (keyword) => http.get('/devices/search', { params: { keyword } }),
  generateQrCode: (deviceName) => http.post('/devices/qr-generate', { deviceName }),
  searchUsers: (keyword) => http.get('/users/search', { params: { keyword } }),
  adminBorrow: (data) => http.post('/borrows/admin', data),
  getDashboard: () => http.get('/dashboard'),
  getMySummary: () => http.get('/borrows/summary'),

  // 导出
  exportDevices: () => http.get('/export/devices', { responseType: 'blob' }),
  exportBorrows: (params) => http.get('/export/borrows', { params, responseType: 'blob' }),

  // 审计日志
  getAuditLogs: (params) => http.get('/admin/audit-logs', { params }),

  // 密码重置
  resetPassword: (data) => http.post('/auth/reset-password', data),
}