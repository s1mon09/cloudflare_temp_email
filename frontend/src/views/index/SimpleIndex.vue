<script setup>
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useMessage } from 'naive-ui'
import {
    ExitToAppFilled,
    ContentCopyFilled,
    CheckFilled,
    RefreshFilled,
    ArrowBackIosNewFilled,
    ArrowForwardIosFilled,
    SettingsFilled
} from '@vicons/material'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { useUnreadBadge } from '../../utils/composables'
import Login from '../common/Login.vue'
import AccountSettings from './AccountSettings.vue'
import { processItem } from '../../utils/email-parser'
import MailContentRenderer from '../../components/MailContentRenderer.vue'
import AddressSelect from '../../components/AddressSelect.vue'
import AddressExpiry from '../../components/AddressExpiry.vue'
import AddressCredentialModal from '../../components/AddressCredentialModal.vue'

const { jwt, settings, useSimpleIndex, showAddressCredential, openSettings, addressPassword } = useGlobalState()
const message = useMessage()

// 邮件数据
const currentPage = ref(1)
const totalCount = ref(0)
const currentMail = ref(null)
const showAccountSettingsCard = ref(false)
const currentAutoRefreshInterval = ref(60)
const timer = ref(null)
const mailLoading = ref(false)
const mailError = ref('')

const { t } = useScopedI18n('views.index.SimpleIndex')

// 未读角标：标题 / favicon 展示未读数（需开启「邮件已读状态」）
const { setUnreadCount, clearUnreadBadge } = useUnreadBadge()

// 复制地址；成功后按钮原地显示「已复制」，避免弹窗打扰
const addressCopied = ref(false)
let addressCopiedTimer = null
const copyAddress = async () => {
    try {
        await navigator.clipboard.writeText(settings.value.address)
        addressCopied.value = true
        clearTimeout(addressCopiedTimer)
        addressCopiedTimer = setTimeout(() => { addressCopied.value = false }, 1500)
    } catch (error) {
        message.error(t('copyFailed'))
    }
}

// 获取邮件数据；列表区域使用局部加载态，避免每次刷新都遮挡整页
const fetchMails = async () => {
    if (!settings.value.address) return
    mailLoading.value = true
    try {
        const { results, count, unreadCount } = await api.fetch(`/api/mails?limit=1&offset=${currentPage.value - 1}`, {
            showLoading: false
        })
        if (typeof count === 'number') totalCount.value = count;
        if (typeof unreadCount === 'number') setUnreadCount(unreadCount);
        const rawMail = results && results.length > 0 ? results[0] : null
        currentMail.value = rawMail ? await processItem(rawMail) : null
        mailError.value = ''
    } catch (error) {
        console.error('Failed to fetch mails:', error)
        // 页内展示错误并提供重试，避免只弹 toast 后内容区空白
        mailError.value = error.message || t('fetchMailsFailed')
    } finally {
        mailLoading.value = false
    }
}

const toggleCurrentMailUnread = async () => {
    if (!currentMail.value || !openSettings.value.enableMailReadStatus) return
    const mail = currentMail.value
    const previousValue = mail.is_unread
    const isUnread = previousValue !== 1
    mail.is_unread = isUnread ? 1 : 0
    try {
        await api.fetch(`/api/mails/${mail.id}/read`, {
            method: 'PATCH',
            body: JSON.stringify({ isUnread }),
            showLoading: false
        })
        message.success(t('readStatusUpdated'))
    } catch {
        mail.is_unread = previousValue
    }
}

// 删除邮件
const deleteMail = async () => {
    if (!currentMail.value) return;
    try {
        await api.fetch(`/api/mails/${currentMail.value.id}`, { method: 'DELETE' });
        message.success(t('deleteSuccess'));
        currentMail.value = null;
        await refreshMails({ silent: true });
    } catch (error) {
        console.error('Failed to delete mail:', error);
        message.error(t('deleteFailed'));
    }
}

// 刷新邮件；silent 用于自动刷新/删除后的刷新，避免重复提示打扰
const refreshMails = async ({ silent = false } = {}) => {
    if (mailLoading.value) return
    currentPage.value = 1
    currentAutoRefreshInterval.value = 60
    if (!silent) showAccountSettingsCard.value = false
    await fetchMails()
    if (!silent && !mailError.value) message.success(t('refreshSuccess'))
}

// 分页控制
const currentPageDisplay = computed(() => currentPage.value)
const totalPages = computed(() => Math.max(1, totalCount.value))
const canGoPrev = computed(() => currentPage.value > 1)
const canGoNext = computed(() => currentPage.value < totalPages.value)
const isFirstPage = computed(() => currentPage.value === 1)

const prevPage = async () => {
    if (!canGoPrev.value) return
    currentPage.value--
    await fetchMails()
}

const nextPage = async () => {
    if (!canGoNext.value) return
    currentPage.value++
    await fetchMails()
}

onMounted(async () => {
    await api.getSettings()
    await fetchMails()

    // 启动自动刷新
    timer.value = setInterval(async () => {
        // 页面不可见时不刷新，避免无谓请求；回到页面后倒计时继续
        if (document.hidden) return
        if (!isFirstPage.value) {
            currentAutoRefreshInterval.value = 60
            return
        }

        if (--currentAutoRefreshInterval.value <= 0) {
            await refreshMails({ silent: true })
        }
    }, 1000)
})

onBeforeUnmount(() => {
    clearInterval(timer.value)
    clearTimeout(addressCopiedTimer)
    clearUnreadBadge()
})
</script>

<template>
    <div class="center">
        <div v-if="!settings.address">
            <n-card :bordered="false" embedded>
                <Login />
            </n-card>
        </div>

        <div v-else>
            <n-card :bordered="false" embedded>
                <div style="text-align: center; margin-bottom: 16px; font-size: 18px;">
                    <AddressSelect :showCopy="false" size="small" />
                    <div>
                        <AddressExpiry />
                    </div>
                </div>
                <n-flex justify="center" class="action-bar">
                    <n-button @click="refreshMails()" :loading="mailLoading" type="primary" tertiary size="small">
                        <template #icon>
                            <n-icon>
                                <RefreshFilled />
                            </n-icon>
                        </template>
                        {{ t('refreshMails') }}
                    </n-button>
                    <n-button @click="copyAddress" :type="addressCopied ? 'success' : 'default'" tertiary size="small">
                        <template #icon>
                            <n-icon>
                                <CheckFilled v-if="addressCopied" />
                                <ContentCopyFilled v-else />
                            </n-icon>
                        </template>
                        {{ addressCopied ? t('copied') : t('copyAddress') }}
                    </n-button>
                    <n-button @click="useSimpleIndex = false" tertiary size="small">
                        <template #icon>
                            <n-icon>
                                <ExitToAppFilled />
                            </n-icon>
                        </template>
                        {{ t('exitSimpleIndex') }}
                    </n-button>
                    <n-button @click="showAccountSettingsCard = true" tertiary size="small">
                        <template #icon>
                            <n-icon>
                                <SettingsFilled />
                            </n-icon>
                        </template>
                        {{ t('mailboxSettings') }}
                    </n-button>
                </n-flex>
                <div v-if="isFirstPage" style="text-align: center; margin-top: 12px;">
                    <n-text depth="3" size="12">
                        {{ t('refreshAfter', { msg: Math.max(0, currentAutoRefreshInterval) }) }}
                    </n-text>
                </div>
            </n-card>

            <!-- 账户设置卡片 -->
            <n-card v-if="showAccountSettingsCard" :bordered="false" embedded closable
                @close="showAccountSettingsCard = false" :title="t('mailboxSettings')">
                <AccountSettings />
            </n-card>

            <n-card v-else :bordered="false" embedded style="text-align: left;">

                <n-alert v-if="mailError && currentMail" type="error" :bordered="false" style="margin-bottom: 12px;">
                    {{ mailError }}
                    <template #action>
                        <n-button size="small" tertiary type="primary" @click="refreshMails()">
                            {{ t('retry') }}
                        </n-button>
                    </template>
                </n-alert>

                <div v-if="totalCount > 1">
                    <n-flex justify="space-between">
                        <n-button @click="prevPage" :disabled="!canGoPrev" text size="small" class="page-button">
                            <template #icon>
                                <n-icon>
                                    <ArrowBackIosNewFilled />
                                </n-icon>
                            </template>
                            {{ t('prevPage') }}
                        </n-button>
                        <n-text size="small">
                            {{ t('mailCount', { current: currentPageDisplay, total: totalCount }) }}
                        </n-text>
                        <n-button @click="nextPage" :disabled="!canGoNext" text size="small" icon-placement="right"
                            class="page-button">
                            <template #icon>
                                <n-icon>
                                    <ArrowForwardIosFilled />
                                </n-icon>
                            </template>
                            {{ t('nextPage') }}
                        </n-button>
                    </n-flex>
                </div>

                <div v-if="mailLoading && !currentMail" class="mail-placeholder">
                    <n-skeleton text :repeat="2" />
                    <n-skeleton text style="width: 60%;" />
                </div>
                <div v-else-if="!currentMail" class="no-mail">
                    <n-empty :description="mailError ? t('fetchMailsFailed') : t('noMails')">
                        <template #extra>
                            <n-button size="small" tertiary type="primary" @click="refreshMails()">
                                {{ t('refreshMails') }}
                            </n-button>
                        </template>
                    </n-empty>
                </div>
                <div v-else>
                    <h3 v-if="currentMail.subject"
                        :class="{ 'mail-title-unread': openSettings.enableMailReadStatus && currentMail.is_unread === 1 }">
                        {{ currentMail.subject }}
                    </h3>
                    <div style="margin-top: 16px;">
                        <MailContentRenderer :mail="currentMail" :showEMailTo="false" :showReply="false"
                            :enableUserDeleteEmail="openSettings.enableUserDeleteEmail" :showSaveS3="false"
                            :enableMailReadStatus="openSettings.enableMailReadStatus"
                            :onUpdateMailReadStatus="toggleCurrentMailUnread"
                            :onDelete="deleteMail" />
                    </div>
                </div>
            </n-card>
        </div>
        <AddressCredentialModal v-model:show="showAddressCredential" :address="settings.address" :jwt="jwt"
            :address-password="addressPassword" />
    </div>
</template>

<style scoped>
.center {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 12px;
    box-sizing: border-box;
}

.n-card {
    margin-top: 20px;
    width: 100%;
}

.mail-placeholder {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 28px 4px;
}

.no-mail {
    padding: 12px 0;
}

.mail-title-unread {
    font-weight: 700;
}

.mail-title-unread::before {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 8px;
    border-radius: 50%;
    background: #2080f0;
    content: '';
    vertical-align: middle;
}

/* 移动端：收紧边距并增大可点击区域，降低误触 */
@media (max-width: 640px) {
    .center {
        padding: 0 8px;
    }

    .n-card {
        margin-top: 12px;
    }
}

@media (hover: none) and (pointer: coarse) {
    .action-bar :deep(.n-button),
    .no-mail :deep(.n-button),
    .page-button {
        min-height: 38px;
    }
}
</style>
