function highlightWords() {
  const text = document.getElementById('text-content');
  const words = text.textContent.split(' ');
  
  // Clear existing content and create spans for each word
  text.innerHTML = words.map(word => 
    `<span class="word">${word}</span>`
  ).join(' ');

  const wordElements = text.getElementsByClassName('word');
  let currentIndex = 0;
  
  // Reading speed (adjust as needed) - currently set to 250 words per minute
  const readingSpeed = 60000 / 250; // milliseconds per word

  function highlightNextWord() {
    // Remove highlight from previous word
    if (currentIndex > 0) {
      wordElements[currentIndex - 1].classList.remove('highlight');
    }
    
    // Add highlight to current word
    if (currentIndex < wordElements.length) {
      wordElements[currentIndex].classList.add('highlight');
      currentIndex++;
      setTimeout(highlightNextWord, readingSpeed);
    }
  }

  // Start highlighting
  highlightNextWord();
}

// Start the highlighting when the page loads
document.addEventListener('DOMContentLoaded', highlightWords); 