<script setup lang="ts">
defineOptions({ name: 'DeviceTree' })

import { computed, nextTick, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Search, Star, StarFilled } from '@element-plus/icons-vue'
import { useDeviceTree, DEVICE_STATUS_META, type DeviceTreeNode } from './useDeviceTree'
import { useDevicePreference } from '@/composables/useDevicePreference'
import { useI18n } from 'vue-i18n'
import type { DeviceArea, DeviceStatus } from '@/types'

interface Props {
  /** 区域树数据（父 = 区域，子 = 设备） */
  areas: DeviceArea[]
  loading?: boolean
  /** 是否由组件接管排序（关闭则用后端顺序） */
  sortable?: boolean
  /**
   * 区域内是否再按首字符插一层分组节点。
   * 默认关闭：分组会把收藏项关进各自的分组里，打断「收藏置顶」的观感，
   * 只有在设备量特别大、需要靠分组折叠时才打开。
   */
  groupByInitial?: boolean
  showToolbar?: boolean
  defaultExpandAll?: boolean
  /** 固定高度（传值则树内部滚动） */
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  areas: () => [],
  loading: false,
  sortable: true,
  groupByInitial: false,
  showToolbar: true,
  defaultExpandAll: true,
  height: ''
})

const emit = defineEmits<{
  (e: 'favorite-change', payload: { id: string; favorited: boolean }): void
  (e: 'device-click', payload: DeviceTreeNode): void
}>()

const { t } = useI18n()

/** 偏好数据按登录人隔离，当前走 localStorage */
const preference = useDevicePreference()

/* ---------- 工具条状态 ---------- */
const keyword = ref('')
const onlyFavorite = ref(false)

const { treeData, deviceIndex, deviceCount, favoriteCount, missingCount } = useDeviceTree({
  areas: () => props.areas,
  sortable: () => props.sortable,
  groupByInitial: () => props.groupByInitial,
  favoriteIds: preference.favoriteIds,
  favoriteRecords: preference.favorites,
  onlyFavorite
})

const treeRef = ref<any>(null)
const treeProps = { label: 'name', children: 'children' }

/* ---------- 展开态托管 ---------- */
/**
 * 为什么不能只用 default-expand-all：
 * treeData 是 computed，收藏一改就返回**新数组引用**，而 el-tree 的 store.setData 是
 * `if (newVal !== this.root.data)` 的引用比较 → 命中「整棵树重建」分支，nodesMap 清空、
 * 所有 Node 重新构造，节点上那个 `expanded` 随旧对象一起被丢掉，只能回到 defaultExpandAll 的初始值。
 * 表现就是：手动折叠了区域，点一下收藏，折叠全部被重置为展开。
 *
 * 所以把「哪些节点是展开的」这份状态挪到外面自己拿着：重建时 Element Plus 会按
 * default-expanded-keys 在 Node.initialize 里逐个 `expand()`，折叠过的 key 不在列表里，自然保持折叠。
 */
const expandedKeys = ref<string[]>([])
/** 已经见过的容器节点 key：用来区分「新增区域」和「用户主动折叠的区域」 */
const knownContainerKeys = new Set<string>()

watch(
  treeData,
  (list) => {
    const containers: string[] = []
    const collect = (nodes: DeviceTreeNode[]) => {
      nodes.forEach((n) => {
        // 叶子设备没有可展开的内容，不进这份清单
        if (n.children?.length) {
          containers.push(n.key)
          collect(n.children)
        }
      })
    }
    collect(list)

    const alive = new Set(containers)
    // 首次进入（或后端新增区域）按 defaultExpandAll 的语义默认展开；
    // 用户手动折叠过的 key 从未被删除记忆，不会被这里重新捡回来
    const fresh = props.defaultExpandAll ? containers.filter((k) => !knownContainerKeys.has(k)) : []
    containers.forEach((k) => knownContainerKeys.add(k))

    // 只保留仍然存在的节点：区域被删 / 搜索切走时不留下无效 key
    expandedKeys.value = [...new Set([...expandedKeys.value.filter((k) => alive.has(k)), ...fresh])]
  },
  { immediate: true }
)

function onNodeExpand(data: DeviceTreeNode): void {
  if (expandedKeys.value.includes(data.key)) return
  expandedKeys.value = [...expandedKeys.value, data.key]
}

function onNodeCollapse(data: DeviceTreeNode): void {
  expandedKeys.value = expandedKeys.value.filter((k) => k !== data.key)
}

/**
 * 搜索沿用 el-tree 内置的 filter 机制，而不是自己裁剪 treeData。
 *
 * 原因：filter() 把节点标记为 visible 之后，会对「可见且有子节点」的节点自动调用 expand()，
 * 也就是免费拿到了「搜索命中时父链自动展开」的行为；
 * 自己裁剪数据的话，还得额外维护一次展开态，且很难做对。
 */
function filterNode(value: any, node: any): boolean {
  const data = node as DeviceTreeNode
  const kw = String(value ?? '')
    .trim()
    .toLowerCase()
  if (!kw) return true

  if (data.type === 'device') {
    const hitName = String(data.name ?? '')
      .toLowerCase()
      .includes(kw)
    const category = String((data.device as Record<string, any> | undefined)?.category ?? '')
    return hitName || category.toLowerCase().includes(kw)
  }
  // 容器节点：自身命中、或任意后代命中（后代命中时 el-tree 会把父标记为 visible）
  if (
    String(data.name ?? '')
      .toLowerCase()
      .includes(kw)
  )
    return true
  return (data.children ?? []).some((child) => matchDeep(child, kw))
}

function matchDeep(node: DeviceTreeNode, kw: string): boolean {
  return filterNode(kw, node)
}

// onlyFavorite 也会改变树的内容，变化时同样要重跑一次 filter
watch([keyword, onlyFavorite], () => {
  nextTick(() => treeRef.value?.filter?.(keyword.value))
})

function deviceId(node: DeviceTreeNode): string {
  return String(node.device?.id ?? node.key ?? '')
}

function isFavorited(node: DeviceTreeNode): boolean {
  return preference.isFavorite(deviceId(node))
}

function toggleFavorite(node: DeviceTreeNode): void {
  const id = deviceId(node)
  // toggle 返回的是「操作是否生效」，不是操作后的收藏状态——
  // 状态要单独查一次，别把成功标志当成是否已收藏发出去
  preference.toggle({ id, name: node.name, areaId: node.areaId })
  emit('favorite-change', { id, favorited: preference.isFavorite(id) })
}

function onRowClick(node: DeviceTreeNode): void {
  if (node.type !== 'device') return
  emit('device-click', node)
}

async function clearMissing(): Promise<void> {
  if (!missingCount.value) return
  try {
    await ElMessageBox.confirm(
      t('device.clearMissingTip', { n: missingCount.value }),
      t('common.tip'),
      {
        type: 'warning',
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel')
      }
    )
  } catch {
    return
  }
  // prune 按「当前真实存在的设备」重算，失效项一次性清掉
  preference.prune(deviceIndex.value.keys())
  preference.flush()
}

const statusColor = (status?: DeviceStatus) =>
  DEVICE_STATUS_META[status ?? 'offline']?.cssVar ?? 'var(--el-color-info)'
const statusLabel = (status?: DeviceStatus) => {
  const meta = status ? DEVICE_STATUS_META[status] : undefined
  return meta ? t(meta.i18nKey) : ''
}
/** `#` 桶显示成「其它」，不要让用户看见一个井号 */
const groupLabel = (letter?: string) => (letter === '#' ? t('device.initialOther') : letter)

const summaryText = computed(() =>
  t('device.summary', { total: deviceCount.value, fav: favoriteCount.value })
)

defineExpose({ treeRef, treeData, keyword })
</script>

<template>
  <div v-loading="loading" class="wb-device-tree">
    <div v-if="showToolbar" class="wb-device-tree__toolbar">
      <el-input
        v-model="keyword"
        :placeholder="t('device.searchPlaceholder')"
        clearable
        size="small"
        class="wb-device-tree__search"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-checkbox v-model="onlyFavorite" size="small">{{ t('device.onlyFavorite') }}</el-checkbox>

      <span class="wb-device-tree__rule">{{ t('device.sortRule') }}</span>
      <span class="wb-device-tree__summary">{{ summaryText }}</span>
    </div>

    <div v-if="missingCount" class="wb-device-tree__missing">
      <span>{{ t('device.missingCount', { n: missingCount }) }}</span>
      <el-button link type="primary" size="small" @click="clearMissing">
        {{ t('device.clearMissing') }}
      </el-button>
    </div>

    <el-tree
      ref="treeRef"
      :data="treeData"
      node-key="key"
      :props="treeProps"
      :default-expanded-keys="expandedKeys"
      :expand-on-click-node="false"
      :filter-node-method="filterNode"
      :empty-text="t('device.empty')"
      :height="height || undefined"
      highlight-current
      @node-expand="onNodeExpand"
      @node-collapse="onNodeCollapse"
    >
      <template #default="{ data }">
        <div class="wb-device-tree__row" @click="onRowClick(data as DeviceTreeNode)">
          <!-- 区域节点 -->
          <template v-if="data.type === 'area'">
            <span class="wb-device-tree__name wb-device-tree__name--strong">{{ data.name }}</span>
            <span class="wb-device-tree__count">{{ data.total ?? 0 }}</span>
          </template>

          <!-- 首字符分组 -->
          <template v-else-if="data.type === 'initial-group'">
            <span class="wb-device-tree__letter">{{ groupLabel(data.initial) }}</span>
            <span class="wb-device-tree__count">{{ data.total ?? 0 }}</span>
          </template>

          <!-- 设备叶子 -->
          <template v-else>
            <span
              class="wb-device-tree__dot"
              :style="{ background: statusColor(data.status) }"
              :title="statusLabel(data.status)"
            />
            <span class="wb-device-tree__name" :class="{ 'is-missing': data.missing }">
              {{ data.name }}
            </span>
            <el-tag v-if="data.missing" size="small" type="info" effect="plain" round>
              {{ t('device.missing') }}
            </el-tag>
            <span v-else class="wb-device-tree__status">{{ statusLabel(data.status) }}</span>

            <el-tooltip
              :content="
                isFavorited(data as DeviceTreeNode) ? t('device.unfavorite') : t('device.favorite')
              "
              placement="top"
            >
              <el-icon
                class="wb-device-tree__star"
                :class="{ 'is-active': isFavorited(data as DeviceTreeNode) }"
                @click.stop="toggleFavorite(data as DeviceTreeNode)"
              >
                <StarFilled v-if="isFavorited(data as DeviceTreeNode)" />
                <Star v-else />
              </el-icon>
            </el-tooltip>
          </template>
        </div>
      </template>
    </el-tree>

    <div v-if="!treeData.length" class="wb-device-tree__empty">{{ t('device.empty') }}</div>
  </div>
</template>

<style scoped lang="scss">
.wb-device-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  &__search {
    width: 220px;
  }

  &__rule {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__summary {
    margin-left: auto;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__missing {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    font-size: 12px;
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
    border-radius: 4px;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
    padding-right: 8px;
  }

  &__name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    &--strong {
      font-weight: 600;
    }

    &.is-missing {
      color: var(--el-text-color-disabled);
      text-decoration: line-through;
    }
  }

  &__dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  &__status {
    flex: none;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__count {
    flex: none;
    margin-left: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__letter {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 22px;
    height: 22px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border-radius: 4px;
  }

  &__star {
    flex: none;
    margin-left: auto;
    cursor: pointer;
    color: var(--el-text-color-placeholder);
    /* 未收藏时藏起来、hover 行才出现；已收藏的常驻，否则用户找不到怎么取消 */
    opacity: 0;
    transition:
      opacity 0.15s,
      color 0.15s;

    /* 收藏标识高亮：常驻金色 + 轻微外发光，一眼能认出自己标记过的设备 */
    &.is-active {
      color: var(--el-color-warning);
      opacity: 1;
      filter: drop-shadow(0 0 2px var(--el-color-warning-light-5));
    }
  }

  :deep(.el-tree-node__content) {
    height: 32px;

    &:hover .wb-device-tree__star {
      opacity: 1;
    }
  }

  &__empty {
    padding: 24px 0;
    text-align: center;
    color: var(--el-text-color-secondary);
  }
}
</style>
