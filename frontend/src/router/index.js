import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import User from '../views/User.vue'
import UserOauth2Callback from '../views/user/UserOauth2Callback.vue'
import i18n from '../i18n'
import { useGlobalState } from '../store'
import {
    DEFAULT_LOCALE,
    getBrowserLocales,
    getPreferredLocale,
    replaceLocaleInFullPath,
    resolveSupportedLocale,
} from '../i18n/utils'

const { jwt, preferredLocale } = useGlobalState()

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            alias: '/:lang/',
            component: Index,
            meta: { titleKey: 'router.index' }
        },
        {
            path: '/user',
            alias: '/:lang/user',
            component: User,
            meta: { titleKey: 'router.user' }
        },
        {
            path: '/redeem',
            alias: '/:lang/redeem',
            component: () => import('../views/Redeem.vue'),
            meta: { titleKey: 'router.redeem' }
        },
        {
            path: '/user/oauth2/callback',
            alias: '/:lang/user/oauth2/callback',
            component: UserOauth2Callback,
            meta: { titleKey: 'router.user' }
        },
        {
            path: '/admin',
            alias: '/:lang/admin',
            component: () => import('../views/Admin.vue'),
            meta: { titleKey: 'router.admin' }
        },
        {
            path: '/telegram_mail',
            alias: '/:lang/telegram_mail',
            component: () => import('../views/telegram/Mail.vue'),
            meta: { titleKey: 'router.telegramMail' }
        },
        {
            name: 'not-found',
            path: '/:pathMatch(.*)*',
            redirect: '/'
        }
    ]
});

router.beforeEach((to, from, next) => {
    const routeLocale = resolveSupportedLocale(to.path.split('/')[1])
    const resolvedLocale = routeLocale || DEFAULT_LOCALE
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

// 按当前路由更新 lang 与 canonical，避免多语言 URL 被判为重复内容
// 标题由 Header.vue 的 useHead 统一按 route.meta.titleKey 管理
router.afterEach((to) => {
    if (typeof document === 'undefined') return

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
