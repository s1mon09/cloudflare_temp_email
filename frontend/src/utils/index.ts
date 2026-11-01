import { getPathWithLocale } from '../i18n/utils'

export const hashPassword = async (password: string) => {
    // user crypto to hash password
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export const getRouterPathWithLang = (path: string, lang: string) => {
    const normalizedLang = lang === 'en'
        || lang === 'es'
        || lang === 'pt-BR'
        || lang === 'ja'
        || lang === 'de'
        ? lang
        : 'zh';

    return getPathWithLocale(path, normalizedLang);
}

// 后端时间统一为 UTC 字符串（"YYYY-MM-DD HH:MM:SS"），转成毫秒时间戳
export const utcToTimestamp = (utcDate: string | null | undefined): number | null => {
    if (!utcDate) return null;
    const timestamp = new Date(`${utcDate} UTC`).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
}

// 到期剩余时间拆分为天/时/分，不足一分钟按一分钟显示
export const getExpiryRemainingParts = (remainingMs: number) => {
    const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    return {
        days: Math.floor(totalMinutes / 1440),
        hours: Math.floor((totalMinutes % 1440) / 60),
        minutes: totalMinutes % 60,
    };
}

export const utcToLocalDate = (utcDate: string | null | undefined, useUTCDate: boolean) => {
    if (!utcDate) return '';
    const utcDateString = `${utcDate} UTC`;
    if (useUTCDate) {
        return utcDateString;
    }
    try {
        const date = new Date(utcDateString);
        // if invalid date string
        if (isNaN(date.getTime())) return utcDateString;

        return date.toLocaleString();
    } catch (e) {
        console.error(e);
    }
    return utcDateString;
}
