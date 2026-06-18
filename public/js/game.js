// 游戏主逻辑模块 - 单棋子版本
// 全局状态
window.gameState = null;
window.currentPlayerId = null;
window.currentRoomCode = null;
window.currentDifficulty = 'normal';
window.turnTimerInterval = null;
window.turnTimeRemaining = 0;

// 颜色名称映射
const COLOR_NAMES = {
  red: '红色',
  blue: '蓝色',
  yellow: '黄色',
  green: '绿色',
  purple: '紫色',
  orange: '橙色'
};

// CSS颜色映射
function getColorCSS(color) {
  const map = {
    red: '#E53935',
    blue: '#1E88E5',
    yellow: '#FDD835',
    green: '#43A047',
    purple: '#8E24AA',
    orange: '#FB8C00'
  };
  return map[color] || '#888';
}

// 页面切换
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(`page-${pageId}`);
  if (page) page.classList.add('active');

  // 清理按钮状态
  if (pageId !== 'game') {
    hideActionButtons();
  }
}

function hideActionButtons() {
  const actionDiv = document.getElementById('action-buttons');
  if (actionDiv) actionDiv.classList.add('hidden');
}

function showActionButtons(needLeaveBase) {
  const actionDiv = document.getElementById('action-buttons');
  const moveBtn = document.getElementById('move-piece-btn');
  const leaveBtn = document.getElementById('leave-base-btn');
  if (!actionDiv) return;

  actionDiv.classList.remove('hidden');
  if (moveBtn) moveBtn.classList.toggle('hidden', !!needLeaveBase);
  if (leaveBtn) leaveBtn.classList.toggle('hidden', !needLeaveBase);
}

// 显示模式选择
function showMode(mode) {
  showPage('create');
  const title = document.getElementById('create-title');
  title.textContent = mode === 'couple' ? '创建情侣房间' : '创建多人房间';
  title.dataset.mode = mode;

  // 根据模式更新默认最大人数
  const maxPlayersSelect = document.getElementById('max-players-select');
  if (maxPlayersSelect) {
    maxPlayersSelect.innerHTML = '';
    if (mode === 'couple') {
      const opt = document.createElement('option');
      opt.value = 2;
      opt.textContent = '2人';
      opt.selected = true;
      maxPlayersSelect.appendChild(opt);
      maxPlayersSelect.disabled = true;
    } else {
      for (let i = 2; i <= 6; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i}人`;
        if (i === 4) opt.selected = true;
        maxPlayersSelect.appendChild(opt);
      }
      maxPlayersSelect.disabled = false;
    }
  }
}

// 创建房间 - 支持密码、难度、回合时长、最大人数
function createRoom() {
  const mode = document.getElementById('create-title').dataset.mode;
  const playerName = document.getElementById('player-name').value.trim();
  const password = document.getElementById('room-password').value;
  const difficulty = document.getElementById('difficulty-select').value;
  const turnDuration = parseInt(document.getElementById('turn-duration-select').value);
  const maxPlayers = parseInt(document.getElementById('max-players-select').value);

  if (!playerName) {
    showErrorModal('请输入昵称');
    return;
  }
  if (playerName.length > 20) {
    showErrorModal('昵称不能超过20字');
    return;
  }

  // 密码验证
  if (password && password.length > 0) {
    if (password.length < 6 || password.length > 10) {
      showErrorModal('密码必须为6-10位字母和数字');
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(password)) {
      showErrorModal('密码只能包含字母和数字');
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      showErrorModal('密码必须同时包含字母和数字');
      return;
    }
  }

  // 选择棋子颜色
  showColorSelector(() => {
    const selectedColor = document.querySelector('.color-option.selected')?.dataset.color || 'red';
    createRoomFunc(mode, playerName, password || null, {
      maxPlayers: maxPlayers,
      turnDuration: turnDuration,
      difficulty: difficulty,
      pieceColor: selectedColor
    });
  });
}

// 加入房间 - 支持密码
function joinRoom() {
  const roomCode = document.getElementById('join-room-code').value.trim().toUpperCase();
  const playerName = document.getElementById('join-player-name')?.value?.trim() || '';
  const password = document.getElementById('join-room-password').value;

  if (!roomCode) {
    showErrorModal('请输入有效的房间码');
    return;
  }
  if (!playerName) {
    showErrorModal('请先输入昵称');
    return;
  }

  joinRoomFunc(roomCode, playerName, password || null);
}

// 通过短码加入房间
function joinRoomByShortCode() {
  const shortCode = document.getElementById('join-short-code').value.trim().toUpperCase();
  const playerName = document.getElementById('join-player-name')?.value?.trim() || '';
  const password = document.getElementById('join-room-password').value;

  if (!shortCode) {
    showErrorModal('请输入有效的短码');
    return;
  }
  if (!playerName) {
    showErrorModal('请先输入昵称');
    return;
  }

  joinRoomByShortCodeFunc(shortCode, playerName, password || null);
}

// 显示颜色选择器
function showColorSelector(onConfirm) {
  const modal = document.getElementById('modal-color-select');
  if (!modal) {
    // 无颜色选择器，直接继续
    onConfirm();
    return;
  }
  const list = document.getElementById('color-list');
  if (list) {
    const colors = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'];
    list.innerHTML = colors.map(c => `
      <button onclick="selectPieceColor('${c}')" class="color-option" data-color="${c}" style="background: ${getColorCSS(c)}; width: 48px; height: 48px; border-radius: 50%; border: 3px solid transparent; cursor: pointer;">
        <span style="color: white; font-weight: bold;">✈</span>
      </button>
    `).join('');
    // 默认选中红色
    const firstBtn = list.querySelector('.color-option');
    if (firstBtn) firstBtn.classList.add('selected');
  }
  modal.classList.add('active');
  modal.dataset.onConfirm = '1';
  // 保存回调
  window._colorConfirmCb = onConfirm;
}

// 选择棋子颜色
function selectPieceColor(color) {
  document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
  const btn = document.querySelector(`.color-option[data-color="${color}"]`);
  if (btn) btn.classList.add('selected');
}

// 确认棋子颜色并继续
function confirmColorSelection() {
  const modal = document.getElementById('modal-color-select');
  if (modal) modal.classList.remove('active');
  if (typeof window._colorConfirmCb === 'function') {
    const cb = window._colorConfirmCb;
    window._colorConfirmCb = null;
    cb();
  }
}

// 关闭颜色选择器
function closeColorSelector() {
  const modal = document.getElementById('modal-color-select');
  if (modal) modal.classList.remove('active');
}

// 显示等待室
function showWaitingRoom(room) {
  showPage('waiting');
  document.getElementById('room-code-display').textContent = room.code || '------';
  document.getElementById('short-code-display').textContent = room.shortCode || '----';
  const maxPlayersEl = document.getElementById('max-players');
  const maxPlayers2El = document.getElementById('max-players-2');
  if (maxPlayersEl) maxPlayersEl.textContent = room.maxPlayers || 4;
  if (maxPlayers2El) maxPlayers2El.textContent = room.maxPlayers || 4;
  document.getElementById('difficulty-display').textContent = getDifficultyLabel(room.difficulty);
  document.getElementById('turn-duration-display').textContent = `${room.turnDuration || 45}秒`;
  document.getElementById('password-display').textContent = room.password ? '已设置' : '无';

  // 同步房主控制下拉框
  const diffSel = document.getElementById('difficulty-select-owner');
  if (diffSel) diffSel.value = room.difficulty || 'normal';
  const turnSel = document.getElementById('turn-duration-select-owner');
  if (turnSel) turnSel.value = String(room.turnDuration || 45);
  const maxSel = document.getElementById('max-players-select-owner');
  if (maxSel) maxSel.value = String(room.maxPlayers || 4);

  updatePlayerList(room);
}

function getDifficultyLabel(diff) {
  const map = { easy: '休闲', normal: '团建', hard: '竞技' };
  return map[diff] || '普通';
}

// 更新玩家列表
function updatePlayerList(room) {
  const list = document.getElementById('player-list');
  const count = document.getElementById('player-count');

  if (!list || !room) return;
  count.textContent = room.players.length;

  list.innerHTML = room.players.map(player => `
    <div class="flex items-center gap-3 p-3 rounded-lg bg-gray-900/50 ${!player.isOnline ? 'opacity-50' : ''}">
      <div class="player-piece" style="width:32px;height:32px;font-size:14px;background:${getColorCSS(player.color)};border-radius:50%;color:white;text-align:center;line-height:32px;font-weight:bold;">
        ${player.name[0]}
      </div>
      <div class="flex-1">
        <div class="font-semibold">${player.name}</div>
        <div class="text-xs text-gray-400">${COLOR_NAMES[player.color] || player.color}</div>
      </div>
      <div class="flex items-center gap-2">
        ${player.isOnline ? '<span class="text-green-400 text-xs">在线</span>' : '<span class="text-red-400 text-xs">离线</span>'}
        ${player.id === window.currentPlayerId ? '<span class="text-blue-400 text-xs">(你)</span>' : ''}
        ${player.isOwner ? '<span class="text-yellow-400 text-xs">房主</span>' : ''}
      </div>
    </div>
  `).join('');

  // 房主控制显示
  const ownerControls = document.getElementById('owner-controls');
  const playerInfo = document.getElementById('player-info');
  if (ownerControls && playerInfo && room.players.length > 0) {
    const isOwner = room.players[0].id === window.currentPlayerId;
    ownerControls.classList.toggle('hidden', !isOwner);
    playerInfo.classList.toggle('hidden', isOwner);
  }
}

// 复制房间码
function copyRoomCode() {
  if (window.currentRoomCode) copyToClipboard(window.currentRoomCode);
}

// 复制短码
function copyShortCode() {
  if (window.gameState && window.gameState.shortCode) copyToClipboard(window.gameState.shortCode);
}

// 显示分享模态框
function showShareModal() {
  document.getElementById('modal-share').classList.add('active');
}

// 隐藏分享模态框
function hideShareModal() {
  document.getElementById('modal-share').classList.remove('active');
}

// 房主设置难度
function setRoomDifficulty() {
  const select = document.getElementById('difficulty-select-owner');
  const difficulty = select.value;
  setDifficultyFunc(difficulty);
}

// 房主设置回合时长
function setRoomTurnDuration() {
  const select = document.getElementById('turn-duration-select-owner');
  const seconds = parseInt(select.value);
  setTurnDurationFunc(seconds);
}

// 房主设置最大人数
function setRoomMaxPlayers() {
  const select = document.getElementById('max-players-select-owner');
  const maxPlayers = parseInt(select.value);
  setMaxPlayersFunc(maxPlayers);
}

// 房主重置密码
function resetRoomPassword() {
  const newPassword = prompt('设置新密码(6-10位字母数字混合)，留空则清除密码：');
  if (newPassword === null) return;

  if (newPassword && newPassword.length > 0) {
    if (newPassword.length < 6 || newPassword.length > 10) {
      showErrorModal('密码必须为6-10位');
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(newPassword)) {
      showErrorModal('密码只能包含字母和数字');
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      showErrorModal('密码必须同时包含字母和数字');
      return;
    }
  }

  resetPasswordFunc(newPassword || null);
}

// 开始游戏视图
function startGameView(room) {
  showPage('game');
  document.getElementById('game-room-code').textContent = room.code || '------';
  initBoard();
  updateTurnIndicator();
  updateDiceDisplay(null);
  initChat();
  hideActionButtons();

  // 启动回合计时器
  startTurnTimer(room.turnDuration || 45);
}

// 回合计时器
let turnTimerInterval = null;
let turnTimeRemaining = 0;

function startTurnTimer(seconds) {
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
  }
  turnTimeRemaining = seconds;
  updateTimerDisplay();
  turnTimerInterval = setInterval(() => {
    turnTimeRemaining--;
    if (turnTimeRemaining <= 0) {
      turnTimeRemaining = 0;
      clearInterval(turnTimerInterval);
    }
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('turn-timer-display');
  if (!el) return;
  if (window.gameState && window.gameState.gameState !== 'playing') {
    el.textContent = '';
    return;
  }
  if (turnTimeRemaining <= 5) {
    el.innerHTML = `<span class="text-red-400">⏱ ${turnTimeRemaining}s</span>`;
  } else {
    el.innerHTML = `<span class="text-gray-400">⏱ ${turnTimeRemaining}s</span>`;
  }
}

// 更新回合指示器
function updateTurnIndicator() {
  const indicator = document.getElementById('turn-indicator');
  if (!indicator || !window.gameState) return;

  const currentPlayer = window.gameState.players[window.gameState.currentTurnIndex];
  if (!currentPlayer) return;

  const isMine = currentPlayer.id === window.currentPlayerId;
  const colorCSS = getColorCSS(currentPlayer.color);

  if (isMine) {
    indicator.innerHTML = `
      <div class="flex items-center justify-center gap-2">
        <span class="text-sm text-green-400">你的回合</span>
      </div>
      <div class="text-lg font-bold" style="color: ${colorCSS}">
        ${currentPlayer.name}
      </div>
    `;
  } else {
    indicator.innerHTML = `
      <div class="text-sm text-gray-400 text-center">等待 ${currentPlayer.name} 操作...</div>
      <div class="text-lg font-bold text-center" style="color: ${colorCSS}">
        ${COLOR_NAMES[currentPlayer.color] || '玩家'}方
      </div>
    `;
  }
}

// 更新骰子显示
function updateDiceDisplay(value) {
  const dice = document.getElementById('dice-container');
  if (!dice) return;

  if (value === null) {
    dice.textContent = '?';
    dice.classList.remove('rolling');
    hideActionButtons();
  } else {
    dice.textContent = value;
    dice.classList.add('rolling');
    setTimeout(() => dice.classList.remove('rolling'), 500);

    // 显示移动按钮（如果是当前玩家且需要移动）
    if (window.gameState && window.gameState.diceRolled) {
      const currentPlayer = window.gameState.players[window.gameState.currentTurnIndex];
      if (currentPlayer && currentPlayer.id === window.currentPlayerId) {
        const pos = currentPlayer.piece;
        // 如果掷出6且在大本营，则显示"出发"，否则显示"前进"
        const needLeaveBase = (pos === -1 || pos === undefined || pos === null);
        if (value === 6 || !needLeaveBase) {
          showActionButtons(needLeaveBase);
        }
      }
    }
  }
}

// 投骰子
function rollDice() {
  if (!window.gameState) return;
  const player = window.gameState.players[window.gameState.currentTurnIndex];
  if (!player || player.id !== window.currentPlayerId) return;
  if (window.gameState.diceRolled) return;
  if (window.gameState.taskPending) return;

  rollDiceFunc();
}

// 移动棋子 - 单棋子
function movePiece() {
  if (!window.gameState || !window.gameState.diceRolled || window.gameState.taskPending) return;
  const player = window.gameState.players[window.gameState.currentTurnIndex];
  if (!player || player.id !== window.currentPlayerId) return;

  hideActionButtons();
  movePieceFunc(0);
}

// 完成任务
function completeTask(success) {
  taskAnswerFunc(success);
}

// 跳过任务
function skipTask() {
  skipTaskFunc();
}

// 结束回合
function endTurn() {
  endTurnFunc();
}

// 开始游戏
function startGame() {
  startGameFunc();
}

// 离开房间
function leaveRoom() {
  hideGameMenu();
  if (window.turnTimerInterval) {
    clearInterval(window.turnTimerInterval);
    window.turnTimerInterval = null;
  }
  leaveRoomFunc();
}

// 显示游戏菜单
function showGameMenu() {
  document.getElementById('modal-game-menu').classList.add('active');
}

// 隐藏游戏菜单
function hideGameMenu() {
  document.getElementById('modal-game-menu').classList.remove('active');
}

// 显示任务面板
function showTaskPanel(task) {
  const panel = document.getElementById('task-panel');
  const content = document.getElementById('task-content');
  const options = document.getElementById('task-options');
  const actionBtn = document.getElementById('task-action-btn');
  if (!panel || !task) return;

  panel.classList.remove('hidden');
  panel.classList.add('fade-in');

  content.innerHTML = `<div class="text-lg mb-2">${task.content || ''}</div>`;

  if (task.type === 'question' && task.options) {
    options.innerHTML = task.options.map((opt, i) => `
      <button onclick="selectTaskAnswer(${i})" class="task-option w-full text-left" data-answer="${i}">
        ${String.fromCharCode(65 + i)}. ${opt}
      </button>
    `).join('');
    actionBtn.classList.add('hidden');
  } else if (task.type === 'action') {
    options.innerHTML = `<div class="text-gray-400 text-center">${task.description || '请完成上述动作'}</div>`;
    actionBtn.classList.remove('hidden');
    actionBtn.textContent = '我已完成 (+2格)';
    actionBtn.onclick = () => completeTask(true);
  } else if (task.type === 'challenge') {
    options.innerHTML = `<div class="text-gray-400 text-center">请与大家完成互动</div>`;
    actionBtn.classList.remove('hidden');
    actionBtn.textContent = '我已完成 (+2格)';
    actionBtn.onclick = () => completeTask(true);
  } else if (task.type === 'luck') {
    options.innerHTML = `<div class="text-center text-yellow-400">${task.content || ''}</div>`;
    actionBtn.classList.remove('hidden');
    actionBtn.textContent = '继续';
    actionBtn.onclick = () => completeTask(true);
  }
}

function hideTaskPanel() {
  const panel = document.getElementById('task-panel');
  if (panel) panel.classList.add('hidden');
}

// 选择任务答案
function selectTaskAnswer(answer) {
  document.querySelectorAll('.task-option').forEach(opt => opt.classList.remove('selected'));
  const selected = document.querySelector(`[data-answer="${answer}"]`);
  if (selected) selected.classList.add('selected');

  setTimeout(() => {
    // 判断对错
    const currentTask = window.gameState && window.gameState.taskPending;
    if (currentTask && typeof currentTask.answer === 'number') {
      const success = (answer === currentTask.answer);
      taskAnswerFunc(success);
    } else {
      taskAnswerFunc(true);
    }
  }, 300);
}

// 显示错误模态框
function showErrorModal(message) {
  document.getElementById('error-message').textContent = message;
  document.getElementById('modal-error').classList.add('active');
}

function hideErrorModal() {
  document.getElementById('modal-error').classList.remove('active');
}

// 显示游戏结束
function showGameOverModal(winner) {
  if (winner) {
    const isMe = winner.id === window.currentPlayerId;
    setTimeout(() => {
      alert(`🎉 游戏结束!\n\n${winner.name} 获胜!\n\n${isMe ? '恭喜你获得胜利!' : '下次再接再厉!'}`);
    }, 500);
  }
}

// 显示任务包选择器
function showTaskPackageSelector() {
  fetch('/api/task-packages')
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        const list = document.getElementById('task-package-list');
        list.innerHTML = data.packages.map(pkg => `
          <div class="task-list-item flex justify-between items-center" onclick="selectTaskPackage('${pkg.id}')">
            <div>
              <div class="font-semibold">${pkg.name}</div>
              <div class="text-xs text-gray-400">${pkg.author} | ${pkg.taskCount || pkg.tasks?.length || 0}个任务</div>
            </div>
            ${pkg.id === 'default' ? '<span class="text-xs text-gray-500">内置</span>' : ''}
          </div>
        `).join('');
        document.getElementById('modal-task-package').classList.add('active');
      }
    });
}

function selectTaskPackage(taskPackageId) {
  hideTaskPackageModal();
  setTaskPackageFunc(taskPackageId);
}

function hideTaskPackageModal() {
  document.getElementById('modal-task-package').classList.remove('active');
}

// 聊天功能
let chatMessages = [];
function initChat() { chatMessages = []; }

function sendChat() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const message = input.value.trim();
  if (!message) return;
  sendChatFunc(message);
  input.value = '';
}

function addChatMessage(data) {
  console.log(`[${data.playerName}]: ${data.message}`);
}

// 处理服务端更新游戏状态
function updateGameState(roomData) {
  window.gameState = roomData;
  if (roomData.gameState === 'playing') {
    renderBoard();
    updateTurnIndicator();
    updateDiceDisplay(roomData.diceValue);
  }
}

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initSocket();
  initBoard();

  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendChat();
    });
  }
});

// 页面可见性变化处理断线重连
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && window.currentPlayerId && window.currentRoomCode) {
    if (typeof socket !== 'undefined' && socket && !socket.connected) {
      reconnectFunc();
    }
  }
});
