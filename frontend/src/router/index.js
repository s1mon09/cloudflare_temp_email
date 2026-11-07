import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import i18n, { ensureLocaleMessages } from '../i18n'
import { useGlobalState } from '../store'
import {
    DEFAULT_LOCALE,
    getBrowserLocales,
    getPreferredLocale,
    replaceLocaleInFullPath,
    resolveSupportedLocale,
} from '../i18n/utils'

const { jwt, preferredLocale } = useGlobalState()

const Redeem = () => import('../views/Redeem.vue')
const Admin = () => import('../views/Admin.vue')
const TelegramMail = () => import('../views/telegram/Mail.vue')
const User = () => import('../views/User.vue')
const UserOauth2Callback = () => import('../views/user/UserOauth2Callback.vue')

// 每个页面同时注册「带语言前缀」与「不带前缀」两条记录。
// 不使用 alias：alias 无法为无参路径追加 :lang 参数，会触发 Vue Router 警告。
const withLang = (path, component, meta) => {
    const langPath = path === '/' ? '/:lang/' : `/:lang${path}`
    return [
        { path, component, meta },
        { path: langPath, component, meta }
    ]
}

const router = createRouter({
    history: createWebHistory(),
    routes: [
        ...withLang('/', Index, { titleKey: 'router.index' }),
        ...withLang('/user', User, { titleKey: 'router.user' }),
        ...withLang('/redeem', Redeem, { titleKey: 'router.redeem' }),
        ...withLang('/user/oauth2/callback', UserOauth2Callback, { titleKey: 'router.user' }),
        ...withLang('/admin', Admin, { titleKey: 'router.admin' }),
        ...withLang('/telegram_mail', TelegramMail, { titleKey: 'router.telegramMail' }),
        {
            name: 'not-found',
            path: '/:pathMatch(.*)*',
            redirect: '/'
        }
    ]
});

router.beforeEach(async (to, from, next) => {
    const routeLocale = resolveSupportedLocale(to.path.split('/')[1])
    const resolvedLocale = routeLocale || DEFAULT_LOCALE
    // 额外语言文案按需加载，加载完成后再切换，避免短暂显示兜底语言
    await ensureLocaleMessages(resolvedLocale)
    i18n.global.locale.value = resolvedLocale

    if (routeLocale) {
        preferredLocale.value = routeLocale
    } else if (!preferredLocale.value) {
        preferredLocale.value = getPreferredLocale('', getBrowserLocales())
    }

    if (Object.prototype.hasOwnProperty.call(to.query, 'jwt')) {
        const jwtQuery = Array.isArray(to.query.jwt) ? to.query.jwt[0] : to.query.jwt
        if (typeof jwtQuery === 'string') {
            jwt.value = jwtQuery
        }
        const query = { ...to.query }
        delete query.jwt
        next({
            path: to.path,
            query,
            hash: to.hash,
            replace: true,
        })
        return
    }

    if (routeLocale) {
        const canonicalRoutePath = replaceLocaleInFullPath(to.fullPath, routeLocale)
        if (canonicalRoutePath !== to.fullPath) {
            return next(canonicalRoutePath)
        }
    }

    if (routeLocale === DEFAULT_LOCALE) {
        return next(replaceLocaleInFullPath(to.fullPath, DEFAULT_LOCALE))
    }

    next()
});

// 语言代码 -> <html lang> 取值
const HTML_LANG_MAP = {
    zh: 'zh-CN',
    en: 'en',
    es: 'es',
    ja: 'ja',
    de: 'de',
    'pt-BR': 'pt-BR',
}

// 部署后旧页签可能请求到已失效的懒加载 chunk：自动刷新一次，避免白屏
router.onError((error, to) => {
    if (!/dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error?.message || '')) {
        return
    }
    if (sessionStorage.getItem('chunk-reload')) {
        return
    }
    sessionStorage.setItem('chunk-reload', '1')
    window.location.assign(to?.fullPath || window.location.href)
})

// 按当前路由更新 lang 与 canonical，避免多语言 URL 被判为重复内容
// 标题由 Header.vue 的 useHead 统一按 route.meta.titleKey 管理
router.afterEach((to) => {
    if (typeof document === 'undefined') return

    sessionStorage.removeItem('chunk-reload')

    const locale = i18n.global.locale.value
    document.documentElement.lang = HTML_LANG_MAP[locale] || 'zh-CN'

    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
        canonical = document.createElement('link')
        canonical.setAttribute('rel', 'canonical')
        document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', `${window.location.origin}${to.path}`)
})

export default router
