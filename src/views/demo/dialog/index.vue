<script setup lang="ts">
defineOptions({ name: 'DemoDialog' })

import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ProDialog from '@/components/ProDialog.vue'
import { configureDialog, dialogDefaults, useDialogConfig } from '@/config/dialog'

const cfg = useDialogConfig()

/**
 * 单个弹窗的能力开关。
 * 四项能力都直接绑到 ProDialog 的 props 上，改动**立即生效**，不需要重开弹窗。
 */
const flags = reactive({
  draggable: true,
  dragOverflow: false,
  fullscreenable: true,
  maximizable: true,
  minimizable: true,
  stackable: true
})
const headerActions = ref(true)

const basicVisible = ref(false)
const demoName = ref('')
type OpenMode = 'normal' | 'maximized' | 'minimized' | 'fullscreen'
const openMode = ref<OpenMode>('normal')

function open(mode: OpenMode = 'normal'): void {
  openMode.value = mode
  basicVisible.value = true
}

function onConfirm(): void {
  ElMessage.success('已确认')
  basicVisible.value = false
}

/** 一键把所有能力恢复成开启 */
function resetFlags(): void {
  flags.draggable = true
  flags.dragOverflow = false
  flags.fullscreenable = true
  flags.maximizable = true
  flags.minimizable = true
  flags.stackable = true
  headerActions.value = true
}

/** ---------- 多弹窗：三个独立的弹窗，各自有自己的 v-model ---------- */
const aVisible = ref(false)
const bVisible = ref(false)
const cVisible = ref(false)
/** 勾上就显式传 :modal="true"，用来演示「单个弹窗的配置会盖掉全局 / 自动规则」 */
const forceModal = ref(false)

function openAll(): void {
  aVisible.value = true
  bVisible.value = true
  cVisible.value = true
}

/** ---------- 嵌套：父弹窗里再开一个子弹窗 ---------- */
const parentVisible = ref(false)
const childVisible = ref(false)

/** ---------- 全局默认配置 ---------- */
const snapshot = {
  headerActions: dialogDefaults.headerActions,
  draggable: dialogDefaults.draggable
}
const globalActions = ref(snapshot.headerActions)
const globalDraggable = ref(snapshot.draggable)

function applyGlobal(): void {
  configureDialog({
    headerActions: globalActions.value,
    draggable: globalDraggable.value
  })
  ElMessage.success('全局默认已更新')
}

function restoreGlobal(): void {
  configureDialog({ ...snapshot })
  globalActions.value = snapshot.headerActions
  globalDraggable.value = snapshot.draggable
}

/** 全局配置是模块级单例，离开本页要还原，免得影响其它页面 */
onBeforeUnmount(restoreGlobal)

/** 为了让「当前生效值」跟着开关实时变化 */
const globalSummary = computed(
  () =>
    `headerActions=${cfg.headerActions} / draggable=${cfg.draggable} / cascadeStep=${cfg.cascadeStep}`
)
</script>

<template>
  <div class="wb-page wb-demo-dialog">
    <el-alert type="info" show-icon :closable="false" class="wb-mb12">
      <div class="wb-demo-dialog__tip">
        <div>
          弹窗新增四项能力：
          <b>全屏展示</b>
          、
          <b>标题栏拖动</b>
          、
          <b>多个弹窗同时出现</b>
          、
          <b>最大化 / 最小化</b>
          。
        </div>
        <div>
          每一项都能配：
          <b>全局默认</b>
          （
          <code>src/config/dialog.ts</code>
          ）→
          <b>单个弹窗的 props</b>
          → 运行时的用户操作，后者优先。
        </div>
        <div>下表所有开关直接绑在 props 上，拨动后立即生效，不用重开弹窗。</div>
      </div>
    </el-alert>

    <!-- ============ 单个弹窗 · 能力开关 ============ -->
    <div class="wb-card">
      <div class="wb-demo-dialog__title">单个弹窗 · 能力开关</div>

      <div class="wb-demo-dialog__row">
        <el-checkbox v-model="flags.draggable">可拖动</el-checkbox>
        <el-checkbox v-model="flags.dragOverflow">拖动可超出视口</el-checkbox>
        <el-checkbox v-model="flags.fullscreenable">可全屏</el-checkbox>
        <el-checkbox v-model="flags.maximizable">可最大化</el-checkbox>
        <el-checkbox v-model="flags.minimizable">可最小化</el-checkbox>
        <el-checkbox v-model="flags.stackable">可多弹窗共存</el-checkbox>
        <el-checkbox v-model="headerActions">显示操作区</el-checkbox>
      </div>
      <div class="wb-text-muted wb-demo-dialog__hint">
        默认拖不出视口（四条边都被夹住）。这个弹窗比视口矮不了多少，所以纵向只能挪一点点；
        勾上「拖动可超出视口」就能随便拖了。
      </div>

      <div class="wb-demo-dialog__row">
        <el-button type="primary" @click="open('normal')">按上面配置打开</el-button>
        <el-button @click="open('fullscreen')">打开即全屏</el-button>
        <el-button @click="open('maximized')">打开即最大化</el-button>
        <el-button @click="open('minimized')">打开即最小化</el-button>
      </div>

      <div class="wb-demo-dialog__row">
        <span class="wb-text-muted">一键对照：</span>
        <el-button link type="primary" @click="flags.draggable = false">关掉拖动</el-button>
        <el-button link type="primary" @click="flags.maximizable = false">关掉最大化</el-button>
        <el-button link type="primary" @click="flags.minimizable = false">关掉最小化</el-button>
        <el-button link type="primary" @click="headerActions = false">
          关掉整个操作区（回到原生表头）
        </el-button>
        <el-button link type="primary" @click="resetFlags">全部还原</el-button>
      </div>
    </div>

    <!-- ============ 多弹窗 ============ -->
    <div class="wb-card">
      <div class="wb-demo-dialog__title">多个弹窗 · 同时出现</div>
      <div class="wb-demo-dialog__row">
        <el-button type="primary" @click="aVisible = true">打开弹窗 A</el-button>
        <el-button type="primary" @click="bVisible = true">打开弹窗 B</el-button>
        <el-button type="primary" @click="cVisible = true">打开弹窗 C</el-button>
        <el-button type="success" @click="openAll">三个一起打开</el-button>
        <el-checkbox v-model="forceModal">强制保留遮罩（:modal="true"）</el-checkbox>
      </div>
      <div class="wb-text-muted wb-demo-dialog__hint">
        同时打开多个时会自动撤掉遮罩、向右下错位排列，点哪个哪个到最前；只开一个时遮罩照旧。
        「强制保留遮罩」用来演示单个弹窗的配置能盖掉这套自动规则。
      </div>

      <div class="wb-demo-dialog__row">
        <el-button @click="parentVisible = true">打开父弹窗</el-button>
        <span class="wb-text-muted">父弹窗里再开一个子弹窗，验证嵌套（append-to-body）</span>
      </div>
    </div>

    <!-- ============ 全局默认 ============ -->
    <div class="wb-card">
      <div class="wb-demo-dialog__title">全局默认配置</div>
      <div class="wb-demo-dialog__row">
        <el-checkbox v-model="globalActions">所有弹窗显示操作区</el-checkbox>
        <el-checkbox v-model="globalDraggable">所有弹窗可拖动</el-checkbox>
        <el-button type="primary" @click="applyGlobal">应用到全局</el-button>
        <el-button @click="restoreGlobal">恢复默认</el-button>
      </div>
      <div class="wb-text-muted wb-demo-dialog__hint">
        全局默认写在
        <code>src/config/dialog.ts</code>
        ，也可以在
        <code>main.ts</code>
        里用
        <code>configureDialog()</code>
        一次性设定。当前生效值：
        <code>{{ globalSummary }}</code>
      </div>
    </div>

    <!-- ============ 弹窗实例 ============ -->
    <ProDialog
      v-model="basicVisible"
      title="能力开关演示"
      width="720px"
      :draggable="flags.draggable"
      :overflow="flags.dragOverflow"
      :fullscreenable="flags.fullscreenable"
      :maximizable="flags.maximizable"
      :minimizable="flags.minimizable"
      :stackable="flags.stackable"
      :header-actions="headerActions"
      :default-maximized="openMode === 'maximized'"
      :default-minimized="openMode === 'minimized'"
      :fullscreen="openMode === 'fullscreen'"
      @confirm="onConfirm"
    >
      <el-form label-width="100px">
        <el-form-item label="弹窗名称">
          <el-input v-model="demoName" placeholder="随便填" />
        </el-form-item>
        <el-form-item label="拖动">
          <el-input placeholder="按住标题栏拖动试试" />
        </el-form-item>
        <el-form-item label="全屏">
          <el-input placeholder="点右上角全屏按钮" />
        </el-form-item>
        <el-form-item label="最大化">
          <el-input placeholder="点右上角最大化按钮" />
        </el-form-item>
        <el-form-item label="最小化">
          <el-input placeholder="点右上角最小化按钮，会收到右下角" />
        </el-form-item>
        <el-form-item label="多弹窗">
          <el-input placeholder="和别的弹窗一起打开时会自动错位" />
        </el-form-item>
      </el-form>
      <div class="wb-text-muted wb-demo-dialog__hint">
        这段说明用来撑出滚动：切到全屏或最大化，可以看到表头与底部按钮钉住不动，只有正文滚动。
      </div>
      <div class="wb-demo-dialog__filler">
        <p v-for="n in 30" :key="n">
          第 {{ n }} 行占位内容 —— 用来把正文撑得比视口还高，这样切换全屏 /
          最大化时才能验证「正文内部滚动、表头与底部按钮钉住不动」。
        </p>
      </div>
    </ProDialog>

    <ProDialog
      v-model="aVisible"
      title="弹窗 A"
      width="560px"
      :modal="forceModal ? true : undefined"
      @confirm="aVisible = false"
    >
      <p>我是 A。再点开 B 和 C，三个会向右下错位排列，都能看见。</p>
      <p class="wb-text-muted">点任意一个弹窗，它会自动跳到最前。</p>
    </ProDialog>

    <ProDialog
      v-model="bVisible"
      title="弹窗 B"
      width="560px"
      :modal="forceModal ? true : undefined"
      @confirm="bVisible = false"
    >
      <p>我是 B。</p>
      <el-button @click="cVisible = true">顺手把 C 也打开</el-button>
    </ProDialog>

    <ProDialog
      v-model="cVisible"
      title="弹窗 C"
      width="560px"
      :modal="forceModal ? true : undefined"
      @confirm="cVisible = false"
    >
      <p>我是 C。三个都在的时候，试试把其中一个最小化——它会收成一条横条钉在右下角。</p>
    </ProDialog>

    <ProDialog
      v-model="parentVisible"
      title="父弹窗"
      width="600px"
      confirm-text="关闭"
      @confirm="parentVisible = false"
    >
      <p>我是父弹窗。</p>
      <el-button type="primary" @click="childVisible = true">打开子弹窗</el-button>
      <p class="wb-text-muted">子弹窗挂到 body 上，父弹窗仍然在下面；父弹窗里还能继续开更多层。</p>
    </ProDialog>

    <ProDialog v-model="childVisible" title="子弹窗" width="480px" @confirm="childVisible = false">
      <p>我是嵌套打开的子弹窗。</p>
    </ProDialog>
  </div>
</template>

<style scoped lang="scss">
.wb-demo-dialog {
  &__tip {
    font-size: 13px;
    line-height: 1.9;
  }

  &__title {
    margin-bottom: 12px;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__hint {
    display: block;
    font-size: 13px;
    line-height: 1.8;
    margin-bottom: 12px;
  }

  &__filler {
    font-size: 13px;
    line-height: 1.8;
    color: var(--el-text-color-secondary);

    p {
      margin: 0;
    }
  }
}
</style>
