// 通过 IndexNow 将站点 URL 主动提交给 Bing / Yandex 等搜索引擎，加快收录。
// 用法：pnpm run seo:indexnow
const KEY = '37c9e89f3018e29485ad41828ffdfc70'
const HOST = 'mail.kodao.site'
const BASE = `https://${HOST}`
const PATHS = ['/', '/en/', '/ja/', '/de/', '/es/', '/pt-BR/']

const urlList = PATHS.map((path) => `${BASE}${path}`)

const payload = {
  host: HOST,
  key: KEY,
  keyLocation: `${BASE}/${KEY}.txt`,
  urlList,
}

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
})

console.log(`[indexnow] submitted ${urlList.length} urls, status=${response.status} ${response.statusText}`)

if (!response.ok && response.status !== 202) {
  process.exitCode = 1
}
