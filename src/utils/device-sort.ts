import { compareByInitial, getInitial, INITIAL_OTHER } from './pinyin'

/**
 * 设备名的排序规则（业务口径，改动前先看这段注释）：
 *
 *   ① 收藏过的排最前
 *   ② 数字开头的在前，按数值 0-9 排（1 < 2 < 10，不是字符串序的 1 < 10 < 2）
 *   ③ 字母开头的在后，A-Z；同一字母内的数字部分同样按数值排（A2 < A10）
 *   ④ 剩下的一律最后（中文等），按拼音首字母兜底
 *
 * ## 为什么要显式分档，而不是直接丢给 Intl.Collator
 * `new Intl.Collator('zh-CN', { numeric: true })` 确实能把 A9 排在 A10 前面，
 * 但在 zh-CN（拼音）排序规则下，**汉字会排在拉丁字母之前**——
 * 实测 `collator.compare('冷水机组', 'A1') === -1`。
 * 所以要中文设备垫底，就必须自己先分档再比较，不能只依赖 collator。
 */

export type DeviceNameGroup = 'digit' | 'letter' | 'other'

/** 分档权重：数字 → 字母 → 其它 */
const GROUP_ORDER: Record<DeviceNameGroup, number> = { digit: 0, letter: 1, other: 2 }

/**
 * 数值敏感的比较器。
 * `numeric: true` 让 "10" 按数值 10 参与比较，而不是按字符 '1'、'0' 逐位比。
 */
const NATURAL = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isLatin(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
}

/** 设备名属于哪一档（收藏与否不在这里判断，那是 sortDevices 的事） */
export function nameGroupOf(name?: string | null): DeviceNameGroup {
  const s = String(name ?? '').trim()
  if (!s) return 'other'
  const first = s[0]
  if (isDigit(first)) return 'digit'
  if (isLatin(first)) return 'letter'
  return 'other'
}

/**
 * 两台设备的排序比较器。
 * 只负责「同名档内怎么排」，收藏优先级由 sortDevices 处理。
 */
export function compareDeviceName(a?: string | null, b?: string | null): number {
  const sa = String(a ?? '')
  const sb = String(b ?? '')
  const ga = nameGroupOf(sa)
  const gb = nameGroupOf(sb)

  if (ga !== gb) return GROUP_ORDER[ga] - GROUP_ORDER[gb]
  // 中文等非字母数字开头的，退回拼音首字母口径
  if (ga === 'other') return compareByInitial(sa, sb)

  const r = NATURAL.compare(sa, sb)
  // sensitivity:'base' 下 'A1' 与 'a1' 相等，补一次严格比较，保证顺序稳定可复现
  return r !== 0 ? r : sa < sb ? -1 : sa > sb ? 1 : 0
}

/**
 * 分组标签：数字开头按 0-9 各成一档，字母开头取大写首字母，其余走拼音。
 * 之前数字统统归到 `#` 一档，与新口径「数字按 0-9」不一致，故改掉。
 */
export function deviceGroupKey(name?: string | null): string {
  const s = String(name ?? '').trim()
  if (!s) return INITIAL_OTHER
  const first = s[0]
  if (isDigit(first)) return first
  if (isLatin(first)) return first.toUpperCase()
  return getInitial(s) || INITIAL_OTHER
}

/** 分组之间的先后：数字档 → 字母档 → 其它档 */
export function groupWeight(key: string): string {
  const k = key || INITIAL_OTHER
  if (isDigit(k[0])) return `0${k}`
  if (isLatin(k[0])) return `1${k}`
  return `2${k}`
}
