var SessionData = (function () {
	async function get(key) {
		const [tab] = await chrome?.tabs?.query({ active: true, currentWindow: true });
		var p = new Promise(function (resolve, reject) {
			chrome.scripting.executeScript({
				target: { tabId: tab.id }, args: [key], function: function (key) {
					window.SessionData = window.SessionData || {};
					return window.SessionData[key];
				}
			}, function (response) { resolve(response[0]?.result); });
		});
		var data = await p;
		return data;
	}

	async function set(key, value) {
		const [tab] = await chrome?.tabs?.query({ active: true, currentWindow: true });
		var p = new Promise(function (resolve, reject) {
			chrome.scripting.executeScript({
				target: { tabId: tab.id }, args: [key, value], function: function (key, value) {
					window.SessionData = window.SessionData || {};
					window.SessionData[key] = value;
				}
			}, function (response) { resolve(response[0].result); });
		});
	}
	async function clear() {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		var p = new Promise(function (resolve, reject) {
			chrome.scripting.executeScript({
				target: { tabId: tab.id }, function: function () {
					window.SessionData = {};
				}
			}, function (response) { resolve(response[0].result); });
		});
	}

	async function removeData(key, index) {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		var p = new Promise(function (resolve, reject) {
			chrome.scripting.executeScript({
				target: { tabId: tab.id }, function: function () {
					window.SessionData = window.SessionData
					return window.SessionData.recordings.splice(index, 1);
				}
			}, function (response) { resolve(response[0]?.result); });
		});
		var data = await p;
		return data;
	}


	return { get, set, clear, removeData };
})();

