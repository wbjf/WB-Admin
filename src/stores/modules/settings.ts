import { defineStore } from 'pinia'
import { DEFAULT_THEME, applyThemeToDom, readStoredTheme, type ThemeState } from '@/utils/theme'

export const useSettingsStore = defineStore('wb-settings', {
  state: (): ThemeState => readStoredTheme(),
  getters: {
    isDark(state): boolean {
      return (
        state.mode === 'dark' ||
        (state.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      )
    }
  },
  actions: {
    apply(): void {
      applyThemeToDom({ ...this.$state })
    },
    setMode(mode: ThemeState['mode']) {
      this.mode = mode
      this.apply()
    },
    setColor(color: string) {
      this.color = color
      this.apply()
    },
    setLayout(layout: ThemeState['layout']) {
      this.layout = layout
      this.apply()
    },
    toggleSidebar(opened?: boolean) {
      this.sidebarOpened = typeof opened === 'boolean' ? opened : !this.sidebarOpened
      this.apply()
    },
    set<K extends keyof ThemeState>(key: K, value: ThemeState[K]) {
      ;(this as any)[key] = value
      this.apply()
    },
    resetDefault() {
      this.$patch({ ...DEFAULT_THEME })
      this.apply()
    }
  }
})
