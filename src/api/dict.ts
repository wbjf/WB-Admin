/**
 * 字典 API 转发层
 * dictApi / listDictDataByType 的实际实现统一放在 @/api/dept.ts 中导出，
 * 这里按 @/stores/modules/dict 的引用路径做转发，避免重复实现。
 */
export { dictApi, listDictDataByType } from './dept'
