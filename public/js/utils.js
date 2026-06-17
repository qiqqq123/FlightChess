// 工具函数

// 生成随机ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// 复制文本到剪贴板
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('已复制到剪贴板');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast('已复制到剪贴板');
  } catch (err) {
    showToast('复制失败');
  }
  document.body.removeChild(textarea);
}

// 显示提示
let toastTimeout = null;
function showToast(message, duration = 2000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg z-50 fade-in';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg z-50 fade-in';

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// 格式化时间戳
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 加载状态
function showLoading() {
  let loader = document.getElementById('loading');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'loading';
    loader.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    loader.innerHTML = '<div class="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>';
    document.body.appendChild(loader);
  }
  loader.style.display = 'flex';
}

function hideLoading() {
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'none';
}

// 颜色映射
const COLORS = {
  red: '#E53935',
  blue: '#1E88E5',
  yellow: '#FDD835',
  green: '#43A047'
};

const COLOR_NAMES = {
  red: '红色',
  blue: '蓝色',
  yellow: '黄色',
  green: '绿色'
};

// 获取颜色CSS
function getColorCSS(color) {
  return COLORS[color] || '#888888';
}

// 验证房间码格式
function isValidRoomCode(code) {
  return /^[A-Z]{6}$/.test(code);
}

// 验证短码格式
function isValidShortCode(code) {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}

// 玩家状态类
class PlayerState {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.color = data.color;
    this.pieces = data.pieces || [-1, -1, -1, -1];
    this.finished = data.finished || 0;
    this.isOnline = data.isOnline !== false;
  }
}

// 游戏状态类
class GameState {
  constructor(data) {
    this.code = data.code;
    this.mode = data.mode;
    this.gameState = data.gameState;
    this.players = (data.players || []).map(p => new PlayerState(p));
    this.currentTurnIndex = data.currentTurnIndex || 0;
    this.currentPlayerId = data.currentPlayerId || null;
    this.diceValue = data.diceValue;
    this.diceRolled = data.diceRolled || false;
    this.taskPending = data.taskPending || null;
    this.winner = data.winner || null;
  }

  getCurrentPlayer() {
    return this.players.find(p => p.id === this.currentPlayerId);
  }

  isMyTurn(playerId) {
    return this.currentPlayerId === playerId && this.gameState === 'playing';
  }

  getPlayerById(id) {
    return this.players.find(p => p.id === id);
  }

  getPlayerIndex(id) {
    return this.players.findIndex(p => p.id === id);
  }
}
