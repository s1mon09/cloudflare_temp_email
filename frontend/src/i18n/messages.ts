import { MESSAGE_REGISTRY, getMessageSource } from './message-registry'

import type { MessageKey, MessageNamespace } from './message-registry'

import type { SupportedLocale } from './locale-registry'

type LocaleTree = Record<string, unknown>
type SourceLocale = Extract<SupportedLocale, 'en' | 'zh'>
type AdditionalLocale = Exclude<SupportedLocale, SourceLocale>

// 额外语言按需加载，避免全部打进首屏主包
const additionalLocaleLoaders: Record<AdditionalLocale, () => Promise<Record<string, string>>> = {
  es: () => import('./locales/source/es').then(({ esMessages }) => esMessages),
  'pt-BR': () => import('./locales/source/ptBR').then(({ ptBRMessages }) => ptBRMessages),
  ja: () => import('./locales/source/ja').then(({ jaMessages }) => jaMessages),
  de: () => import('./locales/source/de').then(({ deMessages }) => deMessages),
}

const setNestedValue = (target: LocaleTree, path: string, value: unknown) => {
  const segments = path.split('.')
  let current: LocaleTree = target

  for (const segment of segments.slice(0, -1)) {
    const existing = current[segment]
    if (typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
      current = existing as LocaleTree
      continue
    }

    current[segment] = {}
    current = current[segment] as LocaleTree
  }

  current[segments.at(-1) as string] = value
}

const buildSourceLocaleMessages = (locale: SourceLocale) => {
  const messages: LocaleTree = {}

  for (const namespace of Object.keys(MESSAGE_REGISTRY) as MessageNamespace[]) {
    const keys = Object.keys(MESSAGE_REGISTRY[namespace]) as MessageKey<typeof namespace>[]
    for (const key of keys) {
      const message = getMessageSource(namespace, key, locale)
      if (message === undefined) continue
      setNestedValue(messages, `${namespace}.${key}`, message)
    }
  }

  return messages
}

const buildEnglishFlatMessages = () => {
  const messages: Record<string, string> = {}

  for (const namespace of Object.keys(MESSAGE_REGISTRY) as MessageNamespace[]) {
    const keys = Object.keys(MESSAGE_REGISTRY[namespace]) as MessageKey<typeof namespace>[]
    for (const key of keys) {
      const message = getMessageSource(namespace, key, 'en')
      if (message === undefined) continue
      messages[`${namespace}.${key}`] = message
    }
  }

  return messages
}

const EN_FLAT_MESSAGES = buildEnglishFlatMessages()

const buildAdditionalLocaleMessages = (source: Record<string, string>) => {
  const messages: LocaleTree = {}

  // 额外语言缺少的 key 回退到英文，避免回落到中文
  for (const [key, value] of Object.entries({ ...EN_FLAT_MESSAGES, ...source })) {
    setNestedValue(messages, key, value)
  }

  return messages
}

export const I18N_MESSAGES: Partial<Record<SupportedLocale, LocaleTree>> = {
  zh: buildSourceLocaleMessages('zh'),
  en: buildSourceLocaleMessages('en'),
}

const additionalLocaleCache = new Map<AdditionalLocale, LocaleTree>()

// 按需加载并缓存额外语言文案；中文/英文为主包内置语言，直接返回
export const loadLocaleMessages = async (locale: SupportedLocale): Promise<LocaleTree> => {
  const builtIn = I18N_MESSAGES[locale]
  if (builtIn) return builtIn

  const additionalLocale = locale as AdditionalLocale
  const cached = additionalLocaleCache.get(additionalLocale)
  if (cached) return cached

  const source = await additionalLocaleLoaders[additionalLocale]()
  const messages = buildAdditionalLocaleMessages(source)
  additionalLocaleCache.set(additionalLocale, messages)
  return messages
}
