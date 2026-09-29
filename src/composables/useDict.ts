import { computed, onMounted, ref, watch } from 'vue'
import { useDictStore } from '@/stores/modules/dict'
import type { DictData, Option } from '@/types'

/** 组合式字典：自动加载 + 响应式 options */
export function useDict(...types: string[]) {
  const store = useDictStore()

  const map = ref<Record<string, DictData[]>>({})

  async function load(): Promise<void> {
    if (!types.length) return
    await store.loadDicts(types)
    map.value = { ...store.dictMap }
  }

  function options(type: string): Option[] {
    return store.getOptions(type)
  }

  function label(type: string, value: string | number): string {
    return store.label(type, value)
  }

  const loaded = computed(() => types.every((t) => Boolean(map.value[t]?.length)))

  onMounted(load)
  watch(() => types.join(','), load)

  return { map, options, label, loaded, reload: load, clear: () => store.clearCache() }
}

export default useDict
