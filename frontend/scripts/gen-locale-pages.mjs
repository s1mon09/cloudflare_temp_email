// 构建后处理：为每种语言生成带本地化 SEO 内容的静态 HTML，并同步生成 sitemap。
// 在 `vite build` 之后运行，读取 dist/index.html，替换 <!-- seo:head:* --> 与
// <!-- seo:body:* --> 标记之间的内容后，写出 dist/index.html 与各语言子目录页面。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(__dirname, '../dist')

const SITE = 'https://mail.kodao.site'
const OG_IMAGE = `${SITE}/logo.png`
const OG_SITE_NAME = 'Temp Email'

export const LOCALES = [
  {
    id: 'zh',
    dir: '',
    path: '/',
    htmlLang: 'zh-CN',
    hreflang: 'zh-CN',
    ogLocale: 'zh_CN',
    currency: 'CNY',
    priority: '1.0',
    title: '临时邮箱 Temp Email - 免费在线接收邮件与验证码',
    description:
      '免费临时邮箱，无需注册即可生成临时邮箱地址，实时接收邮件与验证码，保护真实邮箱免受垃圾邮件骚扰。支持自定义域名、多语言与附件下载。',
    keywords:
      '临时邮箱,免费邮箱,一次性邮箱,验证码接收,临时邮件,10分钟邮箱,temp mail,disposable email',
    h1: '临时邮箱 Temp Email',
    intro:
      '免费临时邮箱，无需注册即可生成临时邮箱地址，实时接收邮件与验证码，保护真实邮箱免受垃圾邮件骚扰。支持自定义域名、多语言与附件下载，适合注册账号、接收验证码等一次性场景。',
    bullets: [
      '无需注册，即时生成临时邮箱地址',
      '实时接收邮件，自动识别验证码',
      '支持自定义域名与多语言界面',
      '支持附件下载与邮件 API',
    ],
    faqTitle: '常见问题',
    faq: [
      { q: '临时邮箱是免费的吗？', a: '是的，全部功能免费使用，无需注册即可开始接收邮件。' },
      {
        q: '临时邮箱能用来做什么？',
        a: '适合注册账号、接收验证码、试用服务等一次性场景，避免真实邮箱被垃圾邮件骚扰。',
      },
      { q: '邮件会保存多久？', a: '临时地址与邮件会在到期后自动清理，请及时保存重要信息。' },
    ],
  },
  {
    id: 'en',
    dir: 'en',
    path: '/en/',
    htmlLang: 'en',
    hreflang: 'en',
    ogLocale: 'en_US',
    currency: 'USD',
    priority: '0.9',
    title: 'Temp Email - Free Online Disposable Email & Verification Codes',
    description:
      'Free temporary email. Instantly generate a disposable address without registration, receive emails and verification codes in real time, and keep your real inbox free from spam. Custom domains, multiple languages and attachments supported.',
    keywords:
      'temp mail, temporary email, disposable email, verification code, 10 minute mail, fake email, anonymous email',
    h1: 'Temp Email - Free Temporary Email',
    intro:
      'Free temporary email service. Generate a disposable address instantly without registration, receive emails and verification codes in real time, and keep your real inbox spam-free. Custom domains, multiple languages and attachments are supported — ideal for sign-ups and one-time verification.',
    bullets: [
      'No registration, generate a temporary address instantly',
      'Receive emails in real time with automatic verification code detection',
      'Custom domains and a multi-language interface',
      'Attachment download and a mail API',
    ],
    faqTitle: 'Frequently asked questions',
    faq: [
      {
        q: 'Is the temporary email free?',
        a: 'Yes, all features are free and no registration is required to start receiving emails.',
      },
      {
        q: 'What can I use a temporary email for?',
        a: 'It is ideal for sign-ups, receiving verification codes and trying services without exposing your real inbox to spam.',
      },
      {
        q: 'How long are emails kept?',
        a: 'Temporary addresses and their emails are cleaned up automatically after they expire, so save anything important in time.',
      },
    ],
  },
  {
    id: 'ja',
    dir: 'ja',
    path: '/ja/',
    htmlLang: 'ja',
    hreflang: 'ja',
    ogLocale: 'ja_JP',
    currency: 'USD',
    priority: '0.8',
    title: '一時メール Temp Email - メールと認証コードを無料で受信',
    description:
      '無料の一時メール。登録なしで使い捨てアドレスを即時作成し、メールと認証コードをリアルタイムで受信。本当のメールボックスを迷惑メールから守ります。カスタムドメイン、多言語、添付ファイルに対応。',
    keywords: '一時メール,使い捨てメール,フリーメール,認証コード,10分メール,temp mail,disposable email',
    h1: '一時メール Temp Email',
    intro:
      '無料の一時メールサービスです。登録なしで使い捨てアドレスを即時作成し、メールと認証コードをリアルタイムで受信できます。本当のメールボックスを迷惑メールから守り、カスタムドメイン・多言語・添付ファイルにも対応。アカウント登録や認証コードの受信など、一度きりの用途に最適です。',
    bullets: [
      '登録不要で即時に一時アドレスを作成',
      'メールをリアルタイム受信し、認証コードを自動抽出',
      'カスタムドメインと多言語 UI に対応',
      '添付ファイルのダウンロードとメール API に対応',
    ],
    faqTitle: 'よくある質問',
    faq: [
      {
        q: '一時メールは無料ですか？',
        a: 'はい、すべての機能を無料で利用でき、登録なしですぐに受信を開始できます。',
      },
      {
        q: 'どのような用途に使えますか？',
        a: 'アカウント登録や認証コードの受信、サービスの試用などに最適で、本当のメールアドレスを迷惑メールから守れます。',
      },
      {
        q: 'メールはどのくらい保存されますか？',
        a: '一時アドレスとメールは有効期限後に自動的に削除されるため、重要な内容は早めに保存してください。',
      },
    ],
  },
  {
    id: 'de',
    dir: 'de',
    path: '/de/',
    htmlLang: 'de',
    hreflang: 'de',
    ogLocale: 'de_DE',
    currency: 'USD',
    priority: '0.8',
    title: 'Temp Email - Kostenlose Wegwerf-E-Mail & Verifizierungscodes',
    description:
      'Kostenlose temporäre E-Mail. Erzeuge sofort eine Wegwerf-Adresse ohne Registrierung, empfange E-Mails und Verifizierungscodes in Echtzeit und halte dein echtes Postfach spamfrei. Eigene Domains, mehrere Sprachen und Anhänge werden unterstützt.',
    keywords:
      'temporäre E-Mail, Wegwerf-E-Mail, Einweg-E-Mail, Verifizierungscode, 10-Minuten-Mail, temp mail',
    h1: 'Temp Email - Kostenlose temporäre E-Mail',
    intro:
      'Kostenloser temporärer E-Mail-Dienst. Erzeuge ohne Registrierung sofort eine Wegwerf-Adresse, empfange E-Mails und Verifizierungscodes in Echtzeit und halte dein echtes Postfach spamfrei. Eigene Domains, mehrere Sprachen und Anhänge werden unterstützt – ideal für Anmeldungen und einmalige Verifizierungen.',
    bullets: [
      'Keine Registrierung, sofort eine temporäre Adresse erzeugen',
      'E-Mails in Echtzeit empfangen, Verifizierungscodes automatisch erkennen',
      'Eigene Domains und mehrsprachige Oberfläche',
      'Anhang-Download und Mail-API',
    ],
    faqTitle: 'Häufige Fragen',
    faq: [
      {
        q: 'Ist die temporäre E-Mail kostenlos?',
        a: 'Ja, alle Funktionen sind kostenlos und du kannst ohne Registrierung sofort E-Mails empfangen.',
      },
      {
        q: 'Wofür kann ich eine temporäre E-Mail nutzen?',
        a: 'Sie eignet sich für Anmeldungen, den Empfang von Verifizierungscodes und Tests von Diensten, ohne dein echtes Postfach Spam auszusetzen.',
      },
      {
        q: 'Wie lange werden E-Mails gespeichert?',
        a: 'Temporäre Adressen und ihre E-Mails werden nach Ablauf automatisch gelöscht. Speichere wichtige Inhalte rechtzeitig.',
      },
    ],
  },
  {
    id: 'es',
    dir: 'es',
    path: '/es/',
    htmlLang: 'es',
    hreflang: 'es',
    ogLocale: 'es_ES',
    currency: 'USD',
    priority: '0.8',
    title: 'Temp Email - Correo Temporal Gratis y Códigos de Verificación',
    description:
      'Correo temporal gratis. Genera una dirección desechable al instante sin registro, recibe correos y códigos de verificación en tiempo real y mantén tu bandeja real libre de spam. Compatible con dominios personalizados, varios idiomas y archivos adjuntos.',
    keywords:
      'correo temporal, correo desechable, correo gratis, código de verificación, correo de 10 minutos, temp mail',
    h1: 'Temp Email - Correo Temporal Gratis',
    intro:
      'Servicio de correo temporal gratis. Genera una dirección desechable al instante sin registro, recibe correos y códigos de verificación en tiempo real y mantén tu bandeja real libre de spam. Compatible con dominios personalizados, varios idiomas y archivos adjuntos; ideal para registros y verificaciones puntuales.',
    bullets: [
      'Sin registro: genera una dirección temporal al instante',
      'Recibe correos en tiempo real y detecta códigos de verificación',
      'Dominios personalizados e interfaz multilingüe',
      'Descarga de adjuntos y API de correo',
    ],
    faqTitle: 'Preguntas frecuentes',
    faq: [
      {
        q: '¿El correo temporal es gratis?',
        a: 'Sí, todas las funciones son gratuitas y no necesitas registrarte para empezar a recibir correos.',
      },
      {
        q: '¿Para qué sirve un correo temporal?',
        a: 'Es ideal para registros, recibir códigos de verificación y probar servicios sin exponer tu correo real al spam.',
      },
      {
        q: '¿Cuánto tiempo se guardan los correos?',
        a: 'Las direcciones temporales y sus correos se eliminan automáticamente al caducar; guarda la información importante a tiempo.',
      },
    ],
  },
  {
    id: 'pt-BR',
    dir: 'pt-BR',
    path: '/pt-BR/',
    htmlLang: 'pt-BR',
    hreflang: 'pt-BR',
    ogLocale: 'pt_BR',
    currency: 'USD',
    priority: '0.8',
    title: 'Temp Email - E-mail Temporário Grátis e Códigos de Verificação',
    description:
      'E-mail temporário grátis. Gere um endereço descartável na hora, sem cadastro, receba e-mails e códigos de verificação em tempo real e mantenha sua caixa real livre de spam. Compatível com domínios personalizados, vários idiomas e anexos.',
    keywords:
      'email temporário, email descartável, email grátis, código de verificação, email de 10 minutos, temp mail',
    h1: 'Temp Email - E-mail Temporário Grátis',
    intro:
      'Serviço de e-mail temporário grátis. Gere um endereço descartável na hora, sem cadastro, receba e-mails e códigos de verificação em tempo real e mantenha sua caixa de entrada real livre de spam. Compatível com domínios personalizados, vários idiomas e anexos — ideal para cadastros e verificações pontuais.',
    bullets: [
      'Sem cadastro: gere um endereço temporário na hora',
      'Receba e-mails em tempo real e detecte códigos de verificação',
      'Domínios personalizados e interface multilíngue',
      'Download de anexos e API de e-mail',
    ],
    faqTitle: 'Perguntas frequentes',
    faq: [
      {
        q: 'O e-mail temporário é grátis?',
        a: 'Sim, todas as funções são gratuitas e você não precisa se cadastrar para começar a receber e-mails.',
      },
      {
        q: 'Para que serve um e-mail temporário?',
        a: 'É ideal para cadastros, receber códigos de verificação e testar serviços sem expor seu e-mail real a spam.',
      },
      {
        q: 'Por quanto tempo os e-mails são guardados?',
        a: 'Endereços temporários e seus e-mails são removidos automaticamente após expirarem; salve o que for importante a tempo.',
      },
    ],
  },
]

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const renderHreflang = () =>
  LOCALES.map((loc) => `  <link rel="alternate" hreflang="${loc.hreflang}" href="${SITE}${loc.path}" />`)
    .join('\n') + `\n  <link rel="alternate" hreflang="x-default" href="${SITE}/" />`

const renderOgAlternates = (current) =>
  LOCALES.filter((loc) => loc.id !== current.id)
    .map((loc) => `  <meta property="og:locale:alternate" content="${loc.ogLocale}">`)
    .join('\n')

const buildJsonLd = (loc) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'Temp Email',
      alternateName: loc.h1,
      url: `${SITE}${loc.path}`,
      description: loc.description,
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'Web',
      inLanguage: loc.htmlLang,
      offers: { '@type': 'Offer', price: '0', priceCurrency: loc.currency },
    },
    {
      '@type': 'WebSite',
      name: 'Temp Email',
      url: SITE,
      inLanguage: loc.htmlLang,
    },
    {
      '@type': 'Organization',
      name: 'Temp Email',
      url: SITE,
      logo: OG_IMAGE,
    },
    {
      '@type': 'FAQPage',
      inLanguage: loc.htmlLang,
      mainEntity: loc.faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ],
})

const renderHead = (loc) => `  <title>${escapeHtml(loc.title)}</title>
  <meta name="description" content="${escapeHtml(loc.description)}">
  <meta name="keywords" content="${escapeHtml(loc.keywords)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${SITE}${loc.path}">
${renderHreflang()}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${OG_SITE_NAME}">
  <meta property="og:title" content="${escapeHtml(loc.title)}">
  <meta property="og:description" content="${escapeHtml(loc.description)}">
  <meta property="og:url" content="${SITE}${loc.path}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:locale" content="${loc.ogLocale}">
${renderOgAlternates(loc)}
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(loc.title)}">
  <meta name="twitter:description" content="${escapeHtml(loc.description)}">
  <meta name="twitter:image" content="${OG_IMAGE}">
  <script type="application/ld+json">
${JSON.stringify(buildJsonLd(loc), null, 2)}
  </script>`

const renderBody = (loc) => `    <main class="seo-fallback">
      <h1>${escapeHtml(loc.h1)}</h1>
      <p>${escapeHtml(loc.intro)}</p>
      <ul>
${loc.bullets.map((item) => `        <li>${escapeHtml(item)}</li>`).join('\n')}
      </ul>
      <h2>${escapeHtml(loc.faqTitle)}</h2>
${loc.faq
  .map((item) => `      <h3>${escapeHtml(item.q)}</h3>\n      <p>${escapeHtml(item.a)}</p>`)
  .join('\n')}
    </main>`

const replaceRegion = (html, region, content) => {
  const pattern = new RegExp(`(<!-- seo:${region}:start -->)[\\s\\S]*?(<!-- seo:${region}:end -->)`)
  if (!pattern.test(html)) {
    throw new Error(`缺少 seo:${region} 标记，无法生成语言页面`)
  }
  return html.replace(pattern, `$1\n${content}\n  $2`)
}

const renderSitemap = (lastmod) => {
  const urls = LOCALES.map((loc) => {
    const alternates = LOCALES.map(
      (alt) => `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${SITE}${alt.path}"/>`,
    ).join('\n')
    return `  <url>
    <loc>${SITE}${loc.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${loc.priority}</priority>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>
  </url>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`
}

const main = () => {
  const baseHtml = readFileSync(resolve(DIST, 'index.html'), 'utf8')

  for (const loc of LOCALES) {
    const html = replaceRegion(
      replaceRegion(baseHtml, 'head', renderHead(loc)),
      'body',
      renderBody(loc),
    ).replace(/<html lang="[^"]*">/, `<html lang="${loc.htmlLang}">`)

    const target = loc.dir
      ? resolve(DIST, loc.dir, 'index.html')
      : resolve(DIST, 'index.html')

    if (loc.dir) mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, html)
  }

  const lastmod = new Date().toISOString().slice(0, 10)
  writeFileSync(resolve(DIST, 'sitemap.xml'), renderSitemap(lastmod))

  console.log(`[gen-locale-pages] generated ${LOCALES.length} locale pages, sitemap lastmod=${lastmod}`)
}

main()
