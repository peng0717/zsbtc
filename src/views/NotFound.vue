<template>
  <div class="not-found-root">
    <div class="nf-card">
      <div class="nf-code">404</div>
      <div class="nf-divider"></div>
      <h2 class="nf-title">页面未找到</h2>
      <p class="nf-desc">您访问的页面不存在或已被移除</p>
      <button class="nf-btn" @click="$router.push('/home')">返回首页</button>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.not-found-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 24px;
}

.nf-card {
  text-align: center;
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 48px 36px;
  box-shadow: var(--shadow-md);
  max-width: 360px;
  width: 100%;
}

.nf-code {
  font-size: 80px;
  font-weight: 800;
  color: var(--primary);
  line-height: 1;
  letter-spacing: -2px;
  font-family: var(--font-mono);
}

.nf-divider {
  width: 48px;
  height: 3px;
  background: var(--primary);
  margin: 20px auto 24px;
  border-radius: 2px;
}

.nf-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 10px;
}

.nf-desc {
  font-size: 14px;
  color: var(--text-hint);
  margin: 0 0 32px;
  line-height: 1.6;
}

.nf-btn {
  display: inline-block;
  padding: 12px 36px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-size: 15px;
  font-weight: 500;
  font-family: var(--font);
  cursor: pointer;
  box-shadow: var(--shadow-primary);
  transition: transform 0.15s var(--ease-out), box-shadow 0.15s var(--ease-out);
  -webkit-tap-highlight-color: transparent;
}

.nf-btn:active {
  transform: scale(0.96);
  box-shadow: 0 2px 6px rgba(30,93,201,0.25);
}
</style>
