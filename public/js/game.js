// 游戏主逻辑模块

let gameState = null;

// 页面切换
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(`page-${pageId}`);
  if (page) {
    page.classList.add('active');
  }
}

// 显示模式选择
function showMode(mode) {
  showPage('create');
  const title = document.getElementById('create-title');
  const passwordSection = document.getElementById('password-section');

  if (mode === 'couple') {
    title.textContent = '创建情侣房间';
    passwordSection.classList.remove('hidden');
    document.getElementById('room-password').placeholder = '设置私密密码';
  } else {
    title.textContent = '创建多人房间';
    passwordSection.classList.add('hidden');
  }

  document.getElementById('create-title').dataset.mode = mode;
}

// 显示任务包编辑器
function showEditor() {
  showPage('editor');
  loadTaskPackageList();
}

// 创建房间
function createRoom() {
  const mode = document.getElementById('create-title').dataset.mode;
  const playerName = document.getElementById('player-name').value.trim();
  const password = document.getElementById('room-password').value;

  if (!playerName) {
    showErrorModal('请输入昵称');
    return;
  }

  if (playerName.length > 20) {
    showErrorModal('昵称不能超过20字');
    return;
  }

  createRoomFunc(mode, playerName, password || null);
}

// 加入房间
function joinRoom() {
  const roomCode = document.getElementById('join-room-code').value.trim().toUpperCase();
  const playerName = document.getElementById('player-name')?.value?.trim() || '';

  if (!roomCode || !isValidRoomCode(roomCode)) {
    showErrorModal('请输入有效的6位房间码');
    return;
  }

  if (!playerName) {
    showErrorModal('请先输入昵称');
    return;
  }

  joinRoom(roomCode, playerName, null);
}

// 通过短码加入房间
function joinRoomByShortCode() {
  const shortCode = document.getElementById('join-short-code').value.trim().toUpperCase();
  const playerName = document.getElementById('player-name')?.value?.trim() || '';

  if (!shortCode || !isValidShortCode(shortCode)) {
    showErrorModal('请输入有效的8位短码');
    return;
  }

  if (!playerName) {
    showErrorModal('请先输入昵称');
    return;
  }

  joinRoomByShortCodeFunc(shortCode, playerName, null);
}

// 显示等待室
function showWaitingRoom(room) {
  showPage('waiting');
  document.getElementById('room-code-display').textContent = room.code;
  document.getElementById('short-code-display').textContent = room.shortCode;
  document.getElementById('max-players').textContent = room.maxPlayers;
  updatePlayerList(room);
}

// 更新玩家列表
function updatePlayerList(room) {
  const list = document.getElementById('player-list');
  const count = document.getElementById('player-count');

  if (!list || !room) return;

  count.textContent = room.players.length;

  list.innerHTML = room.players.map(player => `
    <div class="flex items-center gap-3 p-3 rounded-lg bg-gray-900/50 ${!player.isOnline ? 'opacity-50' : ''}">
      <div class="player-piece ${player.color}" style="width:32px;height:32px;font-size:14px;">
        ${player.name[0]}
      </div>
      <div class="flex-1">
        <div class="font-semibold">${player.name}</div>
        <div class="text-xs text-gray-400">${COLOR_NAMES[player.color]}阵营</div>
      </div>
      <div class="flex items-center gap-2">
        ${player.isOnline ? '<span class="text-green-400 text-xs">在线</span>' : '<span class="text-red-400 text-xs">离线</span>'}
        ${player.id === currentPlayerId ? '<span class="text-blue-400 text-xs">(你)</span>' : ''}
      </div>
    </div>
  `).join('');

  // 房主控制
  const ownerControls = document.getElementById('owner-controls');
  if (ownerControls) {
    const isOwner = room.players[0]?.id === currentPlayerId;
    ownerControls.style.display = isOwner ? 'block' : 'none';
  }
}

// 复制房间码
function copyRoomCode() {
  if (currentRoomCode) {
    copyToClipboard(currentRoomCode);
  }
}

// 复制短码
function copyShortCode() {
  if (gameState) {
    copyToClipboard(gameState.code);
  }
}

// 显示分享模态框
function showShareModal() {
  document.getElementById('modal-share').classList.add('active');
}

// 隐藏分享模态框
function hideShareModal() {
  document.getElementById('modal-share').classList.remove('active');
}

// 开始游戏视图
function startGameView(room) {
  showPage('game');
  document.getElementById('game-room-code').textContent = room.code;

  initBoard();
  updateTurnIndicator();
  updateDiceDisplay(null);

  // 显示聊天
  initChat();
}

// 更新回合指示器
function updateTurnIndicator() {
  const indicator = document.getElementById('turn-indicator');
  if (!indicator || !gameState) return;

  const currentPlayer = gameState.getCurrentPlayer();
  if (!currentPlayer) return;

  if (gameState.isMyTurn(currentPlayerId)) {
    indicator.innerHTML = `
      <div class="flex items-center justify-center gap-2">
        <span class="text-sm text-gray-400">你的回合</span>
      </div>
      <div class="text-lg font-bold" style="color: ${getColorCSS(currentPlayer.color)}">
        ${currentPlayer.name} (${COLOR_NAMES[currentPlayer.color]})
      </div>
    `;
  } else {
    indicator.innerHTML = `
      <div class="text-sm text-gray-400">等待 ${currentPlayer.name} 投骰子...</div>
      <div class="text-lg font-bold" style="color: ${getColorCSS(currentPlayer.color)}">
        ${COLOR_NAMES[currentPlayer.color]}方
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
    dice.style.opacity = gameState && gameState.isMyTurn(currentPlayerId) ? '1' : '0.5';
  } else {
    dice.textContent = value;
    dice.classList.add('rolling');
    setTimeout(() => dice.classList.remove('rolling'), 500);
  }
}

// 更新可移动棋子
function updateMovablePieces(movablePieces) {
  const container = document.getElementById('movable-pieces');
  if (!container || !gameState) return;

  container.innerHTML = '';

  const currentPlayer = gameState.getCurrentById(currentPlayerId);
  if (!currentPlayer || !movablePieces || movablePieces.length === 0) {
    container.innerHTML = '<span class="text-gray-400 text-sm">没有可移动的棋子</span>';
    return;
  }

  movablePieces.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'btn movable flex flex-col items-center p-2 rounded-lg';
    btn.dataset.pieceIndex = m.index;
    btn.innerHTML = `
      <div class="player-piece ${currentPlayer.color}" style="width:40px;height:40px">
        ${m.index + 1}
      </div>
      <span class="text-xs text-gray-400">${m.reason}</span>
    `;
    btn.onclick = () => {
      movePieceFunc(m.index);
    };
    container.appendChild(btn);
  });
}

// 清除可移动棋子
function clearMovablePieces() {
  const container = document.getElementById('movable-pieces');
  if (container) {
    container.innerHTML = '';
  }
}

// 投骰子
function rollDice() {
  if (!gameState || !gameState.isMyTurn(currentPlayerId)) return;
  if (gameState.diceRolled) return;
  if (gameState.taskPending) return;

  rollDiceFunc();
}

// 开始游戏
function startGame() {
  startGameFunc();
}

// 离开房间
function leaveRoom() {
  hideGameMenu();
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

// 显示房间状态
function showRoomState() {
  hideGameMenu();
  if (!gameState) return;

  const state = JSON.stringify(gameState, null, 2);
  alert(`房间状态:\n${state}`);
}

// 显示任务面板
function showTaskPanel(task) {
  const panel = document.getElementById('task-panel');
  const content = document.getElementById('task-content');
  const options = document.getElementById('task-options');
  const actionBtn = document.getElementById('task-action-btn');

  if (!panel) return;

  panel.classList.remove('hidden');
  panel.classList.add('fade-in');

  content.innerHTML = `<div class="text-lg mb-2">${task.content}</div>`;

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
    actionBtn.textContent = '我已完成动作';
  } else if (task.type === 'challenge') {
    options.innerHTML = `<div class="text-gray-400 text-center">请选择一名玩家完成互动</div>`;
    actionBtn.classList.remove('hidden');
    actionBtn.textContent = '选择目标玩家';
    actionBtn.onclick = showChallengeTargetSelector;
  } else if (task.type === 'luck') {
    options.innerHTML = `<div class="text-center text-yellow-400">${task.content}</div>`;
    actionBtn.classList.add('hidden');
  }
}

// 隐藏任务面板
function hideTaskPanel() {
  const panel = document.getElementById('task-panel');
  if (panel) {
    panel.classList.add('hidden');
  }
}

// 选择任务答案
function selectTaskAnswer(answer) {
  // 移除其他选中状态
  document.querySelectorAll('.task-option').forEach(opt => {
    opt.classList.remove('selected');
  });
  // 选中当前
  const selected = document.querySelector(`[data-answer="${answer}"]`);
  if (selected) {
    selected.classList.add('selected');
  }

  // 延迟提交，让用户看到选择
  setTimeout(() => {
    taskAnswerFunc(answer);
  }, 300);
}

// 完成动作任务
function completeTaskAction() {
  if (gameState && gameState.taskPending) {
    if (gameState.taskPending.type === 'challenge') {
      showChallengeTargetSelector();
    } else {
      taskActionFunc();
    }
  }
}

// 显示挑战目标选择器
function showChallengeTargetSelector() {
  const modal = document.getElementById('modal-challenge-target');
  const list = document.getElementById('challenge-target-list');

  if (!modal || !list || !gameState) return;

  const otherPlayers = gameState.players.filter(p => p.id !== currentPlayerId && p.isOnline);

  list.innerHTML = otherPlayers.map(p => `
    <button onclick="selectChallengeTarget('${p.id}')" class="task-option w-full text-left flex items-center gap-3">
      <div class="player-piece ${p.color}" style="width:32px;height:32px;font-size:12px;">
        ${p.name[0]}
      </div>
      <span>${p.name}</span>
    </button>
  `).join('');

  modal.classList.add('active');
}

// 选择挑战目标
function selectChallengeTarget(targetPlayerId) {
  hideChallengeTargetModal();
  taskChallengeTargetFunc(targetPlayerId);
}

// 隐藏挑战目标模态框
function hideChallengeTargetModal() {
  document.getElementById('modal-challenge-target').classList.remove('active');
}

// 显示错误模态框
function showErrorModal(message) {
  document.getElementById('error-message').textContent = message;
  document.getElementById('modal-error').classList.add('active');
}

// 隐藏错误模态框
function hideErrorModal() {
  document.getElementById('modal-error').classList.remove('active');
}

// 显示游戏结束模态框
function showGameOverModal(winner) {
  if (winner) {
    const isMe = winner.id === currentPlayerId;
    alert(`🎉 游戏结束!\n\n${winner.name} 获胜!\n\n${isMe ? '恭喜你获得胜利!' : '下次再接再厉!'}`);
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

// 选择任务包
function selectTaskPackage(taskPackageId) {
  hideTaskPackageModal();
  setTaskPackageFunc(taskPackageId);
}

// 隐藏任务包模态框
function hideTaskPackageModal() {
  document.getElementById('modal-task-package').classList.remove('active');
}

// 聊天功能
let chatMessages = [];

function initChat() {
  chatMessages = [];
}

function sendChat() {
  const input = document.getElementById('chat-input');
  if (!input) return;

  const message = input.value.trim();
  if (!message) return;

  sendChatFunc(message);
  input.value = '';
}

function addChatMessage(data) {
  // 简单显示在控制台，生产环境可改为UI显示
  console.log(`[${data.playerName}]: ${data.message}`);
}

// 处理服务端更新游戏状态
function updateGameState(roomData) {
  gameState = new GameState(roomData);

  if (roomData.gameState === 'playing') {
    renderBoard();
    updateTurnIndicator();
    updateDiceDisplay(roomData.diceValue);
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 初始化Socket
  initSocket();

  // 初始化棋盘
  initBoard();

  // 聊天输入回车发送
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChat();
      }
    });
  }
});

// 页面可见性变化处理断线重连
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentPlayerId && currentRoomCode) {
    // 尝试重连
    if (socket && !socket.connected) {
      reconnectFunc();
    }
  }
});
