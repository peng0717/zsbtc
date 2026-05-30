<template>
  <van-config-provider>
    <router-view />
  </van-config-provider>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

// 未登录用户自动跳转登录页（首页除外）
const token = localStorage.getItem('token')
if (!token) {
  const currentPath = window.location.hash.replace('#', '') || '/'
  if (currentPath !== '/login') {
    router.push('/login')
  }
}
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; }
</style>
