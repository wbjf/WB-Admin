/** ProTable 列配置 */
export interface TableColumn {
  /** 列标题 */
  label: string
  /** 字段名 */
  prop: string
  width?: number | string
  minWidth?: number | string
  align?: 'left' | 'center' | 'right'
  fixed?: 'left' | 'right'
  sortable?: boolean | 'custom'
  tooltip?: boolean
  /** 是否在表格隐藏（列设置可勾选回来） */
  hidden?: boolean
  /** 是否为序号列 */
  type?: 'index' | 'selection' | 'expand'
  /** 自定义单元格插槽名，不填则用 prop 作为插槽名 */
  slot?: string
  /** 简单格式化 */
  formatter?: (row: any, value: any, index: number) => string
  children?: TableColumn[]
  reserveSelection?: boolean
}

export interface ProTableRequestResult<T = any> {
  list: T[]
  total: number
}

export type ProTableRequest<T = any> = (
  params: Record<string, any>
) => Promise<ProTableRequestResult<T>>
