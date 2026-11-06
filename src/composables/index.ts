export { useCrud, type CrudConfig } from './useCrud'
export { useTable } from './useTable'
export { useDownload } from './useDownload'
export { useDict } from './useDict'
export { usePermission } from './usePermission'
export { useDialogStack } from './useDialogStack'
export {
  useAiChat,
  switchAiChatUser,
  normalizeModels,
  DEFAULT_MODELS,
  MAX_FILE_SIZE_MB,
  type AiChatApi,
  type AddFilesResult
} from '@/components/AiChat/useAiChat'
export {
  useDevicePreference,
  configureDevicePreference,
  createLocalAdapter,
  flushDevicePreference,
  type PreferenceAdapter,
  type DevicePreferenceApi
} from './useDevicePreference'
