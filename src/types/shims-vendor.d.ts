/**
 * 第三方模块环境声明（本文件不能出现 import / export，否则会退化为模块增强而不生效）
 */
declare module 'qrcode' {
  interface QRCodeOptions {
    width?: number
    margin?: number
    color?: { dark?: string; light?: string }
    errorCorrectionLevel?: string
    type?: string
  }
  export function toDataURL(text: string, options?: QRCodeOptions): Promise<string>
  export function toDataURL(
    canvas: HTMLCanvasElement,
    text: string,
    options?: QRCodeOptions
  ): Promise<string>
  export function toString(text: string, options?: QRCodeOptions): Promise<string>
  export function toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    options?: QRCodeOptions
  ): Promise<void>
}

declare module '@wangeditor/editor-for-vue'

declare module '@wangeditor/editor'
