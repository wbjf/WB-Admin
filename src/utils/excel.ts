import * as XLSX from 'xlsx'
import { ElMessage } from 'element-plus'
import { t } from '@/locales'

export interface ExcelColumn {
  label: string
  prop: string
  width?: number
  formatter?: (row: any, value: any) => any
}

/** 导出 Excel */
export function exportExcel(
  columns: ExcelColumn[],
  rows: any[],
  filename = `export_${Date.now()}`,
  sheetName = 'Sheet1'
): void {
  const header = columns.map((c) => c.label)
  const body = rows.map((row) =>
    columns.map((c) => {
      const raw = row[c.prop]
      return c.formatter ? c.formatter(row, raw) : raw
    })
  )
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body])
  sheet['!cols'] = columns.map((c) => ({ wch: (c.width || 18) as number }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/** 读取 Excel / CSV 首个工作表 */
export async function readExcel<T = any>(file: File, converter?: (rows: any[]) => T[]): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' })
        const first = wb.SheetNames[0]
        if (!first) {
          ElMessage.warning(t('common.emptyFile'))
          resolve([])
          return
        }
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[first], { defval: '' })
        resolve(converter ? converter(rows as any[]) : (rows as unknown as T[]))
      } catch (err) {
        ElMessage.error(t('common.parseFailed'))
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsArrayBuffer(file)
  })
}

/** 下载导入模板 */
export function downloadTemplate(columns: ExcelColumn[], filename = 'template'): void {
  exportExcel(columns, [], filename, 'template')
}
