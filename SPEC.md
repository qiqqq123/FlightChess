# 飞行棋联机版 - 项目规范

## 1. 项目概述

**项目名称**: 飞行棋联机版 (Ludo Online)
**项目类型**: 实时多人在线网页游戏
**核心功能**: 支持情侣双人私密模式/好友2-4人多人模式的全平台联机飞行棋游戏
**目标用户**: 休闲游戏玩家、家庭、情侣、朋友聚会

## 2. 技术架构

### 前端
- **核心**: HTML5 + Canvas 2D
- **样式**: Tailwind CSS (CDN)
- **通信**: Socket.io Client
- **适配**: 响应式设计，支持手机+PC浏览器+微信内置浏览器

### 后端
- **运行时**: Node.js 18+
- **框架**: Express.js
- **实时通信**: Socket.io
- **存储**: 内存存储 (房间数据) + JSON文件 (任务包)

### 目录结构
```
/workspace/
├── server/
│   ├── index.js          # 服务端入口
│   ├── game.js           # 游戏核心逻辑
│   ├── room.js           # 房间管理
│   ├── tasks.js          # 任务系统
│   └── utils.js          # 工具函数
├── public/
│   ├── index.html        # 主页面
│   ├── css/
│   │   └── style.css     # 自定义样式
│   ├── js/
│   │   ├── app.js        # 应用入口
│   │   ├── game.js       # 游戏逻辑
│   │   ├── board.js      # 棋盘渲染
│   │   ├── socket.js     # Socket通信
│   │   ├── task.js       # 任务系统
│   │   └── editor.js     # 任务包编辑器
│   └── assets/
│       └── icons/        # 棋子图标
├── package.json
└── SPEC.md
```

## 3. 游戏规则

### 飞行棋棋盘
- 4个玩家阵营: 红(下方)、蓝(左侧)、黄(上方)、绿(右侧)
- 每个阵营: 1个大本营(起点) + 4个飞机
- 中央区域: 4条安全航线
- 总格子数: 52个外圈格子 + 16个终点跑道

### 游戏流程
1. 玩家投掷骰子(1-6)
2. 根据点数移动飞机
3. 落在任务格触发任务
4. 任务完成后继续投掷
5. 全部4架飞机到达终点获胜

### 飞行棋规则
- 起点投6可以起飞(首次)或移动6格
- 投到6可以额外投一次
- 对方格子有对方飞机则吃掉(送回大本营)
- 安全格(起点/特定格)不吃子
- 4架飞机全部到达终点获胜

## 4. 功能模块

### 4.1 房间系统
- **创建房间**: 生成6位房间码
- **加入房间**: 输入房间码加入
- **私密模式**: 情侣双人(2人)密码保护
- **多人模式**: 2-4人自由加入
- **断线重连**: 30秒内重新连接恢复游戏状态

### 4.2 短码分享
- 8位短码格式: `XXXX-XXXX`
- 短码包含: 房间信息 + 游戏配置
- 在线分享功能

### 4.3 任务系统
- **任务类型**:
  - 问答任务(选择题)
  - 动作任务(做指定动作)
  - 挑战任务(与对手互动)
  - 运气任务(随机结果)
- **任务触发**: 除起点外每个格子有专属任务
- **任务完成**: 答对/完成动作继续游戏
- **任务失败**: 停一回合

### 4.4 任务包管理
- **可视化编辑器**: 网页端编辑任务
- **JSON导入/导出**: 支持文件方式分享
- **内置默认任务包**: 提供默认任务

### 4.5 内容风控
- 敏感词过滤
- 任务内容审核
- 异常行为检测

## 5. Socket.io 事件定义

### 客户端 → 服务端
| 事件名 | 描述 | 数据格式 |
|--------|------|----------|
| `create_room` | 创建房间 | `{mode, playerName, password?}` |
| `join_room` | 加入房间 | `{roomCode, playerName, password?}` |
| `roll_dice` | 投骰子 | `{}` |
| `move_piece` | 移动棋子 | `{pieceIndex}` |
| `task_answer` | 任务回答 | `{answer}` |
| `task_action` | 任务动作 | `{actionDone}` |
| `reconnect` | 断线重连 | `{playerId, roomCode}` |
| `chat_message` | 聊天消息 | `{message}` |

### 服务端 → 客户端
| 事件名 | 描述 | 数据格式 |
|--------|------|----------|
| `room_created` | 房间已创建 | `{roomCode, playerId}` |
| `room_joined` | 加入成功 | `{room, playerId}` |
| `player_joined` | 玩家加入 | `{player}` |
| `game_start` | 游戏开始 | `{gameState}` |
| `dice_result` | 骰子结果 | `{value, playerId}` |
| `piece_moved` | 棋子移动 | `{playerId, pieceIndex, position}` |
| `task_triggered` | 任务触发 | `{task, position}` |
| `task_result` | 任务结果 | `{success, newPosition}` |
| `piece_eaten` | 棋子被吃 | `{playerId, pieceIndex}` |
| `turn_change` | 回合切换 | `{currentPlayerId}` |
| `game_over` | 游戏结束 | `{winnerId}` |
| `error` | 错误信息 | `{code, message}` |

## 6. UI/UX 设计

### 6.1 页面结构
1. **首页**: 模式选择(双人/多人)、创建/加入房间
2. **等待室**: 房间信息、玩家列表、开始游戏
3. **游戏室**: 棋盘、骰子、玩家状态、任务弹窗
4. **任务编辑器**: 任务包列表、任务编辑表单

### 6.2 配色方案
| 用途 | 颜色 |
|------|------|
| 红色阵营 | `#E53935` |
| 蓝色阵营 | `#1E88E5` |
| 黄色阵营 | `#FDD835` |
| 绿色阵营 | `#43A047` |
| 背景色 | `#1a1a2e` |
| 棋盘底色 | `#16213e` |
| 任务格 | `#0f3460` |
| 安全格 | `#533483` |

### 6.3 响应式断点
- 移动端: `< 768px`
- 平板端: `768px - 1024px`
- 桌面端: `> 1024px`

## 7. 安全机制

### 7.1 断线重连
- 心跳检测: 30秒间隔
- 断线后30秒内重连自动恢复
- 重连超时后标记离线状态

### 7.2 内容风控
- 敏感词库过滤
- 任务内容长度限制(100字)
- 聊天消息长度限制(50字)

### 7.3 异常降级
- 服务端异常: 返回错误码，客户端提示
- 网络断开: 自动重连机制
- 游戏状态同步: 服务端为权威来源

## 8. 数据模型

### 房间数据
```javascript
{
  code: "ABC123",
  mode: "couple" | "multi",
  password: string | null,
  players: [{
    id: string,
    name: string,
    color: string,
    pieces: [position, ...],
    finished: number,
    isOnline: boolean
  }],
  currentTurn: playerId,
  gameState: "waiting" | "playing" | "finished",
  taskPackage: TaskPackage,
  diceValue: number | null,
  taskPending: Task | null,
  winner: playerId | null
}
```

### 任务包格式
```javascript
{
  id: string,
  name: string,
  author: string,
  tasks: [{
    position: number,
    type: "question" | "action" | "challenge" | "luck",
    content: string,
    options?: string[],
    answer?: number,
    actionRequired?: string,
    timeLimit?: number
  }]
}
```

## 9. 短码格式

8位短码结构: `XXXX-XXXX`
- 前4位: 房间码Base62编码
- 后4位: 校验码 + 版本号

短码解码后包含:
```javascript
{
  roomCode: string,
  taskPackageId?: string,
  version: number
}
```

## 10. 验收标准

1. ✅ 支持2人私密模式和2-4人多人模式
2. ✅ 每个格子触发专属任务(除起点)
3. ✅ 任务包可视化编辑
4. ✅ JSON导入/导出功能
5. ✅ 8位短码分享
6. ✅ WebSocket实时联机
7. ✅ 断线重连机制
8. ✅ 移动端/PC端/微信浏览器适配
9. ✅ 内容风控与异常处理
