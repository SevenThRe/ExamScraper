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
  if (request.action === 'askOllama') {
    console.log('Sending request to Ollama:', request.data);
    // 这里可以使用类似的逻辑来处理 askCustomModel 请求
    // 鄙人能力有限 实在研究不懂OLLAMA的CORS 所以只能用OpenAI来代替
    // 所以这个功能暂时无法使用
    
    fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(request.data)
    })
    .then(async response => {
      console.log('Ollama response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ollama error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      return response.json();
    })
    .then(data => {
      console.log('Ollama success response:', data);
      sendResponse({ success: true, data });
    })
    .catch(error => {
      console.error('Ollama request failed:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true;
  }
  if (request.action === 'askOpenAI') {
    console.log('Sending request to OpenAI:', request.data);
    
    const myHeaders = new Headers();
    myHeaders.append("Authorization", `Bearer ${request.data.apiKey}`);
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
      messages: [
        { role: "system", content: "你是一个大语言模型机器人" },
        { role: "user", content: request.data.prompt }
      ],
      stream: false,
      model: "gpt-4o",
      temperature: 0.5,
      presence_penalty: 0,
      frequency_penalty: 0,
      top_p: 1
    });

    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow'
    };

    fetch("https://xiaoai.plus/v1/chat/completions", requestOptions)
      .then(async response => {
        console.log('OpenAI response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('OpenAI error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        return response.json();
      })
      .then(data => {
        console.log('OpenAI success response:', data);
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('OpenAI request failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
  if (request.action === 'askCustomModel') {
    console.log('Sending request to custom model:', request.data);
    
    
  }
});
