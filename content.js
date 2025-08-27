// content.js - 內容腳本，運行在網頁上

class NoVNCPasteTool {
  constructor() {
    this.isRunning = false;
    this.currentTimeout = null;
    this.canvas = null;
    this.rfb = null;
    this.floatingBall = null;
    this.pastePanel = null;
    this.init();
  }

  init() {
    // 創建懸浮小球
    this.createFloatingBall();
    
    // 監聽來自 popup 的訊息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'checkNoVNC':
          sendResponse({ isNoVNC: this.isNoVNCEnvironment() });
          break;
        case 'startPaste':
          this.startPaste(message.text, message.delay)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true; // 保持訊息通道開啟
        case 'stopPaste':
          this.stopPaste();
          sendResponse({ success: true });
          break;
      }
    });
  }

  isNoVNCEnvironment() {
    // 檢測多種 noVNC 的特徵
    const indicators = [
      // 檢查 noVNC canvas
      () => document.querySelector('canvas.noVNC_canvas'),
      () => document.querySelector('#noVNC_canvas'),
      () => document.querySelector('canvas[data-noVNC]'),
      
      // 檢查 noVNC 相關的 DOM 元素
      () => document.querySelector('.noVNC_container'),
      () => document.querySelector('#noVNC_container'),
      () => document.querySelector('.rfb-canvas'),
      
      // 檢查全域變數
      () => window.RFB || window.noVNC,
      
      // 檢查 URL 或標題
      () => location.href.includes('vnc') || 
            location.href.includes('novnc') ||
            document.title.toLowerCase().includes('vnc'),
      
      // 檢查任何可能是 VNC 的 canvas
      () => {
        const canvases = document.querySelectorAll('canvas');
        return Array.from(canvases).some(canvas => 
          canvas.width > 500 && canvas.height > 300 &&
          (canvas.style.cursor === 'none' || canvas.style.cursor === 'default')
        );
      }
    ];

    return indicators.some(check => {
      try {
        return check();
      } catch (e) {
        return false;
      }
    });
  }

  shouldShowFloatingBall() {
    // 額外的條件來決定是否顯示懸浮小球
    // 例如：URL 包含特定關鍵字、頁面包含特定元素等
    const urlKeywords = ['vnc', 'remote', 'desktop', 'kvm', 'console'];
    const currentUrl = location.href.toLowerCase();
    
    return urlKeywords.some(keyword => currentUrl.includes(keyword)) ||
           document.querySelector('canvas') !== null ||
           document.title.toLowerCase().includes('vnc') ||
           document.title.toLowerCase().includes('remote');
  }

  findVNCCanvas() {
    // 嘗試找到 VNC canvas 的多種方法
    const selectors = [
      'canvas.noVNC_canvas',
      '#noVNC_canvas',
      'canvas[data-noVNC]',
      '.rfb-canvas',
      'canvas'  // 最後嘗試所有 canvas
    ];

    for (const selector of selectors) {
      const canvas = document.querySelector(selector);
      if (canvas) {
        // 如果是通用的 canvas 選擇器，額外檢查
        if (selector === 'canvas') {
          if (canvas.width > 500 && canvas.height > 300) {
            return canvas;
          }
        } else {
          return canvas;
        }
      }
    }

    return null;
  }

  async startPaste(text, delay = 50) {
    if (this.isRunning) {
      throw new Error('貼上正在進行中');
    }

    this.canvas = this.findVNCCanvas();
    if (!this.canvas) {
      // 如果找不到 canvas，嘗試使用焦點元素
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return this.pasteToInput(activeElement, text, delay);
      }
      throw new Error('找不到 VNC canvas 或輸入欄位');
    }

    this.isRunning = true;
    
    try {
      await this.simulateTyping(text, delay);
      this.sendMessage({ action: 'pasteComplete' });
    } catch (error) {
      this.sendMessage({ action: 'pasteError', error: error.message });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async pasteToInput(element, text, delay) {
    this.isRunning = true;
    
    try {
      // 先清空並聚焦
      element.focus();
      element.select();
      
      for (let i = 0; i < text.length; i++) {
        if (!this.isRunning) break;
        
        const char = text[i];
        
        // 只在每 10 個字符或最後一個字符時發送進度
        if (i % 10 === 0 || i === text.length - 1) {
          this.sendMessage({
            action: 'pasteProgress',
            current: i + 1,
            total: text.length
          });
        }
        
        // 模擬輸入
        element.value += char;
        
        // 觸發 input 事件
        element.dispatchEvent(new Event('input', { bubbles: true }));
        
        if (i < text.length - 1) {
          await this.sleep(delay);
        }
      }
      
      // 觸發 change 事件
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
    } finally {
      this.isRunning = false;
    }
  }

  async simulateTyping(text, delay) {
    // 確保 canvas 有焦點
    this.canvas.focus();
    this.canvas.click();

    for (let i = 0; i < text.length; i++) {
      if (!this.isRunning) break;

      const char = text[i];
      
      // 只在每 10 個字符或最後一個字符時發送進度
      if (i % 10 === 0 || i === text.length - 1) {
        this.sendMessage({
          action: 'pasteProgress',
          current: i + 1,
          total: text.length
        });
      }

      // 處理特殊字符
      if (char === '\n') {
        await this.sendKey('Enter');
      } else if (char === '\t') {
        await this.sendKey('Tab');
      } else {
        await this.sendCharacter(char);
      }

      if (i < text.length - 1) {
        await this.sleep(delay);
      }
    }
  }

  async sendCharacter(char) {
    const keyCode = char.charCodeAt(0);
    
    // 模擬按鍵事件
    const events = ['keydown', 'keypress', 'input', 'keyup'];
    
    for (const eventType of events) {
      const event = new KeyboardEvent(eventType, {
        key: char,
        char: char,
        charCode: eventType === 'keypress' ? keyCode : 0,
        keyCode: keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true
      });
      
      this.canvas.dispatchEvent(event);
      
      // 也嘗試發送到 document
      document.dispatchEvent(event);
    }
  }

  async sendKey(key) {
    const events = ['keydown', 'keyup'];
    
    const keyMap = {
      'Enter': { keyCode: 13, key: 'Enter' },
      'Tab': { keyCode: 9, key: 'Tab' },
      'Escape': { keyCode: 27, key: 'Escape' },
      'Backspace': { keyCode: 8, key: 'Backspace' }
    };
    
    const keyInfo = keyMap[key] || { keyCode: 0, key: key };
    
    for (const eventType of events) {
      const event = new KeyboardEvent(eventType, {
        key: keyInfo.key,
        keyCode: keyInfo.keyCode,
        which: keyInfo.keyCode,
        bubbles: true,
        cancelable: true
      });
      
      this.canvas.dispatchEvent(event);
      document.dispatchEvent(event);
    }
  }

  stopPaste() {
    this.isRunning = false;
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
  }

  sleep(ms) {
    return new Promise(resolve => {
      this.currentTimeout = setTimeout(resolve, ms);
    });
  }

  sendMessage(message) {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        // 檢查是否有錯誤
        if (chrome.runtime.lastError) {
          // 這是正常情況，popup 可能沒有打開
          console.log('訊息發送失敗（正常）:', chrome.runtime.lastError.message);
          return;
        }
        // 如果有回應，處理回應
        if (response) {
          console.log('收到回應:', response);
        }
      });
    } catch (error) {
      console.log('發送訊息時發生錯誤:', error);
    }
  }

  createFloatingBall() {
    // 只在 noVNC 環境或者包含 VNC 相關內容時顯示
    if (!this.isNoVNCEnvironment() && !this.shouldShowFloatingBall()) {
      return;
    }

    // 如果已經存在，先移除
    if (this.floatingBall) {
      this.floatingBall.remove();
    }

    // 創建懸浮小球
    this.floatingBall = document.createElement('div');
    this.floatingBall.id = 'novnc-paste-floating-ball';
    this.floatingBall.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#4CAF50"/>
        <path d="M8 12h8M12 8v8" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    
    // 設置樣式
    Object.assign(this.floatingBall.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      width: '50px',
      height: '50px',
      backgroundColor: '#4CAF50',
      borderRadius: '50%',
      cursor: 'pointer',
      zIndex: '999999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      transition: 'all 0.3s ease',
      userSelect: 'none'
    });

    // 添加懸停效果
    this.floatingBall.addEventListener('mouseenter', () => {
      this.floatingBall.style.transform = 'scale(1.1)';
      this.floatingBall.style.backgroundColor = '#45a049';
    });

    this.floatingBall.addEventListener('mouseleave', () => {
      this.floatingBall.style.transform = 'scale(1)';
      this.floatingBall.style.backgroundColor = '#4CAF50';
    });

    // 點擊事件
    this.floatingBall.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.togglePastePanel();
    });

    // 添加到頁面
    document.body.appendChild(this.floatingBall);
  }

  createPastePanel() {
    if (this.pastePanel) {
      this.pastePanel.remove();
    }

    this.pastePanel = document.createElement('div');
    this.pastePanel.id = 'novnc-paste-panel';
    this.pastePanel.innerHTML = `
      <div class="panel-header">
        <h3>noVNC 文字貼上工具</h3>
        <button class="close-btn" id="novnc-close-panel">×</button>
      </div>
      <div class="panel-body">
        <div class="form-group">
          <label for="novnc-text-input">要貼上的文字：</label>
          <textarea id="novnc-text-input" placeholder="在此輸入要貼上的文字..." rows="4"></textarea>
        </div>
        <div class="form-group">
          <label for="novnc-delay-input">輸入延遲 (毫秒)：</label>
          <input type="number" id="novnc-delay-input" value="50" min="10" max="1000">
        </div>
        <div class="button-group">
          <button id="novnc-paste-btn" class="btn-primary">開始貼上</button>
          <button id="novnc-stop-btn" class="btn-secondary">停止</button>
        </div>
        <div id="novnc-status" class="status" style="display: none;"></div>
      </div>
    `;

    // 設置面板樣式
    Object.assign(this.pastePanel.style, {
      position: 'fixed',
      top: '80px',
      right: '20px',
      width: '300px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      zIndex: '999998',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      display: 'none'
    });

    document.body.appendChild(this.pastePanel);
    this.bindPanelEvents();
  }

  bindPanelEvents() {
    const closeBtn = this.pastePanel.querySelector('#novnc-close-panel');
    const pasteBtn = this.pastePanel.querySelector('#novnc-paste-btn');
    const stopBtn = this.pastePanel.querySelector('#novnc-stop-btn');
    const textInput = this.pastePanel.querySelector('#novnc-text-input');
    const delayInput = this.pastePanel.querySelector('#novnc-delay-input');
    const statusDiv = this.pastePanel.querySelector('#novnc-status');

    // 關閉按鈕
    closeBtn.addEventListener('click', () => {
      this.hidePastePanel();
    });

    // 開始貼上
    pasteBtn.addEventListener('click', async () => {
      const text = textInput.value.trim();
      if (!text) {
        this.showPanelStatus('請輸入要貼上的文字', 'error');
        return;
      }

      const delay = parseInt(delayInput.value) || 50;
      
      try {
        pasteBtn.disabled = true;
        stopBtn.disabled = false;
        this.showPanelStatus('開始貼上文字...', 'info');
        
        await this.startPaste(text, delay);
        this.showPanelStatus('貼上完成！', 'success');
      } catch (error) {
        this.showPanelStatus('貼上時發生錯誤：' + error.message, 'error');
      } finally {
        pasteBtn.disabled = false;
        stopBtn.disabled = true;
      }
    });

    // 停止貼上
    stopBtn.addEventListener('click', () => {
      this.stopPaste();
      this.showPanelStatus('已停止貼上', 'success');
      pasteBtn.disabled = false;
      stopBtn.disabled = true;
    });

    // 載入儲存的文字
    const savedText = localStorage.getItem('novnc-paste-text');
    const savedDelay = localStorage.getItem('novnc-paste-delay');
    if (savedText) textInput.value = savedText;
    if (savedDelay) delayInput.value = savedDelay;

    // 自動儲存
    textInput.addEventListener('input', () => {
      localStorage.setItem('novnc-paste-text', textInput.value);
    });
    delayInput.addEventListener('input', () => {
      localStorage.setItem('novnc-paste-delay', delayInput.value);
    });

    // 初始狀態
    stopBtn.disabled = true;
  }

  togglePastePanel() {
    if (!this.pastePanel) {
      this.createPastePanel();
    }

    if (this.pastePanel.style.display === 'none') {
      this.showPastePanel();
    } else {
      this.hidePastePanel();
    }
  }

  showPastePanel() {
    if (this.pastePanel) {
      this.pastePanel.style.display = 'block';
    }
  }

  hidePastePanel() {
    if (this.pastePanel) {
      this.pastePanel.style.display = 'none';
    }
  }

  showPanelStatus(message, type) {
    const statusDiv = this.pastePanel?.querySelector('#novnc-status');
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = `status ${type}`;
      statusDiv.style.display = 'block';
      
      if (type === 'success') {
        setTimeout(() => {
          statusDiv.style.display = 'none';
        }, 3000);
      }
    }
  }
}

// 初始化工具
const pasteTool = new NoVNCPasteTool();

// 避免重複初始化
if (!window.noVNCPasteToolLoaded) {
  window.noVNCPasteToolLoaded = true;
}
