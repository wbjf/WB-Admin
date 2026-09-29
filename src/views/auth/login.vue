<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Iphone, Lock, User } from '@element-plus/icons-vue'
import QRCode from 'qrcode'
import { useUserStore } from '@/stores/modules/user'
import { useTenantStore } from '@/stores/modules/tenant'
import { useSettingsStore } from '@/stores/modules/settings'
import { authApi } from '@/api/auth'
import { getRemember, removeRemember, setRemember } from '@/utils/auth'
import { useI18n } from 'vue-i18n'
import { getNextLocale, setLocale } from '@/locales'
import { passwordLevel } from '@/utils/validate'

defineOptions({ name: 'Login' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const userStore = useUserStore()
const tenantStore = useTenantStore()
const settings = useSettingsStore()

const activeTab = ref<'account' | 'sms' | 'qrcode'>('account')
const formRef = ref<FormInstance>()
const loading = ref(false)
const captchaUrl = ref('')
const qrImage = ref('')
const countdown = ref(0)
const capsLock = ref(false)

const form = ref({
  username: 'admin',
  password: 'admin123',
  code: '',
  uuid: '',
  tenantId: '',
  remember: true
})

const smsForm = ref({ phonenumber: '', code: '' })

const rules = computed<FormRules>(() => ({
  username: [{ required: true, message: t('login.username'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.password'), trigger: 'blur' }, { min: 5, message: '密码至少 5 位', trigger: 'blur' }],
  code: [{ required: true, message: t('login.captcha'), trigger: 'blur' }]
}))

const strength = computed(() => passwordLevel(form.value.password))

const redirect = computed(() => {
  const q = route.query.redirect
  return q ? decodeURIComponent(String(q)) : '/index'
})

async function loadCaptcha() {
  try {
    const res = await authApi.captcha()
    form.value.uuid = res.uuid
    captchaUrl.value = res.captchaEnabled && res.img ? `data:image/gif;base64,${res.img}` : ''
  } catch {
    captchaUrl.value = ''
  }
}

function onCapsLock(e: KeyboardEvent) {
  capsLock.value = typeof e.getModifierState === 'function' && e.getModifierState('CapsLock')
}

async function submit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await userStore.login({ ...form.value }, form.value.remember)
    if (form.value.remember) {
      setRemember({ username: form.value.username, password: form.value.password })
    } else {
      removeRemember()
    }
    await router.push(redirect.value)
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
    await loadCaptcha()
  } finally {
    loading.value = false
  }
}

async function sendSmsCode() {
  if (!/^1[3-9]\d{9}$/.test(smsForm.value.phonenumber)) {
    ElMessage.warning('请输入正确的手机号')
    return
  }
  countdown.value = 60
  const timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) clearInterval(timer)
  }, 1000)
  ElMessage.success('验证码已发送（演示环境请输入 1234）')
}

async function submitSms() {
  if (smsForm.value.code.length < 4) {
    ElMessage.warning('请输入 4 位验证码')
    return
  }
  loading.value = true
  try {
    await userStore.smsLogin(smsForm.value.phonenumber, smsForm.value.code)
    await router.push(redirect.value)
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    loading.value = false
  }
}

async function renderQr() {
  try {
    qrImage.value = await QRCode.toDataURL('wb-admin://login?scene=sso&t=' + Date.now(), {
      width: 200,
      margin: 1
    })
  } catch {
    qrImage.value = ''
  }
}

function toggleTheme() {
  settings.setMode(settings.mode === 'dark' ? 'light' : 'dark')
}

function switchLang() {
  setLocale(getNextLocale())
}

watch(activeTab, (v) => {
  if (v === 'qrcode') renderQr()
})

onMounted(async () => {
  await loadCaptcha()
  if (tenantStore.enabled) {
    await tenantStore.loadTenants()
    form.value.tenantId = tenantStore.currentId || String(tenantStore.tenants[0]?.tenantId ?? '')
  }
  const remembered = getRemember()
  if (remembered) {
    form.value.username = remembered.username
    form.value.password = remembered.password
    form.value.remember = true
  }
})
</script>

<template>
  <div class="wb-login">
    <div class="wb-login__bg">
      <span class="wb-login__blob wb-login__blob--1" />
      <span class="wb-login__blob wb-login__blob--2" />
    </div>

    <div class="wb-login__top">
      <el-button text circle @click="toggleTheme">
        <el-icon><component :is="settings.mode === 'dark' ? 'Sunny' : 'Moon'" /></el-icon>
      </el-button>
      <el-button text round @click="switchLang">
        {{ getNextLocale() === 'en-US' ? 'English' : '简体中文' }}
      </el-button>
    </div>

    <div class="wb-login__panel">
      <div class="wb-login__brand">
        <img src="/favicon.svg" alt="logo" width="34" />
        <div>
          <h1>{{ t('login.title') }}</h1>
          <p>{{ t('login.subtitle') }}</p>
        </div>
      </div>

      <el-tabs v-model="activeTab" stretch class="wb-login__tabs">
        <el-tab-pane :label="t('login.accountLogin')" name="account">
          <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent>
            <el-form-item prop="username">
              <el-input v-model="form.username" :prefix-icon="User" :placeholder="t('login.username')" clearable />
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="form.password"
                type="password"
                show-password
                :prefix-icon="Lock"
                :placeholder="t('login.password')"
                @keyup="onCapsLock"
                @keyup.enter="submit"
              />
            </el-form-item>

            <div v-if="capsLock" class="wb-login__warn">{{ t('login.capsLock') }}</div>

            <div v-if="form.password" class="wb-login__strength">
              <span :class="{ 'is-on': strength >= 0 }" />
              <span :class="{ 'is-on': strength >= 1 }" />
              <span :class="{ 'is-on': strength >= 2 }" />
              <em>{{ ['弱', '中', '强'][strength] }}</em>
            </div>

            <el-form-item v-if="tenantStore.enabled" prop="tenantId">
              <el-select v-model="form.tenantId" :placeholder="t('login.tenantPlaceholder')" style="width: 100%">
                <el-option v-for="item in tenantStore.tenants" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
              </el-select>
            </el-form-item>

            <el-form-item v-if="captchaUrl" prop="code">
              <div class="wb-login__captcha">
                <el-input v-model="form.code" :placeholder="t('login.captcha')" @keyup.enter="submit" />
                <img :src="captchaUrl" alt="captcha" @click="loadCaptcha" />
              </div>
            </el-form-item>

            <div class="wb-login__row">
              <el-checkbox v-model="form.remember">{{ t('login.remember') }}</el-checkbox>
              <router-link to="/forget" class="wb-login__link">{{ t('login.forgot') }}</router-link>
            </div>

            <el-button type="primary" size="large" :loading="loading" style="width: 100%" @click="submit">
              {{ t('login.signIn') }}
            </el-button>

            <div class="wb-login__tip">演示账号 admin / admin123</div>
          </el-form>
        </el-tab-pane>

        <el-tab-pane :label="t('login.smsLogin')" name="sms">
          <el-form size="large">
            <el-form-item>
              <el-input v-model="smsForm.phonenumber" :prefix-icon="Iphone" placeholder="请输入手机号" />
            </el-form-item>
            <el-form-item>
              <div class="wb-login__captcha">
                <el-input v-model="smsForm.code" placeholder="请输入验证码" />
                <el-button :disabled="countdown > 0" @click="sendSmsCode">
                  {{ countdown > 0 ? t('login.resendIn', { n: countdown }) : t('login.sendCode') }}
                </el-button>
              </div>
            </el-form-item>
            <el-button type="primary" size="large" :loading="loading" style="width: 100%" @click="submitSms">
              {{ t('login.signIn') }}
            </el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane :label="t('login.scanning')" name="qrcode">
          <div class="wb-login__qr">
            <img v-if="qrImage" :src="qrImage" alt="qrcode" width="180" />
            <el-skeleton v-else style="width: 180px" animated />
            <p class="wb-text-muted">{{ t('login.qrTip') }}</p>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div class="wb-login__footer">WB-Admin v1.0.0 · Vue3 + TypeScript + Element Plus</div>
  </div>
</template>

<style scoped lang="scss">
.wb-login {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--wb-bg-page);

  &__bg {
    position: absolute;
    inset: 0;
    filter: blur(0);
  }

  &__blob {
    position: absolute;
    width: 460px;
    height: 460px;
    border-radius: 46% 54% 60% 40% / 54% 45% 55% 46%;
    background: var(--el-color-primary-light-5);
    opacity: 0.16;

    &--1 {
      left: -120px;
      top: -100px;
    }

    &--2 {
      right: -140px;
      bottom: -140px;
      background: var(--el-color-info-light-5);
    }
  }

  &__top {
    position: absolute;
    right: 20px;
    top: 16px;
    display: flex;
    gap: 6px;
  }

  &__panel {
    position: relative;
    width: 400px;
    padding: 32px 30px 26px;
    border-radius: 14px;
    background: var(--wb-bg-card);
    border: 1px solid var(--wb-border);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
    z-index: 1;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;

    h1 {
      margin: 0;
      font-size: 19px;
      font-weight: 600;
    }

    p {
      margin: 2px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  &__captcha {
    display: flex;
    gap: 8px;
    width: 100%;

    img {
      height: 40px;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid var(--wb-border);
    }
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 2px 0 16px;
    font-size: 13px;
  }

  &__link {
    color: var(--el-color-primary);
    font-size: 13px;
  }

  &__tip {
    margin-top: 14px;
    text-align: center;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__warn {
    font-size: 12px;
    color: var(--el-color-warning);
    margin-bottom: 8px;
  }

  &__strength {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 12px;

    span {
      width: 34px;
      height: 4px;
      background: var(--el-border-color);
      border-radius: 2px;

      &.is-on:nth-child(1) {
        background: var(--el-color-danger);
      }
      &.is-on:nth-child(2) {
        background: var(--el-color-warning);
      }
      &.is-on:nth-child(3) {
        background: var(--el-color-success);
      }
    }

    em {
      font-size: 12px;
      font-style: normal;
      margin-left: 4px;
      color: var(--el-text-color-secondary);
    }
  }

  &__qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 8px 0 4px;
  }

  &__footer {
    position: absolute;
    bottom: 18px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
</style>
