document.addEventListener('DOMContentLoaded', () => {
    const exportAll = document.getElementById('exportAll');
    const exportWrong = document.getElementById('exportWrong');
    const status = document.getElementById('status');
    const examNameElement = document.getElementById('examName');
  
    // 禁用按钮直到检查完成
    exportAll.disabled = true;
    exportWrong.disabled = true;
  
    // 检查当前页面是否是考试结果页面
    const checkExamInfo = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url.includes('omniedu.com')) {
          examNameElement.textContent = '请在智云考试页面使用此插件';
          return;
        }

        // 无论是否找到考试名称，都启用导出按钮
        exportAll.disabled = false;
        exportWrong.disabled = false;
        examNameElement.textContent = '准备就绪，可以开始导出';
        status.textContent = '';

      } catch (error) {
        console.error('检查页面失败:', error);
        examNameElement.textContent = '页面检查失败';
      }
    };
  
    // 导出函数
    const exportData = async (onlyWrong) => {
      try {
        status.textContent = '正在导出题目...';
        status.className = 'status';
        
        const [tab] = await chrome.tabs.query({ 
          active: true, 
          currentWindow: true 
        });
        
        if (!tab || !tab.id) {
          throw new Error('无法获取当前标签页');
        }

        console.log('开始发送消息到content script');
        
        // 使用 Promise 包装消息发送
        const response = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'scrape',
            onlyWrong: onlyWrong
          }, response => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(response);
          });
        });

        if (!response || !response.csvContent) {
          throw new Error('未能获取题目数据');
        }

        const blob = new Blob(['\ufeff' + response.csvContent], { 
          type: 'text/csv;charset=utf-8' 
        });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().slice(0,10);
        const filename = `${response.examName}_${onlyWrong ? '错题' : '全部'}_${timestamp}.csv`;

        await chrome.downloads.download({
          url: url,
          filename: filename,
          saveAs: true
        });

        status.textContent = '导出成功！';
        status.className = 'status success';
      } catch (error) {
        status.textContent = '导出失败：' + error.message;
        status.className = 'status error';
        console.error('导出失败:', error);
      }
    };
  
    // 初始化
    const init = async () => {
      if (await checkExamInfo()) {
        exportAll.disabled = false;
        exportWrong.disabled = false;
        status.textContent = '准备就绪';
      }
    };
  
    exportAll.addEventListener('click', () => exportData(false));
    exportWrong.addEventListener('click', () => exportData(true));
  
    init();
  });

document.getElementById('startButton').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: 'startScraping'}, response => {
      if (response.success) {
        // 创建并下载CSV文件
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
          url: url,
          filename: '考试题目.csv'
        });
      } else {
        console.error('爬取失败:', response.error);
      }
    });
  });
});