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
      chrome.tabs.get(e).catch(() => {
          // (await removeTabs(optionTabId), chrome.storage.session.remove('optionTabId'))
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