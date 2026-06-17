const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3000;

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json({ limit: '1mb' }));

// 引入模块
const roomModule = require('./room');
const gameModule = require('./game');
const taskModule = require('./tasks');
const { deepClone, filterSensitiveWords } = require('./utils');

// Socket.io 连接处理
io.on('connection', (socket) => {
  console.log(`客户端连接: ${socket.id}`);

  let currentPlayerId = null;
  let currentRoomCode = null;

  // 心跳检测
  socket.emit('pong');

  // 创建房间
  socket.on('create_room', (data) => {
    const { mode, playerName, password } = data;

    if (!['couple', 'multi'].includes(mode)) {
      socket.emit('error', { code: 'INVALID_MODE', message: '无效的房间模式' });
      return;
    }

    // 过滤敏感词
    const filteredName = filterSensitiveWords(playerName);
    if (!filteredName || filteredName.trim().length === 0) {
      socket.emit('error', { code: 'INVALID_NAME', message: '请输入有效的昵称' });
      return;
    }

    const result = roomModule.createRoom(mode, filteredName, password);

    if (!result.success) {
      socket.emit('error', { code: 'CREATE_FAILED', message: result.error });
      return;
    }

    currentPlayerId = result.playerId;
    currentRoomCode = result.room.code;
    socket.join(currentRoomCode);

    socket.emit('room_created', {
      roomCode: result.room.code,
      shortCode: result.room.shortCode,
      playerId: result.playerId,
      room: gameModule.getGameState(result.room)
    });

    console.log(`房间创建: ${result.room.code}, 玩家: ${filteredName}`);
  });

  // 加入房间
  socket.on('join_room', (data) => {
    const { roomCode, playerName, password } = data;

    const filteredName = filterSensitiveWords(playerName);
    if (!filteredName || filteredName.trim().length === 0) {
      socket.emit('error', { code: 'INVALID_NAME', message: '请输入有效的昵称' });
      return;
    }

    const result = roomModule.joinRoom(roomCode.toUpperCase(), filteredName, password);

    if (!result.success) {
      socket.emit('error', { code: 'JOIN_FAILED', message: result.error });
      return;
    }

    currentPlayerId = result.playerId;
    currentRoomCode = result.room.code;
    socket.join(currentRoomCode);

    socket.emit('room_joined', {
      roomCode: result.room.code,
      playerId: result.playerId,
      room: gameModule.getGameState(result.room)
    });

    // 通知房间内其他玩家
    socket.to(currentRoomCode).emit('player_joined', {
      player: result.player,
      room: gameModule.getGameState(result.room)
    });

    console.log(`玩家加入房间: ${result.room.code}, 玩家: ${filteredName}`);
  });

  // 通过短码加入房间
  socket.on('join_room_short', (data) => {
    const { shortCode, playerName, password } = data;

    const filteredName = filterSensitiveWords(playerName);
    if (!filteredName || filteredName.trim().length === 0) {
      socket.emit('error', { code: 'INVALID_NAME', message: '请输入有效的昵称' });
      return;
    }

    const result = roomModule.joinRoomByShortCode(shortCode, filteredName, password);

    if (!result.success) {
      socket.emit('error', { code: 'JOIN_FAILED', message: result.error });
      return;
    }

    currentPlayerId = result.playerId;
    currentRoomCode = result.room.code;
    socket.join(currentRoomCode);

    socket.emit('room_joined', {
      roomCode: result.room.code,
      playerId: result.playerId,
      room: gameModule.getGameState(result.room)
    });

    socket.to(currentRoomCode).emit('player_joined', {
      player: result.player,
      room: gameModule.getGameState(result.room)
    });
  });

  // 离开房间
  socket.on('leave_room', () => {
    if (!currentRoomCode) return;

    const result = roomModule.leaveRoom(currentPlayerId);
    socket.leave(currentRoomCode);

    if (result.success && !result.roomDeleted) {
      socket.to(currentRoomCode).emit('player_left', {
        playerId: currentPlayerId,
        room: gameModule.getGameState(result.room)
      });
    }

    currentPlayerId = null;
    currentRoomCode = null;
  });

  // 断线重连
  socket.on('reconnect', (data) => {
    const { playerId, roomCode } = data;

    const result = roomModule.reconnect(playerId, roomCode);

    if (!result.success) {
      socket.emit('error', { code: 'RECONNECT_FAILED', message: result.error });
      return;
    }

    currentPlayerId = playerId;
    currentRoomCode = roomCode;
    socket.join(roomCode);

    socket.emit('reconnected', {
      room: gameModule.getGameState(result.room),
      player: result.player
    });

    socket.to(roomCode).emit('player_reconnected', {
      playerId,
      room: gameModule.getGameState(result.room)
    });
  });

  // 设置任务包
  socket.on('set_task_package', (data) => {
    if (!currentRoomCode) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }

    const { taskPackageId } = data;
    const result = roomModule.setTaskPackage(currentRoomCode, taskPackageId);

    if (!result.success) {
      socket.emit('error', { code: 'SET_TASK_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('task_package_changed', {
      taskPackageId,
      room: gameModule.getGameState(result.room)
    });
  });

  // 开始游戏
  socket.on('start_game', () => {
    if (!currentRoomCode) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }

    const result = roomModule.startGame(currentRoomCode);

    if (!result.success) {
      socket.emit('error', { code: 'START_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('game_start', {
      room: gameModule.getGameState(result.room)
    });

    console.log(`游戏开始: ${currentRoomCode}`);
  });

  // 投骰子
  socket.on('roll_dice', () => {
    if (!currentRoomCode) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }

    const room = roomModule.getRoom(currentRoomCode);
    if (!room) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '房间不存在' });
      return;
    }

    roomModule.updatePlayerActivity(currentPlayerId);
    const result = gameModule.doRollDice(room, currentPlayerId);

    if (!result.success) {
      socket.emit('error', { code: 'ROLL_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('dice_result', {
      diceValue: result.diceValue,
      playerId: result.playerId,
      movablePieces: result.movablePieces,
      turnChange: result.turnChange,
      nextPlayerId: result.nextPlayerId
    });

    // 如果没有可移动的棋子且没有切换回合，投骰子结果会触发任务或直接结束回合
    if (!result.turnChange && result.movablePieces.length === 0) {
      // 自动结束回合
      io.to(currentRoomCode).emit('turn_change', {
        currentPlayerId: result.nextPlayerId
      });
    }
  });

  // 移动棋子
  socket.on('move_piece', (data) => {
    if (!currentRoomCode) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }

    const { pieceIndex } = data;
    const room = roomModule.getRoom(currentRoomCode);
    if (!room) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '房间不存在' });
      return;
    }

    roomModule.updatePlayerActivity(currentPlayerId);
    const result = gameModule.movePiece(room, currentPlayerId, pieceIndex);

    if (!result.success) {
      socket.emit('error', { code: 'MOVE_FAILED', message: result.error });
      return;
    }

    // 检查是否触发任务
    let taskTriggered = null;
    const taskPackage = taskModule.loadTaskPackage(room.taskPackageId);
    const task = gameModule.getTaskForPosition(result.newPosition, taskPackage);

    if (task && !result.finished) {
      room.taskPending = task;
      room.pendingPlayerIndex = room.players.findIndex(p => p.id === currentPlayerId);
      taskTriggered = task;
    }

    io.to(currentRoomCode).emit('piece_moved', {
      playerId: result.playerId,
      pieceIndex: result.pieceIndex,
      oldPosition: result.oldPosition,
      newPosition: result.newPosition,
      eatenPiece: result.eatenPiece,
      finished: result.finished,
      task: taskTriggered
    });

    if (taskTriggered) {
      io.to(currentRoomCode).emit('task_triggered', {
        task: taskTriggered,
        playerId: currentPlayerId,
        position: result.newPosition
      });
    }

    // 如果游戏结束
    if (room.gameState === 'finished') {
      io.to(currentRoomCode).emit('game_over', {
        winnerId: room.winner,
        room: gameModule.getGameState(room)
      });
    }
  });

  // 任务回答
  socket.on('task_answer', (data) => {
    if (!currentRoomCode) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }

    const { answer } = data;
    const room = roomModule.getRoom(currentRoomCode);
    if (!room || !room.taskPending) {
      socket.emit('error', { code: 'NO_TASK', message: '没有待处理的任务' });
      return;
    }

    roomModule.updatePlayerActivity(currentPlayerId);
    const result = gameModule.completeTask(room, currentPlayerId, { answer });

    if (!result.success) {
      socket.emit('error', { code: 'TASK_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('task_result', {
      playerId: currentPlayerId,
      taskSuccess: result.taskSuccess,
      message: result.message,
      extraTurn: result.extraTurn,
      skipTurn: result.skipTurn,
      nextPlayerId: result.nextPlayerId
    });

    // 如果需要切换回合
    if (result.skipTurn || !result.extraTurn) {
      io.to(currentRoomCode).emit('turn_change', {
        currentPlayerId: result.nextPlayerId
      });
    }
  });

  // 任务动作完成
  socket.on('task_action', (data) => {
    if (!currentRoomCode) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }

    const room = roomModule.getRoom(currentRoomCode);
    if (!room || !room.taskPending) {
      socket.emit('error', { code: 'NO_TASK', message: '没有待处理的任务' });
      return;
    }

    roomModule.updatePlayerActivity(currentPlayerId);
    const result = gameModule.completeTask(room, currentPlayerId, { actionDone: true });

    if (!result.success) {
      socket.emit('error', { code: 'TASK_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('task_result', {
      playerId: currentPlayerId,
      taskSuccess: result.taskSuccess,
      message: result.message,
      extraTurn: result.extraTurn,
      skipTurn: result.skipTurn,
      nextPlayerId: result.nextPlayerId
    });

    if (result.skipTurn || !result.extraTurn) {
      io.to(currentRoomCode).emit('turn_change', {
        currentPlayerId: result.nextPlayerId
      });
    }
  });

  // 挑战任务指定目标
  socket.on('task_challenge_target', (data) => {
    if (!currentRoomCode) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }

    const { targetPlayerId } = data;
    const room = roomModule.getRoom(currentRoomCode);
    if (!room || !room.taskPending) {
      socket.emit('error', { code: 'NO_TASK', message: '没有待处理的任务' });
      return;
    }

    roomModule.updatePlayerActivity(currentPlayerId);

    // 处理挑战任务
    const task = room.taskPending;
    if (task.type === 'challenge' && task.target) {
      // 与目标玩家互动
      const targetPlayer = room.players.find(p => p.id === targetPlayerId);
      if (!targetPlayer) {
        socket.emit('error', { code: 'TARGET_NOT_FOUND', message: '目标玩家不存在' });
        return;
      }

      const result = gameModule.completeTask(room, currentPlayerId, { targetPlayerId });
      if (result.success) {
        io.to(currentRoomCode).emit('task_result', {
          playerId: currentPlayerId,
          taskSuccess: result.taskSuccess,
          message: result.message + ` (与 ${targetPlayer.name})`,
          extraTurn: result.extraTurn,
          skipTurn: result.skipTurn,
          nextPlayerId: result.nextPlayerId
        });

        if (result.skipTurn || !result.extraTurn) {
          io.to(currentRoomCode).emit('turn_change', {
            currentPlayerId: result.nextPlayerId
          });
        }
      }
    }
  });

  // 聊天消息
  socket.on('chat_message', (data) => {
    if (!currentRoomCode) return;

    const { message } = data;
    const filteredMessage = filterSensitiveWords(message);

    if (!filteredMessage || filteredMessage.trim().length === 0) {
      socket.emit('error', { code: 'INVALID_MESSAGE', message: '消息不能为空' });
      return;
    }

    if (filteredMessage.length > 50) {
      socket.emit('error', { code: 'MESSAGE_TOO_LONG', message: '消息不能超过50字' });
      return;
    }

    const room = roomModule.getRoom(currentRoomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === currentPlayerId);
    if (!player) return;

    io.to(currentRoomCode).emit('chat_message', {
      playerId: currentPlayerId,
      playerName: player.name,
      playerColor: player.color,
      message: filteredMessage,
      timestamp: Date.now()
    });
  });

  // 获取房间状态
  socket.on('get_room_state', () => {
    if (!currentRoomCode) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }

    const room = roomModule.getRoom(currentRoomCode);
    if (!room) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '房间不存在' });
      return;
    }

    socket.emit('room_state', {
      room: gameModule.getGameState(room)
    });
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log(`客户端断开: ${socket.id}`);

    if (currentPlayerId && currentRoomCode) {
      const result = roomModule.leaveRoom(currentPlayerId);

      if (result.success && !result.roomDeleted) {
        io.to(currentRoomCode).emit('player_disconnected', {
          playerId: currentPlayerId,
          room: gameModule.getGameState(result.room)
        });
      }
    }
  });

  // 心跳
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// REST API 路由

// 获取任务包列表
app.get('/api/task-packages', (req, res) => {
  const packages = taskModule.listTaskPackages();
  res.json({ success: true, packages });
});

// 获取指定任务包
app.get('/api/task-packages/:id', (req, res) => {
  const pkg = taskModule.loadTaskPackage(req.params.id);
  res.json({ success: true, taskPackage: pkg });
});

// 导出任务包
app.get('/api/task-packages/:id/export', (req, res) => {
  const json = taskModule.exportTaskPackage(req.params.id);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=task-package-${req.params.id}.json`);
  res.send(json);
});

// 导入任务包
app.post('/api/task-packages/import', (req, res) => {
  const { json } = req.body;
  if (!json) {
    res.json({ success: false, error: '缺少JSON数据' });
    return;
  }

  const result = taskModule.importTaskPackage(json);
  res.json(result);
});

// 保存任务包
app.post('/api/task-packages', (req, res) => {
  const taskPackage = req.body;
  const result = taskModule.saveTaskPackage(taskPackage);
  res.json(result);
});

// 短码解析
app.get('/api/short-code/:code', (req, res) => {
  const { code } = req.params;

  // 遍历房间查找匹配的短码
  // 实际应用中应使用数据库
  const rooms = roomModule.getAllRooms ? roomModule.getAllRooms() : [];

  for (const room of rooms) {
    if (room.shortCode === code.toUpperCase()) {
      res.json({
        success: true,
        roomCode: room.code,
        mode: room.mode,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        hasPassword: !!room.password
      });
      return;
    }
  }

  res.json({ success: false, error: '短码不存在或已过期' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`飞行棋服务器运行在 http://localhost:${PORT}`);
  console.log(`WebSocket服务器已启动`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，开始关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
