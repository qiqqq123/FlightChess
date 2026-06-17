const { deepClone, shuffle } = require('./utils');
const { loadTaskPackage } = require('./tasks');

// 棋盘配置
const BOARD_CONFIG = {
  // 外圈总格子数
  OUTER_CELLS: 52,
  // 每阵营终点跑道格子数
  HOME_CELLS: 6,
  // 每阵营飞机数
  PIECES_PER_PLAYER: 4,
  // 安全格位置 (起飞格)
  SAFE_POSITIONS: [0, 13, 26, 39]
};

// 计算飞行棋位置
// 每个颜色有自己独立的路径:
// - 外圈: 0-51 (共享)
// - 各颜色入口: 52-57, 58-63, 64-69, 70-75
// - 终点: 76-79, 80-83, 84-87, 88-91

// 位置映射:
// 红色: 外圈0-12, 入口52-57, 终点76-79
// 蓝色: 外圈13-25, 入口58-63, 终点80-83
// 黄色: 外圈26-38, 入口64-69, 终点84-87
// 绿色: 外圈39-51, 入口70-75, 终点88-91

const COLOR_CONFIG = {
  red: {
    outerStart: 0,
    outerEnd: 12,
    entryStart: 52,
    homeStart: 76,
    globalSafePosition: 0
  },
  blue: {
    outerStart: 13,
    outerEnd: 25,
    entryStart: 58,
    homeStart: 80,
    globalSafePosition: 13
  },
  yellow: {
    outerStart: 26,
    outerEnd: 38,
    entryStart: 64,
    homeStart: 84,
    globalSafePosition: 26
  },
  green: {
    outerStart: 39,
    outerEnd: 51,
    entryStart: 70,
    homeStart: 88,
    globalSafePosition: 39
  }
};

// 投骰子
function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

// 获取玩家颜色配置
function getColorConfig(color) {
  return COLOR_CONFIG[color];
}

// 检查是否是安全格
function isSafePosition(position) {
  return SAFE_POSITIONS.includes(position);
}

// 检查是否在终点跑道
function isInHomeStretch(color, position) {
  const config = getColorConfig(color);
  return position >= config.homeStart && position <= config.homeStart + 5;
}

// 检查是否到达终点
function isAtHome(color, position) {
  const config = getColorConfig(color);
  return position === config.homeStart + 5; // 第6格是实际终点
}

// 获取可移动的棋子
function getMovablePieces(player, diceValue, taskPending) {
  const movable = [];

  // 有待处理任务时不能移动
  if (taskPending) {
    return movable;
  }

  for (let i = 0; i < player.pieces.length; i++) {
    const piecePos = player.pieces[i];

    // 在大本营
    if (piecePos === -1) {
      // 需要投6才能起飞
      if (diceValue === 6) {
        movable.push({ index: i, canMove: true, reason: '起飞' });
      }
    }
    // 在外圈或入口
    else if (piecePos < 52 || (piecePos >= 52 && piecePos <= 75)) {
      const newPos = calculateNewPosition(player.color, piecePos, diceValue);
      if (newPos !== null) {
        movable.push({ index: i, canMove: true, reason: '前进', newPosition: newPos });
      }
    }
    // 在终点跑道
    else {
      const newPos = calculateNewPosition(player.color, piecePos, diceValue);
      if (newPos !== null && newPos <= getColorConfig(player.color).homeStart + 5) {
        movable.push({ index: i, canMove: true, reason: '前进', newPosition: newPos });
      }
    }
  }

  return movable;
}

// 计算新位置
function calculateNewPosition(color, currentPos, diceValue) {
  const config = getColorConfig(color);

  // 在大本营
  if (currentPos === -1) {
    if (diceValue === 6) {
      return config.entryStart; // 起飞到入口第一格
    }
    return null;
  }

  // 在外圈
  if (currentPos >= 0 && currentPos <= 51) {
    let newPos = currentPos + diceValue;

    // 超过外圈终点，需要进入自己的入口跑道
    const colorIndex = Object.keys(COLOR_CONFIG).indexOf(color);
    const outerEndForColor = colorIndex === 0 ? 12 : colorIndex * 13 - 1;
    const outerStartForColor = colorIndex * 13;

    // 检查是否绕完一圈
    if (newPos > 51) {
      newPos = newPos - 52;
    }

    // 简单处理：当前实现假设外圈是直通的
    return newPos;
  }

  // 在入口跑道
  if (currentPos >= 52 && currentPos <= 75) {
    let newPos = currentPos + diceValue;

    // 超过入口终点进入终点
    if (newPos > config.homeStart + 5) {
      // 不能超过终点
      return null;
    }

    return newPos;
  }

  // 在终点跑道
  if (currentPos >= config.homeStart && currentPos <= config.homeStart + 5) {
    let newPos = currentPos + diceValue;

    // 不能超过终点
    if (newPos > config.homeStart + 5) {
      return null;
    }

    return newPos;
  }

  return null;
}

// 移动棋子
function movePiece(room, playerId, pieceIndex) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, error: '玩家不存在' };
  }

  if (room.players[room.currentTurnIndex].id !== playerId) {
    return { success: false, error: '不是你的回合' };
  }

  if (!room.diceRolled || room.diceValue === null) {
    return { success: false, error: '请先投骰子' };
  }

  if (room.taskPending) {
    return { success: false, error: '有待处理的任务' };
  }

  const piecePos = player.pieces[pieceIndex];
  const newPos = calculateNewPosition(player.color, piecePos, room.diceValue);

  if (newPos === null) {
    return { success: false, error: '无法移动' };
  }

  // 记录旧位置
  const oldPos = piecePos;

  // 检查是否吃子
  let eatenPiece = null;
  for (const otherPlayer of room.players) {
    if (otherPlayer.id === playerId) continue;

    for (let i = 0; i < otherPlayer.pieces.length; i++) {
      const otherPos = otherPlayer.pieces[i];

      // 检查是否在同一位置 (外圈安全格不吃子)
      if (newPos === otherPos && !isSafePosition(newPos)) {
        // 吃子
        otherPlayer.pieces[i] = -1;
        eatenPiece = { playerId: otherPlayer.id, pieceIndex: i };
        break;
      }
    }
  }

  // 更新位置
  player.pieces[pieceIndex] = newPos;

  // 检查是否到达终点
  let finished = false;
  if (isAtHome(player.color, newPos)) {
    player.finished++;
    if (player.finished >= 4) {
      room.winner = playerId;
      room.gameState = 'finished';
    }
    finished = true;
  }

  // 重置骰子
  room.diceRolled = false;
  room.diceValue = null;

  // 更新活动
  room.lastActivity = Date.now();

  return {
    success: true,
    playerId,
    pieceIndex,
    oldPosition: oldPos,
    newPosition: newPos,
    eatenPiece,
    finished,
    extraTurn: room.diceRolled === false && room.diceValue === null ? false : undefined
  };
}

// 投骰子
function doRollDice(room, playerId) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, error: '玩家不存在' };
  }

  if (room.players[room.currentTurnIndex].id !== playerId) {
    return { success: false, error: '不是你的回合' };
  }

  if (room.diceRolled) {
    return { success: false, error: '已经投过骰子了' };
  }

  if (room.taskPending) {
    return { success: false, error: '有待处理的任务' };
  }

  const diceValue = rollDice();
  room.diceValue = diceValue;
  room.diceRolled = true;
  room.lastActivity = Date.now();

  // 检查是否有可移动的棋子
  const movablePieces = getMovablePieces(player, diceValue, null);

  // 如果没有可移动的棋子，切换回合
  let turnChange = false;
  if (movablePieces.length === 0) {
    // 投到6可以额外投一次
    if (diceValue !== 6) {
      turnChange = true;
      room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
      // 确保下一位玩家在线
      while (!room.players[room.currentTurnIndex].isOnline) {
        room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
      }
    }
    room.diceRolled = false;
    room.diceValue = null;
  }

  // 检查是否触发任务 (移动后)
  let task = null;
  if (!turnChange && movablePieces.length > 0) {
    // 将在下一步move时处理任务触发
  }

  return {
    success: true,
    diceValue,
    playerId,
    movablePieces,
    turnChange,
    nextPlayerId: room.players[room.currentTurnIndex].id
  };
}

// 获取任务 (根据位置)
function getTaskForPosition(position, taskPackage) {
  if (!taskPackage || !taskPackage.tasks) {
    return null;
  }

  // 位置1-52对应任务
  const normalizedPos = ((position % 52) + 52) % 52 + 1;
  const task = taskPackage.tasks.find(t => t.position === normalizedPos);

  return task || null;
}

// 处理任务完成
function completeTask(room, playerId, taskResult) {
  if (!room.taskPending) {
    return { success: false, error: '没有待处理的任务' };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, error: '玩家不存在' };
  }

  const task = room.taskPending;
  let success = false;
  let forward = 0;
  let backward = 0;
  let extraTurn = false;
  let skipTurn = false;
  let message = '';

  switch (task.type) {
    case 'question':
      // 检查答案
      const correctAnswer = parseInt(taskResult.answer);
      if (correctAnswer === task.answer) {
        success = true;
        forward = 3;
        message = '回答正确! 前进3格';
      } else {
        success = false;
        skipTurn = true;
        message = `回答错误! 正确答案是: ${task.options[task.answer]}`;
      }
      break;

    case 'action':
      // 动作任务直接成功
      success = true;
      forward = 2;
      message = '动作完成! 前进2格';
      break;

    case 'challenge':
      // 挑战任务直接成功
      success = true;
      forward = 4;
      message = '挑战完成! 前进4格';
      break;

    case 'luck':
      // 运气任务自动处理
      success = true;
      if (task.forward) {
        forward = task.forward;
        message = task.content;
      } else if (task.backward) {
        backward = task.backward;
        message = task.content;
      } else if (task.extraTurn) {
        extraTurn = true;
        message = task.content;
      } else if (task.skipTurn) {
        skipTurn = true;
        message = task.content;
      } else {
        forward = 1;
        message = task.content;
      }
      break;
  }

  // 移动棋子
  if (success && (forward > 0 || backward > 0)) {
    const moveAmount = forward > 0 ? forward : -backward;
    // 应用移动到当前棋子
    // 这里需要记录是哪架棋子触发的任务
  }

  // 清除任务
  const pendingTask = room.taskPending;
  room.taskPending = null;

  // 切换回合 (除非extraTurn)
  if (!extraTurn && !success) {
    // 失败停一回合
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    while (!room.players[room.currentTurnIndex].isOnline) {
      room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    }
  } else if (!extraTurn) {
    // 成功继续但不额外投骰子
    room.diceRolled = false;
    room.diceValue = null;
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    while (!room.players[room.currentTurnIndex].isOnline) {
      room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    }
  }

  room.lastActivity = Date.now();

  return {
    success: true,
    taskSuccess: success,
    message,
    extraTurn,
    skipTurn,
    nextPlayerId: room.players[room.currentTurnIndex].id,
    pendingTask
  };
}

// 获取游戏状态
function getGameState(room) {
  return {
    code: room.code,
    mode: room.mode,
    gameState: room.gameState,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      pieces: p.pieces,
      finished: p.finished,
      isOnline: p.isOnline
    })),
    currentTurnIndex: room.currentTurnIndex,
    currentPlayerId: room.players[room.currentTurnIndex]?.id || null,
    diceValue: room.diceValue,
    diceRolled: room.diceRolled,
    taskPending: room.taskPending,
    winner: room.winner
  };
}

// 应用运气任务效果
function applyLuckEffect(room, playerId, task) {
  if (!task || task.type !== 'luck') {
    return { success: false, error: '不是运气任务' };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, error: '玩家不存在' };
  }

  // 找到当前移动的棋子
  let currentPieceIndex = -1;
  for (let i = 0; i < player.pieces.length; i++) {
    if (player.pieces[i] >= 52) { // 在入口或终点跑道
      currentPieceIndex = i;
      break;
    }
  }

  if (currentPieceIndex === -1) {
    // 默认移动第一架飞机
    currentPieceIndex = 0;
  }

  let newPos = player.pieces[currentPieceIndex];
  let message = task.content;

  if (task.forward) {
    newPos += task.forward;
  } else if (task.backward) {
    newPos -= task.backward;
    if (newPos < 0) newPos = -1; // 回大本营
  } else if (task.extraTurn) {
    // 额外投骰子，不需要立即处理
  } else if (task.skipTurn) {
    // 暂停一回合
  } else if (task.swap) {
    // 与其他玩家交换位置 - 需要指定目标
  } else if (task.kickback) {
    // 送对手回大本营 - 需要指定目标
  } else if (task.randomMove !== undefined) {
    // 随机移动
    const randomSteps = Math.floor(Math.random() * (task.randomMove + 1));
    newPos += randomSteps;
  } else if (task.diceFate) {
    // 投骰子决定命运
    const fateDice = rollDice();
    if (fateDice <= 3) {
      newPos += fateDice;
    } else {
      newPos -= (fateDice - 3);
      if (newPos < 0) newPos = -1;
    }
    message = `投到${fateDice}! ${fateDice <= 3 ? '前进' + fateDice + '格' : '后退' + (fateDice - 3) + '格'}`;
  }

  // 确保位置有效
  if (newPos > 91) newPos = 91;
  if (newPos < -1) newPos = -1;

  player.pieces[currentPieceIndex] = newPos;

  // 清除任务
  room.taskPending = null;

  return {
    success: true,
    playerId,
    pieceIndex: currentPieceIndex,
    newPosition: newPos,
    message
  };
}

module.exports = {
  BOARD_CONFIG,
  COLOR_CONFIG,
  rollDice,
  getColorConfig,
  isSafePosition,
  isInHomeStretch,
  isAtHome,
  getMovablePieces,
  calculateNewPosition,
  movePiece,
  doRollDice,
  getTaskForPosition,
  completeTask,
  getGameState,
  applyLuckEffect,
  loadTaskPackage
};
