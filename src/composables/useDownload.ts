import { download, confirmExport } from '@/utils/download'
import { exportExcel, downloadTemplate, type ExcelColumn } from '@/utils/excel'

/** 下载导出能力组合式封装 */
export function useDownload() {
  /** 后端导出 */
  async function exportByApi(url: string, params: Record<string, any> = {}, tip?: string): Promise<void> {
    if (!(await confirmExport(tip))) return
    await download(url, { method: 'post', data: params })
  }

  /** 前端导出（数据已在浏览器内） */
  function exportLocal(columns: ExcelColumn[], rows: any[], filename?: string): void {
    exportExcel(columns, rows, filename)
  }

  /** 下载模板 */
  function template(columns: ExcelColumn[], filename = 'template'): void {
    downloadTemplate(columns, filename)
  }

  /** 任意地址下载 */
  function raw(url: string, filename?: string): Promise<void> {
    return download(url, { filename })
  }

  return { exportByApi, exportLocal, template, raw }
}

export default useDownload
