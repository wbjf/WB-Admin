import { ElLoading, ElMessage, ElMessageBox } from 'element-plus'
import type { AxiosRequestConfig } from 'axios'
import service from './request'
import { t } from '@/locales'

interface DownloadOptions {
  /** 是否使用 POST */
  method?: 'get' | 'post'
  params?: Record<string, any>
  data?: Record<string, any>
  /** 自定义文件名（不含扩展名） */
  filename?: string
  /** 是否展示 loading */
  loading?: boolean
}

function parseFilename(disposition: string | undefined, fallback: string): string {
  if (!disposition) return fallback
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (utf8) return decodeURIComponent(utf8[1])
  const ascii = /filename="?([^";]+)"?/i.exec(disposition)
  return ascii ? decodeURIComponent(ascii[1]) : fallback
}

/**
 * 通用文件下载：自动识别后端错误 JSON，避免把错误体写成文件
 */
export async function download(url: string, options: DownloadOptions = {}): Promise<void> {
  const { method = 'get', params, data, filename, loading = true } = options
  const loadingIns = loading ? ElLoading.service({ text: t('common.downloading'), background: 'rgba(0,0,0,0.2)' }) : null
  try {
    const res = await service.request({
      url,
      method,
      params: method === 'get' ? params : undefined,
      data: method === 'post' ? data : undefined,
      responseType: 'blob',
      meta: { showError: false }
    } as AxiosRequestConfig)

    const blob = res as unknown as Blob
    // 后端返回 JSON 错误体时会走到这里
    if (blob.type && blob.type.includes('application/json')) {
      const text = await blob.text()
      try {
        const json = JSON.parse(text)
        ElMessage.error(json.msg || json.message || t('common.downloadFailed'))
      } catch {
        ElMessage.error(t('common.downloadFailed'))
      }
      return
    }

    if (!blob.size) {
      ElMessage.warning(t('common.emptyFile'))
      return
    }

    const disposition = (res as any)?.headers?.['content-disposition'] as string | undefined
    const finalName = filename || parseFilename(disposition, `download_${Date.now()}`)
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = finalName
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(href)
  } catch (e) {
    ElMessage.error(t('common.downloadFailed'))
  } finally {
    loadingIns?.close()
  }
}

/** 导出前二次确认 */
export async function confirmExport(tip?: string): Promise<boolean> {
  try {
    await ElMessageBox.confirm(tip || t('common.exportConfirm'), t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
    return true
  } catch {
    return false
  }
}

/** 本地文本转文件下载 */
export function downloadText(content: string, filename: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}
