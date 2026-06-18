// 飞行棋棋盘渲染模块 - 单棋子版本

// Canvas roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') {
      r = { tl: r, tr: r, br: r, bl: r };
    }
    this.beginPath();
    this.moveTo(x + r.tl, y);
    this.lineTo(x + w - r.tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    this.lineTo(x + w, y + h - r.br);
    this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    this.lineTo(x + r.bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    this.lineTo(x, y + r.tl);
    this.quadraticCurveTo(x, y, x + r.tl, y);
    this.closePath();
    return this;
  };
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

// 棋盘配置
const BOARD_CONFIG = {
  CELL_SIZE: 40,
  PIECE_RADIUS: 16,
  PADDING: 20,
  TOTAL_CELLS: 52
};

// 颜色配置 (支持6种颜色)
const COLOR_CONFIG = {
  red:    { fill: '#E53935', stroke: '#B71C1C', glow: 'rgba(229, 57, 53, 0.5)',   label: '红' },
  blue:   { fill: '#1E88E5', stroke: '#0D47A1', glow: 'rgba(30, 136, 229, 0.5)',  label: '蓝' },
  yellow: { fill: '#FDD835', stroke: '#F9A825', glow: 'rgba(253, 216, 53, 0.5)',  label: '黄' },
  green:  { fill: '#43A047', stroke: '#2E7D32', glow: 'rgba(67, 160, 71, 0.5)',   label: '绿' },
  purple: { fill: '#8E24AA', stroke: '#4A148C', glow: 'rgba(142, 36, 170, 0.5)',  label: '紫' },
  orange: { fill: '#FB8C00', stroke: '#E65100', glow: 'rgba(251, 140, 0, 0.5)',   label: '橙' }
};

// 大本营位置 (6个玩家 - 根据颜色分配不同位置)
const BASE_POSITIONS = {
  red:    { x: 1, y: 7 },
  blue:   { x: 0, y: 1 },
  yellow: { x: 6, y: 0 },
  green:  { x: 7, y: 6 },
  purple: { x: 0, y: 4 },
  orange: { x: 4, y: 0 }
};

// 外圈格子位置 - 52格简化布局
let outerCells = [];

// 初始化棋盘
function initBoard() {
  if (!canvas) return;

  const containerWidth = Math.min(window.innerWidth - 20, 500);
  const size = containerWidth;

  canvas.width = size;
  canvas.height = size;

  BOARD_CONFIG.CELL_SIZE = size / 8;
  BOARD_CONFIG.PIECE_RADIUS = BOARD_CONFIG.CELL_SIZE * 0.45;
  BOARD_CONFIG.PADDING = BOARD_CONFIG.CELL_SIZE * 0.5;

  calculateOuterCells();
  renderBoard();
}

// 计算52个外圈格子位置
function calculateOuterCells() {
  outerCells = [];
  const cs = BOARD_CONFIG.CELL_SIZE;
  const p = BOARD_CONFIG.PADDING;

  function gridToPixel(gx, gy) {
    return {
      x: p + gx * cs + cs / 2,
      y: p + gy * cs + cs / 2
    };
  }

  // 布局: 8x8网格，外圈形成52格环形
  // 下方边 (y=7): x从1到6 = 6格 (位置 0-5)
  for (let i = 0; i < 6; i++) {
    outerCells.push(gridToPixel(1 + i, 7));
  }
  // 右下角转弯 (位置 6-7)
  outerCells.push(gridToPixel(7, 7));
  outerCells.push(gridToPixel(7, 6));

  // 右侧边 (x=7): y从5到1 = 5格 (位置 8-12)
  for (let i = 0; i < 5; i++) {
    outerCells.push(gridToPixel(7, 5 - i));
  }
  // 右上转弯
  outerCells.push(gridToPixel(7, 0));
  outerCells.push(gridToPixel(6, 0));

  // 上方边 (y=0): x从5到1 = 5格 (位置 15-19)
  for (let i = 0; i < 5; i++) {
    outerCells.push(gridToPixel(5 - i, 0));
  }
  // 左上转弯
  outerCells.push(gridToPixel(0, 0));
  outerCells.push(gridToPixel(0, 1));

  // 左侧边 (x=0): y从2到6 = 5格 (位置 22-26)
  for (let i = 0; i < 5; i++) {
    outerCells.push(gridToPixel(0, 2 + i));
  }
  // 左下转弯 (补全到52格)
  outerCells.push(gridToPixel(0, 7));

  // 使用简化的52格布局 - 每边13格 (标准飞行棋)
  outerCells = [];
  // 重新布局: 4边 x 13格 = 52格
  // 下方: y=7, x从1到6 (6), 然后y从6到1 (6) + 起点 = 13
  // 更简单的方式: 生成标准的52格环
  const positions = [];
  // 下方边 13格 (位置 0-12)
  for (let i = 0; i < 13; i++) {
    positions.push({ x: 1 + Math.min(i, 5), y: 7 - Math.max(0, i - 5) });
  }
  // 右侧边 13格 (位置 13-25)
  for (let i = 0; i < 13; i++) {
    positions.push({ x: 7 - Math.max(0, i - 7), y: 1 + Math.min(i, 5) });
  }
  // 上方边 13格 (位置 26-38)
  for (let i = 0; i < 13; i++) {
    positions.push({ x: 6 - Math.min(i, 5), y: 0 + Math.max(0, i - 5) });
  }
  // 左侧边 13格 (位置 39-51)
  for (let i = 0; i < 13; i++) {
    positions.push({ x: 0 + Math.max(0, i - 7), y: 6 - Math.min(i, 5) });
  }

  // 修正为更简单准确的52格布局
  outerCells = [];
  // 下方: y=7, x从1到6, 然后向上: x=7, y=6到3
  for (let x = 1; x <= 6; x++) outerCells.push(gridToPixel(x, 7));
  outerCells.push(gridToPixel(7, 7));
  for (let y = 6; y >= 3; y--) outerCells.push(gridToPixel(7, y));
  // 右方: y=2, x=7到6, 然后向上: y=1到0, x=6
  for (let y = 2; y >= 1; y--) outerCells.push(gridToPixel(7, y));
  for (let y = 0; y <= 0; y++) {
    for (let x = 6; x >= 1; x--) outerCells.push(gridToPixel(x, 0));
  }
  // 上方: y=0, x=0, 然后向下: y=1, x=0
  outerCells.push(gridToPixel(0, 0));
  for (let y = 1; y <= 3; y++) outerCells.push(gridToPixel(0, y));
  // 左方: y=4, x=0; y=5, x=0; y=6, x=0; y=7, x=0 回到起点
  for (let y = 4; y <= 6; y++) outerCells.push(gridToPixel(0, y));
  outerCells.push(gridToPixel(0, 7));

  // 确保恰好52格
  while (outerCells.length < 52) {
    outerCells.push(gridToPixel(outerCells.length % 7, outerCells.length % 8));
  }
  if (outerCells.length > 52) {
    outerCells = outerCells.slice(0, 52);
  }

  // 修正索引
  outerCells = outerCells.map((cell, i) => ({ x: cell.x, y: cell.y, index: i }));
}

// 渲染棋盘
function renderBoard() {
  if (!ctx || !canvas) return;

  const cs = BOARD_CONFIG.CELL_SIZE;
  const p = BOARD_CONFIG.PADDING;
  const w = canvas.width;
  const h = canvas.height;

  // 清空画布
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, w, h);

  // 绘制网格背景
  drawGrid();

  // 绘制外圈52格
  drawOuterCells();

  // 绘制中心区域
  drawCenter();

  // 绘制大本营
  drawBases();

  // 绘制棋子 (单棋子)
  if (window.gameState) {
    drawSinglePieces();
  }
}

// 绘制网格
function drawGrid() {
  const cs = BOARD_CONFIG.CELL_SIZE;
  const p = BOARD_CONFIG.PADDING;

  ctx.strokeStyle = '#0f3460';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(p + i * cs, p);
    ctx.lineTo(p + i * cs, p + 8 * cs);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p, p + i * cs);
    ctx.lineTo(p + 8 * cs, p + i * cs);
    ctx.stroke();
  }
}

// 绘制外圈格子
function drawOuterCells() {
  const cs = BOARD_CONFIG.CELL_SIZE;

  outerCells.forEach((cell, index) => {
    // 特殊格子类型
    const isSafe = [0, 13, 26, 39].includes(index);
    const isBonus = [9, 19, 29, 39, 49].includes(index);
    const isPenalty = [4, 14, 24, 34, 44].includes(index);

    let fillColor = '#0f3460';
    let strokeColor = '#1a4971';

    if (isSafe) {
      fillColor = '#533483';
      strokeColor = '#7c3aed';
    } else if (isBonus) {
      fillColor = '#2d5a2d';
      strokeColor = '#43A047';
    } else if (isPenalty) {
      fillColor = '#5a2d2d';
      strokeColor = '#E53935';
    }

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;

    const size = cs * 0.9;
    ctx.beginPath();
    ctx.roundRect(cell.x - size / 2, cell.y - size / 2, size, size, 4);
    ctx.fill();
    ctx.stroke();

    // 格子编号
    ctx.fillStyle = '#8899aa';
    ctx.font = `${cs * 0.2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(index.toString(), cell.x, cell.y);

    // 特殊格子图标
    if (isBonus) {
      ctx.fillStyle = '#43A047';
      ctx.font = `bold ${cs * 0.3}px Arial`;
      ctx.fillText('↑', cell.x, cell.y - cs * 0.2);
    }
    if (isPenalty) {
      ctx.fillStyle = '#E53935';
      ctx.font = `bold ${cs * 0.3}px Arial`;
      ctx.fillText('↓', cell.x, cell.y - cs * 0.2);
    }
  });
}

// 绘制中心区域
function drawCenter() {
  const cs = BOARD_CONFIG.CELL_SIZE;
  const p = BOARD_CONFIG.PADDING;
  const cx = p + 3.5 * cs;
  const cy = p + 3.5 * cs;
  const size = cs * 2.5;

  ctx.fillStyle = '#1a1a2e';
  ctx.strokeStyle = '#533483';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.roundRect(cx - size / 2, cy - size / 2, size, size, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#533483';
  ctx.font = `bold ${cs * 0.8}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✈️', cx, cy);
}

// 绘制大本营 (根据实际存在的玩家颜色)
function drawBases() {
  const cs = BOARD_CONFIG.CELL_SIZE;
  const p = BOARD_CONFIG.PADDING;

  const existingColors = window.gameState
    ? gameState.players.map(p => p.color).filter(Boolean)
    : ['red', 'blue', 'yellow', 'green'];

  existingColors.forEach((color) => {
    const pos = BASE_POSITIONS[color] || { x: 0, y: 0 };
    const px = p + pos.x * cs + cs / 2;
    const py = p + pos.y * cs + cs / 2;
    const config = COLOR_CONFIG[color];

    // 大本营背景
    ctx.fillStyle = config.fill;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.roundRect(px - cs / 2, py - cs / 2, cs, cs, 8);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 边框
    ctx.strokeStyle = config.fill;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(px - cs / 2, py - cs / 2, cs, cs, 8);
    ctx.stroke();

    // 大本营标签
    ctx.fillStyle = config.fill;
    ctx.font = `bold ${cs * 0.35}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('大本营', px, py);
  });
}

// 绘制棋子 - 单棋子版本
function drawSinglePieces() {
  if (!window.gameState) return;

  const cs = BOARD_CONFIG.CELL_SIZE;
  const p = BOARD_CONFIG.PADDING;
  const r = BOARD_CONFIG.PIECE_RADIUS;

  window.gameState.players.forEach(player => {
    if (!player || !player.color) return;

    const config = COLOR_CONFIG[player.color];
    if (!config) return;

    // 获取玩家的棋子位置 (单棋子: piece或pieces[0])
    const pos = (typeof player.piece !== 'undefined' && player.piece !== null)
      ? player.piece
      : (player.pieces && player.pieces[0] !== undefined ? player.pieces[0] : -1);

    let px, py;

    if (pos === -1 || pos === undefined || pos === null) {
      // 在大本营
      const basePos = BASE_POSITIONS[player.color] || { x: 0, y: 0 };
      px = p + basePos.x * cs + cs / 2;
      py = p + basePos.y * cs + cs / 2;
    } else if (pos >= 52) {
      // 到达终点
      const basePos = BASE_POSITIONS[player.color] || { x: 0, y: 0 };
      px = p + basePos.x * cs + cs / 2;
      py = p + basePos.y * cs + cs / 2;
    } else {
      // 在格子上 - 所有玩家棋子根据index偏移
      const cell = outerCells[pos];
      if (cell) {
        // 玩家按index偏移，避免重叠
        const playerIndex = window.gameState.players.findIndex(pl => pl.id === player.id);
        const numPlayers = window.gameState.players.length;
        const angle = (playerIndex / numPlayers) * Math.PI * 2;
        const offsetDist = cs * 0.12;

        px = cell.x + Math.cos(angle) * offsetDist;
        py = cell.y + Math.sin(angle) * offsetDist;
      } else {
        return;
      }
    }

    // 发光效果 (当前玩家回合高亮)
    const currentTurnPlayer = window.gameState && window.gameState.players[window.gameState.currentTurnIndex];
    const isCurrentTurn = currentTurnPlayer && currentTurnPlayer.id === player.id;
    if (isCurrentTurn) {
      ctx.shadowColor = config.glow;
      ctx.shadowBlur = 15;
    } else {
      ctx.shadowColor = config.glow;
      ctx.shadowBlur = 6;
    }

    // 绘制棋子 (大一些的单棋子)
    ctx.fillStyle = config.fill;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // 边框
    ctx.strokeStyle = config.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 飞机图标
    ctx.fillStyle = 'white';
    ctx.font = `bold ${r * 1.1}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✈', px, py);

    // 离线玩家半透明
    if (player.isOnline === false) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#aaa';
      ctx.font = `${r * 0.6}px Arial`;
      ctx.fillText('离线', px, py);
    }
  });
}

// 获取格子中心坐标
function getCellPosition(position) {
  if (position < 0 || position >= 52) return null;
  return outerCells[position];
}

// 检查点击位置是否在某个棋子上 (单棋子)
function getPieceAtPosition(x, y) {
  if (!window.gameState || !canvas) return null;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = (x - rect.left) * scaleX;
  const canvasY = (y - rect.top) * scaleY;

  const cs = BOARD_CONFIG.CELL_SIZE;
  const p = BOARD_CONFIG.PADDING;
  const r = BOARD_CONFIG.PIECE_RADIUS;

  for (const player of window.gameState.players) {
    if (!player || !player.color) continue;

    const pos = (typeof player.piece !== 'undefined' && player.piece !== null)
      ? player.piece
      : (player.pieces && player.pieces[0] !== undefined ? player.pieces[0] : -1);

    let px, py;
    if (pos === -1 || pos === undefined || pos === null) {
      const basePos = BASE_POSITIONS[player.color] || { x: 0, y: 0 };
      px = p + basePos.x * cs + cs / 2;
      py = p + basePos.y * cs + cs / 2;
    } else if (pos < 52) {
      const cell = outerCells[pos];
      if (!cell) continue;
      px = cell.x;
      py = cell.y;
    } else {
      continue;
    }

    const dist = Math.sqrt((canvasX - px) ** 2 + (canvasY - py) ** 2);
    if (dist <= r) {
      return { playerId: player.id, pieceIndex: 0 };
    }
  }

  return null;
}

// 窗口大小变化时重绘
window.addEventListener('resize', function() {
  initBoard();
  if (window.gameState && window.gameState.gameState === 'playing') {
    renderBoard();
  }
});

// Canvas点击事件
if (canvas) {
  canvas.addEventListener('click', function(e) {
    if (!window.gameState || !window.gameState.isMyTurn) return;
    if (!window.gameState.isMyTurn()) return;

    const piece = getPieceAtPosition(e.clientX, e.clientY);
    if (piece && piece.playerId === window.currentPlayerId) {
      // 单棋子点击直接移动
      if (typeof window.movePieceFunc === 'function') {
        window.movePieceFunc(0);
      }
    }
  });
}
