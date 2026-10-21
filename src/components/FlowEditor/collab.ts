import type { FlowGraph } from '@/types'

/**
 * 协同编辑（E8）的**前端部分**。
 *
 * 没有协同服务端时不做假实时同步，只做两件真有用的事：
 * 1. **在线提示**：同一浏览器的多个标签页通过 BroadcastChannel 互相知道「谁在编辑」；
 * 2. **编辑锁**：先点「开始编辑」的人拿锁，其他人看到「XX 正在编辑」并不允许提交。
 *
 * 有 WebSocket 服务端时把 `transport` 换成 socket 即可，接口不变。
 * 这个文件只被动态 import：`features.collab` 关闭时不进包。
 */

export interface CollabPeer {
  id: string
  name: string
  /** 是否正在编辑（持有锁） */
  editing: boolean
  at: number
}

export interface CollabOptions {
  flowId: string
  userName: string
  /** 收到别人的图（服务端推或广播） */
  onRemoteChange?: (graph: FlowGraph) => void
  onPeers?: (peers: CollabPeer[]) => void
}

export interface CollabHandle {
  peers: () => CollabPeer[]
  /** 广播自己的图（本地多标签页演示用） */
  publish: (graph: FlowGraph) => void
  /** 申请编辑锁，返回是否拿到 */
  acquire: () => boolean
  release: () => void
  lockedBy: () => CollabPeer | null
  destroy: () => void
}

const CHANNEL_PREFIX = 'wb-admin:flow-collab:'
const HEARTBEAT = 3000
const PEER_TIMEOUT = 9000

export function createCollab(opts: CollabOptions): CollabHandle {
  const self: CollabPeer = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: opts.userName || '匿名',
    editing: false,
    at: Date.now()
  }
  const peers = new Map<string, CollabPeer>()
  let channel: BroadcastChannel | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_PREFIX + opts.flowId)
      channel.onmessage = (e) => {
        const msg = e.data as { type: string; peer?: CollabPeer; graph?: FlowGraph }
        if (msg.type === 'hello' || msg.type === 'beat') {
          if (msg.peer && msg.peer.id !== self.id)
            peers.set(msg.peer.id, { ...msg.peer, at: Date.now() })
          emitPeers()
        } else if (msg.type === 'graph' && msg.graph) {
          opts.onRemoteChange?.(msg.graph)
        } else if (msg.type === 'leave' && msg.peer) {
          peers.delete(msg.peer.id)
          emitPeers()
        }
      }
    }
  } catch {
    channel = null
  }

  function post(msg: Record<string, unknown>): void {
    try {
      channel?.postMessage(msg)
    } catch {
      /* ignore */
    }
  }

  function emitPeers(): void {
    const now = Date.now()
    // 超时未心跳的视为已离开
    peers.forEach((p, id) => {
      if (now - p.at > PEER_TIMEOUT) peers.delete(id)
    })
    opts.onPeers?.([self, ...peers.values()])
  }

  function lockedBy(): CollabPeer | null {
    const holder = [...peers.values()].find((p) => p.editing && p.at > Date.now() - PEER_TIMEOUT)
    return holder || null
  }

  function beat(): void {
    self.at = Date.now()
    post({ type: 'beat', peer: { ...self } })
    emitPeers()
  }

  post({ type: 'hello', peer: { ...self } })
  timer = setInterval(beat, HEARTBEAT)

  return {
    peers: () => [self, ...peers.values()],
    publish: (graph) => post({ type: 'graph', graph }),
    acquire: () => {
      if (lockedBy()) return false
      self.editing = true
      beat()
      return true
    },
    release: () => {
      self.editing = false
      beat()
    },
    lockedBy,
    destroy: () => {
      if (timer) clearInterval(timer)
      post({ type: 'leave', peer: { ...self } })
      try {
        channel?.close()
      } catch {
        /* ignore */
      }
      channel = null
    }
  }
}
