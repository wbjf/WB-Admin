<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormItemRule, type UploadFile } from 'element-plus'
import { Crop, Edit } from '@element-plus/icons-vue'
import ImageCropper from '@/components/ImageCropper/index.vue'
import ProUpload from '@/components/ProUpload/index.vue'
import { userApi } from '@/api/user'
import { useUserStore } from '@/stores/modules/user'
import { useI18n } from 'vue-i18n'
import type { UploadResult } from '@/types'

defineOptions({ name: 'Profile' })

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()

const activeTab = ref('basic')
const saving = ref(false)

/** ---------- 基本资料 ---------- */
const profileFormRef = ref<any>(null)
const form = reactive<Record<string, any>>({
  nickName: '',
  phonenumber: '',
  email: '',
  sex: '0',
  remark: '',
  avatar: ''
})

const emailRules: FormItemRule[] = [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }]
const nickRules: FormItemRule[] = [
  { required: true, message: t('user.nick'), trigger: 'blur' }
]

async function loadProfile(): Promise<void> {
  try {
    const info: any = await userStore.loadUserInfo()
    Object.assign(form, {
      nickName: info?.nickName ?? userStore.nickName ?? '',
      phonenumber: info?.phonenumber ?? userStore.phonenumber ?? '',
      email: info?.email ?? userStore.email ?? '',
      sex: info?.sex ?? '0',
      remark: info?.remark ?? '',
      avatar: info?.avatar ?? userStore.avatar ?? ''
    })
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

async function saveProfile(): Promise<void> {
  const valid = await profileFormRef.value?.validate?.().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    await userApi.updateProfile({ ...form, avatar: form.avatar })
    userStore.setProfile({ ...form })
    ElMessage.success(t('profile.updated'))
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    saving.value = false
  }
}

/** ---------- 头像裁剪 ---------- */
const cropperVisible = ref(false)
const cropperSrc = ref('')

function onUploadSuccess(res: UploadResult, _file: UploadFile): void {
  cropperSrc.value = res?.url ?? ''
  cropperVisible.value = true
}

function openCropper(): void {
  cropperSrc.value = form.avatar || ''
  cropperVisible.value = true
}

async function onCropDone(dataUrl: string): Promise<void> {
  try {
    await userApi.updateAvatar(dataUrl)
    form.avatar = dataUrl
    userStore.avatar = dataUrl
    ElMessage.success(t('common.success'))
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

/** ---------- 修改密码 ---------- */
const pwdFormRef = ref<any>(null)
const pwd = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

const pwdRules: Record<string, FormItemRule[]> = {
  oldPassword: [{ required: true, message: t('profile.oldPassword'), trigger: 'blur' }],
  newPassword: [
    { required: true, message: t('profile.newPassword'), trigger: 'blur' },
    { min: 6, max: 20, message: '长度需在 6 到 20 个字符之间', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: t('profile.confirmPassword'), trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: (e?: Error) => void) => {
        if (value !== pwd.newPassword) callback(new Error(t('login.passwordMismatch')))
        else callback()
      },
      trigger: 'blur'
    }
  ]
}

async function submitPwd(): Promise<void> {
  const valid = await pwdFormRef.value?.validate?.().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    await userApi.updatePwd(pwd.oldPassword, pwd.newPassword)
    ElMessage.success(t('profile.pwdChanged'))
    await userStore.logout()
    router.push('/login')
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    saving.value = false
  }
}

function resetPwd(): void {
  pwd.oldPassword = ''
  pwd.newPassword = ''
  pwd.confirmPassword = ''
  ;(pwdFormRef.value as FormInstance | null)?.clearValidate?.()
}

onMounted(() => {
  void loadProfile()
})
</script>

<template>
  <div class="wb-page wb-profile">
    <el-row :gutter="12">
      <el-col :xs="24" :sm="8" :lg="6">
        <div class="wb-card wb-card--fill wb-profile__side">
          <el-avatar :size="88" :src="form.avatar || userStore.avatar">
            {{ userStore.displayName }}
          </el-avatar>
          <div class="wb-profile__name">{{ userStore.displayName }}</div>
          <div class="wb-text-muted">{{ userStore.deptName || userStore.userName }}</div>
          <el-button plain size="small" @click="openCropper">
            <el-icon><Crop /></el-icon>{{ t('profile.avatar') }}
          </el-button>
          <ul class="wb-profile__meta">
            <li>
              <span class="wb-text-muted">{{ t('user.phone') }}</span>
              <span>{{ userStore.phonenumber || '-' }}</span>
            </li>
            <li>
              <span class="wb-text-muted">{{ t('user.email') }}</span>
              <span>{{ userStore.email || '-' }}</span>
            </li>
            <li>
              <span class="wb-text-muted">{{ t('user.dept') }}</span>
              <span>{{ userStore.deptName || '-' }}</span>
            </li>
          </ul>
        </div>
      </el-col>

      <el-col :xs="24" :sm="16" :lg="18">
        <div class="wb-card wb-card--fill">
          <el-tabs v-model="activeTab" class="wb-profile__tabs">
            <el-tab-pane :label="t('profile.basic')" name="basic">
              <el-form ref="profileFormRef" :model="form" label-width="90px" class="wb-profile__form">
                <el-form-item :label="t('user.avatar')" prop="avatar">
                  <ProUpload
                    v-model="form.avatar"
                    list-type="picture-card"
                    accept="image/*"
                    @success="onUploadSuccess"
                  />
                </el-form-item>
                <el-form-item :label="t('user.nick')" prop="nickName" :rules="nickRules">
                  <el-input v-model="form.nickName" clearable />
                </el-form-item>
                <el-form-item :label="t('user.phone')" prop="phonenumber">
                  <el-input v-model="form.phonenumber" clearable />
                </el-form-item>
                <el-form-item :label="t('user.email')" prop="email" :rules="emailRules">
                  <el-input v-model="form.email" clearable />
                </el-form-item>
                <el-form-item :label="t('user.sex')" prop="sex">
                  <el-radio-group v-model="form.sex">
                    <el-radio value="0">{{ t('user.sexMale') }}</el-radio>
                    <el-radio value="1">{{ t('user.sexFemale') }}</el-radio>
                    <el-radio value="2">{{ t('user.sexUnknown') }}</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item :label="t('common.remark')" prop="remark">
                  <el-input v-model="form.remark" type="textarea" :rows="3" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" :loading="saving" @click="saveProfile">
                    <el-icon><Edit /></el-icon>{{ t('common.save') }}
                  </el-button>
                  <el-button @click="loadProfile">{{ t('common.reset') }}</el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane :label="t('profile.changePwd')" name="password">
              <el-form
                ref="pwdFormRef"
                :model="pwd"
                :rules="pwdRules"
                label-width="90px"
                class="wb-profile__form"
              >
                <el-form-item :label="t('profile.oldPassword')" prop="oldPassword">
                  <el-input v-model="pwd.oldPassword" type="password" show-password clearable />
                </el-form-item>
                <el-form-item :label="t('profile.newPassword')" prop="newPassword">
                  <el-input v-model="pwd.newPassword" type="password" show-password clearable />
                </el-form-item>
                <el-form-item :label="t('profile.confirmPassword')" prop="confirmPassword">
                  <el-input v-model="pwd.confirmPassword" type="password" show-password clearable />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" :loading="saving" @click="submitPwd">
                    {{ t('common.save') }}
                  </el-button>
                  <el-button @click="resetPwd">{{ t('common.reset') }}</el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-col>
    </el-row>

    <ImageCropper v-model="cropperVisible" :src="cropperSrc" :aspect-ratio="1" round @done="onCropDone" />
  </div>
</template>

<style scoped lang="scss">
.wb-profile {
  &__side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 24px 16px;
  }

  &__name {
    font-size: 16px;
    font-weight: 600;
  }

  &__meta {
    width: 100%;
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    font-size: 13px;

    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 0;
      border-top: 1px dashed var(--wb-border);
    }
  }

  /**
   * 撑满型卡片里的 el-tabs。
   * el-tabs 本身是 flex 容器（顶部型为 column），__content 自带 flex-grow:1 + overflow:hidden，
   * 这里只需要给它一个确定高度并允许滚动，表单就在标签页内部滚动而不是把页面顶高。
   */
  &__tabs {
    flex: 1 1 0;
    min-height: 0;

    :deep(.el-tabs__content) {
      overflow: auto;
    }
  }

  &__form {
    max-width: 560px;
  }
}
</style>
