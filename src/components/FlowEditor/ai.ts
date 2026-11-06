import type { FlowGraph } from '@/types'
import { aiApi } from '@/api/ai'
import { DEFAULT_MODELS } from '@/components/AiChat/useAiChat'
import { createEmptyGraph, migrateFlow, newId } from './serialize'

/**
 * AI 生成流程图（E7）。
 *
 * 走和 AI 对话同一套接口（`@/api/ai` 的 `/api/chat`），
 * 所以模型换了、网关换了只需要改接口层一处。
 * 这个文件**只被动态 import**：`features.ai` 关闭时完全不进包。
 */

const SYSTEM_PROMPT = `你是半导体工艺流程图生成助手。根据用户描述输出一个 JSON 流程图，不要输出任何解释文字。
JSON 结构：
{"schema":1,"meta":{"id":"","name":"流程名"},"nodes":[{"id":"n1","type":"litho","x":100,"y":100,"text":"光刻","properties":{"code":"OP-0100"}}],"edges":[{"id":"e1","sourceNodeId":"n1","targetNodeId":"n2","text":""}],"groups":[]}
要求：
1. type 只能用：clean/coater/litho/develop/etch/strip/deposition/implant/cmp/furnace/metro/decision/start/end/lot/note；
2. x/y 为节点中心坐标，横向流程：x 每次 +180，y 固定 200，超过 6 个换行（y +160）；
3. nodes 顺序即工艺顺序，edges 把它们串起来；
4. 只输出 JSON。`

export interface GenerateOptions {
  signal?: AbortSignal
  /** 已有图时让模型在此基础上改 */
  base?: FlowGraph
}

export async function generateFlow(prompt: string, opts: GenerateOptions = {}): Promise<FlowGraph> {
  const data = await aiApi.chat(
    {
      model: DEFAULT_MODELS[0]?.id ?? 'qwen2.5:3b',
      messages: [
        // 接口只认 user / assistant，把系统提示并进第一条 user
        { role: 'user', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: opts.base
            ? `${prompt}\n\n当前图：${JSON.stringify({ nodes: opts.base.nodes.map((n) => n.text), edges: opts.base.edges.length })}`
            : prompt
        }
      ],
      stream: false
    },
    opts.signal
  )

  const text = String(data?.message?.content ?? '')

  const graph = parseGraph(text)
  if (graph) return graph
  // 模型没返回合法 JSON（小模型常见）：按关键词搭一个骨架，保证功能可见
  return keywordFallback(prompt)
}

/** 从回复里抠出第一个 JSON 对象（模型爱加 ```json 围栏和解释） */
export function parseGraph(text: string): FlowGraph | null {
  if (!text) return null
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const json = JSON.parse(cleaned.slice(start, end + 1))
    if (!json || !Array.isArray(json.nodes)) return null
    return migrateFlow(json)
  } catch {
    return null
  }
}

const KEYWORDS: Array<{ re: RegExp; type: string; label: string }> = [
  { re: /清洗|clean|rca/i, type: 'clean', label: '晶圆清洗' },
  { re: /涂胶|coater|track/i, type: 'coater', label: '涂胶' },
  { re: /光刻|曝光|litho|photo/i, type: 'litho', label: '光刻曝光' },
  { re: /显影|develop/i, type: 'develop', label: '显影' },
  { re: /刻蚀|etch/i, type: 'etch', label: '刻蚀' },
  { re: /去胶|strip/i, type: 'strip', label: '去胶' },
  { re: /沉积|cvd|pvd|film|薄膜/i, type: 'deposition', label: '薄膜沉积' },
  { re: /注入|implant/i, type: 'implant', label: '离子注入' },
  { re: /抛光|cmp/i, type: 'cmp', label: 'CMP 抛光' },
  { re: /扩散|炉|furnace/i, type: 'furnace', label: '扩散' },
  { re: /量测|测量|metro|cd|sem/i, type: 'metro', label: '量测' },
  { re: /判定|检查|decision|判断/i, type: 'decision', label: '判定' }
]

/** 关键词兜底：至少给出一条可编辑的骨架，而不是报错了事 */
export function keywordFallback(prompt: string): FlowGraph {
  const graph = createEmptyGraph('', (prompt || 'AI 生成流程').slice(0, 20))
  const hits = KEYWORDS.filter((k) => k.re.test(prompt || ''))
  const list = hits.length
    ? hits
    : [
        { re: /.*/, type: 'clean', label: '晶圆清洗' },
        { re: /.*/, type: 'litho', label: '光刻曝光' },
        { re: /.*/, type: 'etch', label: '刻蚀' },
        { re: /.*/, type: 'metro', label: '量测' }
      ]

  list.forEach((k, i) => {
    const id = newId('n')
    graph.nodes.push({
      id,
      type: k.type,
      x: 100 + (i % 6) * 180,
      y: 200 + Math.floor(i / 6) * 160,
      text: k.label,
      width: 140,
      height: 54,
      properties: { code: `OP-0${(i + 1) * 100}`, params: [], comments: [] }
    })
    if (i > 0) {
      graph.edges.push({
        id: newId('e'),
        type: 'polyline',
        sourceNodeId: graph.nodes[i - 1].id,
        targetNodeId: id,
        properties: { kind: 'main' }
      })
    }
  })
  return graph
}
