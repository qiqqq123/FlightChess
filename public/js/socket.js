// Socket.io 通信模块 - 单棋子版本
let socket = null;
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

  socket.on('connect', () => {
    console.log('Socket已连接');
    reconnectAttempts = 0;
    if (window.currentPlayerId && window.currentRoomCode) {
      socket.emit('reconnect', { playerId: window.currentPlayerId, roomCode: window.currentRoomCode });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket已断开');
  });

  // 重连成功 - 保留原有棋子和游戏状态
  socket.on('reconnected', (data) => {
    console.log('重连成功', data);
    window.currentPlayerId = data.player.id;
    updateGameState(data.room);
    showToast('重新连接成功');
  });

  // 房间创建成功
  socket.on('room_created', (data) => {
    window.currentPlayerId = data.playerId;
    window.currentRoomCode = data.roomCode;
    // 应用选中的棋子颜色
    const selectedColor = document.querySelector('.color-option.selected')?.dataset.color;
    if (selectedColor && data.room && data.room.players) {
      const me = data.room.players.find(p => p.id === data.playerId);
      if (me && me.color !== selectedColor) {
        // 发送选择颜色请求
        socket.emit('choose_color', { color: selectedColor });
      }
    }
    updateGameState(data.room);
    showWaitingRoom(data.room);
  });

  // 加入房间成功
  socket.on('room_joined', (data) => {
    window.currentPlayerId = data.playerId;
    window.currentRoomCode = data.roomCode;
    updateGameState(data.room);
    if (data.room.gameState === 'waiting' || data.room.gameState === 'selecting') {
      showWaitingRoom(data.room);
    } else {
      startGameView(data.room);
    }
  });

  // 玩家加入
  socket.on('player_joined', (data) => {
    updateGameState(data.room);
    if (data.room.gameState === 'waiting' || data.room.gameState === 'selecting') {
      showWaitingRoom(data.room);
    }
    if (data.player && data.player.id !== window.currentPlayerId) {
      showToast(`${data.player.name} 加入了房间`);
    }
  });

  // 玩家离开
  socket.on('player_left', (data) => {
    updateGameState(data.room);
    updatePlayerList(data.room);
  });

  // 玩家断线
  socket.on('player_disconnected', (data) => {
    updateGameState(data.room);
    const player = data.room.players.find(p => p.id === data.playerId);
    if (player) showToast(`${player.name} 已断线`);
    updatePlayerList(data.room);
  });

  // 玩家重连
  socket.on('player_reconnected', (data) => {
    updateGameState(data.room);
    const player = data.room.players.find(p => p.id === data.playerId);
    if (player) showToast(`${player.name} 已重新连接`);
    updatePlayerList(data.room);
  });

  // 游戏开始
  socket.on('game_start', (data) => {
    updateGameState(data.room);
    startGameView(data.room);
  });

  // 骰子结果
  socket.on('dice_result', (data) => {
    if (window.gameState) {
      window.gameState.diceValue = data.diceValue;
      window.gameState.diceRolled = true;
      if (data.room && data.room.players) {
        window.gameState.players = data.room.players;
        window.gameState.currentTurnIndex = data.room.currentTurnIndex || window.gameState.currentTurnIndex;
      }
    }
    updateDiceDisplay(data.diceValue);
    updateTurnIndicator();

    // 显示提示
    const currentPlayer = window.gameState && window.gameState.players[window.gameState.currentTurnIndex];
    const isMine = currentPlayer && currentPlayer.id === window.currentPlayerId;
    if (isMine) {
      const pos = currentPlayer.piece;
      if (pos === -1 || pos === undefined || pos === null) {
        if (data.diceValue === 6) {
          showToast('掷出6! 点击"出发"');
        } else {
          showToast(`掷出${data.diceValue}，需要6才能出发`);
        }
      } else {
        showToast(`掷出${data.diceValue}! 点击"前进"`);
      }
    }
  });

  // 棋子移动
  socket.on('piece_moved', (data) => {
    // 先更新房间状态
    if (data.room) {
      updateGameState(data.room);
    }

    renderBoard();
    if (window.gameState) updateDiceDisplay(window.gameState.diceValue);

    if (data.taskResult && data.taskResult.message) {
      showToast(data.taskResult.message);
    }

    if (data.task) {
      showTaskPanel(data.task);
    }

    // 检查是否是自己的棋子完成，显示移动按钮
    setTimeout(() => {
      if (window.gameState && !window.gameState.taskPending && !window.gameState.diceRolled) {
        // 回合切换，不需要移动
      }
    }, 600);
  });

  // 任务触发
  socket.on('task_triggered', (data) => {
    if (window.gameState) window.gameState.taskPending = data.task;
    showTaskPanel(data.task);
  });

  // 任务结果
  socket.on('task_result', (data) => {
    if (data.message) showToast(data.message || (data.taskSuccess ? '任务完成' : '任务失败'));
    if (window.gameState) {
      window.gameState.taskPending = null;
      window.gameState.diceRolled = false;
      window.gameState.diceValue = null;
    }
    hideTaskPanel();
    // 重新获取状态
    if (data.room) updateGameState(data.room);
    renderBoard();
    updateTurnIndicator();
    updateDiceDisplay(null);
  });

  // 回合切换
  socket.on('turn_change', (data) => {
    if (window.gameState) {
      window.gameState.diceRolled = false;
      window.gameState.diceValue = null;
    }
    if (data.room) updateGameState(data.room);
    if (data.timedOut) showToast('回合超时');
    updateTurnIndicator();
    updateDiceDisplay(null);
  });

  // 游戏结束
  socket.on('game_over', (data) => {
    if (window.gameState) window.gameState.gameState = 'finished';
    const winner = data.room && data.room.players ? data.room.players.find(p => p.id === data.winnerId) : null;
    showGameOverModal(winner || { id: data.winnerId, name: '玩家' });
  });

  // 任务包更改
  socket.on('task_package_changed', (data) => {
    updateGameState(data.room);
    showToast('任务包已更新');
  });

  // 密码已更改
  socket.on('password_changed', (data) => {
    updateGameState(data.room);
    showToast('密码已更新');
    updatePlayerList(data.room);
  });

  // 颜色已更改
  socket.on('color_changed', (data) => {
    updateGameState(data.room);
    if (data.playerId && data.playerId === window.currentPlayerId) {
      showToast(`棋子颜色已选择: ${COLOR_NAMES[data.color] || data.color}`);
    }
    updatePlayerList(data.room);
  });

  // 难度已更改
  socket.on('difficulty_changed', (data) => {
    updateGameState(data.room);
    showToast(`难度设为: ${getDifficultyLabel(data.difficulty)}`);
    updatePlayerList(data.room);
  });

  // 回合时长已更改
  socket.on('turn_duration_changed', (data) => {
    updateGameState(data.room);
    showToast(`回合时长: ${data.turnDuration}秒`);
    updatePlayerList(data.room);
  });

  // 最大玩家数已更改
  socket.on('max_players_changed', (data) => {
    updateGameState(data.room);
    showToast(`最大玩家数: ${data.maxPlayers}`);
    updatePlayerList(data.room);
  });

  // 房间状态
  socket.on('room_state', (data) => {
    updateGameState(data.room);
  });

  // 聊天消息
  socket.on('chat_message', (data) => {
    addChatMessage(data);
  });

  // 错误
  socket.on('error', (data) => {
    console.error('Socket错误:', data);
    showErrorModal(data.message || '操作失败');
  });
}

// === 发送事件的函数 ===

function createRoomFunc(mode, playerName, password, options) {
  if (!socket) initSocket();
  socket.emit('create_room', { mode, playerName, password, options: options || {} });
}

function joinRoomFunc(roomCode, playerName, password) {
  if (!socket) initSocket();
  socket.emit('join_room', { roomCode, playerName, password });
}

function joinRoomByShortCodeFunc(shortCode, playerName, password) {
  if (!socket) initSocket();
  socket.emit('join_room_short', { shortCode, playerName, password });
}

function leaveRoomFunc() {
  if (socket) socket.emit('leave_room');
  window.currentPlayerId = null;
  window.currentRoomCode = null;
  showPage('home');
}

function rollDiceFunc() {
  if (socket && window.gameState) {
    const player = window.gameState.players[window.gameState.currentTurnIndex];
    if (player && player.id === window.currentPlayerId) {
      socket.emit('roll_dice');
    }
  }
}

function movePieceFunc(pieceIndex) {
  if (socket && window.gameState) {
    const player = window.gameState.players[window.gameState.currentTurnIndex];
    if (player && player.id === window.currentPlayerId) {
      socket.emit('move_piece', { pieceIndex });
    }
  }
}

function taskAnswerFunc(answer) {
  if (socket) {
    if (typeof answer === 'boolean') {
      // 跳过任务或完成任务
      if (answer === true) {
        socket.emit('task_action');
      } else {
        socket.emit('skip_task');
      }
    } else {
      socket.emit('task_answer', { answer });
    }
  }
}

function skipTaskFunc() {
  if (socket) socket.emit('skip_task');
}

function endTurnFunc() {
  if (socket) socket.emit('end_turn');
}

function startGameFunc() {
  if (socket) socket.emit('start_game');
}

function setTaskPackageFunc(taskPackageId) {
  if (socket) socket.emit('set_task_package', { taskPackageId });
}

function sendChatFunc(message) {
  if (socket && message && message.trim()) {
    socket.emit('chat_message', { message: message.trim() });
  }
}

function reconnectFunc() {
  if (socket && window.currentPlayerId && window.currentRoomCode) {
    socket.emit('reconnect', { playerId: window.currentPlayerId, roomCode: window.currentRoomCode });
  }
}

function resetPasswordFunc(newPassword) {
  if (socket) socket.emit('reset_password', { newPassword });
}

function setDifficultyFunc(difficulty) {
  if (socket) socket.emit('set_difficulty', { difficulty });
}

function setTurnDurationFunc(seconds) {
  if (socket) socket.emit('set_turn_duration', { seconds });
}

function setMaxPlayersFunc(maxPlayers) {
  if (socket) socket.emit('set_max_players', { maxPlayers });
}
