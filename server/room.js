const {
  generateRoomCode,
  generateShortCode,
  generatePlayerId,
  deepClone,
  validatePassword,
  validateMaxPlayers,
  validateTurnDuration,
  isValidDifficulty,
  getDifficultyConfig
} = require('./utils');

// 房间存储 (内存)
const rooms = new Map();

// 玩家到房间的映射
const playerToRoom = new Map();

// 清理过期的房间 (30分钟无活动)
const ROOM_TIMEOUT = 30 * 60 * 1000;

// 内部房间存储 (供 game.js 直接操作)
const _rooms = rooms;
function _getRawRoom(roomCode) {
  return rooms.get(roomCode) || null;
}

// 棋子颜色配置 - 支持6种颜色
const PIECE_COLORS = [
  { color: 'red', name: '红色', icon: '🔴' },
  { color: 'blue', name: '蓝色', icon: '🔵' },
  { color: 'yellow', name: '黄色', icon: '🟡' },
  { color: 'green', name: '绿色', icon: '🟢' },
  { color: 'purple', name: '紫色', icon: '🟣' },
  { color: 'orange', name: '橙色', icon: '🟠' }
];

// 获取房间中已选择的颜色
function getUsedColors(room) {
  return room.players
    .filter(p => p.color)
    .map(p => p.color);
}

// 获取可用的颜色
function getAvailableColors(room) {
  const used = getUsedColors(room);
  return PIECE_COLORS.filter(c => !used.includes(c.color));
}

// 创建房间
function createRoom(mode, playerName, password = null, options = {}) {
  if (!['couple', 'multi'].includes(mode)) {
    return { success: false, error: '无效的房间模式' };
  }

  // 密码验证 (情侣模式强制需要密码，多人模式可选)
  let validatedPassword = null;
  if (password !== null && password !== undefined && password !== '') {
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return { success: false, error: pwdCheck.error };
    }
    validatedPassword = pwdCheck.filtered;
  }

  // 最大玩家数验证
  let maxPlayers = mode === 'couple' ? 2 : 4;
  if (options.maxPlayers !== undefined) {
    const maxCheck = validateMaxPlayers(options.maxPlayers);
    if (!maxCheck.valid) {
      return { success: false, error: maxCheck.error };
    }
    // 情侣模式最多2人
    maxPlayers = mode === 'couple' ? Math.min(maxCheck.value, 2) : maxCheck.value;
  }

  // 回合时长验证
  let turnDuration = 45;
  if (options.turnDuration !== undefined) {
    const durCheck = validateTurnDuration(options.turnDuration);
    if (!durCheck.valid) {
      return { success: false, error: durCheck.error };
    }
    turnDuration = durCheck.value;
  }

  // 难度设置
  let difficulty = 'normal';
  if (options.difficulty !== undefined) {
    if (!isValidDifficulty(options.difficulty)) {
      return { success: false, error: '无效的难度设置' };
    }
    difficulty = options.difficulty;
  }

  // 是否公开
  const isPublic = options.isPublic === true;

  const roomCode = generateRoomCode();

  // 验证房间码唯一性
  if (rooms.has(roomCode)) {
    return { success: false, error: '房间创建失败，请重试' };
  }

  // 房主玩家 - 单棋子
  const playerId = generatePlayerId();
  const availableForOwner = PIECE_COLORS.slice(0, maxPlayers);
  // 如果用户选择了颜色，优先使用；否则默认第一个可用
  let defaultColor = availableForOwner[0].color;
  if (options && options.pieceColor) {
    const valid = PIECE_COLORS.find(c => c.color === options.pieceColor);
    if (valid) defaultColor = valid.color;
  }

  const player = {
    id: playerId,
    name: playerName || '玩家1',
    color: defaultColor,
    colorName: (PIECE_COLORS.find(c => c.color === defaultColor) || PIECE_COLORS[0]).name,
    piece: -1,  // 单棋子: -1 表示在大本营
    pieces: [ -1 ],  // 兼容旧的 pieces 数组
    finished: 0,
    isOnline: true,
    isOwner: true,
    colorChosen: true,
    lastActivity: Date.now()
  };

  const room = {
    code: roomCode,
    shortCode: generateShortCode(roomCode),
    mode: mode,
    password: validatedPassword,
    isPublic: isPublic,
    players: [player],
    maxPlayers: maxPlayers,
    turnDuration: turnDuration,
    difficulty: difficulty,
    currentTurnIndex: 0,
    gameState: 'waiting', // waiting, selecting, playing, finished
    taskPackageId: 'default',
    diceValue: null,
    diceRolled: false,
    taskPending: null,
    pendingPlayerIndex: null,
    winner: null,
    turnStartedAt: null,
    turnTimeoutHandle: null,
    createdAt: Date.now(),
    lastActivity: Date.now()
  };

  rooms.set(roomCode, room);
  playerToRoom.set(playerId, roomCode);

  return {
    success: true,
    room: deepClone(room),
    playerId,
    player
  };
}

// 加入房间
function joinRoom(roomCode, playerName, password = null) {
  const room = rooms.get(roomCode);

  if (!room) {
    return { success: false, error: '房间不存在' };
  }

  if (room.gameState === 'finished') {
    return { success: false, error: '游戏已结束' };
  }

  if (room.players.length >= room.maxPlayers) {
    return { success: false, error: '房间已满' };
  }

  // 密码检查
  if (room.password && room.password !== password) {
    return { success: false, error: '密码错误' };
  }

  const playerId = generatePlayerId();
  // 分配未被选择的颜色
  const availableColors = getAvailableColors(room);
  const assignedColor = availableColors.length > 0 ? availableColors[0] : PIECE_COLORS[room.players.length % PIECE_COLORS.length];

  const player = {
    id: playerId,
    name: playerName || `玩家${room.players.length + 1}`,
    color: assignedColor.color,
    colorName: assignedColor.name,
    piece: -1,
    pieces: [ -1 ],
    finished: 0,
    isOnline: true,
    isOwner: false,
    colorChosen: false,
    lastActivity: Date.now()
  };

  room.players.push(player);
  room.lastActivity = Date.now();
  playerToRoom.set(playerId, roomCode);

  return {
    success: true,
    room: deepClone(room),
    playerId,
    player
  };
}

// 通过短码加入房间
function joinRoomByShortCode(shortCode, playerName, password = null) {
  const parts = shortCode.toUpperCase().split('-');
  if (parts.length !== 2) {
    return { success: false, error: '短码格式错误' };
  }

  for (const [roomCode, room] of rooms) {
    if (room.shortCode === shortCode.toUpperCase()) {
      return joinRoom(roomCode, playerName, password);
    }
  }

  return { success: false, error: '房间不存在或短码已过期' };
}

// 玩家选择棋子颜色
function choosePlayerColor(playerId, roomCode, color) {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: '房间不存在' };

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { success: false, error: '玩家不存在' };

  // 游戏开始后不允许更换颜色
  if (room.gameState !== 'waiting' && room.gameState !== 'selecting') {
    return { success: false, error: '游戏已开始，无法更换棋子颜色' };
  }

  // 验证颜色是否有效
  const validColor = PIECE_COLORS.find(c => c.color === color);
  if (!validColor) return { success: false, error: '无效的颜色' };

  // 验证颜色是否已被使用
  const usedColors = getUsedColors(room).filter(c => c !== player.color);
  if (usedColors.includes(color)) {
    return { success: false, error: '该颜色已被其他玩家选择' };
  }

  player.color = validColor.color;
  player.colorName = validColor.name;
  player.colorChosen = true;
  player.lastActivity = Date.now();
  room.lastActivity = Date.now();

  return {
    success: true,
    room: deepClone(room),
    player
  };
}

// 房主重置密码
function resetPassword(ownerId, roomCode, newPassword) {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: '房间不存在' };

  const owner = room.players.find(p => p.id === ownerId);
  if (!owner || !owner.isOwner) {
    return { success: false, error: '仅房主可以重置密码' };
  }

  if (newPassword === null || newPassword === undefined || newPassword === '') {
    room.password = null;
    room.lastActivity = Date.now();
    return { success: true, room: deepClone(room) };
  }

  const pwdCheck = validatePassword(newPassword);
  if (!pwdCheck.valid) {
    return { success: false, error: pwdCheck.error };
  }

  room.password = pwdCheck.filtered;
  room.lastActivity = Date.now();

  return { success: true, room: deepClone(room) };
}

// 设置难度
function setDifficulty(ownerId, roomCode, difficulty) {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: '房间不存在' };

  const owner = room.players.find(p => p.id === ownerId);
  if (!owner || !owner.isOwner) {
    return { success: false, error: '仅房主可以设置难度' };
  }

  if (room.gameState === 'playing' || room.gameState === 'finished') {
    return { success: false, error: '游戏进行中无法更改难度' };
  }

  if (!isValidDifficulty(difficulty)) {
    return { success: false, error: '无效的难度' };
  }

  room.difficulty = difficulty;
  room.lastActivity = Date.now();

  return { success: true, room: deepClone(room) };
}

// 设置回合时长
function setTurnDuration(ownerId, roomCode, seconds) {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: '房间不存在' };

  const owner = room.players.find(p => p.id === ownerId);
  if (!owner || !owner.isOwner) {
    return { success: false, error: '仅房主可以设置回合时长' };
  }

  if (room.gameState === 'playing' || room.gameState === 'finished') {
    return { success: false, error: '游戏进行中无法更改回合时长' };
  }

  const durCheck = validateTurnDuration(seconds);
  if (!durCheck.valid) {
    return { success: false, error: durCheck.error };
  }

  room.turnDuration = durCheck.value;
  room.lastActivity = Date.now();

  return { success: true, room: deepClone(room) };
}

// 设置最大玩家数
function setMaxPlayers(ownerId, roomCode, maxPlayers) {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: '房间不存在' };

  const owner = room.players.find(p => p.id === ownerId);
  if (!owner || !owner.isOwner) {
    return { success: false, error: '仅房主可以设置最大人数' };
  }

  if (room.gameState === 'playing' || room.gameState === 'finished') {
    return { success: false, error: '游戏进行中无法更改最大人数' };
  }

  const maxCheck = validateMaxPlayers(maxPlayers);
  if (!maxCheck.valid) {
    return { success: false, error: maxCheck.error };
  }

  // 新的最大人数不能小于当前玩家数
  if (maxCheck.value < room.players.length) {
    return { success: false, error: `最大人数不能小于当前玩家数(${room.players.length})` };
  }

  // 情侣模式最多2人
  if (room.mode === 'couple' && maxCheck.value > 2) {
    return { success: false, error: '情侣模式最多2人' };
  }

  room.maxPlayers = maxCheck.value;
  room.lastActivity = Date.now();

  return { success: true, room: deepClone(room) };
}

// 离开房间
function leaveRoom(playerId) {
  const roomCode = playerToRoom.get(playerId);
  if (!roomCode) return { success: true };

  const room = rooms.get(roomCode);
  if (!room) {
    playerToRoom.delete(playerId);
    return { success: true };
  }

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    playerToRoom.delete(playerId);
    return { success: true };
  }

  // 标记玩家离线而非直接删除，保留游戏状态
  room.players[playerIndex].isOnline = false;

  // 如果游戏已结束或房间只剩1人，删除房间
  const onlinePlayers = room.players.filter(p => p.isOnline);
  if (onlinePlayers.length === 0) {
    rooms.delete(roomCode);
    room.players.forEach(p => playerToRoom.delete(p.id));
    return { success: true, roomDeleted: true };
  }

  // 如果房主离开，将房主转移给第一位在线玩家
  if (room.players[playerIndex].isOwner) {
    const newOwner = room.players.find(p => p.id !== playerId && p.isOnline);
    if (newOwner) {
      newOwner.isOwner = true;
    }
  }

  // 如果游戏进行中，重新计算回合
  if (room.gameState === 'playing' && room.currentTurnIndex === playerIndex) {
    // 当前回合玩家离开，切换到下一位
    room.currentTurnIndex = room.players.findIndex(p => p.isOnline);
  }

  playerToRoom.delete(playerId);
  room.lastActivity = Date.now();

  return { success: true, room: deepClone(room) };
}

// 获取房间信息
function getRoom(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return null;
  return deepClone(room);
}

// 获取玩家信息
function getPlayer(playerId) {
  const roomCode = playerToRoom.get(playerId);
  if (!roomCode) return null;

  const room = rooms.get(roomCode);
  if (!room) return null;

  return room.players.find(p => p.id === playerId) || null;
}

// 获取当前玩家
function getCurrentPlayer(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  const player = room.players[room.currentTurnIndex];
  return player && player.isOnline ? player : null;
}

// 更新玩家活动时间
function updatePlayerActivity(playerId) {
  const roomCode = playerToRoom.get(playerId);
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) return;

  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.lastActivity = Date.now();
  }
  room.lastActivity = Date.now();
}

// 重连处理 - 保留原有棋子和游戏状态
function reconnect(playerId, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: '房间不存在' };

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { success: false, error: '玩家不存在' };

  // 检查重连时间窗口 (90秒，给予更多缓冲)
  const now = Date.now();
  const offlineTime = now - player.lastActivity;
  if (offlineTime > 90000) {
    return { success: false, error: '重连超时，请重新加入游戏' };
  }

  player.isOnline = true;
  playerToRoom.set(playerId, roomCode);
  room.lastActivity = now;

  return {
    success: true,
    room: deepClone(room),
    player
  };
}

// 设置任务包
function setTaskPackage(roomCode, taskPackageId) {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: '房间不存在' };

  if (room.gameState === 'playing' || room.gameState === 'finished') {
    return { success: false, error: '游戏进行中无法更改任务包' };
  }

  room.taskPackageId = taskPackageId;
  room.lastActivity = Date.now();

  return { success: true, room: deepClone(room) };
}

// 开始游戏
function startGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: '房间不存在' };

  if (room.players.length < 2) {
    return { success: false, error: '至少需要2名玩家才能开始' };
  }

  if (room.gameState !== 'waiting' && room.gameState !== 'selecting') {
    return { success: false, error: '游戏已经开始' };
  }

  // 重置所有棋子位置到起点 (保留玩家选择的颜色)
  room.players.forEach(player => {
    player.piece = -1;
    player.pieces = [-1];
    player.finished = 0;
  });

  room.gameState = 'playing';
  room.currentTurnIndex = 0;
  room.diceValue = null;
  room.diceRolled = false;
  room.taskPending = null;
  room.pendingPlayerIndex = null;
  room.winner = null;
  room.turnStartedAt = Date.now();
  room.lastActivity = Date.now();

  return { success: true, room: deepClone(room) };
}

// 获取所有房间 (用于短码查询)
function getAllRooms() {
  return Array.from(rooms.values());
}

// 获取棋子颜色配置
function getPieceColors() {
  return PIECE_COLORS;
}

// 获取所有可用颜色
function getRoomColors(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return { used: [], available: PIECE_COLORS.map(c => c.color) };
  return {
    used: getUsedColors(room),
    available: getAvailableColors(room).map(c => c.color)
  };
}

// 获取所有公开房间（未开始的）
function getPublicRooms() {
  const publicRooms = [];
  for (const [code, room] of rooms) {
    if (room.isPublic && (room.gameState === 'waiting' || room.gameState === 'selecting')) {
      publicRooms.push({
        code: room.code,
        shortCode: room.shortCode,
        mode: room.mode,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        difficulty: room.difficulty,
        hasPassword: !!room.password,
        isPublic: room.isPublic,
        createdAt: room.createdAt
      });
    }
  }
  // 按创建时间倒序排列
  publicRooms.sort((a, b) => b.createdAt - a.createdAt);
  return publicRooms.slice(0, 20); // 最多返回20个
}

// 清理过期房间
function cleanupExpiredRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_TIMEOUT) {
      room.players.forEach(p => playerToRoom.delete(p.id));
      rooms.delete(code);
      console.log(`清理过期房间: ${code}`);
    }
  }
}

// 定期清理 (每5分钟)
setInterval(cleanupExpiredRooms, 5 * 60 * 1000);

module.exports = {
  createRoom,
  joinRoom,
  joinRoomByShortCode,
  leaveRoom,
  getRoom,
  getPlayer,
  getCurrentPlayer,
  updatePlayerActivity,
  reconnect,
  setTaskPackage,
  startGame,
  getAllRooms,
  getPublicRooms,
  choosePlayerColor,
  resetPassword,
  setDifficulty,
  setTurnDuration,
  setMaxPlayers,
  getPieceColors,
  getRoomColors,
  _getRawRoom,
  PIECE_COLORS
};
