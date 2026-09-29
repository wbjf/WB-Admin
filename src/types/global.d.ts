import type * as Icons from '@element-plus/icons-vue'

/**
 * main.ts 中全量注册了 Element Plus 图标，模板里可以直接使用。
 * 这里补齐 vue-tsc 所需的全局组件声明，避免 <User /> 之类被判为未知组件。
 */
declare module 'vue' {
  export interface GlobalComponents {
    // 认证页用到
    User: typeof Icons.User
    Lock: typeof Icons.Lock
    Iphone: typeof Icons.Iphone
    Key: typeof Icons.Key
    Message: typeof Icons.Message
    Moon: typeof Icons.Moon
    Sunny: typeof Icons.Sunny
    CircleCheckFilled: typeof Icons.CircleCheckFilled
    // 布局与导航
    Search: typeof Icons.Search
    Setting: typeof Icons.Setting
    Bell: typeof Icons.Bell
    Grid: typeof Icons.Grid
    Expand: typeof Icons.Expand
    Fold: typeof Icons.Fold
    FullScreen: typeof Icons.FullScreen
    Refresh: typeof Icons.Refresh
    Close: typeof Icons.Close
    Link: typeof Icons.Link
    ArrowUp: typeof Icons.ArrowUp
    ArrowDown: typeof Icons.ArrowDown
    Top: typeof Icons.Top
    Bottom: typeof Icons.Bottom
    // 表格与上传
    Delete: typeof Icons.Delete
    Document: typeof Icons.Document
    Plus: typeof Icons.Plus
    UploadFilled: typeof Icons.UploadFilled
    Download: typeof Icons.Download
    Printer: typeof Icons.Printer
    Edit: typeof Icons.Edit
    EditPen: typeof Icons.EditPen
    // 裁剪
    ZoomIn: typeof Icons.ZoomIn
    ZoomOut: typeof Icons.ZoomOut
    RefreshLeft: typeof Icons.RefreshLeft
    RefreshRight: typeof Icons.RefreshRight
    // 菜单图标（页面内可能直接引用）
    Monitor: typeof Icons.Monitor
    Cpu: typeof Icons.Cpu
    Coin: typeof Icons.Coin
    Timer: typeof Icons.Timer
    Folder: typeof Icons.Folder
    MagicStick: typeof Icons.MagicStick
    DataAnalysis: typeof Icons.DataAnalysis
    Odometer: typeof Icons.Odometer
    OfficeBuilding: typeof Icons.OfficeBuilding
    Postcard: typeof Icons.Postcard
    Collection: typeof Icons.Collection
    Tools: typeof Icons.Tools
    Connection: typeof Icons.Connection
    Tickets: typeof Icons.Tickets
    Present: typeof Icons.Present
    UserFilled: typeof Icons.UserFilled
    Menu: typeof Icons.Menu
    Warning: typeof Icons.Warning
    ShoppingCart: typeof Icons.ShoppingCart
    Service: typeof Icons.Service
  }
}

export {}
