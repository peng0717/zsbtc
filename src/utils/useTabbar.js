import { watch } from 'vue'
import { useRoute } from 'vue-router'

/**
 * 监听 route.path 自动高亮 Tabbar 选中项
 * @param {import('vue').Ref<number>} tabbarActive 当前选中索引
 * @param {Record<string, number>} routeMap 路径→索引映射，支持精确匹配和前缀匹配
 * @example
 *   useTabbarWatch(tabbarActive, {
 *     '/home': 0,
 *     '/my-borrows': 1,
 *     '/admin': 2
 *   })
 */
export function useTabbarWatch(tabbarActive, routeMap) {
  const route = useRoute()
  watch(() => route.path, (val) => {
    for (const [pattern, idx] of Object.entries(routeMap)) {
      if (val.startsWith(pattern)) {
        tabbarActive.value = idx
        return
      }
    }
  }, { immediate: true })
}

/**
 * 反转 map 的 key/value → value/key，用于根据索引取路径
 */
export function invertMap(map) {
  const result = {}
  for (const [k, v] of Object.entries(map)) {
    result[v] = k
  }
  return result
}