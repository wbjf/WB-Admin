// 生成 GitHub Pages 的 404 兜底页（在 npm run build:pages 之后执行）。
//
// 背景：GitHub Pages 对任何不存在的路径都只返回**站点根目录**的 /404.html，
// 子目录里的 404.html 不会被使用。而本站是一个站点里装了「两个应用」：
//   /WB-Admin/        → Vue 单页应用（history 路由，深链接要靠兜底页兜住）
//   /WB-Admin/docs/   → VitePress 文档站（每一页都是真实的 html 文件）
// 所以兜底页需要分流：文档站的路径回文档站首页，其余交给应用自己路由。
// 不分流的话，文档站里一个拼错的地址会把用户丢进后台的登录页，很困惑。
//
// 做法：把 index.html 的 <head> 开头插入一段普通（非 module）脚本。
// 它先于应用的 module 脚本执行，且只在文档站的路径下改写地址，
// 其余路径不做任何事 —— 应用照旧按 location.pathname 打开深链接。
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dist = resolve(process.argv[2] || 'dist')
// 覆盖入口只有这一个，且与 docs/.vitepress/config.ts 读的是同一个环境变量。
// 刻意**不**从命令行收路径参数：Windows 的 Git Bash(MSYS) 会把以 / 开头的参数
// 当路径改写（实测 /WB-Admin/docs/ → C:/Users/.../PortableGit/.../WB-Admin/docs/），
// 而 CI 是 Ubuntu 不会中招 —— 典型的「本地静默错、线上看着对」。
const docsBase = process.env.DOCS_BASE || '/WB-Admin/docs/'

// 自检：文档站产物里真实使用的资源前缀，必须与上面的 docsBase 一致。
// 对不上说明 config.ts 的 base 被改过而这里没跟上，**必须直接失败** ——
// 否则会静默上线一个把文档访问者丢进后台登录页的兜底页，很难想到去查这里。
const prefix = `${docsBase}assets/`
if (!readFileSync(resolve(dist, 'docs/index.html'), 'utf8').includes(prefix)) {
  throw new Error(
    `文档站产物里找不到资源前缀 ${prefix}，与 docs/.vitepress/config.ts 的 base 不一致`
  )
}

const html = readFileSync(resolve(dist, 'index.html'), 'utf8')

const guard = [
  '<script>',
  '  // 文档站的地址交给文档站；后台应用的深链接不会进这个分支',
  `  if (location.pathname.indexOf(${JSON.stringify(docsBase)}) === 0) {`,
  `    location.replace(${JSON.stringify(docsBase)})`,
  '  }',
  '</script>'
].join('\n')

const marker = '<head>'
if (!html.includes(marker)) {
  throw new Error(`index.html 里找不到 ${marker}，无法注入 404 分流脚本`)
}

writeFileSync(resolve(dist, '404.html'), html.replace(marker, `${marker}\n    ${guard}`))
console.log(`[make-404] 已生成 ${resolve(dist, '404.html')}，文档路径前缀：${docsBase}`)
