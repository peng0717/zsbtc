import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '../stores/user.js'

const routes = [
  { path: '/', redirect: '/home' },
  { path: '/login', component: () => import('../views/Login.vue') },
  { path: '/home', component: () => import('../views/Home.vue'), meta: { auth: true } },
  { path: '/device/:id', component: () => import('../views/DeviceDetail.vue'), meta: { auth: true } },
  { path: '/borrow/:deviceId', component: () => import('../views/Borrow.vue'), meta: { auth: true } },
  { path: '/scan', component: () => import('../views/Scan.vue'), meta: { auth: true } },

  { path: '/my-borrows', component: () => import('../views/MyBorrows.vue'), meta: { auth: true } },
  { path: '/admin/dashboard', component: () => import('../views/AdminDashboard.vue'), meta: { auth: true, admin: true } },
  { path: '/admin/devices', component: () => import('../views/AdminDevices.vue'), meta: { auth: true, admin: true } },
  { path: '/admin/approval', component: () => import('../views/AdminApproval.vue'), meta: { auth: true, admin: true } },
  { path: '/admin/return', component: () => import('../views/AdminReturn.vue'), meta: { auth: true, admin: true } },
  { path: '/admin/users', component: () => import('../views/AdminUsers.vue'), meta: { auth: true, admin: true } },
  { path: '/admin/borrow', component: () => import('../views/AdminBorrow.vue'), meta: { auth: true, admin: true } },
  { path: '/admin/borrow-return', component: () => import('../views/AdminBorrowReturn.vue'), meta: { auth: true, admin: true } },
  { path: '/admin/borrowed', component: () => import('../views/AdminBorrowed.vue'), meta: { auth: true, admin: true } },
  { path: '/:pathMatch(.*)*', component: () => import('../views/NotFound.vue') },
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  // 确保 Pinia store 已从 localStorage 恢复完毕，再读取 token 和 role
  await userStore.restoreFromStorage()
  const token = userStore.token

  if (to.path === '/login' && token) {
    return next('/home')
  }

  if (to.meta.auth) {
    if (!token) return next('/login')
    if (to.meta.admin) {
      if (userStore.role !== '管理员') return next('/home')
    }
  }
  next()
})

export default router