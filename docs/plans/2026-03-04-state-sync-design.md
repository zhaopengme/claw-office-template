# Pixel Office × MobaiClaw 状态同步设计

> 日期: 2026-03-04
> 状态: 已确认

## 产品定位

个人 AI 助手面板。像素办公室 + 聊天 + 全功能控制台（渐进实现）。
视觉风格以像素风为主，场景可换皮肤。

## 核心原则

- **WS 是唯一通道**: 聊天和状态共用同一个 WebSocket 连接 (JSON-RPC 2.0)
- **状态层解耦**: StateStore 将 WS 数据转化为 UI 状态，场景/聊天/控制台都从 store 读取
- **场景可插拔**: 场景引擎通过 `SceneHandle` 接口读状态，不直接依赖 WS 或 Phaser
- **渐进增强**: V1 只做 Agent 工作状态 + 基础聊天，架构预留扩展点

## 整体架构

```
前端 (React + Phaser)
├── 场景引擎 (可换皮肤，实现 SceneHandle 接口)
├── 聊天面板 (基础)
├── 控制台 (后续: 状态/设置/多Agent)
├── StateStore (React Context + useReducer)
└── WS Client (单连接，按 method 路由分发)
    │
    │ WebSocket (JSON-RPC 2.0)
    │
后端 (mobaiclaw Go)
├── WS Gateway (notification 广播)
├── Agent Loop (状态事件触发)
└── Bus/Router (现有消息总线)
```

## 状态协议

### Notification Method 体系

| method             | 用途                   | V1 实现 |
|--------------------|------------------------|---------|
| `message.outbound` | Agent 聊天回复广播      | 已有    |
| `agent.state`      | Agent 工作状态变更      | V1      |
| `system.status`    | 系统级状态              | 后续    |
| `agent.list`       | 多 Agent 列表及状态     | 后续    |
| `memory.update`    | 记忆变更通知            | 后续    |

### `agent.state` 事件格式

```json
{
  "jsonrpc": "2.0",
  "method": "agent.state",
  "params": {
    "agent_id": "star",
    "state": "thinking",
    "detail": "calling tool: web_search",
    "timestamp": 1709568000
  }
}
```

### State 枚举值

| state      | 含义               | 场景动画映射     |
|------------|--------------------|------------------|
| `idle`     | 空闲               | 角色在沙发上休息 |
| `thinking` | 收到消息，开始处理 | 角色走向桌子     |
| `working`  | 调用工具/生成回复  | 角色在桌前打字   |
| `error`    | 处理出错           | Bug 弹跳动画     |

### 后端触发点

| 位置               | 发射状态                        |
|--------------------|---------------------------------|
| processMessage 入口 | `thinking`                      |
| callLLM 调用前      | `working` + "calling LLM"      |
| 工具执行前          | `working` + "calling tool: xxx" |
| 消息处理完成        | `idle`                          |
| 错误捕获            | `error` + 错误信息              |

## 后端改造

### 1. Agent Loop — emitState 方法

在 Agent Loop 关键节点通过 bus 发送状态消息，使用内部 channel `"__state"` 区分：

```go
func (a *AgentInstance) emitState(state, detail string) {
    payload, _ := json.Marshal(map[string]any{
        "agent_id":  a.ID,
        "state":     state,
        "detail":    detail,
        "timestamp": time.Now().Unix(),
    })
    a.bus.PublishOutbound(bus.OutboundMessage{
        Channel: "__state",
        Content: string(payload),
    })
}
```

### 2. WS Gateway — 状态广播 listener

新增 listener 监听 `__state` channel，广播为 `agent.state` notification：

```go
ol.AddOutboundListener("wsgateway-state", func(msg bus.OutboundMessage) {
    if msg.Channel != "__state" { return }
    // 解析 msg.Content 为 JSON, 广播为 agent.state notification
})
```

### 不改什么

- Bus 接口不变
- Handler (agent.send / agent.wait) 不变
- 其他通道 (Telegram, CLI) 不受影响

## 前端状态层

### StateStore (React Context + useReducer)

```typescript
interface AppState {
  wsStatus: 'connecting' | 'connected' | 'disconnected'
  agentState: { state: string; detail: string }
  messages: ChatMessage[]
  sending: boolean
}
```

### 组件结构

```
src/
├── store/index.ts         — StateStore context + provider + hooks
├── hooks/useWebSocket.ts  — WS 连接 (method 路由分发到 store)
├── game/PhaserGame.tsx    — 不变
├── game/OfficeScene.ts    — 从 store 读 agentState 驱动动画
├── components/ChatPanel.tsx — 从 store 读 messages
├── components/StatusBar.tsx — 不变
└── config/types.ts        — 增加 ws 配置
```

### 场景引擎接口

```typescript
interface SceneHandle {
  changeState(state: string): void
  updateTitle(title: string): void
}
```

任何新场景只需实现此接口即可替换 Phaser 场景。

### WS 地址配置化

在 `office.config.json` 中新增：

```json
{
  "ws": {
    "url": "ws://localhost:18791/ws",
    "token": ""
  }
}
```

## V1 实施范围

| 层     | 内容                              | 改动量   |
|--------|-----------------------------------|----------|
| 后端   | emitState 方法 + 5 个触发点       | ~40 行   |
| 后端   | WS Gateway 状态广播 listener      | ~15 行   |
| 后端   | CORS 放开 localhost:5173          | 已完成   |
| 前端   | StateStore (Context + Reducer)    | ~80 行   |
| 前端   | useWebSocket 改造 (method 路由)   | ~30 行   |
| 前端   | 场景自动跟随 agentState           | ~10 行   |
| 前端   | WS 地址放入 config.json           | ~5 行    |

## V1 不做

- 多 Agent 切换
- system.status / memory.update
- 流式输出
- 聊天 UI 美化 (Markdown 渲染)
- 场景换肤机制 (架构预留但不实现)

## 验证方式

1. 启动 mobaiclaw gateway
2. 启动前端 dev server
3. 发送聊天消息
4. 验证: 角色动画跟随 Agent 状态 (idle → thinking → working → idle)
5. 验证: 出错时显示 error 动画
6. 验证: 断开 WS → 自动重连 → 状态恢复
