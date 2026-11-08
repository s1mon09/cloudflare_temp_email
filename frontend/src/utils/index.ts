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

// 邮件正文的基础排版：避免 iOS 上固定宽度表格 / 超大图片撑破视口，
// 同时把正文固定为浅色，保证邮件原始配色不被系统深色模式反转。
export const EMAIL_BASE_STYLES = `
  :host { color-scheme: light; }
  html, body { margin: 0; padding: 0; }
  img, video { max-width: 100% !important; height: auto !important; }
  table { max-width: 100%; }
  pre { white-space: pre-wrap; word-break: break-word; }
  a { overflow-wrap: anywhere; }
`

// iframe 渲染时补上视口与 color-scheme，Safari 才会按设备宽度排版邮件。
export const buildMailSrcdoc = (html: string) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<style>${EMAIL_BASE_STYLES.replace(':host', 'html')}</style>
</head><body>${html}</body></html>`

const stripHtmlTags = (html: string) => html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// 把邮件 HTML 转成纯文本，用于 Web Share 分享。
export const htmlToPlainText = (html: string | null | undefined) => {
    if (!html) return '';
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script, style').forEach((node) => node.remove());
        return (doc.body?.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
    } catch (e) {
        console.error(e);
        return stripHtmlTags(html);
    }
}

// iOS Safari 在非安全上下文或旧版本上可能没有 navigator.clipboard，
// 这里统一回退到 execCommand，避免复制验证码时静默失败。
export const copyToClipboard = async (text: string): Promise<boolean> => {
    if (!text) return false;
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {
        console.warn('clipboard.writeText failed, falling back to execCommand', e);
    }
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        const copied = document.execCommand('copy');
        textarea.remove();
        return copied;
    } catch (e) {
        console.error(e);
        return false;
    }
}

export const canShareContent = () => typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'

// 调用系统分享面板（iOS 上是 Share Sheet）。用户取消时也返回 true，
// 避免把「取消」误报成失败。
export const shareContent = async (data: ShareData): Promise<boolean> => {
    if (!canShareContent()) return false;
    if (typeof navigator.canShare === 'function' && !navigator.canShare(data)) return false;
    try {
        await navigator.share(data);
        return true;
    } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return true;
        console.error(e);
        return false;
    }
}

export const shareFile = async (blob: Blob, filename: string): Promise<boolean> => {
    if (!canShareContent()) return false;
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    return shareContent({ files: [file], title: filename });
}

