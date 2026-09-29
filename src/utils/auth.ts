import Cookies from 'js-cookie'

const TokenKey = 'wb-admin-token'
const RefreshKey = 'wb-admin-refresh-token'
const TenantKey = 'wb-admin-tenant'
const RememberKey = 'wb-admin-remember'

export function getToken(): string {
  return Cookies.get(TokenKey) || localStorage.getItem(TokenKey) || ''
}

export function setToken(token: string, remember = true): void {
  removeToken()
  if (remember) {
    Cookies.set(TokenKey, token, { expires: 7 })
  } else {
    localStorage.setItem(TokenKey, token)
  }
}

export function removeToken(): void {
  Cookies.remove(TokenKey)
  localStorage.removeItem(TokenKey)
  localStorage.removeItem(RefreshKey)
}

export function getRefreshToken(): string {
  return localStorage.getItem(RefreshKey) || ''
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(RefreshKey, token)
}

/** 当前租户 */
export function getTenantId(): string {
  return localStorage.getItem(TenantKey) || ''
}

export function setTenantId(id: string): void {
  if (id) localStorage.setItem(TenantKey, id)
  else localStorage.removeItem(TenantKey)
}

/** 记住的登录信息（轻度混淆存储，非安全级别） */
export interface RememberForm {
  username: string
  password: string
}

export function getRemember(): RememberForm | null {
  const raw = localStorage.getItem(RememberKey)
  if (!raw) return null
  try {
    return JSON.parse(decode(raw))
  } catch {
    return null
  }
}

export function setRemember(form: RememberForm): void {
  localStorage.setItem(RememberKey, encode(JSON.stringify(form)))
}

export function removeRemember(): void {
  localStorage.removeItem(RememberKey)
}

function encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str))).split('').reverse().join('')
}

function decode(str: string): string {
  return decodeURIComponent(escape(atob(str.split('').reverse().join(''))))
}
