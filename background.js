// background.js - 背景腳本

chrome.runtime.onInstalled.addListener(() => {
  console.log('noVNC 文字貼上工具已安裝');
});

// 處理來自內容腳本的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 不需要轉發訊息，popup 會直接監聽來自 content script 的訊息
  // 這裡只是記錄訊息，避免循環發送
  console.log('收到訊息:', message);
});
