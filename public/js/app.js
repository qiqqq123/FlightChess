// 应用入口模块

// 全局状态
let currentUserId = null;
let currentUserName = null;
let currentRoom = null;

// 初始化应用
function initApp() {
  console.log('飞行棋联机版初始化...');

  // 检查WebSocket连接
  if (!window.io) {
    console.error('Socket.io 未加载');
    showErrorModal('网络库加载失败，请刷新页面');
    return;
  }

  // 初始化Socket
  initSocket();

  // 初始化棋盘
  initBoard();

  // 绑定全局事件
  bindGlobalEvents();

  console.log('应用初始化完成');
}

// 绑定全局事件
function bindGlobalEvents() {
  // 阻止双击缩放 (移动端)
  document.addEventListener('dblclick', (e) => {
    e.preventDefault();
  }, { passive: false });

  // 处理返回按钮
  window.addEventListener('popstate', (e) => {
    // 根据当前页面处理返回逻辑
    const activePage = document.querySelector('.page.active');
    if (activePage && activePage.id !== 'page-home') {
      e.preventDefault();
      showPage('home');
    }
  });

  // 键盘事件
  document.addEventListener('keydown', (e) => {
    // ESC关闭模态框
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
      });
    }
  });

  // 网络状态检测
  window.addEventListener('online', () => {
    showToast('网络已恢复');
    // 尝试重连
    if (currentPlayerId && currentRoomCode) {
      reconnectFunc();
    }
  });

  window.addEventListener('offline', () => {
    showToast('网络已断开', 3000);
  });
}

// 页面可见性变化处理
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // 页面变为可见
    if (socket && !socket.connected) {
      reconnectFunc();
    }
  }
});

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// 防止移动端橡皮筋效果
document.body.addEventListener('touchmove', (e) => {
  if (e.target === document.body) {
    e.preventDefault();
  }
}, { passive: false });

// 导出全局函数供HTML调用
window.showPage = showPage;
window.showMode = showMode;
window.showEditor = showEditor;
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.joinRoomByShortCode = joinRoomByShortCode;
window.leaveRoom = leaveRoom;
window.startGame = startGame;
window.rollDice = rollDice;
window.copyRoomCode = copyRoomCode;
window.copyShortCode = copyShortCode;
window.showShareModal = showShareModal;
window.hideShareModal = hideShareModal;
window.showTaskPackageSelector = showTaskPackageSelector;
window.hideTaskPackageModal = hideTaskPackageModal;
window.showErrorModal = showErrorModal;
window.hideErrorModal = hideErrorModal;
window.hideGameMenu = hideGameMenu;
window.showGameMenu = showGameMenu;
window.selectTaskAnswer = selectTaskAnswer;
window.completeTaskAction = completeTaskAction;
window.showChallengeTargetSelector = showChallengeTargetSelector;
window.selectChallengeTarget = selectChallengeTarget;
window.hideChallengeTargetModal = hideChallengeTargetModal;
window.sendChat = sendChat;
window.showTaskPanel = showTaskPanel;
window.hideTaskPanel = hideTaskPanel;

// 编辑器函数
window.loadTaskPackageList = loadTaskPackageList;
window.loadPackage = loadPackage;
window.createNewPackage = createNewPackage;
window.saveCurrentPackage = saveCurrentPackage;
window.importPackage = importPackage;
window.hideImportModal = hideImportModal;
window.doImportPackage = doImportPackage;
window.exportCurrentPackage = exportCurrentPackage;
window.addNewTask = addNewTask;
window.editTask = editTask;
window.deleteTask = deleteTask;
window.saveTask = saveTask;
window.closeTaskEditor = closeTaskEditor;
window.updateTaskField = updateTaskField;
window.updateTaskType = updateTaskType;
window.updateTaskOptions = updateTaskOptions;
window.updateLuckType = updateLuckType;
window.updatePackageField = updatePackageField;
window.selectTaskPackage = selectTaskPackage;
