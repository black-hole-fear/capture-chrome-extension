

function handleUnload() {
  // Your logic to be executed when the extension is about to be closed
  console.log('Extension is about to be closed');
}

// Use a connection to detect when the background script is disconnected
const port = chrome.runtime.connect({ name: 'background-script' });

// Listen for messages from the connected port
port.onDisconnect.addListener(function() {
  // The onDisconnect event is triggered when the extension is about to be closed
  handleUnload();
});
