import { http } from '@/utils/request'
import type { UserInfo } from '@/types'

export interface LoginResult {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token?: string
}

export interface CaptchaResult {
  captchaEnabled: boolean
  img: string
  uuid: string
}

export const authApi = {
  captcha: () => http.get<CaptchaResult>('/captchaImage', undefined, { auth: false }),
  login: (data: Record<string, any>) => http.post<LoginResult>('/login', data, { auth: false, showError: true }),
  smsCode: (phone: string) => http.get<{ uuid: string; expires: number }>('/sms/code', { phonenumber: phone }, { auth: false }),
  smsLogin: (data: Record<string, any>) => http.post<LoginResult>('/sms/login', data, { auth: false }),
  refresh: (token: string) => http.post<LoginResult>('/refresh', null, { auth: false, repeatable: false }),
  logout: () => http.post<void>('/logout'),
  profile: () => http.get<UserInfo>('/getInfo'),
  register: (data: Record<string, any>) => http.post<void>('/register', data, { auth: false }),
  forget: (data: Record<string, any>) => http.post<void>('/forget', data, { auth: false })
}

export const loginApi = authApi.login
export const logoutApi = authApi.logout
export const getUserProfile = authApi.profile
export const refreshTokenApi = () => authApi.refresh('')
export const smsLoginApi = authApi.smsLogin
