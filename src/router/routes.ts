import type { RouteRecordRaw } from 'vue-router'
import { Layout } from './helper'

export const LAYOUT_NAME = 'RootLayout'

/** 无需登录即可访问 */
export const WHITE_LIST = ['/login', '/register', '/forget', '/auth-redirect', '/403', '/404', '/500']

/** 静态路由（与后端菜单无关） */
export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/login.vue'),
    meta: { hidden: true, title: '登录' }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/register.vue'),
    meta: { hidden: true, title: '注册' }
  },
  {
    path: '/forget',
    name: 'Forget',
    component: () => import('@/views/auth/forget.vue'),
    meta: { hidden: true, title: '找回密码' }
  },
  {
    path: '/redirect',
    component: Layout,
    meta: { hidden: true },
    children: [
      {
        path: '/redirect/:path(.*)',
        name: 'Redirect',
        component: () => import('@/views/common/Redirect.vue')
      }
    ]
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/403.vue'),
    meta: { hidden: true, title: '403' }
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { hidden: true, title: '404' }
  },
  {
    path: '/500',
    name: 'ServiceError',
    component: () => import('@/views/error/500.vue'),
    meta: { hidden: true, title: '500' }
  },
  /**
   * 兜底路由：任何未匹配的路径都进 404，而不是让 router-view 渲染空白。
   * Vue Router 4 按路由具体性排序，因此不会抢占后面动态添加的业务路由。
   */
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFoundCatchAll',
    redirect: '/404',
    meta: { hidden: true }
  }
]

/** 所有用户都有的基础页面 */
export const baseRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: LAYOUT_NAME,
    component: Layout,
    redirect: '/index',
    children: [
      {
        path: 'index',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: 'menu.dashboard', icon: 'Odometer', affix: true }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/index.vue'),
        meta: { title: 'menu.profile', hidden: true }
      }
    ]
  }
]

export default constantRoutes
