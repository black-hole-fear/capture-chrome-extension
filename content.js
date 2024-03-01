window.addEventListener('beforeunload', function(event) {
    // Inform the background script that the page is being closed
    console.log("hello")
    chrome.runtime.sendMessage({ type: 'pageClosing' });
  });
  