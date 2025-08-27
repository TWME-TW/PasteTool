// popup.js - 控制彈出視窗的邏輯

document.addEventListener('DOMContentLoaded', async () => {
  const textInput = document.getElementById('textInput');
  const delayInput = document.getElementById('delayInput');
  const pasteBtn = document.getElementById('pasteBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusDiv = document.getElementById('status');
  const novncIndicator = document.getElementById('novncIndicator');
  const novncStatus = document.getElementById('novncStatus');

  // 載入儲存的設定
  chrome.storage.sync.get(['pasteText', 'inputDelay'], (result) => {
    if (result.pasteText) {
      textInput.value = result.pasteText;
    }
    if (result.inputDelay) {
      delayInput.value = result.inputDelay;
    }
  });

  // 檢查是否在 noVNC 環境
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'checkNoVNC' }, (response) => {
    if (chrome.runtime.lastError) {
      updateNoVNCStatus(false, '無法連接到頁面');
      return;
    }
    
    if (response && response.isNoVNC) {
      updateNoVNCStatus(true, '已檢測到 noVNC');
    } else {
      updateNoVNCStatus(false, '未檢測到 noVNC');
    }
  });

  // 開始貼上
  pasteBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    if (!text) {
      showStatus('請輸入要貼上的文字', 'error');
      return;
    }

    const delay = parseInt(delayInput.value) || 50;
    
    // 儲存設定
    chrome.storage.sync.set({
      pasteText: text,
      inputDelay: delay
    });

    // 發送貼上指令
    chrome.tabs.sendMessage(tab.id, {
      action: 'startPaste',
      text: text,
      delay: delay
    }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('發送指令失败', 'error');
        return;
      }
      
      if (response && response.success) {
        showStatus('開始貼上文字...', 'info');
        pasteBtn.disabled = true;
        stopBtn.disabled = false;
      } else {
        showStatus(response ? response.error : '未知錯誤', 'error');
      }
    });
  });

  // 停止貼上
  stopBtn.addEventListener('click', () => {
    chrome.tabs.sendMessage(tab.id, { action: 'stopPaste' }, (response) => {
      if (response && response.success) {
        showStatus('已停止貼上', 'success');
        pasteBtn.disabled = false;
        stopBtn.disabled = true;
      }
    });
  });

  // 監聽來自 content script 的訊息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'pasteComplete') {
      showStatus('貼上完成！', 'success');
      pasteBtn.disabled = false;
      stopBtn.disabled = true;
    } else if (message.action === 'pasteError') {
      showStatus('貼上時發生錯誤：' + message.error, 'error');
      pasteBtn.disabled = false;
      stopBtn.disabled = true;
    } else if (message.action === 'pasteProgress') {
      showStatus(`貼上進度：${message.current}/${message.total}`, 'info');
    }
  });

  function updateNoVNCStatus(detected, message) {
    if (detected) {
      novncIndicator.className = 'indicator-dot detected';
      novncStatus.textContent = message;
      pasteBtn.disabled = false;
    } else {
      novncIndicator.className = 'indicator-dot not-detected';
      novncStatus.textContent = message;
      // 即使沒檢測到 noVNC 也允許使用，因為可能誤判
      pasteBtn.disabled = false;
    }
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    }
  }

  // 初始狀態
  stopBtn.disabled = true;
});
