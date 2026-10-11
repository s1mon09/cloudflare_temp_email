import { ref } from 'vue'
import { useBreakpoint, useMemo } from 'vooks'

// 未读角标：在浏览器标题与 favicon 上展示未读数。
// 不依赖通知权限，用户在前台也能看到新邮件数量。
export function useUnreadBadge() {
    const unreadCount = ref(0)
    let baseFaviconHref = null
    let faviconImage = null
    let faviconLoadFailed = false

    const updateTitleBadge = (total) => {
        const base = document.title.replace(/^\(\d+\+?\)\s*/, '')
        document.title = total > 0 ? `(${total > 99 ? '99+' : total}) ${base}` : base
    }

    const faviconLink = () => (
        document.querySelector('link[rel="icon"]')
        || document.querySelector('link[rel="shortcut icon"]')
    )

    const renderFaviconBadge = (total) => {
        const link = faviconLink()
        if (!link) return
        if (baseFaviconHref === null) baseFaviconHref = link.getAttribute('href') || '/favicon.ico'
        if (total <= 0) {
            link.setAttribute('href', baseFaviconHref)
            return
        }
        if (!faviconImage) {
            faviconImage = new Image()
            faviconImage.onload = () => renderFaviconBadge(unreadCount.value)
            faviconImage.onerror = () => {
                faviconLoadFailed = true
                renderFaviconBadge(unreadCount.value)
            }
            faviconImage.src = baseFaviconHref
            return
        }
        const size = 32
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!faviconLoadFailed) ctx.drawImage(faviconImage, 0, 0, size, size)
        ctx.beginPath()
        ctx.arc(size - 8, 8, 8, 0, Math.PI * 2)
        ctx.fillStyle = '#f5222d'
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 10px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(total > 9 ? '9+' : String(total), size - 8, 8)
        link.setAttribute('href', canvas.toDataURL('image/png'))
    }

    const applyUnreadBadge = () => {
        updateTitleBadge(unreadCount.value)
        renderFaviconBadge(unreadCount.value)
    }

    const setUnreadCount = (total) => {
        unreadCount.value = Math.max(0, Number(total) || 0)
        applyUnreadBadge()
    }

    const clearUnreadBadge = () => {
        unreadCount.value = 0
        updateTitleBadge(0)
        const link = faviconLink()
        if (link && baseFaviconHref !== null) link.setAttribute('href', baseFaviconHref)
    }

    return { unreadCount, setUnreadCount, applyUnreadBadge, clearUnreadBadge }
}

export function useIsMobile() {
    const breakpointRef = useBreakpoint({ xs: 0, s: 768 })
    return useMemo(() => {
        return breakpointRef.value === 'xs'
    })
}
