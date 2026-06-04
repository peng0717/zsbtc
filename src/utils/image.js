/**
 * 获取图片完整 URL
 * - 本地开发：前端 3000 端口，后端 3001 端口，需拼接端口
 * - 生产环境：前后端同源，直接用相对路径
 */
const isDev = import.meta.env.DEV

export function getImgUrl(img) {
  if (!img) return ''
  if (img.startsWith('http') || img.startsWith('data:')) return img
  if (isDev) {
    const protocol = window.location.protocol
    const host = window.location.hostname
    return `${protocol}//${host}:3001${img}`
  }
  return img
}

/** 默认设备占位图 SVG */
export const placeholderImg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjBmMmY2Ii8+PHRleHQgeD0iMzAiIHk9IjM0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYjBjMGQwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMCI+5Zu+54mHPC90ZXh0Pjwvc3ZnPg=='
