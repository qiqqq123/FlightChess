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

  // 创建房间 (支持选项: maxPlayers, turnDuration, difficulty)
  socket.on('create_room', (data) => {
    const { mode, playerName, password, options } = data;

    if (!['couple', 'multi'].includes(mode)) {
      socket.emit('error', { code: 'INVALID_MODE', message: '无效的房间模式' });
      return;
    }

    const filteredName = filterSensitiveWords(playerName);
    if (!filteredName || filteredName.trim().length === 0) {
      socket.emit('error', { code: 'INVALID_NAME', message: '请输入有效的昵称' });
      return;
    }

    const result = roomModule.createRoom(mode, filteredName, password, options || {});

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

    console.log(`房间创建: ${result.room.code}, 玩家: ${filteredName}, 难度: ${result.room.difficulty}`);
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

  // 房主重置密码
  socket.on('reset_password', (data) => {
    if (!currentRoomCode) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }
    const { newPassword } = data;
    const result = roomModule.resetPassword(currentPlayerId, currentRoomCode, newPassword);

    if (!result.success) {
      socket.emit('error', { code: 'PASSWORD_RESET_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('password_changed', {
      hasPassword: !!newPassword,
      room: gameModule.getGameState(result.room)
    });
  });

  // 玩家选择棋子颜色
  socket.on('choose_color', (data) => {
    if (!currentRoomCode) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }
    const { color } = data;
    const result = roomModule.choosePlayerColor(currentPlayerId, currentRoomCode, color);

    if (!result.success) {
      socket.emit('error', { code: 'COLOR_CHANGE_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('color_changed', {
      playerId: currentPlayerId,
      color: color,
      room: gameModule.getGameState(result.room)
    });
  });

  // 设置难度 (仅房主, 游戏未开始)
  socket.on('set_difficulty', (data) => {
    if (!currentRoomCode) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }
    const { difficulty } = data;
    const result = roomModule.setDifficulty(currentPlayerId, currentRoomCode, difficulty);

    if (!result.success) {
      socket.emit('error', { code: 'SET_DIFFICULTY_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('difficulty_changed', {
      difficulty: difficulty,
      room: gameModule.getGameState(result.room)
    });
  });

  // 设置最大玩家数 (仅房主, 游戏未开始)
  socket.on('set_max_players', (data) => {
    if (!currentRoomCode) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }
    const { maxPlayers } = data;
    const result = roomModule.setMaxPlayers(currentPlayerId, currentRoomCode, maxPlayers);

    if (!result.success) {
      socket.emit('error', { code: 'SET_MAX_PLAYERS_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('max_players_changed', {
      maxPlayers: maxPlayers,
      room: gameModule.getGameState(result.room)
    });
  });

  // 设置回合时长 (仅房主, 游戏未开始)
  socket.on('set_turn_duration', (data) => {
    if (!currentRoomCode) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }
    const { seconds } = data;
    const result = roomModule.setTurnDuration(currentPlayerId, currentRoomCode, seconds);

    if (!result.success) {
      socket.emit('error', { code: 'SET_TURN_DURATION_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('turn_duration_changed', {
      turnDuration: seconds,
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

  // 断线重连 - 保留原有棋子和游戏状态
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
    if (!currentRoomCode) return;

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
    if (!currentRoomCode) return;

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

  // 投骰子 - 单棋子逻辑
  socket.on('roll_dice', () => {
    if (!currentRoomCode) return;

    const room = roomModule.getRoom(currentRoomCode);
    if (!room) return;

    const result = gameModule.executeTurn(currentRoomCode, currentPlayerId);

    if (!result.success) {
      socket.emit('error', { code: 'ROLL_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('dice_result', {
      diceValue: result.diceValue,
      playerId: currentPlayerId,
      canMove: result.canMove,
      moveHint: result.moveHint,
      room: gameModule.getGameState(result.room)
    });
  });

  // 移动棋子 - 单棋子逻辑
  socket.on('move_piece', (data) => {
    if (!currentRoomCode) return;

    const pieceIndex = (data && data.pieceIndex) || 0;
    const result = gameModule.movePiece(currentRoomCode, currentPlayerId, pieceIndex);

    if (!result.success) {
      socket.emit('error', { code: 'MOVE_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('piece_moved', {
      playerId: currentPlayerId,
      pieceIndex: 0,
      oldPosition: result.from,
      newPosition: result.to,
      task: result.task,
      taskResult: result.taskResult,
      moved: result.moved,
      room: gameModule.getGameState(result.room)
    });

    // 触发任务事件
    if (result.task) {
      io.to(currentRoomCode).emit('task_triggered', {
        task: result.task,
        playerId: currentPlayerId,
        position: result.to
      });
    }

    // 游戏结束
    const rawRoom = roomModule._getRawRoom(currentRoomCode);
    if (rawRoom && rawRoom.gameState === 'finished') {
      io.to(currentRoomCode).emit('game_over', {
        winnerId: rawRoom.winner ? rawRoom.winner.id : currentPlayerId,
        room: gameModule.getGameState(rawRoom)
      });
    }
  });

  // 任务回答 (选择题)
  socket.on('task_answer', (data) => {
    if (!currentRoomCode) return;

    const { answer } = data;
    const room = roomModule._getRawRoom(currentRoomCode);
    if (!room || !room.taskPending) return;

    const task = room.taskPending;
    let success = false;

    if (task.type === 'question') {
      success = (answer === task.answer);
    } else if (task.type === 'action' || task.type === 'challenge' || task.type === 'luck') {
      success = true; // 动作/挑战/运气任务按完成处理
    }

    const result = gameModule.completeTask(currentRoomCode, currentPlayerId, success);

    if (!result.success) {
      socket.emit('error', { code: 'TASK_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('task_result', {
      playerId: currentPlayerId,
      taskSuccess: success,
      reward: result.reward,
      newPosition: result.newPosition,
      message: success ? '任务完成!' : '任务失败',
      room: gameModule.getGameState(result.room)
    });
  });

  // 任务动作完成
  socket.on('task_action', () => {
    if (!currentRoomCode) return;

    const result = gameModule.completeTask(currentRoomCode, currentPlayerId, true);
    if (!result.success) {
      socket.emit('error', { code: 'TASK_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('task_result', {
      playerId: currentPlayerId,
      taskSuccess: true,
      reward: result.reward,
      newPosition: result.newPosition,
      message: '任务完成!',
      room: gameModule.getGameState(result.room)
    });
  });

  // 跳过任务 (有惩罚)
  socket.on('skip_task', () => {
    if (!currentRoomCode) return;

    const result = gameModule.skipTask(currentRoomCode, currentPlayerId);

    if (!result.success) {
      socket.emit('error', { code: 'SKIP_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('task_result', {
      playerId: currentPlayerId,
      taskSuccess: false,
      message: result.message,
      newPosition: result.newPosition,
      room: gameModule.getGameState(result.room)
    });
  });

  // 回合超时
  socket.on('turn_timeout', () => {
    if (!currentRoomCode) return;

    const result = gameModule.handleTurnTimeout(currentRoomCode);
    if (!result.success) return;

    io.to(currentRoomCode).emit('turn_change', {
      timedOut: true,
      nextPlayerId: result.nextPlayer ? result.nextPlayer.id : null,
      room: gameModule.getGameState(result.room)
    });
  });

  // 结束回合
  socket.on('end_turn', () => {
    if (!currentRoomCode) return;

    const result = gameModule.endTurn(currentRoomCode, currentPlayerId);

    if (!result.success) {
      socket.emit('error', { code: 'END_TURN_FAILED', message: result.error });
      return;
    }

    io.to(currentRoomCode).emit('turn_change', {
      nextPlayerId: result.nextPlayer ? result.nextPlayer.id : null,
      room: gameModule.getGameState(result.room)
    });
  });

  // 聊天消息
  socket.on('chat_message', (data) => {
    if (!currentRoomCode) return;

    const { message } = data;
    const filteredMessage = filterSensitiveWords(message);

    if (!filteredMessage || filteredMessage.trim().length === 0) return;
    if (filteredMessage.length > 100) return;

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
    if (!currentRoomCode) return;

    const room = roomModule.getRoom(currentRoomCode);
    if (!room) return;

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

// 获取公开房间列表
app.get('/api/rooms/public', (req, res) => {
  const rooms = roomModule.getPublicRooms();
  res.json({ success: true, rooms });
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
