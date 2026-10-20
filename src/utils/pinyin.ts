/**
 * 中文「拼音首字母 / 拼音排序」工具（零依赖）。
 *
 * ## 为什么不用 pinyin-pro 之类的字典包
 * 它们要额外带一份几百 KB 的「汉字 → 拼音」字典；而浏览器 / Node 内置的
 * `Intl.Collator('zh-CN')` 本身就实现了拼音排序（CLDR 里 zh-Hans 的默认排序规则
 * 就是 pinyin）。于是只要再准备 23 个「字母分界字」，用二分就能在**不带任何字典**
 * 的前提下把一个字定位到某个字母段，进而拿到首字母。
 *
 * ## 两个必须知道的前提
 * 1. **多音字无解**：任何自动方案都区分不了「重庆」到底是 C 还是 Z。
 *    业务上有需要时用 `setInitialResolver()` 挂一个订正钩子（见下方示例）。
 * 2. **运行环境可能没有中文排序规则**（裁剪过的 ICU、`--without-intl` 的 Node 等）。
 *    首次使用时会做一次自检，不通过就整体降级到 `#` 分组，
 *    宁可「都归到其它」，也不要给出看似可信其实是错的字母。
 *
 * @example 订正多音字 / 业务黑话
 * ```ts
 * import { getInitial, setInitialResolver } from '@/utils/pinyin'
 * const OVERRIDES: Record<string, string> = { 重庆: 'C' } // 按名称前缀订正
 * setInitialResolver((text, fallback) => OVERRIDES[text.slice(0, 2)] ?? fallback)
 * ```
 *
 * @example 有字典包时切换到精确实现
 * ```ts
 * import { pinyin } from 'pinyin-pro'
 * setInitialResolver((text) => pinyin(text, { pattern: 'first', toneType: 'none' })[0].toUpperCase())
 * ```
 */

/** 归类兜底桶：数字、纯符号、以及无法判定的字符 */
export const INITIAL_OTHER = '#'

/** 拼音里真实存在的首字母只有 23 个 —— 没有 I / U / V */
export const INITIAL_LETTERS = 'ABCDEFGHJKLMNOPQRSTWXYZ'.split('')

/**
 * 字母分界字：每个字取该拼音首字母下**最小的一个音节**。
 * 例如 B 取「八」(ba)，于是任何排在「八」之前且排在「啊」之后的字都属于 A 段。
 * 用常见字而非生僻字，避免编码 / 字体差异影响自检。
 */
const PILLARS: ReadonlyArray<readonly [string, string]> = [
  ['啊', 'A'],
  ['八', 'B'],
  ['擦', 'C'],
  ['搭', 'D'],
  ['蛾', 'E'],
  ['发', 'F'],
  ['噶', 'G'],
  ['哈', 'H'],
  ['击', 'J'],
  ['喀', 'K'],
  ['垃', 'L'],
  ['妈', 'M'],
  ['拿', 'N'],
  ['哦', 'O'],
  ['啪', 'P'],
  ['期', 'Q'],
  ['然', 'R'],
  ['撒', 'S'],
  ['塌', 'T'],
  ['挖', 'W'],
  ['昔', 'X'],
  ['压', 'Y'],
  ['匝', 'Z']
]

const RE_LATIN = /[a-zA-Z]/
const RE_DIGIT = /[0-9]/
const RE_CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/
const RE_MEANINGFUL = /[a-zA-Z0-9\u3400-\u4DBF\u4E00-\u9FFF]/

export type InitialResolver = (text: string, fallback: string) => string

let resolver: InitialResolver | null = null

/**
 * 挂一个首字母订正钩子。
 *
 * 注意钩子内部**不要**再调 `getInitial()`（会递归栈溢出）：
 * 第二个参数 `fallback` 就是内置算法算出来的结果，直接改写它即可。
 */
export function setInitialResolver(fn: InitialResolver | null): void {
  resolver = fn
}

function createCollator(locale = 'zh-CN'): Intl.Collator {
  // numeric：让「设备 2」排在「设备 10」之前（自然序），纯字典序会排成 10 → 2
  // sensitivity: 'base'：忽略声调与大小写差异，只比基础字形
  return new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
}

let _collator: Intl.Collator | null = null

export function collator(): Intl.Collator {
  if (!_collator) _collator = createCollator()
  return _collator
}

/**
 * 允许切换语种 / 重新构建 collator（测试或需要非默认 locale 时用）。
 * 会同时清掉自检结果与缓存，保证下一轮重新判定。
 */
export function setCollatorLocale(locale: string): void {
  _collator = createCollator(locale)
  _support = null
  initialCache.clear()
}

/** 中文友好的字符串比较器，可直接喂给 Array.prototype.sort */
export function compareName(a?: string | null, b?: string | null): number {
  return collator().compare(String(a ?? ''), String(b ?? ''))
}

/** 取第一个「有意义」字符：跳过前导空格与标点，避免「（甲区）一号机」被判成 `#` */
function firstMeaningfulChar(text: string): string {
  for (const ch of text) {
    if (RE_MEANINGFUL.test(ch)) return ch
  }
  return ''
}

const initialCache = new Map<string, string>()

/** 单个字符 → 首字母（不含 resolver 钩子） */
function initialOfChar(ch: string): string {
  if (!ch) return INITIAL_OTHER
  if (RE_LATIN.test(ch)) return ch.toUpperCase()
  if (RE_DIGIT.test(ch)) return INITIAL_OTHER
  if (!RE_CJK.test(ch)) return INITIAL_OTHER

  const cached = initialCache.get(ch)
  if (cached) return cached

  const cmp = collator().compare.bind(collator())
  // 二分找「最后一个 ≤ 当前字 的分界字」，它所属的字母就是答案。
  let lo = 0
  let hi = PILLARS.length - 1
  let ans = INITIAL_OTHER // 连「啊」都排在它前面 → 非汉字内容，进兜底桶
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (cmp(ch, PILLARS[mid][0]) >= 0) {
      ans = PILLARS[mid][1]
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  initialCache.set(ch, ans)
  return ans
}

let _support: boolean | null = null

/**
 * 运行环境是否真的支持中文拼音排序。
 *
 * 判据很硬核：把 23 个分界字分别喂给自己的算法，要求**每一个都算出自己的字母**。
 * 若底层 ICU 没有 zh 的拼音规则（退化成码点排序），「匝」(Z) 会算成 A 之类，自检立刻失败。
 * 结果只算一次。
 */
export function isPinyinSupported(): boolean {
  if (_support !== null) return _support
  try {
    _support = PILLARS.every(([ch, letter]) => initialOfChar(ch) === letter)
  } catch {
    _support = false
  }
  return _support
}

/** 测试用：清掉自检缓存，让下一次 isPinyinSupported() 重新判定 */
export function resetPinyinProbe(): void {
  _support = null
}

/**
 * 取名称的首字母（大写）。中文走拼音，英文 / 数字走字面量，其余归入 `#`。
 * 结果会经过 `setInitialResolver()` 挂的钩子（如果有）。
 */
export function getInitial(text?: string | null): string {
  const str = String(text ?? '').trim()
  if (!str) return INITIAL_OTHER
  const base = isPinyinSupported() ? initialOfChar(firstMeaningfulChar(str)) : INITIAL_OTHER
  if (!resolver) return base
  try {
    return resolver(str, base).toUpperCase()
  } catch {
    // 钩子是外部代码，写错不能把排序 / 渲染一起拖垮
    return base
  }
}

/**
 * 首字母的排序权重。
 *
 * 让 `#`（数字 / 符号）固定排在所有字母**之后**。
 * 不要直接用字符本身比较：`'#'(35) < 'A'(65)`，数字会跑到列表最前面，
 * 而且会跟「首字母分组」里把 `#` 放在末尾的排版不一致，用户会觉得混乱。
 */
export function initialWeight(letter: string): string {
  return letter === INITIAL_OTHER ? '~~~' : letter
}

/**
 * 首字母优先的自然排序：先按首字母（# 最后），首字母相同再比全名（拼音序 / 自然序）。
 * 这样「首字母像一样」的相邻性得到保证，分组视图与平铺视图的顺序也一致。
 */
export function compareByInitial(a?: string | null, b?: string | null): number {
  const ia = initialWeight(getInitial(a))
  const ib = initialWeight(getInitial(b))
  if (ia !== ib) return ia < ib ? -1 : 1
  return compareName(a, b)
}
