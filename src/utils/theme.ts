/**
 * 主题工具：把主色生成 Element Plus 需要的 9 级色阶，写入 CSS 变量。
 * 采用 HSL 混合而非引入外部色卡依赖，保证离线可用且体积小。
 */
function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

/** 混合白/黑获得色阶 */
function mix(color: string, base: string, weight: number): string {
  const [r1, g1, b1] = hexToRgb(color)
  const [r2, g2, b2] = hexToRgb(base)
  const w = weight / 100
  return rgbToHex(r1 * (1 - w) + r2 * w, g1 * (1 - w) + g2 * w, b1 * (1 - w) + b2 * w)
}

export function generatePrimaryPalette(primary: string): Record<string, string> {
  return {
    light3: mix(primary, '#ffffff', 30),
    light5: mix(primary, '#ffffff', 50),
    light7: mix(primary, '#ffffff', 70),
    light8: mix(primary, '#ffffff', 80),
    light9: mix(primary, '#ffffff', 90),
    dark2: mix(primary, '#000000', 20)
  }
}

/** 写入 CSS 变量 */
export function applyPrimaryColor(color: string): void {
  const root = document.documentElement
  const p = generatePrimaryPalette(color)
  root.style.setProperty('--el-color-primary', color)
  root.style.setProperty('--el-color-primary-light-3', p.light3)
  root.style.setProperty('--el-color-primary-light-5', p.light5)
  root.style.setProperty('--el-color-primary-light-7', p.light7)
  root.style.setProperty('--el-color-primary-light-8', p.light8)
  root.style.setProperty('--el-color-primary-light-9', p.light9)
  root.style.setProperty('--el-color-primary-dark-2', p.dark2)
}

export type ThemeMode = 'light' | 'dark' | 'auto'
export type LayoutMode = 'left' | 'top' | 'mix'

export interface ThemeState {
  mode: ThemeMode
  color: string
  layout: LayoutMode
  sidebarOpened: boolean
  weak: boolean
  gray: boolean
  tagsView: boolean
  fixedHeader: boolean
  footer: boolean
  animation: boolean
  allowWatermark: boolean
  size: 'large' | 'default' | 'small'
}

export const THEME_STORAGE_KEY = 'wb-admin-theme'

export const DEFAULT_THEME: ThemeState = {
  mode: 'light',
  color: '#409eff',
  layout: 'left',
  sidebarOpened: true,
  weak: false,
  gray: false,
  tagsView: true,
  fixedHeader: true,
  footer: true,
  animation: true,
  allowWatermark: false,
  size: 'default'
}

/** index.html 首屏同步读取，避免闪白 */
export function readStoredTheme(): ThemeState {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    return raw ? { ...DEFAULT_THEME, ...JSON.parse(raw) } : { ...DEFAULT_THEME }
  } catch {
    return { ...DEFAULT_THEME }
  }
}

export function applyThemeToDom(state: ThemeState): void {
  const root = document.documentElement
  const dark =
    state.mode === 'dark' ||
    (state.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', dark)
  root.classList.toggle('html-weak', state.weak)
  root.classList.toggle('html-gray', state.gray)
  document.body.setAttribute('data-layout', state.layout)
  applyPrimaryColor(state.color)
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(state))
}

/** 常用预设色（可在线扩展） */
export const PRESET_COLORS = [
  '#409eff',
  '#4096ff',
  '#1677ff',
  '#36cfc9',
  '#52c41a',
  '#73d13d',
  '#faad14',
  '#f5222d',
  '#eb2f96',
  '#722ed1',
  '#13c2c2',
  '#2f54eb'
]
