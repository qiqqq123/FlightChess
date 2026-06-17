// 飞行棋棋盘渲染模块

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
  PADDING: 20
};

// 棋盘位置映射 (52个外圈格子的Canvas坐标)
// 简化的棋盘布局: 4个阵营，每个阵营的飞机和大本营
const BOARD_LAYOUT = {
  // 红色阵营 (下方/起点)
  red: {
    base: { x: 0, y: 3 }, // 大本营位置 (网格坐标)
    entry: 0, // 入口格子索引
    homeStart: 52, // 入口跑道起点
    homeEnd: 57 // 入口跑道终点
  },
  // 蓝色阵营 (左侧)
  blue: {
    base: { x: 3, y: 0 },
    entry: 13,
    homeStart: 58,
    homeEnd: 63
  },
  // 黄色阵营 (上方)
  yellow: {
    base: { x: 6, y: 3 },
    entry: 26,
    homeStart: 64,
    homeEnd: 69
  },
  // 绿色阵营 (右侧)
  green: {
    base: { x: 3, y: 6 },
    entry: 39,
    homeStart: 70,
    homeEnd: 75
  }
};

// 颜色配置
const COLOR_CONFIG = {
  red: { fill: '#E53935', stroke: '#B71C1C', glow: 'rgba(229, 57, 53, 0.5)' },
  blue: { fill: '#1E88E5', stroke: '#0D47A1', glow: 'rgba(30, 136, 229, 0.5)' },
  yellow: { fill: '#FDD835', stroke: '#F9A825', glow: 'rgba(253, 216, 53, 0.5)' },
  green: { fill: '#43A047', stroke: '#2E7D32', glow: 'rgba(67, 160, 71, 0.5)' }
};

// 外圈格子位置 (简化的飞行棋外圈布局)
let outerCells = [];

// 初始化棋盘
function initBoard() {
  if (!canvas) return;

  const containerWidth = Math.min(window.innerWidth - 20, 500);
  const size = containerWidth;

  canvas.width = size;
  canvas.height = size;

  BOARD_CONFIG.CELL_SIZE = size / 8;
  BOARD_CONFIG.PIECE_RADIUS = BOARD_CONFIG.CELL_SIZE * 0.4;
  BOARD_CONFIG.PADDING = BOARD_CONFIG.CELL_SIZE * 0.5;

  calculateOuterCells();
  renderBoard();
}

// 计算外圈格子位置
function calculateOuterCells() {
  outerCells = [];
  const cs = BOARD_CONFIG.CELL_SIZE;
  const p = BOARD_CONFIG.PADDING;
  const gridSize = 8;

  // 飞行棋标准外圈是一个环形
  // 简化为4x13的布局
  // 红色在下方，蓝色在左侧，黄色在上方，绿色在右侧

  // 定义四个边的起点和方向
  const sides = [
    { start: { x: 1, y: 7 }, dir: { x: 1, y: 0 }, length: 12 }, // 红: 从左下角向右
    { start: { x: 0, y: 6 }, dir: { x: 0, y: 1 }, length: 12 }, // 蓝: 从左上角向下
    { start: { x: 6, y: 0 }, dir: { x: -1, y: 0 }, length: 12 }, // 黄: 从右上角向左 (反转)
    { start: { x: 7, y: 1 }, dir: { x: 0, y: -1 }, length: 12 } // 绿: 从右下角向上 (反转)
  ];

  // 实际飞行棋外圈是连续的52格
  // 重新规划:
  // 起点(0) = 红色起点
  // 1-12 = 红色外圈 (右移)
  // 13 = 蓝色起点
  // 14-25 = 蓝色外圈 (下移)
  // 26 = 黄色起点
  // 27-38 = 黄色外圈 (左移)
  // 39 = 绿色起点
  // 40-51 = 绿色外圈 (上移)

  // 网格坐标映射到像素坐标
  function gridToPixel(gx, gy) {
    return {
      x: p + gx * cs + cs / 2,
      y: p + gy * cs + cs / 2
    };
  }

  // 红色边 (下方) y=7, x从1到6 (6格), 加上右转弯
  for (let i = 0; i < 6; i++) {
    const pos = gridToPixel(1 + i, 7);
    outerCells.push({ x: pos.x, y: pos.y, index: i });
  }
  // 右转弯格
  outerCells.push(gridToPixel(7, 7));
  outerCells.push(gridToPixel(7, 6));

  // 蓝色边 (左侧) x=0, y从6到1 (6格)
  for (let i = 0; i < 6; i++) {
    const pos = gridToPixel(0, 6 - i);
    outerCells.push({ x: pos.x, y: pos.y, index: 13 + i });
  }
  // 左上转弯
  outerCells.push(gridToPixel(0, 0));
  outerCells.push(gridToPixel(1, 0));

  // 黄色边 (上方) y=0, x从6到1 (6格)
  for (let i = 0; i < 6; i++) {
    const pos = gridToPixel(6 - i, 0);
    outerCells.push({ x: pos.x, y: pos.y, index: 26 + i });
  }
  // 右上转弯
  outerCells.push(gridToPixel(7, 0));
  outerCells.push(gridToPixel(7, 1));

  // 绿色边 (右侧) x=7, y从6到1 (6格)
  for (let i = 0; i < 6; i++) {
    const pos = gridToPixel(7, 6 - i);
    outerCells.push({ x: pos.x, y: pos.y, index: 39 + i });
  }
  // 右下转弯 - 完成环形
  outerCells.push(gridToPixel(7, 7));
  // 注意: 最后一个转弯格与红色起点相邻

  // 调整红色起点位置
  const redStart = gridToPixel(1, 7);
  if (outerCells.length > 0) {
    outerCells[0] = { x: redStart.x, y: redStart.y, index: 0 };
  }
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

  // 绘制外圈格子
  drawOuterCells();

  // 绘制中心区域
  drawCenter();

  // 绘制大本营
  drawBases();

  // 绘制棋子
  if (gameState) {
    drawPieces();
  }
}

// 绘制网格
function drawGrid() {
  const cs = BOARD_CONFIG.CELL_SIZE;
  const p = BOARD_CONFIG.PADDING;

  ctx.strokeStyle = '#0f3460';
  ctx.lineWidth = 1;

  // 绘制8x8网格线
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
    // 安全格特殊颜色
    const isSafe = [0, 13, 26, 39].includes(index);
    const isTaskCell = true; // 所有格子都可能触发任务

    ctx.fillStyle = isSafe ? '#533483' : '#0f3460';
    ctx.strokeStyle = isSafe ? '#7c3aed' : '#1a4971';
    ctx.lineWidth = 2;

    // 绘制圆角矩形格子
    const size = cs * 0.9;
    ctx.beginPath();
    ctx.roundRect(cell.x - size / 2, cell.y - size / 2, size, size, 4);
    ctx.fill();
    ctx.stroke();

    // 格子编号 (小字)
    ctx.fillStyle = '#666';
    ctx.font = `${cs * 0.2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(index.toString(), cell.x, cell.y);
  });
}

// 绘制中心区域
function drawCenter() {
  const cs = BOARD_CONFIG.CELL_SIZE;
  const p = BOARD_CONFIG.PADDING;
  const cx = p + 3.5 * cs;
  const cy = p + 3.5 * cs;
  const size = cs * 2.5;

  // 中心区域背景
  ctx.fillStyle = '#1a1a2e';
  ctx.strokeStyle = '#533483';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.roundRect(cx - size / 2, cy - size / 2, size, size, 10);
  ctx.fill();
  ctx.stroke();

  // 绘制飞行棋logo/图标
  ctx.fillStyle = '#533483';
  ctx.font = `bold ${cs * 0.8}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✈️', cx, cy);
}

// 绘制大本营
function drawBases() {
  const cs = BOARD_CONFIG.CELL_SIZE;
  const p = BOARD_CONFIG.PADDING;

  const colors = ['red', 'blue', 'yellow', 'green'];
  const basePositions = [
    { x: 1, y: 7 },   // 红: 左下
    { x: 0, y: 1 },   // 蓝: 左上
    { x: 6, y: 0 },   // 黄: 右上
    { x: 7, y: 6 }    // 绿: 右下
  ];

  colors.forEach((color, i) => {
    const pos = basePositions[i];
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

    // 绘制4个小飞机位置
    const offsets = [
      { dx: -0.15, dy: -0.15 },
      { dx: 0.15, dy: -0.15 },
      { dx: -0.15, dy: 0.15 },
      { dx: 0.15, dy: 0.15 }
    ];

    offsets.forEach((offset, j) => {
      const sx = px + offset.dx * cs;
      const sy = py + offset.dy * cs;
      const r = cs * 0.15;

      ctx.fillStyle = '#16213e';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = config.fill;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  });
}

// 绘制棋子
function drawPieces() {
  if (!gameState) return;

  const cs = BOARD_CONFIG.CELL_SIZE;
  const p = BOARD_CONFIG.PADDING;
  const r = BOARD_CONFIG.PIECE_RADIUS;

  gameState.players.forEach(player => {
    const config = COLOR_CONFIG[player.color];

    player.pieces.forEach((pos, pieceIndex) => {
      let px, py;

      if (pos === -1) {
        // 在大本营
        const baseIndex = ['red', 'blue', 'yellow', 'green'].indexOf(player.color);
        const basePos = [
          { x: 1, y: 7 },
          { x: 0, y: 1 },
          { x: 6, y: 0 },
          { x: 7, y: 6 }
        ][baseIndex];

        const offsets = [
          { dx: -0.15, dy: -0.15 },
          { dx: 0.15, dy: -0.15 },
          { dx: -0.15, dy: 0.15 },
          { dx: 0.15, dy: 0.15 }
        ][pieceIndex];

        px = p + basePos.x * cs + cs / 2 + offsets.dx * cs;
        py = p + basePos.y * cs + cs / 2 + offsets.dy * cs;
      } else if (pos >= 52) {
        // 在入口跑道或终点
        // 简化为靠近各自角落
        const basePos = [
          { x: 1, y: 7 },
          { x: 0, y: 1 },
          { x: 6, y: 0 },
          { x: 7, y: 6 }
        ][['red', 'blue', 'yellow', 'green'].indexOf(player.color)];

        const localPos = pos - 52;
        const row = Math.floor(localPos / 2);
        const col = localPos % 2;

        px = p + (basePos.x + col * 0.3) * cs + cs / 2;
        py = p + (basePos.y + row * 0.2) * cs + cs / 2;
      } else {
        // 在外圈
        const cell = outerCells[pos];
        if (cell) {
          // 根据颜色添加小偏移避免重叠
          const offsets = [
            { dx: -0.1, dy: -0.1 },
            { dx: 0.1, dy: -0.1 },
            { dx: -0.1, dy: 0.1 },
            { dx: 0.1, dy: 0.1 }
          ][pieceIndex];

          px = cell.x + offsets.dx * cs;
          py = cell.y + offsets.dy * cs;
        } else {
          return;
        }
      }

      // 发光效果
      ctx.shadowColor = config.glow;
      ctx.shadowBlur = 10;

      // 绘制棋子
      ctx.fillStyle = config.fill;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;

      // 边框
      ctx.strokeStyle = config.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 飞机编号
      ctx.fillStyle = 'white';
      ctx.font = `bold ${r * 0.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((pieceIndex + 1).toString(), px, py);

      // 离线玩家半透明
      if (!player.isOnline) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });
}

// 获取格子中心坐标
function getCellPosition(position) {
  if (position < 0) return null;
  if (position < 52) {
    return outerCells[position];
  }
  return null;
}

// 检查点击位置是否在某个棋子上
function getPieceAtPosition(x, y) {
  if (!gameState || !canvas) return null;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = (x - rect.left) * scaleX;
  const canvasY = (y - rect.top) * scaleY;

  const cs = BOARD_CONFIG.CELL_SIZE;
  const p = BOARD_CONFIG.PADDING;
  const r = BOARD_CONFIG.PIECE_RADIUS;

  for (const player of gameState.players) {
    for (let i = 0; i < player.pieces.length; i++) {
      const pos = player.pieces[i];
      let px, py;

      if (pos === -1) {
        const baseIndex = ['red', 'blue', 'yellow', 'green'].indexOf(player.color);
        const basePos = [
          { x: 1, y: 7 }, { x: 0, y: 1 }, { x: 6, y: 0 }, { x: 7, y: 6 }
        ][baseIndex];
        const offsets = [
          { dx: -0.15, dy: -0.15 }, { dx: 0.15, dy: -0.15 },
          { dx: -0.15, dy: 0.15 }, { dx: 0.15, dy: 0.15 }
        ][i];
        px = p + basePos.x * cs + cs / 2 + offsets.dx * cs;
        py = p + basePos.y * cs + cs / 2 + offsets.dy * cs;
      } else if (pos < 52) {
        const cell = outerCells[pos];
        if (!cell) continue;
        const offsets = [
          { dx: -0.1, dy: -0.1 }, { dx: 0.1, dy: -0.1 },
          { dx: -0.1, dy: 0.1 }, { dx: 0.1, dy: 0.1 }
        ][i];
        px = cell.x + offsets.dx * cs;
        py = cell.y + offsets.dy * cs;
      } else {
        continue;
      }

      const dist = Math.sqrt((canvasX - px) ** 2 + (canvasY - py) ** 2);
      if (dist <= r) {
        return { playerId: player.id, pieceIndex: i };
      }
    }
  }

  return null;
}

// 窗口大小变化时重绘
window.addEventListener('resize', debounce(() => {
  initBoard();
  if (gameState && gameState.gameState === 'playing') {
    renderBoard();
  }
}, 250));

// Canvas点击事件
if (canvas) {
  canvas.addEventListener('click', (e) => {
    if (!gameState || !gameState.isMyTurn(currentPlayerId)) return;

    const piece = getPieceAtPosition(e.clientX, e.clientY);
    if (piece && piece.playerId === currentPlayerId) {
      // 检查这架棋子是否可移动
      const movable = document.querySelector(`[data-piece-index="${piece.pieceIndex}"]`);
      if (movable && movable.classList.contains('movable')) {
        movePieceFunc(piece.pieceIndex);
      }
    }
  });
}
