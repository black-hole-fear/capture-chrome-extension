

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

// Other background script logic goes here
chrome.tabs.query({}, function(tabs){
  for(var i = 0; i < tabs.length; i++){
      chrome.tabs.executeScript( tabs[i].id, {code:"window.onclick = function(e) { chrome.runtime.sendMessage({msgID: \"click_event\"});};"},
              function(){} );
  }
});
chrome.tabs.onCreated.addListener(function(tab)  { 
 chrome.tabs.executeScript( tab.id, {code:"window.onclick = function(e) { chrome.runtime.sendMessage({msgID: \"click_event\"});};"},
 function(){} );
});
chrome.tabs.onUpdated.addListener(function(tab)  { 
 chrome.tabs.executeScript( tab.id, {code:"window.onclick = function(e) { chrome.runtime.sendMessage({msgID: \"click_event\"});};"},
 function(){} );
});

chrome.runtime.onMessage.addListener(function(req, sender, resp){

  if(req.msgID.indexOf("click_event") > -1)
  {   
    console.log("extension is reloaded!");
     chrome.runtime.reload();
  }
});