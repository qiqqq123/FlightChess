const { v4: uuidv4 } = require('uuid');

// 生成房间码 (6位大写字母)
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 生成8位短码 XXXX-XXXX
function generateShortCode(roomCode) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let prefix = '';
  for (let i = 0; i < 4; i++) {
    prefix += chars[Math.floor(Math.random() * chars.length)];
  }
  // 校验码简单实现
  let checksum = 0;
  for (let i = 0; i < roomCode.length; i++) {
    checksum += roomCode.charCodeAt(i);
  }
  const suffix = chars[checksum % chars.length] + chars[(checksum * 3) % chars.length] +
                 chars[(checksum * 7) % chars.length] + chars[(checksum * 11) % chars.length];
  return `${prefix}-${suffix}`;
}

// 解码短码
function decodeShortCode(shortCode) {
  const parts = shortCode.split('-');
  if (parts.length !== 2 || parts[0].length !== 4 || parts[1].length !== 4) {
    return null;
  }
  return {
    prefix: parts[0],
    suffix: parts[1],
    full: shortCode.toUpperCase()
  };
}

// Base62编码
function base62Encode(str) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz0123456789';
  let result = '';
  let num = 0;
  for (let i = 0; i < str.length; i++) {
    num = num * 256 + str.charCodeAt(i);
  }
  while (num > 0) {
    result = chars[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return result || chars[0];
}

// Base62解码
function base62Decode(encoded) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz0123456789';
  let result = 0;
  for (let i = 0; i < encoded.length; i++) {
    result = result * 62 + chars.indexOf(encoded[i]);
  }
  let str = '';
  while (result > 0) {
    str = String.fromCharCode(result % 256) + str;
    result = Math.floor(result / 256);
  }
  return str;
}

// 敏感词过滤 (简单实现)
const sensitiveWords = ['反动', '暴力', '色情', '赌博', '诈骗', '毒品', '武器', '恐怖'];

function filterSensitiveWords(text) {
  if (!text) return text;
  let filtered = text;
  for (const word of sensitiveWords) {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  }
  return filtered;
}

// 验证密码: 6-10位数字+字母混合
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: '密码不能为空' };
  }
  const trimmed = password.trim();
  if (trimmed.length < 6 || trimmed.length > 10) {
    return { valid: false, error: '密码必须为6-10位' };
  }
  const hasLetter = /[a-zA-Z]/.test(trimmed);
  const hasDigit = /[0-9]/.test(trimmed);
  if (!hasLetter || !hasDigit) {
    return { valid: false, error: '密码必须包含字母和数字' };
  }
  if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
    return { valid: false, error: '密码只能包含字母和数字' };
  }
  return { valid: true, filtered: trimmed };
}

// 难度配置: easy(休闲), normal(团建), hard(竞技)
const DIFFICULTY_LEVELS = {
  easy: { name: '休闲模式', description: '任务简单，朋友聚会', taskTypes: ['luck', 'action'], forwardMultiplier: 1.0, timeLimit: 60 },
  normal: { name: '团建模式', description: '均衡难度，团队竞技', taskTypes: ['action', 'challenge', 'question'], forwardMultiplier: 1.0, timeLimit: 45 },
  hard: { name: '竞技模式', description: '高难度挑战，对抗竞技', taskTypes: ['question', 'challenge', 'action'], forwardMultiplier: 0.7, timeLimit: 30 }
};

function isValidDifficulty(level) {
  return DIFFICULTY_LEVELS.hasOwnProperty(level);
}

function getDifficultyConfig(level) {
  return DIFFICULTY_LEVELS[level] || DIFFICULTY_LEVELS.easy;
}

// 验证最大玩家数: 2-6人
function validateMaxPlayers(maxPlayers) {
  const num = parseInt(maxPlayers);
  if (isNaN(num)) {
    return { valid: false, error: '人数必须为数字' };
  }
  if (num < 2 || num > 6) {
    return { valid: false, error: '最大人数必须为2-6人' };
  }
  return { valid: true, value: num };
}

// 验证回合时长: 15-120秒
function validateTurnDuration(seconds) {
  const num = parseInt(seconds);
  if (isNaN(num)) {
    return { valid: false, error: '时长必须为数字' };
  }
  if (num < 15 || num > 120) {
    return { valid: false, error: '回合时长必须为15-120秒' };
  }
  return { valid: true, value: num };
}

// 生成玩家ID
function generatePlayerId() {
  return uuidv4().slice(0, 8);
}

// 获取当前时间戳
function getTimestamp() {
  return Date.now();
}

// 数组洗牌
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 深度克隆
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function validateContent(content) {
  if (!content || typeof content !== 'string') return { valid: true, filtered: '' };
  const filtered = filterSensitiveWords(content);
  return { valid: true, filtered };
}

module.exports = {
  generateRoomCode,
  generateShortCode,
  decodeShortCode,
  base62Encode,
  base62Decode,
  filterSensitiveWords,
  validateContent,
  validatePassword,
  isValidDifficulty,
  getDifficultyConfig,
  DIFFICULTY_LEVELS,
  validateMaxPlayers,
  validateTurnDuration,
  generatePlayerId,
  getTimestamp,
  shuffle,
  deepClone
};
