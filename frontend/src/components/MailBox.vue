<script setup>
import { watch, onMounted, ref, onBeforeUnmount, computed } from "vue";
import { useMessage, useThemeVars } from 'naive-ui'
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../store'
import { CloudDownloadRound, ArrowBackIosNewFilled, ArrowForwardIosFilled, InboxRound, ContentCopyOutlined, NotificationsActiveFilled, NotificationsNoneFilled } from '@vicons/material'
import { useIsMobile, useUnreadBadge } from '../utils/composables'
import { processItem } from '../utils/email-parser'
import { buildReplyModel, buildForwardModel } from '../utils/mail-actions'
import MailContentRenderer from "./MailContentRenderer.vue";
import MailSummary from "./MailSummary.vue";

const message = useMessage()
const themeVars = useThemeVars()
const isMobile = useIsMobile()

const props = defineProps({
  enableUserDeleteEmail: {
    type: Boolean,
    default: false,
    required: false
  },
  showEMailTo: {
    type: Boolean,
    default: true,
    required: false
  },
  fetchMailData: {
    type: Function,
    default: () => { },
    required: true
  },
  deleteMail: {
    type: Function,
    default: () => { },
    required: false
  },
  showReply: {
    type: Boolean,
    default: false,
    required: false
  },
  showSaveS3: {
    type: Boolean,
    default: false,
    required: false
  },
  saveToS3: {
    type: Function,
    default: (mail_id, filename, blob) => { },
    required: false
  },
  showFilterInput: {
    type: Boolean,
    default: false,
    required: false
  },
  enableMailReadStatus: {
    type: Boolean,
    default: false
  },
  updateMailReadStatus: {
    type: Function,
    default: () => { }
  },
})

const searchKeyword = ref('')
let searchDebounceTimer = null

const {
  isDark, mailboxSplitSize, mailListView, mailListPreviewLineClamp, indexTab, loading,
  autoRefresh, configAutoRefreshInterval, sendMailModel
} = useGlobalState()
const autoRefreshInterval = ref(configAutoRefreshInterval.value)
const rawData = ref([])
const timer = ref(null)

const count = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loadError = ref(null)
const refreshLoading = ref(false)

// 已解析邮件缓存：轮询时复用解析结果，只解析新增邮件，避免重复执行 WASM 解析
const PARSED_MAIL_CACHE_LIMIT = 80
const parsedMailCache = new Map()

const revokeMailAttachments = (mail) => {
  mail?.attachments?.forEach((attachment) => {
    if (attachment?.url) URL.revokeObjectURL(attachment.url)
  })
}

const processMailWithCache = async (item) => {
  const cached = parsedMailCache.get(item.id)
  if (cached) {
    // 邮件正文不可变，仅同步每次请求可能变化的字段（如已读状态）
    cached.is_unread = item.is_unread
    cached.checked = false
    return cached
  }

  const processed = await processItem(item)
  processed.checked = false
  parsedMailCache.set(processed.id, processed)
  if (parsedMailCache.size > PARSED_MAIL_CACHE_LIMIT) {
    const oldestId = parsedMailCache.keys().next().value
    revokeMailAttachments(parsedMailCache.get(oldestId))
    parsedMailCache.delete(oldestId)
  }
  return processed
}

// 自动刷新倒计时可视化已移除，倒计时秒数直接显示在开关文案中
const mailListPreviewLineClampValue = computed(() => {
  const value = Number(mailListPreviewLineClamp.value)
  if (!Number.isFinite(value)) return 0
  return Math.min(5, Math.max(0, Math.round(value)))
})

// Mail list is rendered from rawData; keyword search is delegated to the server.
const data = computed(() => rawData.value)

const openMail = (mail) => {
  curMail.value = mail
  if (mail?.is_unread !== 1 || !props.enableMailReadStatus) return
  mail.is_unread = 0
  setUnreadCount(unreadCount.value - 1)
  void props.updateMailReadStatus(mail.id, false).catch(() => {
    mail.is_unread = 1
    setUnreadCount(unreadCount.value + 1)
  })
}

const toggleCurrentMailUnread = async () => {
  if (!curMail.value || !props.enableMailReadStatus) return
  const mail = curMail.value
  const previousValue = mail.is_unread
  const isUnread = previousValue !== 1
  mail.is_unread = isUnread ? 1 : 0
  try {
    await props.updateMailReadStatus(mail.id, isUnread)
    setUnreadCount(unreadCount.value + (isUnread ? 1 : -1))
    message.success(t("success"))
  } catch {
    mail.is_unread = previousValue
  }
}

const canGoPrevMail = computed(() => {
  if (!curMail.value) return false
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)
  return currentIndex > 0 || page.value > 1
})

const canGoNextMail = computed(() => {
  if (!curMail.value) return false
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)
  return currentIndex < data.value.length - 1 || count.value > page.value * pageSize.value
})

const prevMail = async () => {
  if (!canGoPrevMail.value) return
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)

  if (currentIndex > 0) {
    openMail(data.value[currentIndex - 1])
  } else if (page.value > 1) {
    page.value--
    await refresh()
    if (data.value.length > 0) {
      openMail(data.value[data.value.length - 1])
    }
  }
}

const nextMail = async () => {
  if (!canGoNextMail.value) return
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)

  if (currentIndex < data.value.length - 1) {
    openMail(data.value[currentIndex + 1])
  } else if (count.value > page.value * pageSize.value) {
    page.value++
    await refresh()
    if (data.value.length > 0) {
      openMail(data.value[0])
    }
  }
}

const curMail = ref(null);
// 移动端抽屉的 show 需要布尔值；curMail 同时承载「选中邮件」与「抽屉开关」，
// 直接绑定对象会触发 naive-ui 的 show 类型告警，这里用 computed 代理
const showMailDrawer = computed({
  get: () => !!curMail.value,
  set: (val) => { if (!val) curMail.value = null; }
});

const multiActionMode = ref(false)
const showMultiActionDownload = ref(false)
const showMultiActionDelete = ref(false)
const multiActionDownloadZip = ref({})
const multiActionDeleteProgress = ref({ percentage: 0, tip: '0/0' })

const { t } = useScopedI18n('components.MailBox')

// New-mail browser notifications. Only fires while the tab is in the background,
// so users get alerted without being spammed while reading.
const NOTIFY_STORAGE_KEY = 'mailbox-notify-enabled'
const notifySupported = typeof window !== 'undefined' && 'Notification' in window
const notifyEnabled = ref(
  notifySupported
  && Notification.permission === 'granted'
  && localStorage.getItem(NOTIFY_STORAGE_KEY) === '1'
)
let notifyTrackedIds = new Set()
let notifyPrimed = false

const toggleNotify = async () => {
  if (!notifySupported) {
    message.error(t('notifyFailed'))
    return
  }
  if (notifyEnabled.value) {
    notifyEnabled.value = false
    localStorage.setItem(NOTIFY_STORAGE_KEY, '0')
    return
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    message.error(t('notifyFailed'))
    return
  }
  notifyEnabled.value = true
  localStorage.setItem(NOTIFY_STORAGE_KEY, '1')
}

const newMailTitle = (mails) => mails.length > 1
  ? t('notifyNewMails', { count: mails.length })
  : t('notifyNewMail')

const newMailBody = (mails) => {
  const codeMail = mails.find((mail) => {
    try {
      return JSON.parse(mail.metadata)?.ai_extract?.type === 'auth_code'
    } catch (e) {
      return false
    }
  })
  return codeMail
    ? t('notifyWithCode', { code: JSON.parse(codeMail.metadata).ai_extract.result })
    : `${mails[0].source || ''}: ${mails[0].subject || ''}`
}

const notifyNewMails = (mails) => {
  const notification = new Notification(newMailTitle(mails), {
    body: newMailBody(mails),
    tag: 'mailbox-new-mail'
  })
  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}

const handleNewMailNotification = (isFirstLoad) => {
  if (!isFirstLoad && !searchKeyword.value && page.value === 1) {
    const fresh = rawData.value.filter((mail) => !notifyTrackedIds.has(mail.id))
    if (fresh.length > 0) {
      if (document.hidden) {
        // 后台标签页：使用系统通知
        if (notifyEnabled.value) notifyNewMails(fresh)
      } else {
        // 页面可见：给页内提示，方便用户盯着等待验证码
        message.success(`${newMailTitle(fresh)} · ${newMailBody(fresh)}`, { duration: 5000 })
      }
    }
  }
  notifyTrackedIds = new Set(rawData.value.map((mail) => mail.id))
}

// 未读角标：在浏览器标题与 favicon 上展示未读数（需开启「邮件已读状态」）
const { unreadCount, setUnreadCount, clearUnreadBadge } = useUnreadBadge()

const setupAutoRefresh = async (autoRefresh) => {
  // auto refresh every configAutoRefreshInterval seconds
  autoRefreshInterval.value = configAutoRefreshInterval.value;
  if (autoRefresh) {
    clearInterval(timer.value);
    timer.value = setInterval(async () => {
      // 页面不可见或断网时暂停轮询，避免空转请求；恢复后倒计时继续
      if (document.hidden) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (loading.value || refreshLoading.value) return;
      autoRefreshInterval.value--;
      if (autoRefreshInterval.value <= 0) {
        autoRefreshInterval.value = configAutoRefreshInterval.value;
        await backFirstPageAndRefresh();
      }
    }, 1000)
  } else {
    clearInterval(timer.value)
    timer.value = null
  }
}

watch(autoRefresh, async (autoRefresh, old) => {
  setupAutoRefresh(autoRefresh)
}, { immediate: true })

watch([page, pageSize], async ([page, pageSize], [oldPage, oldPageSize]) => {
  if (page !== oldPage || pageSize !== oldPageSize) {
    await refresh();
  }
})

const refresh = async () => {
  if (refreshLoading.value) return
  const previousMailId = curMail.value?.id;
  refreshLoading.value = true
  try {
    const { results, count: totalCount, unreadCount: unreadTotal } = await props.fetchMailData(
      pageSize.value, (page.value - 1) * pageSize.value, searchKeyword.value
    );
    loadError.value = null;
    rawData.value = await Promise.all(results.map(processMailWithCache));
    handleNewMailNotification(!notifyPrimed);
    notifyPrimed = true;
    if (typeof totalCount === 'number') {
      count.value = totalCount;
    }
    if (typeof unreadTotal === 'number') {
      setUnreadCount(unreadTotal);
    }
    // 保留用户正在阅读的邮件，避免刷新时被强制跳回最新一封
    const stillListed = previousMailId == null
      ? null
      : data.value.find((mail) => mail.id === previousMailId) || null;
    curMail.value = stillListed
      || ((!isMobile.value && !mailListView.value && data.value.length > 0) ? data.value[0] : null);
  } catch (error) {
    // 页内展示错误并提供重试，避免只弹 toast 后列表空白
    loadError.value = error.message || "error";
    console.error(error);
  } finally {
    refreshLoading.value = false
  }
};

const backFirstPageAndRefresh = async () => {
  if (page.value === 1) {
    await refresh();
  } else {
    // 切回第一页会触发分页监听刷新，避免重复请求
    page.value = 1;
  }
}

watch(searchKeyword, () => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(async () => {
    if (page.value !== 1) {
      // Changing page triggers the page watcher which refreshes with the keyword.
      page.value = 1;
    } else {
      await refresh();
    }
  }, 300)
})

// Latest verification code among the loaded mails, for one-click copy.
const latestCode = computed(() => {
  for (const mail of rawData.value) {
    if (!mail.metadata) continue
    try {
      const extract = JSON.parse(mail.metadata)?.ai_extract
      if (extract?.type === 'auth_code' && extract.result) return extract.result
    } catch (e) {
      // ignore malformed metadata
    }
  }
  return ''
})

const copyLatestCode = async () => {
  try {
    await navigator.clipboard.writeText(latestCode.value)
    message.success(t('copySuccess'))
  } catch (e) {
    message.error(t('copyFailed'))
  }
}

// Show a friendly relative time for recent mails, fall back to the absolute
// local time for anything older than a day.
const formatMailTime = (utcDate) => {
  if (!utcDate) return ''
  const date = new Date(`${utcDate} UTC`)
  if (isNaN(date.getTime())) return utcToLocalDate(utcDate, useUTCDate.value)
  const diff = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  if (diff >= 0 && diff < minute) return t('timeJustNow')
  if (diff >= 0 && diff < hour) return t('timeMinutesAgo', { count: Math.floor(diff / minute) })
  if (diff >= 0 && diff < 24 * hour) return t('timeHoursAgo', { count: Math.floor(diff / hour) })
  return utcToLocalDate(utcDate, useUTCDate.value)
}

const clickRow = (row) => {
  if (multiActionMode.value) {
    row.checked = !row.checked;
    curMail.value = row;
    return;
  }
  if (mailListView.value && curMail.value?.id === row.id) {
    curMail.value = null;
    return;
  }
  openMail(row);
};


const mailItemClass = (row) => {
  return curMail.value && row.id == curMail.value.id ? (isDark.value ? 'overlay overlay-dark-backgroud' : 'overlay overlay-light-backgroud') : '';
};

const deleteMail = async () => {
  try {
    await props.deleteMail(curMail.value.id);
    message.success(t("success"));
    curMail.value = null;
    await refresh();
  } catch (error) {
    message.error(error.message || "error");
  }
};

const replyMail = async () => {
  Object.assign(sendMailModel.value, buildReplyModel(curMail.value, t('reply')));
  indexTab.value = 'sendmail';
};

const forwardMail = async () => {
  Object.assign(sendMailModel.value, buildForwardModel(curMail.value, t('forwardMail')));
  indexTab.value = 'sendmail';
};

const onSpiltSizeChange = (size) => {
  mailboxSplitSize.value = size;
}

const saveToS3Proxy = async (filename, blob) => {
  await props.saveToS3(curMail.value.id, filename, blob);
}

const multiActionModeClick = (enableMulti) => {
  if (enableMulti) {
    data.value.forEach((item) => {
      item.checked = false;
    });
    multiActionMode.value = true;
  } else {
    multiActionMode.value = false;
    data.value.forEach((item) => {
      item.checked = false;
    });
  }
}

const multiActionSelectAll = (checked) => {
  data.value.forEach((item) => {
    item.checked = checked;
  });
}

const multiActionDeleteMail = async () => {
  try {
    loading.value = true;
    const selectedMails = data.value.filter((item) => item.checked);
    if (selectedMails.length === 0) {
      message.error(t('pleaseSelectMail'));
      return;
    }
    multiActionDeleteProgress.value = {
      percentage: 0,
      tip: `0/${selectedMails.length}`
    };
    for (const [index, mail] of selectedMails.entries()) {
      await props.deleteMail(mail.id);
      showMultiActionDelete.value = true;
      multiActionDeleteProgress.value = {
        percentage: Math.floor((index + 1) / selectedMails.length * 100),
        tip: `${index + 1}/${selectedMails.length}`
      };
    }
    message.success(t("success"));
    await refresh();
  } catch (error) {
    message.error(error.message || "error");
  } finally {
    loading.value = false;
    showMultiActionDelete.value = true;
  }
}

const multiActionDownload = async () => {
  try {
    loading.value = true;
    const selectedMails = data.value.filter((item) => item.checked);
    if (selectedMails.length === 0) {
      message.error(t('pleaseSelectMail'));
      return;
    }
    const JSZipModlue = await import('jszip');
    const JSZip = JSZipModlue.default;
    const zip = new JSZip();
    for (const mail of selectedMails) {
      zip.file(`${mail.id}.eml`, mail.raw);
    }
    multiActionDownloadZip.value = {
      url: URL.createObjectURL(await zip.generateAsync({ type: "blob" })),
      filename: `mails-${new Date().toISOString().replace(/:/g, '-')}.zip`
    }
    showMultiActionDownload.value = true;
  } catch (error) {
    message.error(error.message || "error");
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await refresh();
});

onBeforeUnmount(() => {
  clearInterval(timer.value)
  clearTimeout(searchDebounceTimer)
  // 离开收件箱时移除角标，避免影响其他页面
  clearUnreadBadge()
  // 释放缓存邮件附件的 blob URL，避免长时间占用内存
  parsedMailCache.forEach(revokeMailAttachments)
  parsedMailCache.clear()
})
</script>

<template>
  <div>
    <n-alert v-if="loadError" type="error" style="margin-bottom: 10px;">
      {{ loadError }}
      <template #action>
        <n-button size="small" tertiary type="primary" @click="backFirstPageAndRefresh">
          {{ t('retry') }}
        </n-button>
      </template>
    </n-alert>
    <div v-if="latestCode" class="latest-code-bar">
      <span class="latest-code-bar__label">{{ t('latestCode') }}</span>
      <span class="latest-code-bar__value">{{ latestCode }}</span>
      <n-button size="small" type="primary" @click="copyLatestCode">
        <template #icon>
          <n-icon :component="ContentCopyOutlined" />
        </template>
        {{ t('copyCode') }}
      </n-button>
    </div>
    <div v-if="!isMobile" class="left">
      <div style="margin-bottom: 10px;">
        <n-space v-if="multiActionMode" align="center">
          <n-button @click="multiActionModeClick(false)" tertiary>
            {{ t('cancelMultiAction') }}
          </n-button>
          <n-button @click="multiActionSelectAll(true)" tertiary>
            {{ t('selectAll') }}
          </n-button>
          <n-button @click="multiActionSelectAll(false)" tertiary>
            {{ t('unselectAll') }}
          </n-button>
          <n-popconfirm v-if="enableUserDeleteEmail" @positive-click="multiActionDeleteMail">
            <template #trigger>
              <n-button tertiary type="error">{{ t('delete') }}</n-button>
            </template>
            {{ t('deleteMailTip') }}
          </n-popconfirm>
          <n-button @click="multiActionDownload" tertiary type="info">
            <template #icon>
              <n-icon :component="CloudDownloadRound" />
            </template>
            {{ t('downloadMail') }}
          </n-button>
        </n-space>
        <n-space v-else align="center" :size="12">
          <n-button @click="multiActionModeClick(true)" type="primary" tertiary>
            {{ t('multiAction') }}
          </n-button>
          <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" :page-sizes="[20, 50, 100]"
            size="large" show-size-picker />
          <n-flex class="auto-refresh-control" align="center" :size="8">
            <n-switch v-model:value="autoRefresh" size="large" :round="false">
              <template #checked>
                {{ t('refreshAfter', { msg: autoRefreshInterval }) }}
              </template>
              <template #unchecked>
                {{ t('autoRefresh') }}
              </template>
            </n-switch>
          </n-flex>
          <n-button @click="backFirstPageAndRefresh" type="primary" tertiary>
            {{ t('refresh') }}
          </n-button>
          <n-button v-if="notifySupported" @click="toggleNotify" tertiary
            :type="notifyEnabled ? 'success' : 'default'">
            <template #icon>
              <n-icon :component="notifyEnabled ? NotificationsActiveFilled : NotificationsNoneFilled" />
            </template>
            {{ t('notifyEnable') }}
          </n-button>
        </n-space>
        <div v-if="showFilterInput" class="mail-toolbar-filter">
          <n-input v-model:value="searchKeyword" :placeholder="t('keywordQueryTip')" clearable />
        </div>
      </div>
      <n-split class="left" direction="horizontal" :max="0.75" :min="0" :resize-trigger-size="8"
        :default-size="mailboxSplitSize" :on-update:size="onSpiltSizeChange" v-if="!mailListView || curMail">
        <template #resize-trigger>
          <div class="split-handle">
            <div class="split-handle__grip" />
          </div>
        </template>
        <template #1>
          <div class="mail-list-scroll mail-list-compact">
            <div v-if="loadError" class="mail-load-error">
              <n-alert type="error" :bordered="false">
                {{ loadError }}
                <template #action>
                  <n-button size="small" tertiary type="primary" @click="backFirstPageAndRefresh">
                    {{ t('retry') }}
                  </n-button>
                </template>
              </n-alert>
            </div>
            <n-list hoverable clickable>
              <n-list-item v-for="row in data" v-bind:key="row.id" @click="() => clickRow(row)"
                :class="[mailItemClass(row), { 'mail-list-unread': enableMailReadStatus && row.is_unread === 1 }]">
                <template #prefix v-if="multiActionMode">
                  <n-checkbox v-model:checked="row.checked" @click.stop />
                </template>
                <MailSummary :mail="row" :showEMailTo="showEMailTo" :enableMailReadStatus="enableMailReadStatus"
                  :previewLineClamp="mailListPreviewLineClampValue" :formatTime="formatMailTime" />
              </n-list-item>
            </n-list>
          </div>
        </template>
        <template #2>
          <div v-if="curMail" style="margin: 8px;">
            <n-flex justify="space-between" align="center">
              <n-space :wrap="false" align="center">
                <n-button v-if="mailListView" @click="curMail = null" text size="small">
                  <template #icon>
                    <n-icon>
                      <ArrowBackIosNewFilled />
                    </n-icon>
                  </template>
                  {{ t('backToList') }}
                </n-button>
                <n-button @click="prevMail" :disabled="!canGoPrevMail" text size="small">
                  <template #icon>
                    <n-icon>
                      <ArrowBackIosNewFilled />
                    </n-icon>
                  </template>
                  {{ t('prevMail') }}
                </n-button>
              </n-space>
              <n-button @click="nextMail" :disabled="!canGoNextMail" text size="small" icon-placement="right">
                <template #icon>
                  <n-icon>
                    <ArrowForwardIosFilled />
                  </n-icon>
                </template>
                {{ t('nextMail') }}
              </n-button>
            </n-flex>
          </div>
          <n-card :bordered="false" v-if="curMail" class="mail-item" :title="curMail.subject"
            style="overflow: auto; max-height: 100vh;">
            <MailContentRenderer :mail="curMail" :showEMailTo="showEMailTo"
              :enableUserDeleteEmail="enableUserDeleteEmail" :showReply="showReply" :showSaveS3="showSaveS3"
              :enableMailReadStatus="enableMailReadStatus" :onUpdateMailReadStatus="toggleCurrentMailUnread"
              :onDelete="deleteMail" :onReply="replyMail" :onForward="forwardMail" :onSaveToS3="saveToS3Proxy" />
          </n-card>
          <n-card :bordered="false" embedded class="mail-item" v-else>
            <n-empty :description="count === 0 ? t('emptyInbox') : t('pleaseSelectMail')">
              <template #icon>
                <n-icon :component="InboxRound" :size="64" />
              </template>
              <template #extra v-if="count === 0">
                <n-button size="small" tertiary type="primary" @click="backFirstPageAndRefresh">
                  {{ t('refresh') }}
                </n-button>
              </template>
            </n-empty>
          </n-card>
        </template>
      </n-split>
      <div v-else class="mail-list-scroll mail-list-compact">
        <div v-if="loadError" class="mail-load-error">
          <n-alert type="error" :bordered="false">
            {{ loadError }}
            <template #action>
              <n-button size="small" tertiary type="primary" @click="backFirstPageAndRefresh">
                {{ t('retry') }}
              </n-button>
            </template>
          </n-alert>
        </div>
        <n-list hoverable clickable>
          <n-list-item v-for="row in data" v-bind:key="row.id" @click="() => clickRow(row)"
            :class="[mailItemClass(row), { 'mail-list-unread': enableMailReadStatus && row.is_unread === 1 }]">
            <template #prefix v-if="multiActionMode">
              <n-checkbox v-model:checked="row.checked" @click.stop />
            </template>
            <MailSummary :mail="row" :showEMailTo="showEMailTo" :enableMailReadStatus="enableMailReadStatus"
              :previewLineClamp="mailListPreviewLineClampValue" :formatTime="formatMailTime" />
          </n-list-item>
        </n-list>
      </div>
    </div>
    <div class="left" v-else>
      <n-space justify="space-between" align="center" :size="[8, 8]">
        <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" simple size="medium" />
        <n-flex class="auto-refresh-control auto-refresh-control--mobile" align="center" :size="6">
          <n-switch v-model:value="autoRefresh" size="medium" :round="false">
            <template #checked>
              {{ t('refreshAfter', { msg: autoRefreshInterval }) }}
            </template>
            <template #unchecked>
              {{ t('autoRefresh') }}
            </template>
          </n-switch>
        </n-flex>
        <n-button @click="backFirstPageAndRefresh" tertiary size="small" type="primary">
          {{ t('refresh') }}
        </n-button>
      </n-space>
      <div v-if="showFilterInput" style="padding: 0 10px; margin-top: 8px; margin-bottom: 10px;">
        <n-input v-model:value="searchKeyword"
          :placeholder="t('keywordQueryTip')" size="small" clearable />
      </div>
      <div class="mail-list-scroll mail-list-compact">
        <n-list hoverable clickable>
          <n-list-item v-for="row in data" v-bind:key="row.id" @click="() => clickRow(row)"
            :class="{ 'mail-list-unread': enableMailReadStatus && row.is_unread === 1 }">
            <MailSummary :mail="row" :showEMailTo="showEMailTo" :enableMailReadStatus="enableMailReadStatus"
              :previewLineClamp="mailListPreviewLineClampValue" :formatTime="formatMailTime" />
          </n-list-item>
        </n-list>
      </div>
      <n-drawer v-model:show="showMailDrawer" width="100%" placement="bottom" :trap-focus="false" :block-scroll="false"
        style="height: 80vh;">
        <n-drawer-content :title="curMail ? curMail.subject : ''" closable>
          <div class="mail-mobile-reader">
            <MailContentRenderer :mail="curMail" :showEMailTo="showEMailTo"
              :enableUserDeleteEmail="enableUserDeleteEmail" :showReply="showReply" :showSaveS3="showSaveS3"
              :enableMailReadStatus="enableMailReadStatus" :onUpdateMailReadStatus="toggleCurrentMailUnread"
              :onDelete="deleteMail" :onReply="replyMail" :onForward="forwardMail"
              :onSaveToS3="saveToS3Proxy" />
          </div>
        </n-drawer-content>
      </n-drawer>
    </div>
    <n-modal v-model:show="showMultiActionDownload" preset="dialog" :title="t('downloadMail')">
      <n-tag type="info">
        {{ multiActionDownloadZip.filename }}
      </n-tag>
      <n-button tag="a" target="_blank" tertiary type="info" size="small" :download="multiActionDownloadZip.filename"
        :href="multiActionDownloadZip.url">
        <n-icon :component="CloudDownloadRound" />
        {{ t('downloadMail') + " zip" }}
      </n-button>
    </n-modal>
    <n-modal v-model:show="showMultiActionDelete" preset="dialog" :title="t('delete') + t('success')"
      negative-text="OK">
      <n-space justify="center">
        <n-progress type="circle" status="error" :percentage="multiActionDeleteProgress.percentage">
          <span style="text-align: center">
            {{ multiActionDeleteProgress.tip }}
          </span>
        </n-progress>
      </n-space>
    </n-modal>
  </div>
</template>

<style scoped>
.latest-code-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 8px 12px;
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  background: rgba(24, 160, 88, 0.08);
}

.latest-code-bar__label {
  color: var(--n-text-color-3);
}

.latest-code-bar__value {
  font-family: monospace;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--n-text-color);
}
.left {
  text-align: left;
}

.center {
  text-align: center;
}

.overlay {
  width: 100%;
  height: 100%;
  z-index: 1000;
}

.mail-list-compact :deep(.n-list-item.overlay-dark-backgroud) {
  background-color: rgba(255, 255, 255, 0.1);
}

.mail-list-compact :deep(.n-list-item.overlay-light-backgroud) {
  background-color: rgba(0, 0, 0, 0.1);
}

.mail-item {
  height: 100%;
}

:deep(.mail-item .n-card-header__main) {
  overflow-wrap: anywhere;
}

.mail-mobile-reader {
  min-width: 0;
}

.mail-list-scroll {
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 60vh;
  max-height: 100vh;
}

.mail-list-compact :deep(.n-list-item) {
  height: auto;
  padding: 12px 14px;
}

.mail-list-compact :deep(.n-list-item:not(.overlay):hover) {
  background-color: v-bind("isDark ? 'rgba(255, 255, 255, 0.04)' : themeVars.hoverColor");
}

.mail-list-scroll :deep(.n-list-item__main) {
  min-width: 0;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.split-handle {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.split-handle__grip {
  width: 4px;
  height: 32px;
  border-radius: 2px;
  background-color: var(--n-resize-trigger-color);
  transition: background-color 0.2s;
}

.split-handle:hover .split-handle__grip {
  background-color: var(--n-resize-trigger-color-hover);
}

/* 触屏窄屏：增大邮件列表项点击区域，降低误触 */
@media (hover: none) and (pointer: coarse) and (max-width: 1024px) {
  .mail-list-scroll :deep(.n-list-item),
  .left :deep(.n-list-item) {
    padding-top: 14px;
    padding-bottom: 14px;
  }
}

/* 自动刷新开关与同排按钮高度对齐 */
.auto-refresh-control {
  flex: 0 0 auto;
  height: 34px;
}

.auto-refresh-control--mobile {
  height: 28px;
}

/* 收件箱筛选框独立成行，避免挤压工具栏控件导致换行 */
.mail-toolbar-filter {
  max-width: 320px;
  margin-top: 8px;
}

/* 加载失败提示与列表保持一致的留白 */
.mail-load-error {
  padding: 8px 10px 0;
}
</style>
