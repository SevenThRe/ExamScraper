chrome.runtime.onInstalled.addListener(() => {
    console.log('考试题库整理助手已安装');
  });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadCSV') {
    chrome.downloads.download({
      url: request.data.url,
      filename: request.data.filename,
      saveAs: false
    });
  }
});