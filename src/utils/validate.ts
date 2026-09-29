/** 常用校验规则 */
export const isExternal = (path: string): boolean => /^(https?:|mailto:|tel:|\/\/)/.test(path)

export const isEmail = (v: string): boolean =>
  /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(v)

export const isPhone = (v: string): boolean => /^1[3-9]\d{9}$/.test(v)

export const isIdCard = (v: string): boolean => /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/.test(v)

export const isUrl = (v: string): boolean =>
  /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/.test(v)

export const isNumber = (v: string): boolean => /^[0-9]+.?[0-9]*$/.test(v)

export const isIPv4 = (v: string): boolean =>
  /^((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/.test(v)

/** 密码强度：0 弱 1 中 2 强 */
export function passwordLevel(v: string): 0 | 1 | 2 {
  if (!v) return 0
  let score = 0
  if (v.length >= 8) score++
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++
  if (/\d/.test(v)) score++
  if (/[^A-Za-z0-9]/.test(v)) score++
  if (score >= 4) return 2
  if (score >= 3) return 1
  return 0
}

export const isStrongPassword = (v: string): boolean => passwordLevel(v) >= 1
