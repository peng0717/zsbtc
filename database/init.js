/**
 * 云开发数据库初始化脚本
 * 在微信开发者工具 → 云开发控制台 → 数据库 中手动创建集合
 */

// === 集合 1: users（用户表）===
// 权限：所有用户可读，仅创建者可写
// 手动创建集合: users
// 字段说明：
//   userId     学工号（唯一）
//   realName   真实姓名
//   role       角色：学生 / 教师 / 管理员
//   password   密码（初始123456）
//   isFirstLogin  首次登录标记（true 时强制改密码）
//   createTime 创建时间

// 初始化管理员账号（在云开发控制台 → 数据库 → users 中添加）：
// {
//   "userId": "admin001",
//   "realName": "管理员",
//   "role": "管理员",
//   "password": "123456",
//   "isFirstLogin": true,
//   "createTime": "2026-05-29T00:00:00.000Z"
// }

// === 集合 2: devices（设备表）===
// 权限：所有用户可读，仅创建者可写

const sampleDevices = [
  { name: '氩弧焊枪 WP-26', category: '焊枪', model: 'WP-26', location: '焊接实训室 A101', desc: '适用于不锈钢薄板焊接，额定电流 150A', totalQty: 10, availableQty: 10, status: 'available' },
  { name: '二氧化碳焊枪 MB-25AK', category: '焊枪', model: 'MB-25AK', location: '焊接实训室 A101', desc: '配套 NBC-350 焊机，适用于碳钢焊接', totalQty: 8, availableQty: 8, status: 'available' },
  { name: '等离子切割枪 P80', category: '切割枪', model: 'P80', location: '切割实训室 A102', desc: '切割厚度 1-20mm，适配 LGK-100', totalQty: 5, availableQty: 5, status: 'available' },
  { name: '万用表 DT9205A', category: '仪表', model: 'DT9205A', location: '电工实训室 B201', desc: '数字万用表，交直流电压/电流/电阻/电容', totalQty: 20, availableQty: 20, status: 'available' },
  { name: '示波器 DS1054Z', category: '仪表', model: 'DS1054Z', location: '电工实训室 B201', desc: '四通道数字示波器，带宽 50MHz', totalQty: 6, availableQty: 6, status: 'available' },
  { name: '电焊面罩自动变光', category: '防护用品', model: 'XG-300', location: '焊接实训室 A101', desc: '自动变光电焊面罩，响应时间 0.1ms', totalQty: 15, availableQty: 15, status: 'available' }
]

// 在云开发控制台 → 数据库 → devices 逐条添加上方示例数据

// === 集合 3: borrow_records（借用记录表）===
// 权限：仅创建者可读写
// 字段说明：
//   deviceId / deviceName  设备信息
//   userId / userName      借用人信息
//   qty / purpose          借用数量 / 用途
//   status                 状态：pending(待审批) / approved(已通过) / rejected(已拒绝) / returned(已归还)
//   applyTime / approveTime / returnTime
// 索引建议：status + applyTime 降序；userId + applyTime 降序

console.log('请在云开发控制台手动创建 3 个集合，并导入示例设备数据。')