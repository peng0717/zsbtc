<template>
  <div class="page-container my-credits">
    <van-nav-bar title="我的信用" left-text="返回" left-arrow @click-left="$router.back()" />

    <div class="credit-header">
      <div class="credit-big-score" :class="creditScore >= 80 ? 'score-high' : 'score-low'">{{ creditScore }}</div>
      <div class="credit-big-label">当前信用分</div>
      <div class="credit-bar-wrap">
        <div class="credit-bar-fill" :style="{ width: Math.min(creditScore, 100) + '%' }" :class="creditScore >= 80 ? 'bar-high' : 'bar-low'"></div>
      </div>
    </div>

    <div class="record-list">
      <div v-for="r in records" :key="r.id" class="record-item">
        <div class="record-left">
          <div class="record-reason">{{ r.reason }}</div>
          <div class="record-time">{{ r.created_at }}</div>
        </div>
        <div class="record-amount" :class="r.change_amount > 0 ? 'amount-positive' : 'amount-negative'">
          {{ r.change_amount > 0 ? '+' : '' }}{{ r.change_amount }}
        </div>
      </div>
      <van-empty v-if="records.length === 0" description="暂无信用记录" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api.js'

const creditScore = ref(100)
const records = ref([])

onMounted(async () => {
  try {
    const res = await api.getMyCredits()
    if (res.success) {
      creditScore.value = res.credit_score ?? 100
      records.value = res.data || []
    }
  } catch (e) {}
})
</script>

<style scoped>
.my-credits { min-height: 100vh; background: var(--bg); }

.credit-header {
  text-align: center;
  padding: 32px 24px 20px;
  background: var(--surface);
  margin: 0 16px 12px;
  border-radius: 14px;
  box-shadow: var(--shadow-sm);
}

.credit-big-score { font-size: 48px; font-weight: 700; line-height: 1.1; }
.score-high { color: #1a7f3e; }
.score-low  { color: #c92a2a; }

.credit-big-label {
  font-size: 14px;
  color: var(--text-hint);
  margin: 6px 0 14px;
}

.credit-bar-wrap {
  width: 100%;
  height: 8px;
  background: #e8e9ee;
  border-radius: 4px;
  overflow: hidden;
}

.credit-bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s; }
.bar-high { background: linear-gradient(90deg, #2ecc71, #1a7f3e); }
.bar-low  { background: linear-gradient(90deg, #e74c3c, #c92a2a); }

.record-list { padding: 0 16px 16px; }

.record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 8px;
  box-shadow: var(--shadow-sm);
}

.record-left { flex: 1; min-width: 0; }
.record-reason { font-size: 14px; color: var(--text); font-weight: 500; }
.record-time { font-size: 11px; color: var(--text-hint); margin-top: 4px; }

.record-amount { font-size: 18px; font-weight: 700; flex-shrink: 0; margin-left: 12px; }
.amount-positive { color: #1a7f3e; }
.amount-negative { color: #c92a2a; }
</style>
