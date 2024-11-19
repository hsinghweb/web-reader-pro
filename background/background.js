let readingState = {
  isPlaying: false,
  currentPosition: 0,
  speed: 1.0,
  words: [],
  tabId: null
};

function startReading() {
  if (readingState.currentPosition >= readingState.words.length) {
    readingState.currentPosition = 0;
  }

  // Build a phrase of multiple words for smoother reading
  let phrase = '';
  let wordsToRead = 4; // Read more words at once for smoother flow
  
  for (let i = 0; i < wordsToRead; i++) {
    if (readingState.currentPosition + i < readingState.words.length) {
      const word = readingState.words[readingState.currentPosition + i];
      phrase += word + ' ';
      
      // Break if we hit end punctuation
      if (/[.!?]$/.test(word)) {
        break;
      }
    }
  }

  // Notify popup about word progress
  chrome.runtime.sendMessage({
    action: 'wordProgress',
    position: readingState.currentPosition
  });

  // Adjust speech rate for natural flow
  let speechRate = readingState.speed * 1.1; // Slightly increased base rate
  
  // Speak with natural flow
  chrome.tts.speak(phrase.trim(), {
    rate: speechRate,
    pitch: 1.0,
    volume: 1.0,
    enqueue: false,
    onEvent: (event) => {
      if (event.type === 'end' || event.type === 'error') {
        if (readingState.isPlaying) {
          // Move position by the number of words we just read
          const wordsRead = phrase.trim().split(/\s+/).length;
          readingState.currentPosition += wordsRead;
          
          if (readingState.currentPosition < readingState.words.length) {
            startReading();
          } else {
            resetState();
          }
        }
      }
    }
  });
}

function resetState() {
  readingState.isPlaying = false;
  readingState.currentPosition = 0;
  chrome.tts.stop();
  if (readingState.tabId) {
    chrome.tabs.sendMessage(readingState.tabId, {
      action: 'highlightWord',
      index: -1
    });
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateState') {
    readingState = { ...readingState, ...request.state };
    if (readingState.isPlaying) {
      chrome.tts.stop();
      startReading();
    } else {
      chrome.tts.stop();
    }
    sendResponse({ success: true });
  } else if (request.action === 'getState') {
    sendResponse({ state: readingState });
  } else if (request.action === 'setContent') {
    readingState.words = request.words;
    readingState.tabId = request.tabId;
    sendResponse({ success: true });
  }
  return true;
}); 