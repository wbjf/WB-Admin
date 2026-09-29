<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElSteps, ElStep } from 'element-plus'
import { Iphone, Key, Lock, User } from '@element-plus/icons-vue'
import { authApi } from '@/api/auth'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'Forget' })

const router = useRouter()
const { t } = useI18n()
const step = ref(0)
const loading = ref(false)
const form = ref({ username: '', phonenumber: '', code: '', password: '', confirmPassword: '' })

function next() {
  if (!form.value.username) {
    ElMessage.warning('请输入账号')
    return
  }
  step.value = 1
  ElMessage.success('验证码已发送（演示环境请输入 1234）')
}

async function submit() {
  if (form.value.code !== '1234') {
    ElMessage.error('验证码错误')
    return
  }
  if (!form.value.password || form.value.password !== form.value.confirmPassword) {
    ElMessage.error(t('login.passwordMismatch'))
    return
  }
  loading.value = true
  try {
    await authApi.forget({ username: form.value.username, password: form.value.password, code: form.value.code })
    ElMessage.success('密码重置成功')
    step.value = 2
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
      <h2>{{ t('login.resetTitle') }}</h2>
      <el-steps :active="step" finish-status="success" align-center class="wb-auth__steps">
        <el-step title="验证账号" />
        <el-step title="重置密码" />
        <el-step title="完成" />
      </el-steps>

      <el-form v-if="step === 0" size="large">
        <el-form-item><el-input v-model="form.username" :prefix-icon="User" placeholder="请输入账号" /></el-form-item>
        <el-form-item><el-input v-model="form.phonenumber" :prefix-icon="Iphone" placeholder="请输入手机号" /></el-form-item>
        <el-button type="primary" size="large" style="width: 100%" @click="next">下一步</el-button>
      </el-form>

      <el-form v-else-if="step === 1" size="large">
        <el-form-item><el-input v-model="form.code" :prefix-icon="Key" placeholder="请输入验证码" /></el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" show-password :prefix-icon="Lock" placeholder="新密码" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.confirmPassword" type="password" show-password :prefix-icon="Lock" placeholder="确认新密码" />
        </el-form-item>
        <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="submit">提交</el-button>
      </el-form>

      <div v-else class="wb-auth__done">
        <el-icon class="wb-auth__ok"><CircleCheckFilled /></el-icon>
        <p>密码已重置，请使用新密码登录</p>
        <el-button type="primary" @click="router.push('/login')">返回登录</el-button>
      </div>

      <div class="wb-auth__footer">
        <router-link to="/login">返回登录</router-link>
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
    width: 460px;
    padding: 30px;
    border-radius: 14px;
    background: var(--wb-bg-card);
    border: 1px solid var(--wb-border);

    h2 {
      margin: 0 0 18px;
      text-align: center;
      font-size: 18px;
      font-weight: 600;
    }
  }

  &__steps {
    margin-bottom: 22px;
  }

  &__done {
    text-align: center;
    padding: 10px 0 4px;
  }

  &__ok {
    font-size: 46px;
    color: var(--el-color-success);
  }

  &__footer {
    margin-top: 16px;
    text-align: center;
    font-size: 13px;

    a {
      color: var(--el-color-primary);
    }
  }
}
</style>
