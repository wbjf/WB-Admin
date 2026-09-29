import { defineStore } from 'pinia'
import type { RouteLocationNormalized } from 'vue-router'

export interface TagView {
  fullPath: string
  path: string
  name: unknown
  meta: Record<string, any>
  title: string
  affix?: boolean
  query?: Record<string, any>
}

function toTagView(route: RouteLocationNormalized | Record<string, any>): TagView {
  const r = route as any
  return {
    fullPath: r.fullPath ?? r.path,
    path: r.path,
    name: r.name,
    meta: r.meta ?? {},
    title: (r.meta?.title as string) || '',
    affix: Boolean(r.meta?.affix),
    query: r.query
  }
}

export const useTagsViewStore = defineStore('wb-tagsView', {
  state: () => ({
    visitedViews: [] as TagView[],
    cachedViews: [] as string[],
    maxCount: 20
  }),
  getters: {
    keepAliveNames(state): string[] {
      return state.cachedViews
    }
  },
  actions: {
    addView(route: RouteLocationNormalized | Record<string, any>) {
      const view = toTagView(route)
      if (this.isVisited(view)) {
        this.updateView(view)
        return
      }
      if (view.meta?.keepAlive && view.name) {
        this.cachedViews.push(String(view.name as string))
      }
      if (this.visitedViews.length >= this.maxCount) {
        const idx = this.visitedViews.findIndex((v) => !v.affix)
        if (idx > -1) this.visitedViews.splice(idx, 1)
      }
      this.visitedViews.push(view)
    },
    isVisited(view: TagView): boolean {
      return this.visitedViews.some((v) => v.fullPath === view.fullPath)
    },
    updateView(view: TagView) {
      const i = this.visitedViews.findIndex((v) => v.fullPath === view.fullPath)
      if (i > -1) this.visitedViews[i] = { ...this.visitedViews[i], ...view }
    },
    delView(view: TagView) {
      const i = this.visitedViews.findIndex((v) => v.fullPath === view.fullPath)
      if (i > -1) this.visitedViews.splice(i, 1)
      this.delCache(view)
    },
    delCache(view: TagView) {
      const name = typeof view.name === 'string' ? view.name : ''
      if (!name) return
      const i = this.cachedViews.indexOf(name)
      if (i > -1) this.cachedViews.splice(i, 1)
    },
    delOthers(view: TagView) {
      this.visitedViews = this.visitedViews.filter((v) => v.affix || v.fullPath === view.fullPath)
      this.cachedViews = this.visitedViews
        .filter((v) => v.meta?.keepAlive && typeof v.name === 'string')
        .map((v) => String(v.name))
    },
    delLeft(view: TagView) {
      const i = this.visitedViews.findIndex((v) => v.fullPath === view.fullPath)
      if (i < 0) return
      const removed = this.visitedViews.slice(0, i).filter((v) => !v.affix)
      this.visitedViews = this.visitedViews.filter((v) => v.affix || v.fullPath === view.fullPath || this.visitedViews.indexOf(v) > i)
      removed.forEach((v) => this.delCache(v))
    },
    delRight(view: TagView) {
      const i = this.visitedViews.findIndex((v) => v.fullPath === view.fullPath)
      if (i < 0) return
      const removed = this.visitedViews.slice(i + 1).filter((v) => !v.affix)
      this.visitedViews = [...this.visitedViews.slice(0, i + 1), ...this.visitedViews.filter((v) => v.affix)]
      removed.forEach((v) => this.delCache(v))
    },
    delAll() {
      this.visitedViews = this.visitedViews.filter((v) => v.affix)
      this.cachedViews = this.visitedViews
        .filter((v) => v.meta?.keepAlive && typeof v.name === 'string')
        .map((v) => String(v.name))
    },
    moveTags(from: number, to: number) {
      const item = this.visitedViews.splice(from, 1)[0]
      if (item) this.visitedViews.splice(to, 0, item)
    }
  }
})
