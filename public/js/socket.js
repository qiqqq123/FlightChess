// Socket.io 通信模块

let socket = null;
let currentPlayerId = null;
let currentRoomCode = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// 初始化Socket连接
function initSocket() {
  if (socket) return;

  const serverUrl = window.location.origin;
  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS
  });

  // 连接成功
  socket.on('connect', () => {
    console.log('Socket已连接');
    reconnectAttempts = 0;

    // 尝试重连
    if (currentPlayerId && currentRoomCode) {
      socket.emit('reconnect', { playerId: currentPlayerId, roomCode: currentRoomCode });
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('Socket已断开');
  });

  // 重连成功
  socket.on('reconnected', (data) => {
    console.log('重连成功', data);
    currentPlayerId = data.player.id;
    updateGameState(data.room);
    showToast('重新连接成功');
  });

  // 房间创建成功
  socket.on('room_created', (data) => {
    currentPlayerId = data.playerId;
    currentRoomCode = data.roomCode;
    gameState = new GameState(data.room);
    showWaitingRoom(data.room);
  });

  // 加入房间成功
  socket.on('room_joined', (data) => {
    currentPlayerId = data.playerId;
    currentRoomCode = data.roomCode;
    gameState = new GameState(data.room);
    if (data.room.gameState === 'waiting') {
      showWaitingRoom(data.room);
    } else {
      startGameView(data.room);
    }
  });

  // 玩家加入
  socket.on('player_joined', (data) => {
    gameState = new GameState(data.room);
    updatePlayerList(data.room);
    showToast(`${data.player.name} 加入了房间`);
  });

  // 玩家离开
  socket.on('player_left', (data) => {
    gameState = new GameState(data.room);
    updatePlayerList(data.room);
  });

  // 玩家断线
  socket.on('player_disconnected', (data) => {
    gameState = new GameState(data.room);
    const player = data.room.players.find(p => p.id === data.playerId);
    if (player) {
      showToast(`${player.name} 已断线`);
    }
    updatePlayerList(data.room);
  });

  // 玩家重连
  socket.on('player_reconnected', (data) => {
    gameState = new GameState(data.room);
    const player = data.room.players.find(p => p.id === data.playerId);
    if (player) {
      showToast(`${player.name} 已重新连接`);
    }
    updatePlayerList(data.room);
  });

  // 游戏开始
  socket.on('game_start', (data) => {
    gameState = new GameState(data.room);
    startGameView(data.room);
  });

  // 骰子结果
  socket.on('dice_result', (data) => {
    gameState.diceValue = data.diceValue;
    gameState.diceRolled = true;

    if (data.turnChange) {
      gameState.currentPlayerId = data.nextPlayerId;
    }

    updateDiceDisplay(data.diceValue);
    updateTurnIndicator();
    updateMovablePieces(data.movablePieces);

    if (data.turnChange) {
      showToast('回合切换');
    }
  });

  // 棋子移动
  socket.on('piece_moved', (data) => {
    const player = gameState.getPlayerById(data.playerId);
    if (player) {
      player.pieces[data.pieceIndex] = data.newPosition;
    }

    renderBoard();
    updateDiceDisplay(gameState.diceValue);

    if (data.eatenPiece) {
      const eatenPlayer = gameState.getPlayerById(data.eatenPiece.playerId);
      if (eatenPlayer) {
        eatenPlayer.pieces[data.eatenPiece.pieceIndex] = -1;
        showToast(`${eatenPlayer.name}的飞机被吃掉了!`);
      }
    }

    if (data.task) {
      showTaskPanel(data.task);
    }

    if (data.finished) {
      showToast('一架飞机到达终点!');
    }
  });

  // 任务触发
  socket.on('task_triggered', (data) => {
    gameState.taskPending = data.task;
    showTaskPanel(data.task);
  });

  // 任务结果
  socket.on('task_result', (data) => {
    showToast(data.message);
    gameState.taskPending = null;
    gameState.currentPlayerId = data.nextPlayerId;
    gameState.diceRolled = false;
    gameState.diceValue = null;
    hideTaskPanel();
    updateTurnIndicator();
    updateDiceDisplay(null);
  });

  // 回合切换
  socket.on('turn_change', (data) => {
    gameState.currentPlayerId = data.currentPlayerId;
    gameState.diceRolled = false;
    gameState.diceValue = null;
    updateTurnIndicator();
    updateDiceDisplay(null);
    clearMovablePieces();
  });

  // 游戏结束
  socket.on('game_over', (data) => {
    gameState.gameState = 'finished';
    gameState.winner = data.winnerId;
    const winner = gameState.getPlayerById(data.winnerId);
    showGameOverModal(winner);
  });

  // 任务包更改
  socket.on('task_package_changed', (data) => {
    gameState = new GameState(data.room);
    showToast('任务包已更改');
  });

  // 错误
  socket.on('error', (data) => {
    console.error('Socket错误:', data);
    showErrorModal(data.message);
  });

  // 房间状态
  socket.on('room_state', (data) => {
    gameState = new GameState(data.room);
  });

  // 聊天消息
  socket.on('chat_message', (data) => {
    addChatMessage(data);
  });
}

// 创建房间
function createRoom(mode, playerName, password) {
  if (!socket) initSocket();
  socket.emit('create_room', { mode, playerName, password });
}

// 加入房间
function joinRoom(roomCode, playerName, password) {
  if (!socket) initSocket();
  socket.emit('join_room', { roomCode, playerName, password });
}

// 通过短码加入
function joinRoomByShortCodeFunc(shortCode, playerName, password) {
  if (!socket) initSocket();
  socket.emit('join_room_short', { shortCode, playerName, password });
}

// 离开房间
function leaveRoomFunc() {
  if (socket) {
    socket.emit('leave_room');
  }
  currentPlayerId = null;
  currentRoomCode = null;
  showPage('home');
}

// 投骰子
function rollDiceFunc() {
  if (socket && gameState && gameState.isMyTurn(currentPlayerId)) {
    socket.emit('roll_dice');
  }
}

// 移动棋子
function movePieceFunc(pieceIndex) {
  if (socket && gameState && gameState.isMyTurn(currentPlayerId)) {
    socket.emit('move_piece', { pieceIndex });
  }
}

// 任务回答
function taskAnswerFunc(answer) {
  if (socket) {
    socket.emit('task_answer', { answer });
  }
}

// 任务动作
function taskActionFunc() {
  if (socket) {
    socket.emit('task_action');
  }
}

// 任务挑战目标
function taskChallengeTargetFunc(targetPlayerId) {
  if (socket) {
    socket.emit('task_challenge_target', { targetPlayerId });
  }
}

// 开始游戏
function startGameFunc() {
  if (socket) {
    socket.emit('start_game');
  }
}

// 设置任务包
function setTaskPackageFunc(taskPackageId) {
  if (socket) {
    socket.emit('set_task_package', { taskPackageId });
  }
}

// 发送聊天
function sendChatFunc(message) {
  if (socket && message.trim()) {
    socket.emit('chat_message', { message: message.trim() });
  }
}

// 重连
function reconnectFunc() {
  if (socket && currentPlayerId && currentRoomCode) {
    socket.emit('reconnect', { playerId: currentPlayerId, roomCode: currentRoomCode });
  }
}
