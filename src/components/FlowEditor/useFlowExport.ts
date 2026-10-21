import { saveAs } from 'file-saver'
import { ElMessage } from 'element-plus'
import type LogicFlow from '@logicflow/core'
import type { FlowGraph } from '@/types'
import { downloadText } from '@/utils/download'
import { exportExcel } from '@/utils/excel'
import { printElement } from '@/utils/print'
import { migrateFlow } from './serialize'

export type ExportType = 'png' | 'jpeg' | 'svg' | 'json' | 'excel' | 'print'

interface SnapshotLike {
  getSnapshotBase64?: (
    backgroundColor?: string,
    fileType?: string
  ) => Promise<{ data: Blob | string; width: number; height: number }>
}

function snapshotExt(lf: LogicFlow): SnapshotLike | null {
  const ext = (lf as unknown as { extension?: Record<string, SnapshotLike> }).extension
  return ext?.snapshot ?? null
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',')
  const mime = /:(.*?);/.exec(head)?.[1] || 'image/png'
  if (head.includes('base64')) {
    const bin = atob(body)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return new Blob([arr], { type: mime })
  }
  return new Blob([decodeURIComponent(body)], { type: mime })
}

function safeName(name: string): string {
  return (name || 'flow').replace(/[\\/:*?"<>|]/g, '_')
}

/**
 * 导出。图片走 LogicFlow 的 Snapshot 插件（SVG → canvas，不依赖页面 CSS，
 * 因为节点是纯 SVG 画的），JSON 走 `downloadText`，工艺卡走 `exportExcel`。
 */
export function useFlowExport(lf: () => LogicFlow | null, graph: () => FlowGraph) {
  async function exportImage(type: 'png' | 'jpeg' | 'svg' = 'png'): Promise<void> {
    const instance = lf()
    const snap = instance ? snapshotExt(instance) : null
    if (!snap?.getSnapshotBase64) {
      ElMessage.warning('当前配置未加载快照插件，无法导出图片')
      return
    }
    const g = graph()
    const name = safeName(g.meta?.name || 'flow')
    try {
      if (type === 'svg') {
        // svg 插件返回的是 dataUrl（base64 或 svg+xml）
        const res = await snap.getSnapshotBase64('transparent', 'svg')
        const raw = typeof res.data === 'string' ? res.data : ''
        const text = raw.startsWith('data:') && raw.includes('base64') ? decodeSvg(raw) : raw
        const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' })
        saveAs(blob, `${name}.svg`)
        return
      }
      const res = await snap.getSnapshotBase64('#ffffff', type)
      const dataUrl = typeof res.data === 'string' ? res.data : ''
      saveAs(dataTypeUrl(dataUrl, type), `${name}.${type}`)
    } catch {
      ElMessage.error('导出图片失败')
    }
  }

  function exportJson(): void {
    const g = graph()
    downloadText(
      JSON.stringify(g, null, 2),
      `${safeName(g.meta?.name || 'flow')}.flow`,
      'application/json;charset=utf-8'
    )
  }

  /** 工艺卡 Excel：一张表列出所有工序及其参数 */
  function exportExcelCard(): void {
    const g = graph()
    const rows = g.nodes.map((n, i) => ({
      seq: i + 1,
      code: n.properties?.code || '',
      name: n.text || '',
      type: n.type,
      device: n.properties?.deviceName || '',
      cycleTime: n.properties?.cycleTime ?? '',
      remark: n.properties?.remark || '',
      params: (n.properties?.params || [])
        .map((p) => `${p.key}=${p.value}${p.unit || ''}`)
        .join('; ')
    }))
    exportExcel(
      [
        { label: '序号', prop: 'seq', width: 60 },
        { label: '工序编号', prop: 'code', width: 120 },
        { label: '名称', prop: 'name', width: 160 },
        { label: '类型', prop: 'type', width: 100 },
        { label: '设备', prop: 'device', width: 140 },
        { label: '节拍(分钟)', prop: 'cycleTime', width: 100 },
        { label: '工艺参数', prop: 'params', width: 300 },
        { label: '备注', prop: 'remark', width: 200 }
      ],
      rows,
      safeName(g.meta?.name || 'flow') + '-工艺卡'
    )
  }

  function print(): void {
    const el = document.querySelector('.wb-flow-canvas svg') as HTMLElement | null
    if (el) printElement(el, { header: graph().meta?.name || '流程图' })
    else window.print()
  }

  async function exportAs(type: ExportType): Promise<void> {
    if (type === 'png' || type === 'jpeg' || type === 'svg') return exportImage(type)
    if (type === 'json') return exportJson()
    if (type === 'excel') return exportExcelCard()
    if (type === 'print') return print()
  }

  return { exportAs, exportImage, exportJson, exportExcelCard, print }
}

/** 读取 .flow.json 文件（导入用） */
export function readFlowFile(file: File): Promise<FlowGraph> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result || '{}'))
        if (!json || (!json.nodes && !json.edges)) throw new Error('不是有效的流程图文件')
        resolve(migrateFlow(json))
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

function dataTypeUrl(dataUrl: string, type: string): Blob {
  if (dataUrl.startsWith('data:')) return dataUrlToBlob(dataUrl)
  return new Blob([dataUrl], { type: `image/${type}` })
}

function decodeSvg(dataUrl: string): string {
  const base64 = dataUrl.split(',').slice(1).join(',')
  try {
    // svg 可能是 base64 也可能是 URL 编码
    return base64.includes('%') ? decodeURIComponent(base64) : atob(base64)
  } catch {
    return dataUrl
  }
}
