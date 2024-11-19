chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    const content = document.body.innerText
      .replace(/\s+/g, ' ')
      .trim();
    sendResponse({ content });
  } else if (request.action === 'highlightWord') {
    highlightWord(request.index);
    // Scroll highlighted word into view smoothly
    const highlight = document.querySelector('.tts-highlight');
    if (highlight) {
      highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  return true;
});

// Add styles for smooth highlighting
const style = document.createElement('style');
style.textContent = `
  .tts-highlight {
    background-color: yellow;
    padding: 2px 4px;
    border-radius: 3px;
    box-shadow: 0 0 3px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
    display: inline-block;
    position: relative;
  }
`;
document.head.appendChild(style);

function highlightWord(index) {
  // Remove existing highlights with a fade effect
  const existing = document.querySelectorAll('.tts-highlight');
  existing.forEach(el => {
    el.style.backgroundColor = 'transparent';
    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.replaceChild(document.createTextNode(el.textContent), el);
      }
    }, 300);
  });

  if (index === -1) return;

  // Find and highlight the word at the given index
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  let wordCount = 0;
  while (node = walker.nextNode()) {
    const words = node.textContent.trim().split(/\s+/);
    if (wordCount <= index && index < wordCount + words.length) {
      const wordIndex = index - wordCount;
      const span = document.createElement('span');
      span.className = 'tts-highlight';
      span.textContent = words[wordIndex];
      
      // Add fade-in effect
      span.style.backgroundColor = 'transparent';
      
      const before = document.createTextNode(words.slice(0, wordIndex).join(' ') + (wordIndex > 0 ? ' ' : ''));
      const after = document.createTextNode((wordIndex < words.length - 1 ? ' ' : '') + words.slice(wordIndex + 1).join(' '));
      
      const parent = node.parentNode;
      parent.insertBefore(before, node);
      parent.insertBefore(span, node);
      parent.insertBefore(after, node);
      parent.removeChild(node);
      
      // Trigger fade-in
      requestAnimationFrame(() => {
        span.style.backgroundColor = 'yellow';
      });
      break;
    }
    wordCount += words.length;
  }
} 