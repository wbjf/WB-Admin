import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'WB-Admin',
  description: 'Vue3 + TypeScript + Element Plus 通用后台管理系统脚手架',
  lang: 'zh-CN',
  base: '/',
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/intro' },
      { text: '组件', link: '/components/pro-table' },
      { text: '工程化', link: '/guide/engineering' }
    ],
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
