const fs = require('fs');
const path = require('path');
const { validateContent } = require('./utils');

const TASK_PACKAGES_DIR = path.join(__dirname, '..', 'task_packages');

// 确保目录存在
if (!fs.existsSync(TASK_PACKAGES_DIR)) {
  fs.mkdirSync(TASK_PACKAGES_DIR, { recursive: true });
}

// 默认任务包 (52个格子，每格一个任务)
const defaultTaskPackage = {
  id: 'default',
  name: '默认任务包',
  author: '系统',
  tasks: generateDefaultTasks()
};

function generateDefaultTasks() {
  const tasks = [];

  // 问答类任务
  const questions = [
    { q: '你最喜欢吃什么水果？', options: ['苹果', '香蕉', '橙子', '葡萄'], answer: 0 },
    { q: '一年有几个月？', options: ['10个月', '11个月', '12个月', '13个月'], answer: 2 },
    { q: '中国的首都在哪里？', options: ['上海', '北京', '广州', '深圳'], answer: 1 },
    { q: '1+1等于多少？', options: ['1', '2', '3', '4'], answer: 1 },
    { q: '太阳从哪里升起？', options: ['西边', '南边', '北边', '东边'], answer: 3 },
    { q: '谁发明了电灯？', options: ['牛顿', '爱因斯坦', '爱迪生', '特斯拉'], answer: 2 },
    { q: '地球是什么形状？', options: ['方形', '圆形', '球形', '三角形'], answer: 2 },
    { q: '水在多少度结冰？', options: ['0度', '10度', '-10度', '100度'], answer: 0 },
    { q: '一个星期有几天？', options: ['5天', '6天', '7天', '8天'], answer: 2 },
    { q: '一年有几个季节？', options: ['2个', '3个', '4个', '5个'], answer: 2 },
    { q: '彩虹有几种颜色？', options: ['5种', '6种', '7种', '8种'], answer: 2 },
    { q: '人类有几根手指？', options: ['8根', '9根', '10根', '11根'], answer: 2 },
    { q: '飞机是谁发明的？', options: ['哥伦布', '莱特兄弟', '牛顿', '霍金'], answer: 1 },
    { q: '哪种动物会飞？', options: ['猫', '狗', '鸟', '鱼'], answer: 2 },
    { q: '中国有多少个民族？', options: ['55个', '56个', '57个', '58个'], answer: 1 },
    { q: '端午节是纪念谁？', options: ['孔子', '老子', '屈原', '孟子'], answer: 2 },
    { q: '哪种颜色是RGB三原色之一？', options: ['黄色', '粉色', '橙色', '紫色'], answer: 0 },
    { q: '计算机存储最小单位是？', options: ['字节', '位', '字', '块'], answer: 1 },
    { q: '中国最长河是？', options: ['黄河', '长江', '珠江', '淮河'], answer: 1 },
    { q: '世界上最高山峰是？', options: ['华山', '黄山', '珠穆朗玛峰', '泰山'], answer: 2 },
    // 更多问题
    { q: '一本书通常有多少页？', options: ['50页以下', '50-200页', '200-500页', '500页以上'], answer: 1 },
    { q: '你每天睡几个小时？', options: ['4小时以下', '4-6小时', '6-8小时', '8小时以上'], answer: 2 },
    { q: '一年中哪个月有28或29天？', options: ['1月', '2月', '3月', '所有月份'], answer: 3 },
    { q: '人体最大的器官是？', options: ['心脏', '肝脏', '皮肤', '大脑'], answer: 2 },
    { q: '哪种语言使用人数最多？', options: ['英语', '汉语', '西班牙语', '法语'], answer: 1 },
    { q: '冰箱有什么用？', options: ['制冷', '加热', '洗衣服', '看电视'], answer: 0 },
    { q: '手机用什么电池？', options: ['燃油电池', '太阳能电池', '锂电池', '干电池'], answer: 2 },
    { q: '互联网缩写是？', options: ['LAN', 'WAN', 'Internet', 'Wifi'], answer: 2 },
    { q: '哪个不是编程语言？', options: ['Python', 'Java', 'HTML', 'Dragon'], answer: 3 },
    { q: '水是由什么组成？', options: ['碳和氧', '氢和氧', '氮和氧', '氦和氧'], answer: 1 },
    // 更多趣味问题
    { q: '你喜欢什么季节？', options: ['春天', '夏天', '秋天', '冬天'], answer: 0 },
    { q: '周末有几天？', options: ['1天', '2天', '3天', '0天'], answer: 1 },
    { q: '你通常几点起床？', options: ['5点前', '5-7点', '7-9点', '9点后'], answer: 2 },
    { q: '刷牙应该刷几分钟？', options: ['不到1分钟', '1-2分钟', '3-5分钟', '10分钟'], answer: 2 },
    { q: '运动有益于？', options: ['身体健康', '心理健康', '两者都有', '两者都没有'], answer: 2 },
    { q: '每天应该喝多少水？', options: ['不到1升', '1-2升', '3-4升', '不用喝水'], answer: 1 },
    { q: '水果和蔬菜哪个维C多？', options: ['水果', '蔬菜', '差不多', '都没有'], answer: 2 },
    { q: '散步算运动吗？', options: ['不算', '算轻度', '算中度', '算剧烈'], answer: 1 },
    { q: '大笑对身体好吗？', options: ['不好', '不确定', '有点好处', '很好'], answer: 3 },
    { q: '吸烟有害健康吗？', options: ['没影响', '有点害', '有害', '有益'], answer: 2 }
  ];

  // 动作类任务
  const actionTasks = [
    { action: '模仿大猩猩捶胸', description: '做出大猩猩的动作' },
    { action: '学猫叫三声', description: '喵喵喵~' },
    { action: '做10个俯卧撑', description: '展示你的力量' },
    { action: '原地转三圈', description: '眩晕模式启动' },
    { action: '模仿鸭子走路', description: '摇摇摆摆走十步' },
    { action: '做鬼脸', description: '越夸张越好' },
    { action: '用舌头舔到鼻子', description: '挑战不可能' },
    { action: '金鸡独立30秒', description: '单腿站立' },
    { action: '模仿木头人', description: '保持不动5秒' },
    { action: '做瑜伽下犬式', description: '展示柔韧性' },
    { action: '模仿唐老鸭走路', description: '摇摇晃晃' },
    { action: '学狗狗叫', description: '汪汪汪~' },
    { action: '倒着数数字', description: '从10数到1' },
    { action: '用左手写自己名字', description: '左手书法' },
    { action: '做5个深蹲', description: '锻炼腿部' },
    { action: '模仿机器人动作', description: '机械舞' },
    { action: '吹气球(模拟)', description: '深吸一口气' },
    { action: '学婴儿说话', description: '咿咿呀呀' },
    { action: '模仿老爷爷走路', description: '步履蹒跚' },
    { action: '学小鸡啄米', description: '叽叽叽~' }
  ];

  // 运气类任务
  const luckTasks = [
    { luck: '幸运! 前进3格', forward: 3 },
    { luck: '太棒了! 前进5格', forward: 5 },
    { luck: '运气不错! 前进2格', forward: 2 },
    { luck: '前进1格', forward: 1 },
    { luck: '哎呦! 后退3格', backward: 3 },
    { luck: '不妙! 后退2格', backward: 2 },
    { luck: '再投一次!', extraTurn: true },
    { luck: '暂停一回合', skipTurn: true },
    { luck: '和任意玩家交换位置', swap: true },
    { luck: '选择一名玩家送Ta回大本营', kickback: true },
    { luck: '随机传送!(0-10格)', randomMove: 10 },
    { luck: '投骰子决定命运(1-3前进,4-6后退)', diceFate: true }
  ];

  // 挑战类任务 (需要与其他玩家互动)
  const challengeTasks = [
    { challenge: '选一名玩家拥抱', target: 1 },
    { challenge: '选一名玩家对视10秒', target: 1 },
    { challenge: '选一名玩家击掌', target: 1 },
    { challenge: '选一名玩家交换位置', target: 1 },
    { challenge: '选一名玩家互相捶背', target: 1 },
    { challenge: '选一名玩家说一个秘密', target: 1 },
    { challenge: '选一名玩家牵手走到终点', target: 1 },
    { challenge: '选一名玩家表演双人小品', target: 1 },
    { challenge: '选一名玩家石头剪刀布三局', target: 1 },
    { challenge: '选一名玩家互相夸赞三句', target: 1 }
  ];

  // 为52个格子分配任务 (除起点格外，每格一个任务)
  for (let i = 1; i <= 52; i++) {
    const taskIndex = (i - 1) % 52;
    let task;

    // 混合不同类型任务
    if (taskIndex < 40) {
      // 40个格子放问答
      const qIndex = taskIndex % questions.length;
      const q = questions[qIndex];
      task = {
        position: i,
        type: 'question',
        content: q.q,
        options: q.options,
        answer: q.answer,
        timeLimit: 30
      };
    } else if (taskIndex < 48) {
      // 8个格子放动作
      const aIndex = (taskIndex - 40) % actionTasks.length;
      const a = actionTasks[aIndex];
      task = {
        position: i,
        type: 'action',
        content: a.action,
        description: a.description,
        timeLimit: 60
      };
    } else if (taskIndex < 50) {
      // 2个格子放运气
      const lIndex = (taskIndex - 48) % luckTasks.length;
      task = {
        position: i,
        type: 'luck',
        content: luckTasks[lIndex].luck,
        ...luckTasks[lIndex]
      };
    } else {
      // 2个格子放挑战
      const cIndex = (taskIndex - 50) % challengeTasks.length;
      task = {
        position: i,
        type: 'challenge',
        content: challengeTasks[cIndex].challenge,
        target: challengeTasks[cIndex].target,
        timeLimit: 60
      };
    }

    tasks.push(task);
  }

  return tasks;
}

// 加载任务包
function loadTaskPackage(id) {
  if (id === 'default') {
    return defaultTaskPackage;
  }

  const filePath = path.join(TASK_PACKAGES_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('加载任务包失败:', e);
      return defaultTaskPackage;
    }
  }
  return defaultTaskPackage;
}

// 保存任务包
function saveTaskPackage(taskPackage) {
  const validation = validatePackage(taskPackage);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 过滤敏感词
  taskPackage.name = filterPackageContent(taskPackage.name);
  taskPackage.author = filterPackageContent(taskPackage.author);
  taskPackage.tasks.forEach(task => {
    task.content = filterPackageContent(task.content);
    if (task.options) {
      task.options = task.options.map(o => filterPackageContent(o));
    }
    if (task.description) {
      task.description = filterPackageContent(task.description);
    }
  });

  const filePath = path.join(TASK_PACKAGES_DIR, `${taskPackage.id}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(taskPackage, null, 2), 'utf-8');
    return { success: true, taskPackage };
  } catch (e) {
    return { success: false, error: '保存失败' };
  }
}

// 验证任务包
function validatePackage(taskPackage) {
  if (!taskPackage || typeof taskPackage !== 'object') {
    return { valid: false, error: '任务包格式错误' };
  }

  if (!taskPackage.id || typeof taskPackage.id !== 'string') {
    return { valid: false, error: '缺少任务包ID' };
  }

  const nameValidation = validateContent(taskPackage.name, 50);
  if (!nameValidation.valid) {
    return { valid: false, error: `任务包名称: ${nameValidation.error}` };
  }

  if (!Array.isArray(taskPackage.tasks)) {
    return { valid: false, error: '缺少任务列表' };
  }

  if (taskPackage.tasks.length === 0) {
    return { valid: false, error: '任务列表不能为空' };
  }

  for (let i = 0; i < taskPackage.tasks.length; i++) {
    const task = taskPackage.tasks[i];
    const taskValidation = validateTask(task, i + 1);
    if (!taskValidation.valid) {
      return taskValidation;
    }
  }

  return { valid: true };
}

// 验证单个任务
function validateTask(task, index) {
  if (!task || typeof task !== 'object') {
    return { valid: false, error: `任务${index}格式错误` };
  }

  const contentValidation = validateContent(task.content, 100);
  if (!contentValidation.valid) {
    return { valid: false, error: `任务${index}: ${contentValidation.error}` };
  }

  const validTypes = ['question', 'action', 'challenge', 'luck'];
  if (!validTypes.includes(task.type)) {
    return { valid: false, error: `任务${index}: 无效的任务类型` };
  }

  if (task.type === 'question') {
    if (!Array.isArray(task.options) || task.options.length < 2) {
      return { valid: false, error: `任务${index}: 选择题需要至少2个选项` };
    }
    if (typeof task.answer !== 'number' || task.answer < 0 || task.answer >= task.options.length) {
      return { valid: false, error: `任务${index}: 无效的答案索引` };
    }
  }

  return { valid: true };
}

// 过滤任务包中的敏感内容
function filterPackageContent(text) {
  if (!text || typeof text !== 'string') return '';
  return text.trim().slice(0, 200);
}

// 获取所有任务包列表
function listTaskPackages() {
  const packages = [{ ...defaultTaskPackage }];

  try {
    const files = fs.readdirSync(TASK_PACKAGES_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const data = fs.readFileSync(path.join(TASK_PACKAGES_DIR, file), 'utf-8');
          const pkg = JSON.parse(data);
          packages.push({
            id: pkg.id,
            name: pkg.name,
            author: pkg.author,
            taskCount: pkg.tasks ? pkg.tasks.length : 0
          });
        } catch (e) {
          console.error('加载任务包失败:', file, e);
        }
      }
    }
  } catch (e) {
    console.error('读取任务包目录失败:', e);
  }

  return packages;
}

// 删除任务包
function deleteTaskPackage(id) {
  if (id === 'default') {
    return { success: false, error: '不能删除默认任务包' };
  }

  const filePath = path.join(TASK_PACKAGES_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return { success: true };
    } catch (e) {
      return { success: false, error: '删除失败' };
    }
  }
  return { success: false, error: '任务包不存在' };
}

// 导出任务包为JSON
function exportTaskPackage(id) {
  const pkg = loadTaskPackage(id);
  return JSON.stringify(pkg, null, 2);
}

// 从JSON导入任务包
function importTaskPackage(jsonStr) {
  try {
    const taskPackage = JSON.parse(jsonStr);
    const validation = validatePackage(taskPackage);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 生成新ID避免冲突
    taskPackage.id = `custom_${Date.now()}`;
    const result = saveTaskPackage(taskPackage);
    return result;
  } catch (e) {
    return { success: false, error: 'JSON解析失败' };
  }
}

module.exports = {
  defaultTaskPackage,
  loadTaskPackage,
  saveTaskPackage,
  validatePackage,
  validateTask,
  listTaskPackages,
  deleteTaskPackage,
  exportTaskPackage,
  importTaskPackage
};
