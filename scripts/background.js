chrome.runtime.onInstalled.addListener(() => {
  // 设置页面匹配规则
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { hostEquals: 'omniedu.com' }
        })
      ],
      actions: [new chrome.declarativeContent.ShowAction()]
    }]);
  });
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
