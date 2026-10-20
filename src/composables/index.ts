export { useCrud, type CrudConfig } from './useCrud'
export { useTable } from './useTable'
export { useDownload } from './useDownload'
export { useDict } from './useDict'
export { usePermission } from './usePermission'
export { useDialogStack } from './useDialogStack'
export { useAiChat, switchAiChatUser, type AiChatApi, type AddFilesResult } from '@/components/AiChat/useAiChat'
export {
  configureAiTransport,
  createHttpTransport,
  createMockTransport,
  DEFAULT_MODELS,
  type HttpTransportOptions,
  type MockTransportOptions
} from '@/components/AiChat/transport'
export {
  useDevicePreference,
  configureDevicePreference,
  createLocalAdapter,
  flushDevicePreference,
  type PreferenceAdapter,
  type DevicePreferenceApi
} from './useDevicePreference'
