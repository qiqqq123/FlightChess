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

// 验证内容安全性
function validateContent(content, maxLength = 100) {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: '内容不能为空' };
  }
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: '内容不能为空' };
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: `内容不能超过${maxLength}字` };
  }
  const filtered = filterSensitiveWords(trimmed);
  if (filtered.includes('*')) {
    return { valid: false, error: '内容包含敏感词' };
  }
  return { valid: true, filtered };
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

module.exports = {
  generateRoomCode,
  generateShortCode,
  decodeShortCode,
  base62Encode,
  base62Decode,
  filterSensitiveWords,
  validateContent,
  generatePlayerId,
  getTimestamp,
  shuffle,
  deepClone
};
