document.addEventListener('DOMContentLoaded', () => {
  const encodeProgress = document.getElementById('encodeProgress');
  const review = document.getElementById('review');
  const status = document.getElementById('status');
  let format;
  let audioURL;
  let encoding = false;
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "createTab") {
      format = request.format;

      if (request.audioURL) {
        encodeProgress.style.width = '100%';
        status.innerHTML = "File is ready!"
        generateSave(request.audioURL);
      } else {
        encoding = true;
      }
    }

    //when encoding completes
    if (request.type === "encodingComplete" && encoding) {
      encoding = false;
      status.innerHTML = "File is ready!";
      encodeProgress.style.width = '100%';
      generateSave(request.audioURL);
    }
    //updates encoding process bar upon messages
    if (request.type === "encodingProgress" && encoding) {
      encodeProgress.style.width = `${request.progress * 100}%`;
    }
    async function generateSave(url) { //creates the save button
      // const currentDate = new Date(Date.now()).toDateString();
      // await chrome.downloads.download({
      //   url: url,
      //   filename: `${currentDate}.${format}`,
      //   saveAs: true
      // });
      
      chrome.runtime.sendMessage({
        type: 'RECORD_STOPPED'
      });
      chrome.tabs.getCurrent((tab) => {
        chrome.tabs.remove(tab.id);
      });

      // saveButton.style.display = "inline-block";
    }
  });
})