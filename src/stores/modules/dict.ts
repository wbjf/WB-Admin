import { defineStore } from 'pinia'
import type { DictData, Option } from '@/types'
import { listDictDataByType } from '@/api/dict'

/** 字典统一缓存，避免每个页面手写 options */
export const useDictStore = defineStore('wb-dict', {
  state: () => ({
    dictMap: {} as Record<string, DictData[]>
  }),
  getters: {
    getDict(state) {
      return (type: string): DictData[] => state.dictMap[type] ?? []
    },
    getOptions(state) {
      return (type: string): Option[] =>
        (state.dictMap[type] ?? []).map((d) => ({
          label: d.dictLabel,
          value: d.dictValue,
          tag: d.listClass
        }))
    }
  },
  actions: {
    async loadDict(type: string): Promise<DictData[]> {
      if (this.dictMap[type]?.length) return this.dictMap[type]
      const data = await listDictDataByType(type)
      this.dictMap[type] = data
      return data
    },
    async loadDicts(types: string[]): Promise<Record<string, DictData[]>> {
      await Promise.all(types.map((t) => this.loadDict(t)))
      return this.dictMap
    },
    label(type: string, value: string | number): string {
      const hit = this.getDict(type).find((d) => d.dictValue === String(value))
      return hit?.dictLabel ?? String(value ?? '')
    },
    tag(type: string, value: string | number): Option | undefined {
      const hit = this.getDict(type).find((d) => d.dictValue === String(value))
      if (!hit) return undefined
      return { label: hit.dictLabel, value: hit.dictValue, tag: hit.listClass }
    },
    setDict(type: string, data: DictData[]) {
      this.dictMap[type] = data
    },
    clearCache() {
      this.dictMap = {}
    }
  },
  persist: {
    key: 'wb-admin-dict',
    pick: ['dictMap']
  }
})
