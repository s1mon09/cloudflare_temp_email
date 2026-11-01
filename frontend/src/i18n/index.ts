import { createI18n } from 'vue-i18n'

import {
    FALLBACK_LOCALE,
    getInitialLocale,
} from './utils'
import { I18N_MESSAGES, loadLocaleMessages } from './messages'

import type { SupportedLocale } from './locale-registry'

const i18n = createI18n({
    legacy: false, // you must set `false`, to use Composition API
    locale: getInitialLocale(),
    fallbackLocale: FALLBACK_LOCALE,
    messages: I18N_MESSAGES,
    missingWarn: false,
    fallbackWarn: false,
})

// 切换语言前确保对应文案已加载（额外语言为按需加载）
export const ensureLocaleMessages = async (locale: SupportedLocale) => {
    if (i18n.global.availableLocales.includes(locale)) return
    const messages = await loadLocaleMessages(locale)
    i18n.global.setLocaleMessage(locale, messages)
}

export default i18n;
