<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { AccessTimeRound } from '@vicons/material'

import { useGlobalState } from '../store'
import { utcToTimestamp, getExpiryRemainingParts } from '../utils'

const { settings } = useGlobalState()
const { t } = useScopedI18n('components.AddressExpiry')

// 到期时间由后端以 UTC 字符串返回，倒计时每 30 秒刷新一次即可
const TICK_INTERVAL_MS = 30 * 1000
const WARNING_THRESHOLD_MS = 60 * 60 * 1000

const now = ref(Date.now())
const tickTimer = setInterval(() => { now.value = Date.now() }, TICK_INTERVAL_MS)
onBeforeUnmount(() => clearInterval(tickTimer))

const expiresAtMs = computed(() => utcToTimestamp(settings.value.expires_at))

const remainingMs = computed(() => (
    expiresAtMs.value === null ? null : expiresAtMs.value - now.value
))

const statusType = computed(() => {
    if (remainingMs.value === null) return 'default'
    if (remainingMs.value <= 0) return 'error'
    if (remainingMs.value <= WARNING_THRESHOLD_MS) return 'warning'
    return 'default'
})

const statusText = computed(() => {
    if (remainingMs.value === null) return ''
    if (remainingMs.value <= 0) return t('expired')
    const { days, hours, minutes } = getExpiryRemainingParts(remainingMs.value)
    if (days > 0) return t('remainingDays', { days, hours })
    if (hours > 0) return t('remainingHours', { hours, minutes })
    return t('remainingMinutes', { minutes })
})
</script>

<template>
    <n-text v-if="statusText" :type="statusType" size="small" class="address-expiry">
        <n-icon :component="AccessTimeRound" />
        {{ statusText }}
    </n-text>
</template>

<style scoped>
.address-expiry {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
</style>
