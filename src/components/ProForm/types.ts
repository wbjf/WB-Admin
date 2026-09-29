import type { FormItemRule } from 'element-plus'
import type { Option } from '@/types'

export type FormWidgetType =
  | 'input'
  | 'textarea'
  | 'number'
  | 'password'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'date'
  | 'daterange'
  | 'datetime'
  | 'time'
  | 'slider'
  | 'rate'
  | 'color'
  | 'icon'
  | 'dict'
  | 'upload'
  | 'slot'

export interface FormSchema {
  prop: string
  label: string
  type: FormWidgetType
  /** 下拉/单选/复选选项 */
  options?: Option[]
  /** 字典类型（type 为 dict 时必填） */
  dictType?: string
  /** 栅格占比，默认 24 */
  span?: number
  rules?: FormItemRule[]
  placeholder?: string
  /** 是否必填（自动生成 rules） */
  required?: boolean
  disabled?: boolean | ((model: any) => boolean)
  hidden?: boolean | ((model: any) => boolean)
  /** 自定义插槽名，type 为 slot 或需要覆盖时使用 */
  slot?: string
  /** 透传给底层组件的属性 */
  props?: Record<string, any>
  defaultValue?: any
  tip?: string
}
