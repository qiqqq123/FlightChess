const { generateRoomCode, generateShortCode, generatePlayerId, deepClone } = require('./utils');

// 房间存储 (内存)
const rooms = new Map();

// 玩家到房间的映射
const playerToRoom = new Map();

// 清理过期的房间 (30分钟无活动)
const ROOM_TIMEOUT = 30 * 60 * 1000;

// 房间颜色配置
const PLAYER_COLORS = [
  { color: 'red', name: '红色', position: 0 },
  { color: 'blue', name: '蓝色', position: 1 },
  { color: 'yellow', name: '黄色', position: 2 },
  { color: 'green', name: '绿色', position: 3 }
];

// 创建房间
function createRoom(mode, playerName, password = null) {
  const roomCode = generateRoomCode();

  // 验证房间码唯一性
  let attempts = 0;
  while (rooms.has(roomCode) && attempts < 10) {
    attempts++;
  }

  if (rooms.has(roomCode)) {
    return { success: false, error: '房间创建失败，请重试' };
  }

  const playerId = generatePlayerId();
  const player = {
    id: playerId,
    name: playerName || '玩家1',
    color: PLAYER_COLORS[0].color,
    colorName: PLAYER_COLORS[0].name,
    pieces: [-1, -1, -1, -1], // -1表示在大本营
    finished: 0,
    isOnline: true,
    lastActivity: Date.now()
  };

  const room = {
    code: roomCode,
    shortCode: generateShortCode(roomCode),
    mode: mode, // 'couple' (2人) 或 'multi' (2-4人)
    password: password,
    players: [player],
    maxPlayers: mode === 'couple' ? 2 : 4,
    currentTurnIndex: 0,
    gameState: 'waiting', // waiting, playing, finished
    taskPackageId: 'default',
    diceValue: null,
    diceRolled: false,
    taskPending: null,
    pendingPlayerIndex: null,
    winner: null,
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

  if (room.gameState !== 'waiting') {
    return { success: false, error: '游戏已经开始，无法加入' };
  }

  if (room.players.length >= room.maxPlayers) {
    return { success: false, error: '房间已满' };
  }

  if (room.password && room.password !== password) {
    return { success: false, error: '密码错误' };
  }

  const playerId = generatePlayerId();
  const colorIndex = room.players.length;
  const player = {
    id: playerId,
    name: playerName || `玩家${room.players.length + 1}`,
    color: PLAYER_COLORS[colorIndex].color,
    colorName: PLAYER_COLORS[colorIndex].name,
    pieces: [-1, -1, -1, -1],
    finished: 0,
    isOnline: true,
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
  // 短码格式: XXXX-XXXX
  // 实际应用中，短码会映射到房间码
  // 这里简化处理，假设短码直接对应房间码的前4位+后4位
  const parts = shortCode.toUpperCase().split('-');
  if (parts.length !== 2) {
    return { success: false, error: '短码格式错误' };
  }

  // 简单映射：实际应用中应使用数据库存储短码映射
  // 这里通过遍历查找匹配的短码
  for (const [roomCode, room] of rooms) {
    if (room.shortCode === shortCode) {
      return joinRoom(roomCode, playerName, password);
    }
  }

  return { success: false, error: '房间不存在或短码已过期' };
}

// 离开房间
function leaveRoom(playerId) {
  const roomCode = playerToRoom.get(playerId);
  if (!roomCode) {
    return { success: false, error: '玩家不在任何房间' };
  }

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

  // 如果所有人都离线或只剩1人且游戏未开始，删除房间
  const onlinePlayers = room.players.filter(p => p.isOnline);
  if (onlinePlayers.length === 0 || (room.gameState === 'waiting' && onlinePlayers.length < 2)) {
    rooms.delete(roomCode);
    room.players.forEach(p => playerToRoom.delete(p.id));
    return { success: true, roomDeleted: true };
  }

  // 如果游戏进行中，重新计算回合
  if (room.gameState === 'playing' && room.currentTurnIndex >= room.players.length) {
    room.currentTurnIndex = room.players.findIndex(p => p.isOnline);
    if (room.currentTurnIndex === -1) room.currentTurnIndex = 0;
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

// 重连处理
function reconnect(playerId, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, error: '玩家不存在' };
  }

  // 检查重连时间窗口 (30秒)
  const now = Date.now();
  const offlineTime = now - player.lastActivity;
  if (offlineTime > 30000) {
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
  if (!room) {
    return { success: false, error: '房间不存在' };
  }

  if (room.gameState !== 'waiting') {
    return { success: false, error: '游戏已开始，无法更改任务包' };
  }

  room.taskPackageId = taskPackageId;
  room.lastActivity = Date.now();

  return { success: true, room: deepClone(room) };
}

// 开始游戏
function startGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }

  if (room.players.length < 2) {
    return { success: false, error: '至少需要2名玩家才能开始' };
  }

  if (room.gameState !== 'waiting') {
    return { success: false, error: '游戏已经开始' };
  }

  // 重置所有飞机位置
  room.players.forEach(player => {
    player.pieces = [-1, -1, -1, -1];
    player.finished = 0;
  });

  room.gameState = 'playing';
  room.currentTurnIndex = 0;
  room.diceValue = null;
  room.diceRolled = false;
  room.taskPending = null;
  room.pendingPlayerIndex = null;
  room.winner = null;
  room.lastActivity = Date.now();

  return { success: true, room: deepClone(room) };
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
  PLAYER_COLORS
};
