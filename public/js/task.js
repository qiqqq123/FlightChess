// 任务系统模块

let currentEditingTask = null;
let currentPackageId = null;

// 加载任务包列表
function loadTaskPackageList() {
  fetch('/api/task-packages')
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        renderPackageList(data.packages);
      }
    })
    .catch(err => {
      console.error('加载任务包列表失败:', err);
    });
}

// 渲染任务包列表
function renderPackageList(packages) {
  const list = document.getElementById('package-list');
  if (!list) return;

  list.innerHTML = packages.map(pkg => `
    <div class="task-list-item ${pkg.id === currentPackageId ? 'border-purple-500' : ''}"
         onclick="loadPackage('${pkg.id}')">
      <div class="font-semibold">${pkg.name}</div>
      <div class="text-xs text-gray-400">
        ${pkg.author} | ${pkg.taskCount || 0}个任务
        ${pkg.id === 'default' ? ' | 内置' : ''}
      </div>
    </div>
  `).join('');
}

// 加载任务包
function loadPackage(packageId) {
  currentPackageId = packageId;
  fetch(`/api/task-packages/${packageId}`)
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        renderPackageEditor(data.taskPackage);
        loadTaskPackageList(); // 更新选中状态
      }
    })
    .catch(err => {
      console.error('加载任务包失败:', err);
      showErrorModal('加载任务包失败');
    });
}

// 渲染任务包编辑器
function renderPackageEditor(taskPackage) {
  const content = document.getElementById('editor-content');
  if (!content) return;

  currentEditingPackage = JSON.parse(JSON.stringify(taskPackage));

  content.innerHTML = `
    <div class="space-y-4">
      <div>
        <label class="block text-gray-400 mb-2">任务包名称</label>
        <input type="text" id="pkg-name" value="${taskPackage.name}" maxlength="50"
               class="w-full" onchange="updatePackageField('name', this.value)" />
      </div>
      <div>
        <label class="block text-gray-400 mb-2">作者</label>
        <input type="text" id="pkg-author" value="${taskPackage.author}" maxlength="30"
               class="w-full" onchange="updatePackageField('author', this.value)" />
      </div>
      <div class="flex justify-between items-center">
        <span class="text-gray-400">任务数量: <span id="task-count">${taskPackage.tasks?.length || 0}</span></span>
        <button onclick="addNewTask()" class="btn bg-green-600 py-2 px-4 rounded-lg text-sm">+ 添加任务</button>
      </div>

      <div id="task-editor-list" class="space-y-2 max-h-[50vh] overflow-auto">
        ${renderTaskList(taskPackage.tasks || [])}
      </div>

      <button onclick="saveCurrentPackage()" class="btn w-full bg-purple-600 py-3 rounded-lg font-semibold">
        保存任务包
      </button>
    </div>
  `;
}

// 渲染任务列表
function renderTaskList(tasks) {
  if (!tasks || tasks.length === 0) {
    return '<div class="text-center text-gray-400 py-8">暂无任务，请添加</div>';
  }

  return tasks.map((task, index) => {
    const typeLabels = {
      question: '❓ 问答',
      action: '🎯 动作',
      challenge: '🤝 挑战',
      luck: '🎲 运气'
    };

    return `
      <div class="task-list-item" onclick="editTask(${index})">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs px-2 py-0.5 rounded bg-purple-600/30">${typeLabels[task.type] || task.type}</span>
              <span class="text-xs text-gray-500">位置 ${task.position}</span>
            </div>
            <div class="text-sm truncate">${task.content}</div>
            ${task.type === 'question' && task.options ? `
              <div class="text-xs text-gray-500 mt-1">
                选项: ${task.options.slice(0, 2).join(', ')}${task.options.length > 2 ? '...' : ''}
              </div>
            ` : ''}
          </div>
          <button onclick="event.stopPropagation(); deleteTask(${index})"
                  class="text-red-400 hover:text-red-300 p-1">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

// 当前编辑的任务包数据
let currentEditingPackage = null;

// 更新任务包字段
function updatePackageField(field, value) {
  if (currentEditingPackage) {
    currentEditingPackage[field] = value;
  }
}

// 添加新任务
function addNewTask() {
  if (!currentEditingPackage) return;

  const newPosition = currentEditingPackage.tasks.length + 1;
  const newTask = {
    position: newPosition,
    type: 'question',
    content: '新任务内容',
    options: ['选项A', '选项B', '选项C', '选项D'],
    answer: 0,
    timeLimit: 30
  };

  currentEditingPackage.tasks.push(newTask);
  renderTaskEditor(newTask, currentEditingPackage.tasks.length - 1);
  updateTaskCount();
}

// 编辑任务
function editTask(index) {
  if (!currentEditingPackage || !currentEditingPackage.tasks[index]) return;

  renderTaskEditor(currentEditingPackage.tasks[index], index);
}

// 渲染单个任务编辑器
function renderTaskEditor(task, index) {
  const list = document.getElementById('task-editor-list');
  if (!list) return;

  currentEditingTask = { ...task, index };

  const taskEditorHTML = `
    <div class="bg-gray-900 rounded-xl p-4 border border-purple-500" id="task-edit-panel">
      <div class="flex justify-between items-center mb-4">
        <h4 class="font-semibold">编辑任务 #${index + 1}</h4>
        <button onclick="closeTaskEditor()" class="text-gray-400 hover:text-white">✕</button>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-gray-400 mb-1 text-sm">任务类型</label>
          <select id="task-type" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-2"
                  onchange="updateTaskType(this.value)">
            <option value="question" ${task.type === 'question' ? 'selected' : ''}>❓ 问答</option>
            <option value="action" ${task.type === 'action' ? 'selected' : ''}>🎯 动作</option>
            <option value="challenge" ${task.type === 'challenge' ? 'selected' : ''}>🤝 挑战</option>
            <option value="luck" ${task.type === 'luck' ? 'selected' : ''}>🎲 运气</option>
          </select>
        </div>

        <div>
          <label class="block text-gray-400 mb-1 text-sm">格子位置 (1-52)</label>
          <input type="number" id="task-position" value="${task.position}" min="1" max="52"
                 class="w-full" onchange="updateTaskField('position', parseInt(this.value))" />
        </div>

        <div>
          <label class="block text-gray-400 mb-1 text-sm">任务内容</label>
          <textarea id="task-content" rows="2" class="w-full"
                    onchange="updateTaskField('content', this.value)">${task.content}</textarea>
        </div>

        <div id="task-type-fields">
          ${renderTaskTypeFields(task)}
        </div>

        <div>
          <label class="block text-gray-400 mb-1 text-sm">时限 (秒)</label>
          <input type="number" id="task-timeLimit" value="${task.timeLimit || 30}" min="5" max="120"
                 class="w-full" onchange="updateTaskField('timeLimit', parseInt(this.value))" />
        </div>

        <button onclick="saveTask()" class="btn w-full bg-green-600 py-2 rounded-lg">保存任务</button>
      </div>
    </div>
  `;

  // 找到对应任务的位置并插入编辑器
  const taskItems = list.querySelectorAll('.task-list-item');
  if (taskItems[index]) {
    taskItems[index].insertAdjacentHTML('afterend', taskEditorHTML);
  }
}

// 渲染任务类型特定字段
function renderTaskTypeFields(task) {
  switch (task.type) {
    case 'question':
      return `
        <div>
          <label class="block text-gray-400 mb-1 text-sm">选项 (用逗号分隔)</label>
          <input type="text" id="task-options" value="${(task.options || []).join(', ')}"
                 class="w-full" onchange="updateTaskOptions(this.value)" />
        </div>
        <div>
          <label class="block text-gray-400 mb-1 text-sm">正确答案 (0-${(task.options || []).length - 1})</label>
          <input type="number" id="task-answer" value="${task.answer || 0}" min="0"
                 max="${(task.options || []).length - 1}"
                 class="w-full" onchange="updateTaskField('answer', parseInt(this.value))" />
        </div>
      `;
    case 'action':
      return `
        <div>
          <label class="block text-gray-400 mb-1 text-sm">动作描述</label>
          <input type="text" id="task-description" value="${task.description || ''}"
                 class="w-full" onchange="updateTaskField('description', this.value)" />
        </div>
      `;
    case 'luck':
      return `
        <div>
          <label class="block text-gray-400 mb-1 text-sm">运气效果</label>
          <select id="task-luck-type" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-2"
                  onchange="updateLuckType(this.value)">
            <option value="">请选择</option>
            <option value="forward" ${task.forward ? 'selected' : ''}>前进</option>
            <option value="backward" ${task.backward ? 'selected' : ''}>后退</option>
            <option value="extraTurn" ${task.extraTurn ? 'selected' : ''}>额外投骰</option>
            <option value="skipTurn" ${task.skipTurn ? 'selected' : ''}>暂停一回合</option>
            <option value="swap" ${task.swap ? 'selected' : ''}>交换位置</option>
            <option value="kickback" ${task.kickback ? 'selected' : ''}>送回大本营</option>
          </select>
        </div>
        ${task.forward ? `
          <div>
            <label class="block text-gray-400 mb-1 text-sm">前进格数</label>
            <input type="number" id="task-forward" value="${task.forward}" min="1" max="10"
                   class="w-full" onchange="updateTaskField('forward', parseInt(this.value))" />
          </div>
        ` : ''}
        ${task.backward ? `
          <div>
            <label class="block text-gray-400 mb-1 text-sm">后退格数</label>
            <input type="number" id="task-backward" value="${task.backward}" min="1" max="10"
                   class="w-full" onchange="updateTaskField('backward', parseInt(this.value))" />
          </div>
        ` : ''}
      `;
    case 'challenge':
      return `
        <div>
          <label class="block text-gray-400 mb-1 text-sm">互动目标数量</label>
          <input type="number" id="task-target" value="${task.target || 1}" min="1" max="3"
                 class="w-full" onchange="updateTaskField('target', parseInt(this.value))" />
        </div>
      `;
    default:
      return '';
  }
}

// 更新任务类型
function updateTaskType(type) {
  if (!currentEditingTask) return;

  currentEditingTask.type = type;

  // 根据类型添加默认字段
  switch (type) {
    case 'question':
      currentEditingTask.options = ['选项A', '选项B', '选项C', '选项D'];
      currentEditingTask.answer = 0;
      delete currentEditingTask.description;
      delete currentEditingTask.forward;
      delete currentEditingTask.backward;
      delete currentEditingTask.extraTurn;
      delete currentEditingTask.skipTurn;
      break;
    case 'action':
      currentEditingTask.description = '请完成动作';
      delete currentEditingTask.options;
      delete currentEditingTask.answer;
      break;
    case 'luck':
      currentEditingTask.forward = 1;
      delete currentEditingTask.options;
      delete currentEditingTask.answer;
      delete currentEditingTask.description;
      break;
    case 'challenge':
      currentEditingTask.target = 1;
      delete currentEditingTask.options;
      delete currentEditingTask.answer;
      delete currentEditingTask.description;
      break;
  }

  // 重新渲染类型字段
  const fieldsContainer = document.getElementById('task-type-fields');
  if (fieldsContainer) {
    fieldsContainer.innerHTML = renderTaskTypeFields(currentEditingTask);
  }
}

// 更新任务选项
function updateTaskOptions(value) {
  if (!currentEditingTask) return;

  currentEditingTask.options = value.split(',').map(s => s.trim()).filter(s => s);
  currentEditingTask.answer = 0;
}

// 更新运气类型
function updateLuckType(type) {
  if (!currentEditingTask) return;

  // 清除所有运气字段
  delete currentEditingTask.forward;
  delete currentEditingTask.backward;
  delete currentEditingTask.extraTurn;
  delete currentEditingTask.skipTurn;
  delete currentEditingTask.swap;
  delete currentEditingTask.kickback;

  // 设置新字段
  switch (type) {
    case 'forward':
      currentEditingTask.forward = 1;
      break;
    case 'backward':
      currentEditingTask.backward = 1;
      break;
    case 'extraTurn':
      currentEditingTask.extraTurn = true;
      break;
    case 'skipTurn':
      currentEditingTask.skipTurn = true;
      break;
    case 'swap':
      currentEditingTask.swap = true;
      break;
    case 'kickback':
      currentEditingTask.kickback = true;
      break;
  }

  // 重新渲染字段
  const fieldsContainer = document.getElementById('task-type-fields');
  if (fieldsContainer) {
    fieldsContainer.innerHTML = renderTaskTypeFields(currentEditingTask);
  }
}

// 更新任务字段
function updateTaskField(field, value) {
  if (!currentEditingTask) return;
  currentEditingTask[field] = value;
}

// 保存任务
function saveTask() {
  if (!currentEditingTask || !currentEditingPackage) return;

  // 更新任务包中的任务
  currentEditingPackage.tasks[currentEditingTask.index] = {
    position: currentEditingTask.position,
    type: currentEditingTask.type,
    content: currentEditingTask.content,
    timeLimit: currentEditingTask.timeLimit
  };

  // 根据类型添加特定字段
  if (currentEditingTask.type === 'question') {
    currentEditingPackage.tasks[currentEditingTask.index].options = currentEditingTask.options;
    currentEditingPackage.tasks[currentEditingTask.index].answer = currentEditingTask.answer;
  } else if (currentEditingTask.type === 'action') {
    currentEditingPackage.tasks[currentEditingTask.index].description = currentEditingTask.description;
  } else if (currentEditingTask.type === 'challenge') {
    currentEditingPackage.tasks[currentEditingTask.index].target = currentEditingTask.target;
  } else if (currentEditingTask.type === 'luck') {
    if (currentEditingTask.forward) currentEditingPackage.tasks[currentEditingTask.index].forward = currentEditingTask.forward;
    if (currentEditingTask.backward) currentEditingPackage.tasks[currentEditingTask.index].backward = currentEditingTask.backward;
    if (currentEditingTask.extraTurn) currentEditingPackage.tasks[currentEditingTask.index].extraTurn = true;
    if (currentEditingTask.skipTurn) currentEditingPackage.tasks[currentEditingTask.index].skipTurn = true;
    if (currentEditingTask.swap) currentEditingPackage.tasks[currentEditingTask.index].swap = true;
    if (currentEditingTask.kickback) currentEditingPackage.tasks[currentEditingTask.index].kickback = true;
  }

  // 重新渲染列表
  const list = document.getElementById('task-editor-list');
  if (list) {
    closeTaskEditor();
    list.innerHTML = renderTaskList(currentEditingPackage.tasks);
  }

  showToast('任务已保存');
}

// 关闭任务编辑器
function closeTaskEditor() {
  const panel = document.getElementById('task-edit-panel');
  if (panel) {
    panel.remove();
  }
  currentEditingTask = null;
}

// 删除任务
function deleteTask(index) {
  if (!currentEditingPackage || !confirm('确定删除这个任务?')) return;

  currentEditingPackage.tasks.splice(index, 1);

  // 重新编号
  currentEditingPackage.tasks.forEach((task, i) => {
    task.position = i + 1;
  });

  updateTaskCount();
  const list = document.getElementById('task-editor-list');
  if (list) {
    list.innerHTML = renderTaskList(currentEditingPackage.tasks);
  }

  showToast('任务已删除');
}

// 更新任务计数
function updateTaskCount() {
  const countEl = document.getElementById('task-count');
  if (countEl && currentEditingPackage) {
    countEl.textContent = currentEditingPackage.tasks.length;
  }
}

// 创建新任务包
function createNewPackage() {
  const name = prompt('请输入新任务包名称:');
  if (!name || !name.trim()) return;

  const newPackage = {
    id: `custom_${Date.now()}`,
    name: name.trim(),
    author: '匿名',
    tasks: []
  };

  currentPackageId = newPackage.id;
  currentEditingPackage = newPackage;
  renderPackageEditor(newPackage);
  loadTaskPackageList();
  showToast('新任务包已创建');
}

// 保存当前任务包
function saveCurrentPackage() {
  if (!currentEditingPackage) return;

  fetch('/api/task-packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentEditingPackage)
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast('任务包已保存');
        currentPackageId = data.taskPackage.id;
        loadTaskPackageList();
      } else {
        showErrorModal(data.error || '保存失败');
      }
    })
    .catch(err => {
      console.error('保存失败:', err);
      showErrorModal('保存失败');
    });
}

// 导入任务包
function importPackage() {
  document.getElementById('modal-import').classList.add('active');
}

// 隐藏导入模态框
function hideImportModal() {
  document.getElementById('modal-import').classList.remove('active');
}

// 执行导入
function doImportPackage() {
  const json = document.getElementById('import-json').value.trim();
  if (!json) {
    showErrorModal('请输入JSON内容');
    return;
  }

  fetch('/api/task-packages/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast('导入成功');
        hideImportModal();
        loadTaskPackageList();
        loadPackage(data.taskPackage.id);
      } else {
        showErrorModal(data.error || '导入失败');
      }
    })
    .catch(err => {
      console.error('导入失败:', err);
      showErrorModal('导入失败');
    });

  document.getElementById('import-json').value = '';
}

// 导出当前任务包
function exportCurrentPackage() {
  if (!currentEditingPackage) {
    showErrorModal('请先选择一个任务包');
    return;
  }

  const json = JSON.stringify(currentEditingPackage, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `task-package-${currentEditingPackage.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
