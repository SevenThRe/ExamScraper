async function askAI(question, apiKey) {
  try {
    // 检查是否需要暂停
    while (this.isPaused) {
      console.log('[AI] 答题已暂停，等待继续...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // 每秒检查一次
    }

    // 确保 API Key 有效
    if (!apiKey) {
      throw new Error('API Key 无效');
    }

    const isChoiceQuestion = question.options && question.options.length > 0;

    let prompt = '';
    if (isChoiceQuestion) {
      prompt = `你是一个专业的考试助手。请分析以下选择题并给出答案，只需回答选项字母(A/B/C/D)：
题目：${question.title}
选项：
${question.options.map(o => `${o.label}. ${o.content}`).join('\n')}`;
    } else {
      prompt = `你是一个专业的考试助手。请分析以下填空题并给出简短答案：
题目：${question.title}`;
    }

    console.log(`[AI] 发送题目到模型 - 题号${question.number}:`, prompt);

    const response = await chrome.runtime.sendMessage({
      action: 'askOpenAI',
      data: {
        prompt: prompt,
        apiKey: apiKey
      }
    });

    if (!response || !response.success) {
      throw new Error(response?.error || '模型请求失败');
    }

    let aiAnswer = response.data.choices[0].message.content.trim();
    console.log(`[AI] 模型分析完成 - 题号${question.number}:`, aiAnswer);

    if (isChoiceQuestion) {
      const match = aiAnswer.match(/[A-D]/i);
      return match ? match[0].toUpperCase() : '';
    } else {
      return aiAnswer.split('\n')[0];
    }

  } catch (error) {
    console.error('[AI] 模型分析失败:', error);
    return '分析失败';
  }
}

// 创建悬浮窗显示 AI 答案
function createAIAnswerPanel(scraper) {
  const panel = document.createElement('div');
  panel.id = 'ai-answer-panel';
  panel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    min-width: 200px;
    display: none; /* 初始隐藏 */
    resize: both; /* 允许缩放 */
    overflow: auto; /* 允许滚动 */
  `;

  const title = document.createElement('h3');
  title.textContent = 'AI 答案';
  title.style.cursor = 'move'; // 设置光标为移动
  panel.appendChild(title);

  const answersDiv = document.createElement('div');
  answersDiv.id = 'answers';
  panel.appendChild(answersDiv);

  // 添加暂停/恢复按钮
  const pauseResumeButton = document.createElement('button');
  pauseResumeButton.id = 'pause-resume-button'; // 设置按钮的 ID
  pauseResumeButton.textContent = '暂停 AI 答题';
  pauseResumeButton.style.cssText = `
    display: block;
    width: 100%;
    padding: 8px 15px;
    margin: 5px 0;
    background: #ff9800;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
  `;

  pauseResumeButton.addEventListener('click', () => {
    if (scraper.isPaused) {
      scraper.resumeAI(); // 恢复 AI 答题
      pauseResumeButton.textContent = '暂停 AI 答题'; // 更新按钮文本
    } else {
      scraper.pauseAI(); // 暂停 AI 答题
      pauseResumeButton.textContent = '恢复 AI 答题'; // 更新按钮文本
    }
  });

  panel.appendChild(pauseResumeButton); // 将按钮添加到面板中

  // 添加拖动功能
  makeDraggable(panel);

  document.body.appendChild(panel);
  return panel;
}

// 拖动功能实现
function makeDraggable(element) {
  let isDragging = false;
  let offsetX, offsetY;
  const title = element.querySelector('h3'); // 查找标题元素
  if (!title) {
    console.error('拖动元素未找到，确保存在 h3 元素用于拖动');
    return;
  }
  element.querySelector('h3').addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - element.getBoundingClientRect().left;
    offsetY = e.clientY - element.getBoundingClientRect().top;
    document.body.style.cursor = 'move';
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      element.style.left = `${e.clientX - offsetX}px`;
      element.style.top = `${e.clientY - offsetY}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.cursor = 'default'; // 恢复光标
  });
}

// 显示 AI 答案
function displayAnswer(answerPanel, questionNumber, answer) {
  const answersDiv = answerPanel.querySelector('#answers');
  const answerElement = document.createElement('div');
  answerElement.textContent = `题号 ${questionNumber}: ${answer}`;
  answersDiv.appendChild(answerElement);
}

// Debugger 类定义
class Debugger {
  constructor(questions, aiAnswers) {
    this.questions = questions;
    this.aiAnswers = aiAnswers;
    this.results = [];
  }

  compareAnswers() {
    if (!this.isDebugMode) {
        console.warn('[ExamScraper] 调试模式未启用，跳过答案比较和 CSV 生成');
        return; // 如果调试模式未启用，直接返回
    }

    this.questions.forEach((question, index) => {
      const correctAnswer = question.answer; // 页面上的正确答案
      const aiAnswer = this.aiAnswers[index]; // AI 的答案

      const isCorrect = correctAnswer === aiAnswer; // 判断是否正确
      this.results.push({
        questionNumber: question.number,
        correctAnswer: correctAnswer,
        aiAnswer: aiAnswer,
        isCorrect: isCorrect
      });

      // 使用 debugLog 进行调试输出
      if (this.isDebugMode) { // 仅在调试模式下输出日志
        console.log(`题号 ${question.number} - 正确答案: ${correctAnswer}, AI 答案: ${aiAnswer}, 是否正确: ${isCorrect}`);
      }
    });

    // 计算正确率
    const correctCount = this.results.filter(result => result.isCorrect).length;
    const totalCount = this.results.length;
    const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

    // 确保 debugLog 函数存在
    if (this.isDebugMode && typeof debugLog === 'function') {
      debugLog(`[AI] 正确率: ${accuracy.toFixed(2)}%`); // 输出正确率
    } else if (!this.isDebugMode) {
      console.warn('[AI] 调试模式未启用，无法输出正确率');
    }

    // 下载 CSV 文件
    this.downloadCSV(); // 调用下载 CSV 方法
  }

  generateCSV() {
    const csvRows = [];
    csvRows.push(['题号', '正确答案', 'AI 答案', '是否正确']);

    this.results.forEach(result => {
      csvRows.push([
        result.questionNumber,
        result.correctAnswer,
        result.aiAnswer,
        result.isCorrect ? '是' : '否'
      ]);
    });

    // 计算正确率
    const correctCount = this.results.filter(result => result.isCorrect).length;
    const totalCount = this.results.length;
    const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

    // 添加正确率到 CSV
    csvRows.push(['', '', '', '']);
    csvRows.push(['正确率', `${accuracy.toFixed(2)}%`]);

    const csvString = csvRows.map(row => row.join(',')).join('\n');
    return csvString;
  }

  downloadCSV() {
    const csv = this.generateCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'ai_answers_comparison.csv');
    a.click();
  }
}

// ExamScraper 类定义
class ExamScraper {
  constructor() {
    this.questions = [];
    this.apiKey = localStorage.getItem('apiKey') || '';
    this.isExamMode = false;
    this.aiAnswers = [];
    this.isDebugMode = false;
    this.isPaused = false;
    this.answeredQuestions = []; // 已回答的题目
    console.log('[ExamScraper] 初始化完成');
  }

  debugLog(message) {
    if (this.isDebugMode) {
      console.log(message);
    }
  }

  handleError(error) {
    console.error('[ExamScraper] 发生错误:', error);

  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
    console.log('[ExamScraper] API Key 设置完成:');
  }

  async scrapeQuestions(onlyWrong = false) {
    try {
      console.log('[ExamScraper] 开始抓取题目...');
      const wrongQuestions = new Set();
      if (onlyWrong) {
        const cardItems = document.querySelectorAll('.que-list li');
        cardItems.forEach(item => {
          if (item.classList.contains('error')) {
            const questionNumber = parseInt(item.textContent);
            wrongQuestions.add(questionNumber);
            console.log('[ExamScraper] 找到错题题号:', questionNumber);
          }
        });
        console.log('[ExamScraper] 总共找到错题数量:', wrongQuestions.size);
      }

      const groups = document.querySelectorAll('.group');
      console.log('[ExamScraper] 找到题目组数量:', groups.length);

      if (groups.length === 0) {
        throw new Error('未找到题目组，请确保页面已加载完成');
      }

      let currentQuestionNumber = 1;

      for (let group of groups) {
        const groupTitle = group.querySelector('.title')?.textContent;
        console.log('[ExamScraper] 处理题目组:', groupTitle);

        const questions = group.querySelectorAll('.question-review');
        console.log(`[ExamScraper] 该组题目数量: ${questions.length}`);

        for (let question of questions) {
          if (onlyWrong && !wrongQuestions.has(currentQuestionNumber)) {
            console.log(`[ExamScraper] 跳过正确题目 #${currentQuestionNumber}`);
            currentQuestionNumber++;
            continue;
          }

          const questionData = {
            number: currentQuestionNumber,
            type: groupTitle,
            title: this.getQuestionTitle(question),
            options: this.getQuestionOptions(question),
            answer: this.getCorrectAnswer(question),
            score: this.getQuestionScore(question)
          };

          this.questions.push(questionData);
          console.log(`[ExamScraper] 已抓取题 #${currentQuestionNumber}`);
          currentQuestionNumber++;
        }
      }

      console.log(`[ExamScraper] 抓取完成，总共 ${this.questions.length} 道题目`);
      return this.questions;

    } catch (error) {
      console.error('[ExamScraper] 抓取过程出错:', error);
      throw error;
    }
  }

  async startExam() {
    if (this.isExamMode) {
        console.warn('[ExamScraper] 已经在考试模式中，无法重复进入');
        return;
    }

    if (!this.apiKey) {
      const apiKeyInput = prompt("请输入你的 API Key：", ""); // 使用 prompt 获取 API Key
      if (apiKeyInput) {
        this.apiKey = apiKeyInput; // 设置 API Key
        localStorage.setItem('apiKey', this.apiKey); // 保存 API Key 到 localStorage ，这个应该不是我浏览器的问题，我就是没搞懂怎么储存，所以导致每次都会询问一遍APIKEY，等我学成一定修
        console.log('[ExamScraper] API Key 设置完成'); // 不再打印 API Key
      } else {
        alert("API Key 不能为空！");
        return; // 如果 API Key 为空，直接返回
      }
    }

    this.isExamMode = true; // 进入考试模式
    console.log('[ExamScraper] 开始答题...');

    const answerPanel = createAIAnswerPanel(this); // 创建悬浮窗
    answerPanel.style.display = 'block'; // 显示悬浮窗

    // 爬取所有题目
    await this.scrapeQuestions(false); // 获取所有题目

    for (const question of this.questions) {
      // 检查是否暂停
      while (this.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 等待100ms后继续检查
        //我还是没搞明白为什么还是暂停不了他，所以你要是进答题了就真进去了，我的脑残脚本会一直跑完，除非你F5刷新
      }
      if (this.answeredQuestions.includes(question.number)) {
        continue;
      }
      const answer = await askAI(question, this.apiKey); // 调用 AI 答题逻辑
      console.log(`题号 ${question.number} 的答案是: ${answer}`);
      this.aiAnswers.push(answer); // 存储 AI 的答案
      this.answeredQuestions.push(question.number); // 记录已回答的题号
      // 在悬浮窗中显示答案
      displayAnswer(answerPanel, question.number, answer);
    }

    // 仅在调试模式下调用 compareAnswers
    if (this.isDebugMode) {
      this.compareAnswers(); // 仅在调试模式下调用
    }
  }

  compareAnswers() {
    const debuggerInstance = new Debugger(this.questions, this.aiAnswers);
    debuggerInstance.compareAnswers();
    debuggerInstance.downloadCSV(); // 下载 CSV 文件
  }

  displayAnswer(answerWindow, questionNumber, answer) {
    const answersDiv = answerWindow.document.getElementById('answers');
    const answerElement = document.createElement('div');
    answerElement.textContent = `题号 ${questionNumber}: ${answer}`;
    answersDiv.appendChild(answerElement);
  }

  exitExam() {
    console.log('[ExamScraper] 退出考试模式，页面将刷新...');
    location.reload(); // 刷页面以退出考试模式
  }

  getQuestionTitle(question) {
    const titleElement = question.querySelector('.ck-content.title');
    if (titleElement) {
      return titleElement.innerText.replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  getQuestionOptions(question) {
    const options = [];
    const optionElements = question.querySelectorAll('.option');

    optionElements.forEach((option) => {
      const label = option.querySelector('.item')?.innerText.trim() || '';
      const content = option.querySelector('.opt-content')?.innerText.trim() || '';

      if (label) {
        options.push({ label, content });
      }
    });

    return options;
  }

  getCorrectAnswer(question) {
    const answerElement = question.querySelector('.score-detail .item:nth-child(3) span.text-color-success');
    return answerElement ? answerElement.innerText.trim() : '';
  }

  getQuestionScore(question) {
    const scoreElement = question.querySelector('.score-detail .text-color-danger');
    return scoreElement ? parseInt(scoreElement.innerText) : 0;
  }

  // 导出题库和错题的 CSV 方法
  exportToCSV(onlyWrong = false) {
    const csvRows = [];
    csvRows.push(['题号', '题目', '选项A', '选项B', '选项C', '选项D', '正确答案']);

    this.questions.forEach((question) => {
      const options = question.options;
      const correctAnswer = question.answer;

      const optionA = options.find(opt => opt.label === 'A')?.content || '';
      const optionB = options.find(opt => opt.label === 'B')?.content || '';
      const optionC = options.find(opt => opt.label === 'C')?.content || '';
      const optionD = options.find(opt => opt.label === 'D')?.content || '';

      if (!onlyWrong || (onlyWrong && this.aiAnswers[question.number - 1] !== correctAnswer)) {
        csvRows.push([
          question.number,
          question.title,
          optionA,
          optionB,
          optionC,
          optionD,
          correctAnswer
        ]);
      }
    });

    const csvString = csvRows.map(row => row.join(',')).join('\n');
    return csvString;
  }

  // 添加控制 AI 是否继续答题的功能
  pauseAI() {
    this.isPaused = true; // 设置为暂停状态
    console.log('[AI] 答题已暂停');
  }

  resumeAI() {
    this.isPaused = false; // 恢复状态
    console.log('[AI] 答题已恢复');
  }
}

// 创建“进入考试模式”按钮
function createStartExamButton(scraper) {
  const button = document.createElement('button');
  button.textContent = '进入考试模式';
  button.style.cssText = `
    display: block;
    width: 100%;
    padding: 8px 15px;
    margin: 5px 0;
    background: #f44336;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
  `;

  button.addEventListener('click', () => {
    if (scraper.isExamMode) {
      scraper.exitExam();
      button.textContent = '进入考试模式';
      button.style.backgroundColor = '#f44336'; // 恢复按钮颜色
    } else {
      const apiKey = prompt("请输入你的 API Key：", "");
      if (apiKey) {
        scraper.setApiKey(apiKey);
        scraper.startExam(); // 调用开始答题的方法
        button.textContent = '退出考试模式';
        button.style.backgroundColor = '#4CAF50'; // 改变按钮颜色
      } else {
        alert("API Key 不能空！");
      }
    }
  });

  return button;
}

// 创建按钮的辅助函数
function createButton(text, onlyWrong) {
  const button = document.createElement('button');
  button.textContent = text;
  button.style.cssText = `
    display: block;
    width: 100%;
    padding: 8px 15px;
    margin: 5px 0;
    background: #4285f4;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
  `;

  button.addEventListener('click', async () => {
    const scraper = new ExamScraper();
    await scraper.scrapeQuestions(onlyWrong);

    const csv = scraper.exportToCSV(onlyWrong);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', onlyWrong ? '错题导出.csv' : '全部题目.csv');
    a.click();
  });

  return button;
}

// 创建“启用调试模式”按钮
function createDebugButton(scraper) {
  const button = document.createElement('button');
  button.textContent = '启用调试模式';
  button.style.cssText = `
    display: block;
    width: 100%;
    padding: 8px 15px;
    margin: 5px 0;
    background: #ff9800;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
  `;

  button.addEventListener('click', () => {
    scraper.isDebugMode = !scraper.isDebugMode; // 切换调试模式状态
    button.textContent = scraper.isDebugMode ? '关闭调试模式' : '启用调试模式'; // 更新按钮文本
    alert(scraper.isDebugMode ? "调试模式已启用。" : "调试模式已关闭。");
  });

  return button;
}

function createFloatingPanel() {
  const panel = document.createElement('div');
  panel.id = 'exam-scraper-panel';
  panel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    min-width: 200px;
  `;

  const titleBar = document.createElement('div');
  titleBar.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
  `;

  const title = document.createElement('div');
  title.textContent = '智云题库助手';
  title.style.fontWeight = 'bold';

  // 创建最小化按钮
  const minimizeBtn = document.createElement('button');
  minimizeBtn.innerHTML = '−';
  minimizeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 0 5px;
    color: #666;
  `;

  titleBar.appendChild(title);
  titleBar.appendChild(minimizeBtn);

  const allButton = createButton('导出全部题目', false);
  const wrongButton = createButton('仅导出错题', true);
  const startExamButton = createStartExamButton(new ExamScraper());
  const debugButton = createDebugButton(new ExamScraper()); // 添加调试按钮

  panel.appendChild(titleBar);
  panel.appendChild(allButton);
  panel.appendChild(wrongButton);
  panel.appendChild(startExamButton);
  panel.appendChild(debugButton); // 添加调试按钮

  // 创建悬浮球
  const floatingBall = document.createElement('div');
  floatingBall.id = 'exam-scraper-ball';
  floatingBall.style.cssText = `
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 48px;
    height: 48px;
    background-image: url(${chrome.runtime.getURL('icons/icon48.png')});
    background-size: cover;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 999999;
    display: none;
  `;

  // 添加拖动功能
  makeDraggable(panel);
  makeDraggable(floatingBall);

  // 最小化按钮点击事件
  minimizeBtn.addEventListener('click', () => {
    panel.style.display = 'none';
    floatingBall.style.display = 'block';
  });

  // 悬浮球点击事件
  floatingBall.addEventListener('click', () => {
    floatingBall.style.display = 'none';
    panel.style.display = 'block';
  });

  document.body.appendChild(panel);
  document.body.appendChild(floatingBall);
  console.log('[ExamScraper] 面板已创建');
}

// 添加拖动功能的辅助函数
function makeDraggable(element) {
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;

  element.addEventListener('mousedown', e => {
    isDragging = true;
    initialX = e.clientX - element.offsetLeft;
    initialY = e.clientY - element.offsetTop;
  });

  document.addEventListener('mousemove', e => {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      element.style.left = `${currentX}px`;
      element.style.top = `${currentY}px`;
      element.style.right = 'auto';

      // 限制在视窗范围内
      const maxX = window.innerWidth - element.offsetWidth;
      const maxY = window.innerHeight - element.offsetHeight;

      currentX = Math.min(Math.max(0, currentX), maxX);
      currentY = Math.min(Math.max(0, currentY), maxY);

      element.style.left = `${currentX}px`;
      element.style.top = `${currentY}px`;
      element.style.right = 'auto';
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

// 确保 DOM 加载完成后执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createFloatingPanel);
} else {
  createFloatingPanel();
}
