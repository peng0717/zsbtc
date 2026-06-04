/**
 * 密码复杂度校验（与后端 app-middleware.js 保持一致）
 * @param {string} pwd 密码
 * @returns {string|null} 错误信息，null 表示通过
 */
export function validatePassword(pwd) {
  if (!pwd || pwd.length < 8) {
    return '密码长度不能少于8位'
  }
  if (!/[a-z]/.test(pwd)) {
    return '密码必须包含小写字母'
  }
  if (!/[A-Z]/.test(pwd)) {
    return '密码必须包含大写字母'
  }
  if (!/[0-9]/.test(pwd)) {
    return '密码必须包含数字'
  }
  return null
}