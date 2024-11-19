class WebReader {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.loadState();
    
    // Check for saved content instead of loading new content
    chrome.storage.local.get(['savedContent'], (result) => {
      if (result.savedContent) {
        // Use saved content
        this.words = result.savedContent.words;
        this.totalWords = this.words.length;
        this.displayContent(this.words);
        this.updateProgress();
        this.updateTimeEstimate();
      } else {
        // Only load new content if no saved content exists
        this.loadPageContent();
      }
    });
    
    // Add message listener for word progress updates
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'wordProgress') {
        this.currentPosition = request.position;
        this.highlightWord(this.currentPosition);
      }
    });
  }

  initializeElements() {
    this.playPauseButton = document.getElementById('playPauseButton');
    this.backwardButton = document.getElementById('backwardButton');
    this.forwardButton = document.getElementById('forwardButton');
    this.speedSlider = document.getElementById('speedSlider');
    this.speedValue = document.getElementById('speedValue');
    this.textContent = document.getElementById('textContent');
    this.status = document.getElementById('status');
    this.progressPercent = document.getElementById('progressPercent');
    this.progressFill = document.getElementById('progressFill');
    this.totalWords = 0;
    this.timeEstimate = document.getElementById('timeEstimate');
    this.wordsPerMinute = 150;
    
    // Make text content non-editable but selectable
    this.textContent.contentEditable = false;
    this.textContent.style.userSelect = 'text';
    this.textContent.style.cursor = 'pointer';
    
    // Add font size buttons
    this.smallFontBtn = document.getElementById('smallFont');
    this.mediumFontBtn = document.getElementById('mediumFont');
    this.largeFontBtn = document.getElementById('largeFont');
    
    // Set default font size
    this.currentFontSize = 'medium';
    this.loadFontSize();
    
    this.reloadButton = document.getElementById('reloadButton');
  }

  setupEventListeners() {
    this.playPauseButton.addEventListener('click', () => this.togglePlayPause());
    this.backwardButton.addEventListener('click', () => this.moveBackward());
    this.forwardButton.addEventListener('click', () => this.moveForward());
    this.speedSlider.addEventListener('input', (e) => this.updateSpeed(e.target.value));
    this.textContent.addEventListener('dblclick', (e) => this.handleWordClick(e));
    
    // Font size button listeners
    this.smallFontBtn.addEventListener('click', () => this.changeFontSize('small'));
    this.mediumFontBtn.addEventListener('click', () => this.changeFontSize('medium'));
    this.largeFontBtn.addEventListener('click', () => this.changeFontSize('large'));
    
    this.reloadButton.addEventListener('click', () => this.reloadContent());
  }

  handleWordClick(e) {
    const clickedElement = e.target;
    if (clickedElement.classList.contains('word')) {
      const newPosition = parseInt(clickedElement.dataset.index);
      if (!isNaN(newPosition)) {
        // Update position and restart reading if playing
        this.currentPosition = newPosition;
        if (this.isPlaying) {
          chrome.runtime.sendMessage({
            action: 'updateState',
            state: {
              isPlaying: true,
              currentPosition: this.currentPosition,
              speed: this.speed
            }
          });
        } else {
          // If not playing, just highlight the word
          this.highlightWord(this.currentPosition);
        }
        
        // Update progress after position change
        this.updateProgress();
        this.status.textContent = `Moved to word ${newPosition + 1} of ${this.totalWords}`;
      }
    }
  }

  async loadState() {
    const response = await chrome.runtime.sendMessage({ action: 'getState' });
    if (response && response.state) {
      this.isPlaying = response.state.isPlaying;
      this.currentPosition = response.state.currentPosition;
      this.speed = response.state.speed;
      this.updateUIState();
      if (this.currentPosition > 0) {
        this.highlightWord(this.currentPosition - 1);
      }
    }
  }

  async loadPageContent() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, (response) => {
      if (response && response.content) {
        this.words = response.content.split(/\s+/);
        this.totalWords = this.words.length;
        this.displayContent(this.words);
        this.status.textContent = 'Content loaded';
        this.updateProgress();
        this.updateTimeEstimate();
        
        // Save content to storage
        chrome.storage.local.set({
          savedContent: {
            words: this.words,
            timestamp: Date.now()
          }
        });
        
        chrome.runtime.sendMessage({
          action: 'setContent',
          words: this.words,
          tabId: tab.id
        });
      }
    });
  }

  displayContent(words) {
    // Join words with a single space and wrap each in a span
    const content = words.map((word, index) => 
      `<span class="word" data-index="${index}" title="Double-click to start reading from here">${word}</span>`
    ).join('&nbsp;'); // Use a single non-breaking space between words
    
    this.textContent.innerHTML = content;
    
    // Highlight current word if exists
    if (this.currentPosition > 0) {
      this.highlightWord(this.currentPosition - 1);
    }
  }

  highlightWord(index) {
    // Remove all previous highlights
    const words = this.textContent.querySelectorAll('.word');
    words.forEach(word => {
      word.classList.remove('word-highlight');
    });

    // Highlight only the current word
    if (index >= 0 && index < this.words.length) {
      const wordElement = this.textContent.querySelector(`[data-index="${index}"]`);
      if (wordElement) {
        wordElement.classList.add('word-highlight');
        
        // Smooth scroll to the highlighted word
        const container = this.textContent;
        const elementRect = wordElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        if (elementRect.bottom > containerRect.bottom || elementRect.top < containerRect.top) {
          wordElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }
    }
    
    // Update progress after highlighting
    this.updateProgress();
  }

  updateUIState() {
    // Update play/pause button
    this.playPauseButton.textContent = this.isPlaying ? 'PAUSE' : 'PLAY';
    this.playPauseButton.classList.toggle('playing', this.isPlaying);
    
    // Update navigation buttons state and color
    this.backwardButton.disabled = !this.isPlaying;
    this.forwardButton.disabled = !this.isPlaying;
    
    // Toggle playing class for nav buttons color
    this.backwardButton.classList.toggle('playing', this.isPlaying);
    this.forwardButton.classList.toggle('playing', this.isPlaying);
    
    this.speedSlider.value = this.speed;
    this.speedValue.textContent = `${this.speed}x`;
    this.status.textContent = this.isPlaying ? 'Reading...' : 'Ready';
    
    if (this.isPlaying) {
      this.highlightWord(this.currentPosition);
    }
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      chrome.runtime.sendMessage({
        action: 'updateState',
        state: {
          isPlaying: true,
          currentPosition: this.currentPosition,
          speed: this.speed
        }
      });
      this.updateUIState();
    }
  }

  pause() {
    if (this.isPlaying) {
      this.isPlaying = false;
      chrome.runtime.sendMessage({
        action: 'updateState',
        state: {
          isPlaying: false,
          currentPosition: this.currentPosition
        }
      });
      // Keep highlight on the last read word
      this.highlightWord(this.currentPosition);
      this.updateUIState();
    }
  }

  updateSpeed(value) {
    this.speed = parseFloat(value);
    this.speedValue.textContent = `${this.speed}x`;
    chrome.runtime.sendMessage({
      action: 'updateState',
      state: {
        speed: this.speed
      }
    });
    // Update time estimate when speed changes
    this.updateTimeEstimate();
  }

  reset() {
    this.isPlaying = false;
    this.currentPosition = 0;
    this.highlightWord(-1);
    this.updateUIState();
    this.updateProgress(); // Reset progress
  }

  changeFontSize(size) {
    // Remove all font size classes
    this.textContent.classList.remove('font-small', 'font-medium', 'font-large');
    
    // Add new font size class
    this.textContent.classList.add(`font-${size}`);
    
    // Update active button state
    this.smallFontBtn.classList.remove('active');
    this.mediumFontBtn.classList.remove('active');
    this.largeFontBtn.classList.remove('active');
    
    // Set active button
    switch(size) {
      case 'small':
        this.smallFontBtn.classList.add('active');
        break;
      case 'medium':
        this.mediumFontBtn.classList.add('active');
        break;
      case 'large':
        this.largeFontBtn.classList.add('active');
        break;
    }
    
    // Save preference
    this.currentFontSize = size;
    chrome.storage.local.set({ fontSize: size });
  }

  loadFontSize() {
    chrome.storage.local.get(['fontSize'], (result) => {
      if (result.fontSize) {
        this.changeFontSize(result.fontSize);
      } else {
        this.changeFontSize('medium'); // Default size
      }
    });
  }

  updateTimeEstimate() {
    if (this.totalWords === 0) return;
    
    // Calculate remaining words
    const remainingWords = this.totalWords - this.currentPosition;
    
    // Calculate reading speed based on base speed and current speed multiplier
    const adjustedWPM = this.wordsPerMinute * this.speed;
    
    // Calculate minutes and seconds
    const totalMinutes = remainingWords / adjustedWPM;
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.round((totalMinutes - minutes) * 60);
    
    // Format time string
    let timeString = '';
    if (minutes > 0) {
      timeString += `${minutes}m `;
    }
    timeString += `${seconds}s`;
    
    this.timeEstimate.textContent = timeString;
  }

  updateProgress() {
    if (this.totalWords === 0) return;
    
    const progress = Math.min(100, Math.round((this.currentPosition / this.totalWords) * 100));
    this.progressPercent.textContent = `${progress}%`;
    this.progressFill.style.width = `${progress}%`;
    
    // Update time estimate whenever progress updates
    this.updateTimeEstimate();
  }

  moveBackward() {
    if (!this.isPlaying) return;
    
    const newPosition = Math.max(0, this.currentPosition - 10);
    if (newPosition !== this.currentPosition) {
      this.currentPosition = newPosition;
      this.highlightWord(this.currentPosition);
      
      chrome.runtime.sendMessage({
        action: 'updateState',
        state: {
          isPlaying: true,
          currentPosition: this.currentPosition,
          speed: this.speed
        }
      });
      
      this.status.textContent = `Moved back to word ${this.currentPosition + 1}`;
    }
  }

  moveForward() {
    if (!this.isPlaying) return;
    
    const newPosition = Math.min(this.totalWords - 1, this.currentPosition + 10);
    if (newPosition !== this.currentPosition) {
      this.currentPosition = newPosition;
      this.highlightWord(this.currentPosition);
      
      chrome.runtime.sendMessage({
        action: 'updateState',
        state: {
          isPlaying: true,
          currentPosition: this.currentPosition,
          speed: this.speed
        }
      });
      
      this.status.textContent = `Moved forward to word ${this.currentPosition + 1}`;
    }
  }

  async reloadContent() {
    // Disable all buttons during reload
    this.reloadButton.disabled = true;
    this.playPauseButton.disabled = true;
    this.backwardButton.disabled = true;
    this.forwardButton.disabled = true;
    this.speedSlider.disabled = true;
    
    // Update status
    this.status.textContent = 'Reloading content...';
    
    // Stop reading if playing
    if (this.isPlaying) {
      this.isPlaying = false;
      chrome.runtime.sendMessage({
        action: 'updateState',
        state: {
          isPlaying: false
        }
      });
    }
    
    // Reset position and progress
    this.currentPosition = 0;
    this.updateProgress();
    
    try {
      // Clear saved content
      await chrome.storage.local.remove(['savedContent']);
      
      // Get current tab content
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, (response) => {
        if (response && response.content) {
          this.words = response.content.split(/\s+/);
          this.totalWords = this.words.length;
          this.displayContent(this.words);
          this.status.textContent = 'Content reloaded';
          this.updateProgress();
          this.updateTimeEstimate();
          
          // Save new content
          chrome.storage.local.set({
            savedContent: {
              words: this.words,
              timestamp: Date.now()
            }
          });
          
          chrome.runtime.sendMessage({
            action: 'setContent',
            words: this.words,
            tabId: tab.id
          });
        }
      });
    } catch (error) {
      this.status.textContent = 'Failed to reload content';
    } finally {
      // Re-enable buttons
      this.reloadButton.disabled = false;
      this.playPauseButton.disabled = false;
      this.speedSlider.disabled = false;
      this.updateUIState(); // This will handle nav buttons state
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new WebReader();
}); 