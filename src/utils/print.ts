import print from 'print-js'
import { ElMessage } from 'element-plus'
import { t } from '@/locales'

interface PrintOptions {
  /** 标题，出现在页眉 */
  header?: string
  /** 表样式（print-js header style） */
  headerStyle?: string
  /** 自定义样式串 */
  style?: string
  /** 是否横向 */
  landscape?: boolean
}

/** 打印任意 DOM 元素 */
export function printElement(el: HTMLElement | string, options: PrintOptions = {}): void {
  const target = typeof el === 'string' ? document.querySelector(el) : el
  if (!target) {
    ElMessage.warning(t('common.printTargetMissing'))
    return
  }
  print({
    printable: target as HTMLElement,
    type: 'html',
    targetStyles: ['*'],
    scanStyles: false,
    header: options.header,
    headerStyle: options.headerStyle ?? 'text-align:center;font-size:16px;font-weight:500;',
    style: options.style ?? '@page { size: A4 landscape; margin: 10mm; }',
    documentTitle: options.header ?? document.title
  })
}

/** 打印一组列数据（表格形式） */
export function printTable<T extends Record<string, any>>(
  columns: { label: string; prop: string; formatter?: (row: T) => any }[],
  rows: T[],
  options: PrintOptions = {}
): void {
  print({
    printable: rows,
    type: 'json',
    properties: columns.map((c) => ({
      field: c.prop,
      displayName: c.label,
      columnSize: '1'
    })),
    header: options.header ?? t('common.print'),
    gridHeaderStyle: 'border:1px solid #ddd;padding:6px;background:#f5f5f5;',
    gridStyle: 'border:1px solid #ddd;padding:6px;',
    documentTitle: options.header ?? document.title
  })
}
