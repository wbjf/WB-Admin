import { defineStore } from 'pinia'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed } from 'vue'

type Device = 'desktop' | 'tablet' | 'mobile'

export const useAppStore = defineStore('wb-app', {
  state: () => ({
    device: 'desktop' as Device,
    /** 全局遮罩（例如导出大数据时） */
    globalLoading: false,
    /** 是否显示内置 unlock 界面 */
    screenLocked: false,
    lockTime: 30,
    idleTimer: 0 as unknown as ReturnType<typeof setInterval> | 0,
    /** 站点信息 */
    site: {
      title: import.meta.env.VITE_APP_TITLE || 'WB-Admin',
      version: '1.0.0'
    }
  }),
  getters: {
    isMobile(state): boolean {
      return state.device === 'mobile'
    }
  },
  actions: {
    /** 响应式三档断点 */
    watchBreakpoint() {
      const bp = useBreakpoints(breakpointsTailwind)
      const current = computed<Device>(() => {
        if (bp.smallerOrEqual('md').value) return 'mobile'
        if (bp.smallerOrEqual('lg').value) return 'tablet'
        return 'desktop'
      })
      this.device = current.value
      return current
    },
    setDevice(device: Device) {
      this.device = device
    },
    setGlobalLoading(v: boolean) {
      this.globalLoading = v
    },
    lockScreen() {
      this.screenLocked = true
    },
    unlockScreen() {
      this.screenLocked = false
      this.resetIdle()
    },
    /** 无操作自动锁屏 */
    startIdleWatch(minutes?: number) {
      const mins = minutes ?? this.lockTime
      this.stopIdleWatch()
      this.idleTimer = setInterval(() => {
        this.screenLocked = true
        this.stopIdleWatch()
      }, mins * 60 * 1000)
      const reset = () => this.resetIdle()
      window.addEventListener('mousemove', reset)
      window.addEventListener('keydown', reset)
    },
    resetIdle() {
      /* 由外部监听重置；占位避免空实现 */
    },
    stopIdleWatch() {
      if (this.idleTimer) clearInterval(this.idleTimer)
      this.idleTimer = 0
    }
  },
  persist: {
    key: 'wb-admin-app',
    pick: ['device', 'lockTime']
  }
})
