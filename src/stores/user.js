import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userId = ref(localStorage.getItem('userId') || '')
  const username = ref(localStorage.getItem('username') || '')
  const name = ref(localStorage.getItem('name') || '')
  const role = ref(localStorage.getItem('role') || '')

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => role.value === '管理员')

  function setLogin(data) {
    token.value = data.token
    userId.value = String(data.user.id)
    username.value = data.user.username
    name.value = data.user.name
    role.value = data.user.role

    localStorage.setItem('token', data.token)
    localStorage.setItem('userId', String(data.user.id))
    localStorage.setItem('username', data.user.username)
    localStorage.setItem('name', data.user.name)
    localStorage.setItem('role', data.user.role)
  }

  function updateProfile(user) {
    name.value = user.name
    localStorage.setItem('name', user.name)
  }

  function logout() {
    token.value = ''
    userId.value = ''
    username.value = ''
    name.value = ''
    role.value = ''

    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    localStorage.removeItem('name')
    localStorage.removeItem('role')
  }

  function restoreFromStorage() {
    token.value = localStorage.getItem('token') || ''
    userId.value = localStorage.getItem('userId') || ''
    username.value = localStorage.getItem('username') || ''
    name.value = localStorage.getItem('name') || ''
    role.value = localStorage.getItem('role') || ''
  }

  return {
    token,
    userId,
    username,
    name,
    role,
    isLoggedIn,
    isAdmin,
    setLogin,
    updateProfile,
    logout,
    restoreFromStorage
  }
})