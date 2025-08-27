// background.js - 背景腳本

chrome.runtime.onInstalled.addListener(() => {
  console.log('noVNC 文字貼上工具已安裝');
});

// 處理來自內容腳本的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 轉發訊息到 popup（如果打開的話）
  try {
    chrome.runtime.sendMessage(message);
  } catch (error) {
    // 忽略錯誤，popup 可能沒有打開
    console.log('轉發訊息失敗，popup 可能沒有打開');
  }
});
