let getTimerTab = null;
let recordStatus = 'INIT';  // 'RECORDING', 'PAUSED'

chrome.runtime.onStartup.addListener(async () => {
  await chrome.storage.session.remove("optionTabId");
});

chrome.runtime.onMessage.addListener(async (e) => {

  const optionTabId = await getStorage("optionTabId");

  if (recordStatus === 'INIT' && e.type === "AUDIO_RECORD") {
      recordStatus = 'RECORDING';
      const s = await E();
      if (!s.id) return console.log("Error opening new tab"), !1;
      await setStorage("optionTabId", s.id);
  } else if (recordStatus === 'PAUSED' && e.type === 'AUDIO_RECORD') {
    recordStatus = 'RECORDING';
  } else if (recordStatus === 'RECORDING' && e.type === 'AUDIO_PAUSE') {
    recordStatus = 'PAUSED';
  } else if (e.type === 'AUDIO_STOP') {
    recordStatus = 'PAUSED';
    chrome.runtime.sendMessage({ type: 'STOP_RECORD' });
  }
  
  return (e.type === "OPTIONS_OPENED" && chrome.runtime.sendMessage({ type: "START_RECORD" }),
      e.type === "RECORD_STARTED" &&
          (getTimerTab = setInterval(I, 1e3), d()),
      (e.type === "RECORD_STOPPED" || e.type === "DELETE_RECORD") &&
      (await removeOptionTab(optionTabId)),
      !0
  );
});

function E() {
  return chrome.tabs.create({
      pinned: true,
      active: false,
      url: `chrome-extension://${chrome.runtime.id}/content.html`
  });
}

async function removeOptionTab(e) {
  recordStatus = 'INIT'; 
  clearInterval(getTimerTab);
  chrome.action.setBadgeText({
      text: ""
  }),
  typeof e ==  "number" && 
  (await removeTabs(e), chrome.storage.session.remove("optionTabId")),
  !0
}

function setStorage(key, value) {
  return new Promise((resolve) => {
      chrome.storage.session.set({ [key]: value }, () => {
          resolve(value);
      });
  });
}

function getStorage(key) {
  return new Promise((resolve) => {
      chrome.storage.session.get([key], (result) => {
          resolve(result[key]);
      });
  });
}

function removeTabs(e) {
  return new Promise((resolve, reject) => {
      chrome.tabs.remove(e).then(resolve).catch(reject);
  });
};

async function I() {
  const e = await getStorage("optionTabId");

  chrome.runtime.sendMessage({ type: 'record_status', payload: recordStatus });
  typeof e == "number" &&
      chrome.tabs.get(e).catch(async () => {
          (await removeTabs(e), chrome.storage.session.remove('optionTabId'))
      });
}

const d = () => {
  chrome.action.setBadgeText({
          text: "REC"
      }),
      chrome.action.setBadgeBackgroundColor({
          color: "#DD0000"
      });
}

const startVideoRecording = async () => {
  await chrome.tabs.query({'active': true, 'lastFocusedWindow': true, 'currentWindow': true}, async function (tabs) {
    // Get current tab to focus on it after start recording on recording screen tab
    const currentTab = tabs[0];

    // Create recording screen tab
    const tab = await chrome.tabs.create({
      url: chrome.runtime.getURL('recording_screen.html'),
      pinned: true,
      active: true,
    });

    // Wait for recording screen tab to be loaded and send message to it with the currentTab
    chrome.tabs.onUpdated.addListener(async function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);

        await chrome.tabs.sendMessage(tabId, {
          name: 'startRecordingOnBackground',
          body: {
            currentTab: currentTab,
          },
        });
      }
    });
  });
};

// Listen for startRecording message from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.name === 'startVideoRecording') {
    startVideoRecording();
  }
});