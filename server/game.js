const roomModule = require('./room');
const { getTaskByPosition, getTaskById } = require('./tasks');
const { deepClone } = require('./utils');

// 棋盘配置 - 简化版本
// 52个普通格子 (索引 0-51)
// 起点格子 = -1 (大本营)
// 终点格子 = 52 (第52格之后)
// 每一个行进格子都触发任务
const BOARD_CONFIG = {
  TOTAL_CELLS: 52,        // 行进中的总格子数 (0-51)
  START: -1,              // 起点/大本营
  FINISH: 52,             // 终点
  SAFE_POSITIONS: [6, 13, 26, 39],  // 安全点
  BONUS_POSITIONS: [9, 19, 29, 39, 49], // 奖励格子 (前进一步)
  PENALTY_POSITIONS: [4, 14, 24, 34, 44] // 惩罚格子 (后退一步)
};

// 骰子点数
function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

// 掷骰子 - 单棋子
function executeTurn(roomCode, playerId) {
  const room = roomModule._getRawRoom(roomCode);
  if (!room) return { success: false, error: '房间不存在' };

  if (room.gameState !== 'playing') {
    return { success: false, error: '游戏未开始' };
  }

  const currentPlayer = room.players[room.currentTurnIndex];
  if (!currentPlayer || currentPlayer.id !== playerId) {
    return { success: false, error: '不是你的回合' };
  }

  if (room.diceRolled) {
    return { success: false, error: '已经掷过骰子了，请移动棋子' };
  }

  // 掷骰子
  const diceValue = rollDice();
  room.diceValue = diceValue;
  room.diceRolled = true;
  roomModule.updatePlayerActivity(playerId);
  room.lastActivity = Date.now();

  // 检查棋子状态 - 判断是否可以移动
  let canMove = true;
  let moveHint = '';
  const currentPos = currentPlayer.piece;

  if (currentPos === -1) {
    // 在大本营
    if (diceValue === 6) {
      moveHint = '掷出6！可以从大本营出发';
      canMove = true;
    } else {
      moveHint = `掷出${diceValue}，需要6才能出发`;
      canMove = false;  // 不能移动
    }
  } else {
    moveHint = `掷出${diceValue}，点击前进`;
    canMove = true;
  }

  return {
    success: true,
    diceValue,
    canMove,
    moveHint,
    currentPosition: currentPos,
    room: deepClone(room)
  };
}

// 移动棋子 - 单棋子逻辑
function movePiece(roomCode, playerId, pieceIndex = 0) {
  const room = roomModule._getRawRoom(roomCode);
  if (!room) return { success: false, error: '房间不存在' };

  const player = room.players[room.currentTurnIndex];
  if (!player || player.id !== playerId) {
    return { success: false, error: '不是你的回合' };
  }

  if (!room.diceRolled || !room.diceValue) {
    return { success: false, error: '请先掷骰子' };
  }

  const diceValue = room.diceValue;
  let triggeredTask = null;
  let taskResult = null;
  let newPosition;
  let moved = false;
  const currentPos = player.piece;

  if (currentPos === -1) {
    // 在大本营 - 掷出6才能出
    if (diceValue === 6) {
      player.piece = 0;
      player.pieces[0] = 0;
      moved = true;
    } else {
      return {
        success: true,
        moved: false,
        pieceIndex: 0,
        from: -1,
        to: -1,
        message: '未掷出6，无法出发',
        diceValue: diceValue,
        room: deepClone(room)
      };
    }
  } else {
    const tempPos = currentPos + diceValue;

    if (tempPos >= BOARD_CONFIG.FINISH) {
      player.piece = BOARD_CONFIG.FINISH;
      player.pieces[0] = BOARD_CONFIG.FINISH;
      player.finished = 1;
      moved = true;
      room.winner = player;
      room.gameState = 'finished';
    } else {
      player.piece = tempPos;
      player.pieces[0] = tempPos;
      moved = true;
    }
  }

  newPosition = player.piece;

  // 检查碰撞 - 单棋子逻辑
  if (moved && newPosition >= 0 && newPosition < BOARD_CONFIG.FINISH) {
    for (let i = 0; i < room.players.length; i++) {
      const otherPlayer = room.players[i];
      if (otherPlayer.id !== player.id) {
        if (otherPlayer.piece === newPosition) {
          otherPlayer.piece = -1;
          otherPlayer.pieces[0] = -1;
          taskResult = {
            type: 'collision',
            message: `你撞到了 ${otherPlayer.name} 的棋子，对方被送回大本营！`
          };
        }
      }
    }
  }

  // 在新位置触发任务 - 每一个行进格子都有独立任务
  if (moved && taskResult === null && newPosition >= 0 && newPosition < BOARD_CONFIG.FINISH && room.gameState === 'playing') {
    const task = getTaskByPosition(newPosition, room.taskPackageId);
    if (task) {
      triggeredTask = task;
      room.taskPending = task;
      room.pendingPlayerIndex = room.currentTurnIndex;
    }
  }

  // 特殊格子处理 (奖励/惩罚)
  if (moved && newPosition >= 0 && newPosition < BOARD_CONFIG.FINISH) {
    if (BOARD_CONFIG.BONUS_POSITIONS.includes(newPosition)) {
      // 奖励格子 - 额外前进1格，不触发额外任务
      player.piece = Math.min(newPosition + 1, BOARD_CONFIG.FINISH - 1);
      player.pieces[0] = player.piece;
    }
    if (BOARD_CONFIG.PENALTY_POSITIONS.includes(newPosition)) {
      // 惩罚格子 - 后退1格
      player.piece = Math.max(newPosition - 1, 0);
      player.pieces[0] = player.piece;
    }
  }

  roomModule.updatePlayerActivity(playerId);
  room.lastActivity = Date.now();

  return {
    success: true,
    moved,
    pieceIndex: 0,
    from: currentPos,
    to: player.piece,
    task: triggeredTask,
    taskResult,
    diceValue,
    room: deepClone(room)
  };
}

// 玩家完成任务
function completeTask(roomCode, playerId, success) {
  const room = roomModule._getRawRoom(roomCode);
  if (!room || !room.taskPending) {
    return { success: false, error: '没有待处理的任务' };
  }

  const player = room.players[room.pendingPlayerIndex];
  if (!player || player.id !== playerId) {
    return { success: false, error: '无权处理此任务' };
  }

  const task = room.taskPending;
  let reward = 0;

  if (success) {
    reward = task.reward || 2;
    player.piece = Math.min(player.piece + reward, BOARD_CONFIG.FINISH - 1);
    player.pieces[0] = player.piece;
  } else {
    reward = task.penalty || -2;
    player.piece = Math.max(player.piece + reward, 0);
    player.pieces[0] = player.piece;
  }

  // 检查是否到达终点
  if (player.piece >= BOARD_CONFIG.FINISH - 1) {
    // 任务奖励推进到最后一格
    player.finished = 1;
    room.winner = player;
    room.gameState = 'finished';
  }

  room.taskPending = null;
  room.pendingPlayerIndex = null;
  roomModule.updatePlayerActivity(playerId);
  room.lastActivity = Date.now();

  return {
    success: true,
    reward: reward,
    taskCompleted: success,
    newPosition: player.piece,
    room: deepClone(room)
  };
}

// 结束回合
function endTurn(roomCode, playerId) {
  const room = roomModule._getRawRoom(roomCode);
  if (!room) return { success: false, error: '房间不存在' };

  const currentPlayer = room.players[room.currentTurnIndex];
  if (!currentPlayer || currentPlayer.id !== playerId) {
    return { success: false, error: '不是你的回合' };
  }

  if (room.taskPending) {
    return { success: false, error: '请先完成任务' };
  }

  // 切换到下一位在线玩家
  let nextIndex = (room.currentTurnIndex + 1) % room.players.length;
  let safety = 0;
  while (!room.players[nextIndex].isOnline && safety < room.players.length) {
    nextIndex = (nextIndex + 1) % room.players.length;
    safety++;
  }

  room.currentTurnIndex = nextIndex;
  room.diceValue = null;
  room.diceRolled = false;
  room.turnStartedAt = Date.now();
  roomModule.updatePlayerActivity(playerId);
  room.lastActivity = Date.now();

  return {
    success: true,
    nextPlayer: room.players[nextIndex],
    room: deepClone(room)
  };
}

// 跳过任务 (有惩罚)
function skipTask(roomCode, playerId) {
  const room = roomModule._getRawRoom(roomCode);
  if (!room) return { success: false, error: '房间不存在' };

  if (!room.taskPending) {
    return { success: false, error: '没有待处理的任务' };
  }

  const player = room.players[room.pendingPlayerIndex];
  if (!player || player.id !== playerId) {
    return { success: false, error: '无权处理此任务' };
  }

  // 跳过任务：惩罚 -1步
  player.piece = Math.max(player.piece - 1, 0);
  player.pieces[0] = player.piece;

  room.taskPending = null;
  room.pendingPlayerIndex = null;
  roomModule.updatePlayerActivity(playerId);
  room.lastActivity = Date.now();

  return {
    success: true,
    message: '已跳过任务，后退1步',
    newPosition: player.piece,
    room: deepClone(room)
  };
}

// 处理回合超时
function handleTurnTimeout(roomCode) {
  const room = roomModule._getRawRoom(roomCode);
  if (!room) return { success: false };

  if (room.gameState !== 'playing') return { success: false };

  if (room.taskPending) {
    room.taskPending = null;
    room.pendingPlayerIndex = null;
  }

  let nextIndex = (room.currentTurnIndex + 1) % room.players.length;
  let safety = 0;
  while (!room.players[nextIndex].isOnline && safety < room.players.length) {
    nextIndex = (nextIndex + 1) % room.players.length;
    safety++;
  }

  room.currentTurnIndex = nextIndex;
  room.diceValue = null;
  room.diceRolled = false;
  room.turnStartedAt = Date.now();
  room.lastActivity = Date.now();

  return {
    success: true,
    timedOut: true,
    nextPlayer: room.players[nextIndex],
    room: deepClone(room)
  };
}

// 获取游戏状态快照
function getGameState(room) {
  if (!room) return null;
  const clone = deepClone(room);
  // 不返回密码明文
  if (clone.password) {
    clone.password = clone.password ? true : false;
  }
  return clone;
}

// 掷骰子 (向后兼容)
function doRollDice(room, playerId) {
  return executeTurn(room.code, playerId);
}

// 根据位置获取任务
function getTaskForPosition(position, taskPackage) {
  if (!taskPackage || !taskPackage.tasks) return null;
  return taskPackage.tasks.find(t => t.position === position || t.position === position + 1) || null;
}

module.exports = {
  BOARD_CONFIG,
  rollDice,
  executeTurn,
  movePiece,
  completeTask,
  endTurn,
  skipTask,
  handleTurnTimeout,
  getGameState,
  doRollDice,
  getTaskForPosition
};
