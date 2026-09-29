import { defineConfig } from 'vitepress'

// 文档站的部署基路径。
//
// 为什么是子目录：GitHub Pages **每个仓库只有一个站点**，演示站已经占用了
// https://wbjf.github.io/WB-Admin/ 的根路径，所以文档站作为它的子目录发布在
// https://wbjf.github.io/WB-Admin/docs/ —— 两者同域，共用一次部署。
//
// 为什么写死在这里而不是构建时传参：**dev 与 build 共用同一个 base**，
// 本地 `npm run docs:dev` 打开的也是 http://localhost:5173/WB-Admin/docs/ ，
// 与线上的相对路径完全一致，这样「资源少了/多了层前缀」这类只在线上才炸的问题
// 在本地就能暴露出来。
//
// ⚠️ 不要改用 CLI 的 `--base` 传参。Windows 的 Git Bash（MSYS）会把以 `/` 开头的
// 命令行参数当路径改写：实测 `--base /WB-Admin/docs/` 被换成
// `C:/Users/<user>/.../PortableGit/versions/1.2.0/WB-Admin/docs/`，
// **构建照样成功**，但产物里所有链接都是垃圾路径 —— 静默，且只有打开页面才发现。
//
// 需要覆盖（比如 fork 后改了仓库名）用环境变量 DOCS_BASE。注意 Git Bash 连
// **环境变量的值**也会一起改写（实测 `DOCS_BASE=/wrong/base/` 被换成
// `C:/Users/.../PortableGit/versions/1.2.0/wrong/base/`）。绕过方式实测只有
// `MSYS_NO_PATHCONV=1` 有效（`MSYS2_ARG_CONV_EXCL` 管不到环境变量；写成 `//x/`
// 虽然不会被改写，但产物会变成协议相对 URL，比原问题更糟）：
//   MSYS_NO_PATHCONV=1 DOCS_BASE=/my-repo/docs/ npm run docs:build
const base = process.env.DOCS_BASE || '/WB-Admin/docs/'

export default defineConfig({
  title: 'WB-Admin',
  description: 'Vue3 + TypeScript + Element Plus 通用后台管理系统脚手架',
  lang: 'zh-CN',
  base,
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/intro' },
      { text: '组件', link: '/components/pro-table' },
      { text: '工程化', link: '/guide/engineering' },
      { text: '在线演示', link: 'https://wbjf.github.io/WB-Admin/' }
    ],
    // 源码公开，顺手给每页加一个「回到源码」的入口
    editLink: {
      pattern: 'https://github.com/wbjf/WB-Admin/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },
    sidebar: {
      '/guide/': [
        {
          text: '起步',
          items: [
            { text: '项目介绍', link: '/guide/intro' },
            { text: '快速开始', link: '/guide/start' },
            { text: '目录结构', link: '/guide/structure' },
            { text: '配置项', link: '/guide/config' }
          ]
        },
        {
          text: '核心机制',
          items: [
            { text: '动态路由与权限', link: '/guide/permission' },
            { text: '主题与布局', link: '/guide/theme' },
            { text: '国际化', link: '/guide/i18n' },
            { text: '多租户', link: '/guide/tenant' },
            { text: '请求层', link: '/guide/request' },
            { text: 'Mock 数据', link: '/guide/mock' }
          ]
        },
        {
          text: '工程化',
          items: [
            { text: '代码生成器', link: '/guide/generator' },
            { text: '构建与部署', link: '/guide/engineering' },
            { text: '新项目落地五步法', link: '/guide/new-project' }
          ]
        }
      ],
      '/components/': [
        {
          text: '业务组件',
          items: [
            { text: 'ProTable 高级表格', link: '/components/pro-table' },
            { text: 'ProForm 表单', link: '/components/pro-form' },
            { text: 'SearchForm 查询区', link: '/components/search-form' },
            { text: 'ProDialog 弹窗', link: '/components/pro-dialog' },
            { text: 'ProUpload 上传', link: '/components/pro-upload' }
          ]
        },
        {
          text: '功能组件',
          items: [
            { text: 'DictSelect / DictTag', link: '/components/dict' },
            { text: 'IconSelect 图标选择器', link: '/components/icon-select' },
            { text: 'EChart 图表', link: '/components/echart' },
            { text: 'ImageCropper 图片裁剪', link: '/components/image-cropper' },
            { text: 'DeptSelect 部门选择', link: '/components/dept-select' },
            { text: 'Editor 富文本编辑器', link: '/components/editor' }
          ]
        },
        {
          text: '工具',
          items: [
            { text: 'Composables', link: '/components/composables' },
            { text: '指令 v-hasPermi 等', link: '/components/directives' },
            { text: '工具函数', link: '/components/utils' }
          ]
        }
      ]
    },
    outline: { label: '本页目录', level: [2, 3] },
    docFooter: { prev: '上一篇', next: '下一篇' },
    search: { provider: 'local' },
    lastUpdated: { text: '最后更新' }
  }
})
