<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Iphone, Lock, Message, User } from '@element-plus/icons-vue'
import { authApi } from '@/api/auth'
import { useI18n } from 'vue-i18n'
import { passwordLevel } from '@/utils/validate'

defineOptions({ name: 'Register' })

const router = useRouter()
const { t } = useI18n()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = ref({
  username: '',
  password: '',
  confirmPassword: '',
  phonenumber: '',
  email: '',
  agree: false
})

const strength = computed(() => passwordLevel(form.value.password))

const rules = computed<FormRules>(() => ({
  username: [{ required: true, message: t('login.username'), trigger: 'blur' }, { min: 3, max: 20, message: '长度 3-20 位', trigger: 'blur' }],
  phonenumber: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
  password: [
    { required: true, message: t('login.password'), trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' }
  ],
  confirmPassword: [
    {
      validator: (_r, value, cb) => {
        if (value === form.value.password) cb()
        else cb(new Error(t('login.passwordMismatch')))
      },
      trigger: 'blur'
    }
  ]
}))

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (!form.value.agree) {
    ElMessage.warning(t('login.agreeTip'))
    return
  }
  loading.value = true
  try {
    await authApi.register({
      username: form.value.username,
      password: form.value.password,
      phonenumber: form.value.phonenumber,
      email: form.value.email
    })
    ElMessage.success('注册成功，请登录')
    router.push('/login')
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="wb-auth">
    <div class="wb-auth__panel">
      <h2>{{ t('login.registerTitle') }}</h2>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" label-width="0">
        <el-form-item prop="username">
          <el-input v-model="form.username" :prefix-icon="User" :placeholder="t('login.username')" />
        </el-form-item>
        <el-form-item prop="phonenumber">
          <el-input v-model="form.phonenumber" :prefix-icon="Iphone" placeholder="手机号（选填）" />
        </el-form-item>
        <el-form-item prop="email">
          <el-input v-model="form.email" :prefix-icon="Message" placeholder="邮箱（选填）" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" show-password :prefix-icon="Lock" :placeholder="t('login.password')" />
        </el-form-item>
        <div class="wb-auth__strength">
          <span :class="{ 'is-on': strength >= 0 }" />
          <span :class="{ 'is-on': strength >= 1 }" />
          <span :class="{ 'is-on': strength >= 2 }" />
        </div>
        <el-form-item prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" show-password :prefix-icon="Lock" :placeholder="t('login.confirmPassword')" />
        </el-form-item>
        <el-checkbox v-model="form.agree" class="wb-auth__agree">{{ t('login.agree') }}</el-checkbox>
        <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="submit">
          {{ t('login.signUp') }}
        </el-button>
      </el-form>
      <div class="wb-auth__footer">
        已有账号？<router-link to="/login">返回登录</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wb-auth {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--wb-bg-page);

  &__panel {
    width: 380px;
    padding: 30px;
    border-radius: 14px;
    background: var(--wb-bg-card);
    border: 1px solid var(--wb-border);

    h2 {
      margin: 0 0 20px;
      font-size: 18px;
      font-weight: 600;
      text-align: center;
    }
  }

  &__agree {
    font-size: 13px;
    margin-bottom: 14px;
  }

  &__footer {
    margin-top: 14px;
    text-align: center;
    font-size: 13px;
    color: var(--el-text-color-secondary);

    a {
      color: var(--el-color-primary);
    }
  }

  &__strength {
    display: flex;
    gap: 4px;
    margin: -8px 0 12px;

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
  }
}
</style>
