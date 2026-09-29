import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

export default pinia

export { useAppStore } from './modules/app'
export { useUserStore } from './modules/user'
export { usePermissionStore } from './modules/permission'
export { useSettingsStore } from './modules/settings'
export { useTagsViewStore } from './modules/tagsView'
export { useDictStore } from './modules/dict'
export { useTenantStore } from './modules/tenant'
