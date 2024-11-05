async function askAI(question, apiKey, scraper) {
  try {
    // 检查是否处于暂停状态
    while (scraper.isPaused) {
      console.log('[AI] 答题已暂停，等待继续...');
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 验证API Key是否有效
    if (!apiKey) {
      throw new Error('API Key 无效');
    }

    // 判断题目类型（选择题或填空题）
    const isChoiceQuestion = question.options && question.options.length > 0;

    // 根据题目类型构建不同的提示语
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

    // 发送请求到OpenAI API
    const response = await chrome.runtime.sendMessage({
      action: 'askOpenAI',
      data: {
        prompt: prompt,
        apiKey: apiKey,
        maxTokens: 1024,
        temperature: 0.5
      }
    });

    // 检查响应是否成功
    if (!response || !response.success) {
      throw new Error(response?.error || '模型请求失败');
    }

    // 处理AI返回的答案
    let aiAnswer = response.data.choices[0].message.content.trim();
    console.log(`[AI] 模型分析完成 - 题号${question.number}:`, aiAnswer);

    // 根据题目类型格式化答案
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

let scraper;
function initScraper() {
  scraper = new ExamScraper(); // 实例化 scraper
  console.log('scraper:', scraper);
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
// function makeDraggable(element) {
//   let isDragging = false;
//   let offsetX, offsetY;
//   const title = element.querySelector('h3'); // 查找标题元素
//   if (!title) {
//     console.error('拖动元素未找到，确保存在 h3 元素用于拖动');
//     return;
//   }
//   element.querySelector('h3').addEventListener('mousedown', (e) => {
//     isDragging = true;
//     offsetX = e.clientX - element.getBoundingClientRect().left;
//     offsetY = e.clientY - element.getBoundingClientRect().top;
//     document.body.style.cursor = 'move';
//   });
//
//   document.addEventListener('mousemove', (e) => {
//     if (isDragging) {
//       element.style.left = `${e.clientX - offsetX}px`;
//       element.style.top = `${e.clientY - offsetY}px`;
//     }
//   });
//
//   document.addEventListener('mouseup', () => {
//     isDragging = false;
//     document.body.style.cursor = 'default'; // 恢复光标
//   });
// }

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
    if (!scraper.isDebugMode) {
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

      if (scraper.isDebugMode) { // 仅在调试模式下输出日志
        console.log(`题号 ${question.number} - 正确答案: ${correctAnswer}, AI 答案: ${aiAnswer}, 是否正确: ${isCorrect}`);
      }
    });

    // 计算正确率
    const correctCount = this.results.filter(result => result.isCorrect).length;
    const totalCount = this.results.length;
    const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

    // 确保 debugLog 函数存在
    if (scraper.isDebugMode) {
      console.log(`[AI] 正确率: ${accuracy.toFixed(2)}%`); // 输出正确率
    } else if (!scraper.isDebugMode) {
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
    // 初始化类属性
    this.questions = [];
    this.apiKey = this.getApiKey();
    this.isExamMode = false;
    this.aiAnswers = [];
    this.isDebugMode = false;
    this.isPaused = false;
    this.answeredQuestions = [];
    this.encryptionKey = this.getOrCreateEncryptionKey();
    console.log('[ExamScraper] 初始化完成');
  }

  // 获取或创建新的加密密钥
  getOrCreateEncryptionKey() {
    let key = localStorage.getItem('encryptionKey');
    if (!key) {
      // 生成256位(32字节)的随机密钥
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      // 直接存储字节数组的Base64表示
      key = btoa(String.fromCharCode.apply(null, array));
      localStorage.setItem('encryptionKey', key);
    }
    return key;
  }

  // 使用AES-GCM加密API Key
  async encryptApiKey(apiKey) {
    try {
      // 从Base64还原为字节数组
      const keyBytes = new Uint8Array(
        atob(this.encryptionKey).split('').map(char => char.charCodeAt(0))
      );

      // 导入加密密钥
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      // 生成随机IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encodedData = new TextEncoder().encode(apiKey);
      
      // 执行加密
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encodedData
      );

      // 合并IV和加密数据
      const encryptedArray = new Uint8Array(iv.length + encryptedData.byteLength);
      encryptedArray.set(iv);
      encryptedArray.set(new Uint8Array(encryptedData), iv.length);
      
      return btoa(String.fromCharCode.apply(null, encryptedArray));
    } catch (error) {
      console.error('[ExamScraper] 加密失败:', error);
      return null;
    }
  }

  // 解密API Key
  async decryptApiKey(encryptedData) {
    try {
      // 从Base64还原密钥字节数组
      const keyBytes = new Uint8Array(
        atob(this.encryptionKey).split('').map(char => char.charCodeAt(0))
      );

      // 导入解密密钥
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // 解码加密数据
      const encryptedArray = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );

      // 分离IV和加密数据
      const iv = encryptedArray.slice(0, 12);
      const data = encryptedArray.slice(12);

      // 执行解密
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('[ExamScraper] 解密失败:', error);
      return null;
    }
  }

  // 设置并加密保存API Key
  async setApiKey(apiKey) {
    const encryptedApiKey = await this.encryptApiKey(apiKey);
    if (encryptedApiKey) {
      this.apiKey = apiKey; // 保存原始API Key用于当前会话
      localStorage.setItem('apiKey', encryptedApiKey); // 保存加密后的API Key
      console.log('[ExamScraper] API Key 已加密并保存');
    }
  }

  // 获取并解密API Key
  async getApiKey() {
    const encryptedApiKey = localStorage.getItem('apiKey');
    if (!encryptedApiKey) return '';
    
    try {
      const decryptedApiKey = await this.decryptApiKey(encryptedApiKey);
      return decryptedApiKey || '';
    } catch (e) {
      console.error('[ExamScraper] API Key解密失败:', e);
      return '';
    }
  }

  async scrapeQuestions(onlyWrong = false) {
    // 清空 questions 数组以确保每次爬取都是新的数据集
    this.questions = []; 

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

          // 添加详细的日志输出
          console.log(`[ExamScraper] 题目 #${currentQuestionNumber} 详细信息:`, {
            题目类型: groupTitle,
            题目内容: questionData.title,
            选项: questionData.options,
            正确答案: questionData.answer,
            分值: questionData.score
          });

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
    
    // 确保使用解密后的API Key
    if (!this.apiKey) {
      const apiKeyInput = prompt("请输入你的 API Key：", "");
      if (apiKeyInput) {
        await this.setApiKey(apiKeyInput);
      } else {
        alert("API Key 不能为空！");
        return;
      }
    }

    // 在开始答题前解密一次API Key并保存
    try {
      // 获取解密后的API Key
      const decryptedApiKey = await this.getApiKey();
      if (!decryptedApiKey) {
        throw new Error('API Key解密失败');
      }
      
      // 保存解密后的API Key用于整个答题过程
      this.decryptedApiKey = decryptedApiKey;
      
      this.isExamMode = true;
      console.log('[ExamScraper] 开始答题...');

      const answerPanel = createAIAnswerPanel(this);
      answerPanel.style.display = 'block';

      await this.scrapeQuestions(false);

      for (const question of this.questions) {
        while (this.isPaused) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (this.answeredQuestions.includes(question.number)) {
          continue;
        }
        // 使用保存的解密后的API Key
        const answer = await askAI(question, this.decryptedApiKey, this);
        console.log(`题号 ${question.number} 的答案是: ${answer}`);
        this.aiAnswers.push(answer);
        this.answeredQuestions.push(question.number);
        displayAnswer(answerPanel, question.number, answer);
      }

      if (this.isDebugMode) {
        this.compareAnswers();
      }
    } catch (error) {
      console.error('[ExamScraper] 答题过程出错:', error);
      alert('答题过程出错，请检查API Key是否正确');
      this.exitExam();
    }
  }

  compareAnswers() {
    const debuggerInstance = new Debugger(this.questions, this.aiAnswers);
    debuggerInstance.compareAnswers();
    debuggerInstance.downloadCSV(); // 下载 CSV 文件
  }
  exitExam() {
    this.decryptedApiKey = null;
    this.isExamMode = false;
    console.log('[ExamScraper] 退出考试模式，页面将刷新...');
    location.reload();
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
    const choiceAnswerElement = question.querySelector('.score-detail .item:nth-child(3) span.text-color-success');
    if (choiceAnswerElement) {
      return choiceAnswerElement.innerText.trim();
    }
  
    const textAnswerElement = question.querySelector('.score-detail .item-box .text-answer');
    if (textAnswerElement) {
      return textAnswerElement.innerText.replace(/^\d+\.\s*/, '').trim();
    }
    return '';
  }
  getQuestionScore(question) {
    const scoreElement = question.querySelector('.score-detail .text-color-danger');
    return scoreElement ? parseInt(scoreElement.innerText) : 0;
  }

  // 导出题库和错题的 CSV 法
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


  exportToJSON() {
    const jsonString = JSON.stringify(this.questions, null, 2);
    return jsonString;
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

  // json 导出为 CSV 测试
function jsonToCSV(json) {
  const keys = Object.keys(json);
  let csv = keys.join(',') + '\n';

  const values = keys.map(key => {
      const value = json[key];
      if (typeof value === 'string' && value.includes(',')) {
          // 转义逗号并用双引号包裹
          return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
  });

  csv += values.join(',') + '\n';
  return csv;
}

// 创建设置图标
function createSettingsIcon(scraper) {
  const icon = document.createElement('img');
  icon.src = 'https://img.icons8.com/material-outlined/24/000000/settings.png';
  icon.alt = '设置';
  icon.style.cssText = `
    width: 24px;
    height: 24px;
    cursor: pointer;
    margin-right: 10px;
  `;

  icon.addEventListener('click', () => {
    const modal = document.getElementById('settings-modal');
    if (modal) {
      // 切换模态窗口的显示状态
      modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
    }
  });

  return icon;
}

// 创建设置模态窗口
function createSettingsModal(scraper) {
  const modal = document.createElement('div');
  const debugButton = createDebugButton(scraper); 

  modal.id = 'settings-modal';
  modal.style.cssText = `
    position: fixed;
    top: 200px; /* 设置初始位置 */
    left: 100px; /* 设置初始位置 */
    z-index: 8000;
    background: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    min-width: 200px;
    display: none; /* 初始隐藏 */
  `;
  const title = document.createElement('h3');
  title.textContent = '设置';
  title.style.cursor = 'move'; // 设置光标为移动


  document.body.appendChild(modal);
  modal.appendChild(title);

  // API Key 输入部分
  const apiKeyInput = document.createElement('input');
  apiKeyInput.type = 'password'; // 设置为密码输入框
  apiKeyInput.placeholder = '请输入你的 API Key';
  apiKeyInput.style.cssText = `
    width: 100%;
    padding: 8px;
    margin: 10px 0;
    border: 1px solid #ccc;
    border-radius: 4px;
  `;
  modal.appendChild(apiKeyInput);

  // 导出格式选择部分
  const exportFormatLabel = document.createElement('label');
  exportFormatLabel.textContent = '选择导出格式:';
  modal.appendChild(exportFormatLabel);

  const exportFormatSelect = document.createElement('select');
  exportFormatSelect.id = 'export-format';
  const csvOption = document.createElement('option');
  csvOption.value = 'csv';
  csvOption.textContent = 'CSV';
  const jsonOption = document.createElement('option');
  jsonOption.value = 'json';
  jsonOption.textContent = 'JSON';
  
  exportFormatSelect.appendChild(csvOption);
  exportFormatSelect.appendChild(jsonOption);
  modal.appendChild(exportFormatSelect);

  // 保存 API Key 按钮
  const saveButton = document.createElement('button');
  saveButton.textContent = '保存 API Key';
  saveButton.style.cssText = `
    display: block;
    width: 100%;
    padding: 8px 15px;
    margin: 5px 0;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
  `;
  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value;
    if (apiKey) {
      scraper.setApiKey(apiKey); // 使用 setApiKey 方法保存 API Key
      alert('API Key 已保存！');
      apiKeyInput.value = ''; // 清空输入框
    } else {
      alert('API Key 不能为空！');
    }
  });
  modal.appendChild(saveButton);
  modal.appendChild(debugButton);

  // 关闭按钮
  const closeButton = document.createElement('button');
  closeButton.textContent = '关闭';
  closeButton.style.cssText = `
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
  closeButton.addEventListener('click', () => {
    modal.style.display = 'none'; // 关闭模态窗口
  });
  modal.appendChild(closeButton);

  // 添加拖动功能
  makeDraggable(modal); // 确保可以拖动整个设置窗口
  return modal;
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

  button.addEventListener('click', async () => { // 确保使用 async
    if (scraper.isExamMode) {
      scraper.exitExam();
      button.textContent = '进入考试模式';
      button.style.backgroundColor = '#f44336'; // 恢复按钮颜色
    } else {
      const apiKey = localStorage.getItem('apiKey');
      if (apiKey) {
        scraper.setApiKey(apiKey);
        await scraper.startExam(); // 确保调用 startExam 是异步的
        button.textContent = '退出考试模式';
        button.style.backgroundColor = '#4CAF50'; // 改变按钮颜色
      } else {
        alert("API Key 不能空！");
      }
    }
  });

  return button;
}

// 创建“导出全部题目”按钮
function createButton(text, onlyWrong, scraper) {
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
    await scraper.scrapeQuestions(onlyWrong); // 确保 scraper 被正确传递

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
    alert(scraper.isDebugMode ? "调试模式已关闭。" : "调试模式已关闭。");
  });

  return button;
}

// 创建悬浮面板
function createFloatingPanel(scraper) { // 确保传递 scraper
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


  const settingsIcon = createSettingsIcon();
  titleBar.appendChild(settingsIcon);
  titleBar.appendChild(title);
  const modal = createSettingsModal(scraper);
  
  document.body.appendChild(modal);




  const allButton = createButton('导出全部题目', false, scraper);
  const wrongButton = createButton('仅导出错题', true, scraper);
  const startExamButton = createStartExamButton(scraper); // 确保传递 scraper

  panel.appendChild(titleBar);
  panel.appendChild(allButton);
  panel.appendChild(wrongButton);
  panel.appendChild(startExamButton);


 

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
    background-image: url('https://resource.omniedu.com/userdata/avatar/sys/1.jpg'); 
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
  console.log('[ExamScraper] 等待 DOMContentLoaded 事件');
  initScraper();

  document.addEventListener('DOMContentLoaded', () => {
    const scraper = new ExamScraper(); // 确保在这里实例化 scraper
    createFloatingPanel(scraper); 
    createAIAnswerPanel(scraper); 
  });
} else {
  const scraper = new ExamScraper(); // 确保在这里实例化 scraper
  createFloatingPanel(scraper); 
  createAIAnswerPanel(scraper); 
}