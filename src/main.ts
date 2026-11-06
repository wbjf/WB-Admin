import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import pinia from './stores'
import i18n from './locales'
import './styles/index.scss'
import { registerDirectives } from './directives'
import { setupErrorHandler, registerGlobalComponents } from './plugins'
import './router/guard'

const app = createApp(App)

// 全量注册图标，便于图标选择器动态渲染
Object.entries(ElementPlusIconsVue).forEach(([name, comp]) => {
  app.component(name, comp)
})

app.use(pinia)
app.use(router)
app.use(i18n)
app.use(ElementPlus)

registerDirectives(app)
registerGlobalComponents(app)
setupErrorHandler(app)

// AI 对话的接口定义在 api/ai.ts，状态与流解析在 components/AiChat/useAiChat.ts，
// 打开面板时拉模型列表、点发送时打 /api/chat，不需要在这里装配任何东西。

app.mount('#app')
