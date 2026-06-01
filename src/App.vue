<template>
  <van-config-provider>
    <router-view />
  </van-config-provider>
</template>

<script setup>
import { useUserStore } from './stores/user.js'
const userStore = useUserStore()
userStore.restoreFromStorage()
</script>