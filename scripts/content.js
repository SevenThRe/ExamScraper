// ExamScraper 类定义
class ExamScraper {
  constructor() {
    this.questions = [];
    console.log('[ExamScraper] 初始化完成');
  }

  async scrapeQuestions(onlyWrong = false) {
    try {
      console.log('[ExamScraper] 开始抓取题目...');
      console.log('[ExamScraper] 仅抓取错题:', onlyWrong);
      
      // 首先获取错题题号
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
      
      for(let group of groups) {
        const groupTitle = group.querySelector('.title')?.textContent;
        console.log('[ExamScraper] 处理题目组:', groupTitle);
        
        const questions = group.querySelectorAll('.question-review');
        console.log(`[ExamScraper] 该组题目数量: ${questions.length}`);
        
        for(let question of questions) {
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
          console.log(`[ExamScraper] 已抓取题目 #${currentQuestionNumber}`);
          currentQuestionNumber++;
        }
      }
      
      console.log(`[ExamScraper] 抓取完成，总共 ${this.questions.length} 道题目`);
      return this.questions;
      
    } catch(error) {
      console.error('[ExamScraper] 抓取过程出错:', error);
      throw error;
    }
  }
  
  getQuestionTitle(question) {
    try {
      const titleElement = question.querySelector('.ck-content.title');
      const title = titleElement ? titleElement.textContent.trim() : '';
      console.log('[ExamScraper] 获取题目标题:', title.substring(0, 30) + '...');
      return title;
    } catch(error) {
      console.error('[ExamScraper] 获取题目标题失败:', error);
      return '';
    }
  }

  getQuestionOptions(question) {
    try {
      const options = [];
      const optionElements = question.querySelectorAll('.option');
      
      optionElements.forEach((option, index) => {
        const label = option.querySelector('.item')?.textContent || '';
        const content = option.querySelector('.opt-content')?.textContent || '';
        options.push({ label, content });
      });
      
      return options;
    } catch(error) {
      console.error('[ExamScraper] 获取选项失败:', error);
      return [];
    }
  }

  getCorrectAnswer(question) {
    try {
      // 检查是否为填空题
      const hasOptions = question.querySelector('.option-list');
      
      if (!hasOptions) {
        // 填空题答案获取逻辑
        const correctAnswerBox = Array.from(question.querySelectorAll('.item-box'))
          .find(box => box.querySelector('.label')?.textContent.includes('正确答案'));
        
        if (correctAnswerBox) {
          const answerText = correctAnswerBox.querySelector('.text-answer')?.textContent.trim();
          console.log('[ExamScraper] 填空题答案:', answerText);
          return answerText;
        }
      } else {
        // 选择题答案获取逻辑
        const correctOption = question.querySelector('.option .item.correct');
        if (correctOption) {
          const answer = correctOption.textContent.trim();
          console.log('[ExamScraper] 选择题答案:', answer);
          return answer;
        }
      }

      console.log('[ExamScraper] 未找到正确答案');
      return '';
    } catch(error) {
      console.error('[ExamScraper] 获取正确答案失败:', error);
      return '';
    }
  }

  getQuestionScore(question) {
    try {
      const scoreElement = question.querySelector('.score-detail .text-color-danger');
      const score = scoreElement ? parseInt(scoreElement.textContent) : 0;
      console.log('[ExamScraper] 题目分值:', score);
      return score;
    } catch(error) {
      console.error('[ExamScraper] 获取分值失败:', error);
      return 0;
    }
  }

  exportToCSV() {
    try {
      console.log('[ExamScraper] 开始导出CSV...');
      let csv = '题号,题目类型,题目内容,选项,正确答案,分值\n';
      
      this.questions.forEach((q, index) => {
        const options = q.options.map(o => 
          `${o.label}.${o.content}`).join('|');
        
        csv += `${index + 1},${q.type},${q.title},${options},${q.answer},${q.score}\n`;
      });
      
      console.log('[ExamScraper] CSV导出完成，数据长度:', csv.length);
      return csv;
    } catch(error) {
      console.error('[ExamScraper] 导出CSV失败:', error);
      throw error;
    }
  }
}

console.log('[ExamScraper] 脚本开始加载...');

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

  button.addEventListener('mouseover', () => {
    button.style.background = '#3367d6';
  });

  button.addEventListener('mouseout', () => {
    button.style.background = '#4285f4';
  });

  button.addEventListener('click', async () => {
    try {
      const scraper = new ExamScraper();
      const questions = await scraper.scrapeQuestions(onlyWrong);
      
      if (!questions || questions.length === 0) {
        throw new Error('未能获取题目数据');
      }

      const csv = scraper.exportToCSV();
      await downloadCSV(csv, onlyWrong ? '错题导出.csv' : '全部题目.csv');
      
    } catch (error) {
      console.error('[ExamScraper] 导出失败:', error);
      alert('导出失败: ' + error.message);
    }
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
    cursor: move;
  `;

  const title = document.createElement('div');
  title.textContent = '智云题库助手';
  title.style.cssText = `
    font-weight: bold;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
  `;

  const allButton = createButton('导出全部题目', false);
  const wrongButton = createButton('仅导出错题', true);

  panel.appendChild(title);
  panel.appendChild(allButton);
  panel.appendChild(wrongButton);

  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;

  panel.addEventListener('mousedown', e => {
    isDragging = true;
    initialX = e.clientX - panel.offsetLeft;
    initialY = e.clientY - panel.offsetTop;
  });

  document.addEventListener('mousemove', e => {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      panel.style.left = `${currentX}px`;
      panel.style.top = `${currentY}px`;
      panel.style.right = 'auto';
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  document.body.appendChild(panel);
  console.log('[ExamScraper] 面板已创建');
}

async function downloadCSV(csv, filename) {
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // 发送消息给 background script 处理下载
    await chrome.runtime.sendMessage({
      action: 'downloadCSV',
      data: {
        url: url,
        filename: filename
      }
    });
    
    URL.revokeObjectURL(url);
    console.log('[ExamScraper] 下载请求已发送');
  } catch (error) {
    console.error('[ExamScraper] 下载失败:', error);
    throw error;
  }
}
// 确保 DOM 加载完成后执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePanel);
} else {
  initializePanel();
}

function initializePanel() {
  console.log('[ExamScraper] 开始初始化面板...');
  createFloatingPanel();
}