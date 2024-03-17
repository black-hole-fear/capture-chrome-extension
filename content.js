chrome.runtime.sendMessage({
	type: "OPTIONS_OPENED"
});

///////////////////////////

const extend = function () { //helper function to merge objects
	let target = arguments[0],
		sources = [].slice.call(arguments, 1);
	for (let i = 0; i < sources.length; ++i) {
		let src = sources[i];
		for (let key in src) {
			let val = src[key];
			target[key] = typeof val === "object" ?
				extend(typeof target[key] === "object" ? target[key] : {}, val) :
				val;
		}
	}
	return target;
};

const WORKER_FILE = {
	wav: "WavWorker.js",
	mp3: "Mp3Worker.js"
};

// default configs
const CONFIGS = {
	workerDir: "/workers/", // worker scripts dir (end with /)
	numChannels: 2, // number of channels
	encoding: "wav", // encoding (can be changed at runtime)

	// runtime options
	options: {
		timeLimit: 1200, // recording time limit (sec)
		encodeAfterRecord: true, // process encoding after recording
		progressInterval: 1000, // encoding progress report interval (millisec)
		bufferSize: undefined, // buffer size (use browser default)

		// encoding-specific options
		wav: {
			mimeType: "audio/wav"
		},
		mp3: {
			mimeType: "audio/mpeg",
			bitRate: 192 // (CBR only): bit rate = [64 .. 320]
		}
	}
};

class Recorder {

	constructor(source, configs) { //creates audio context from the source and connects it to the worker
		extend(this, CONFIGS, configs || {});
		this.context = source.context;
		console.log("audio context: ", this.context);
		if (this.context.createScriptProcessor == null)
			this.context.createScriptProcessor = this.context.createJavaScriptNode;
		this.input = this.context.createGain();
		source.connect(this.input);
		this.buffer = [];
		this.initWorker();
	}

	isRecording() {
		return this.processor != null;
	}

	setEncoding(encoding) {
		if (!this.isRecording() && this.encoding !== encoding) {
			this.encoding = encoding;
			this.initWorker();
		}
	}

	setOptions(options) {
		if (!this.isRecording()) {
			extend(this.options, options);
			this.worker.postMessage({
				command: "options",
				options: this.options
			});
		}
	}

	startRecording() {
		if (!this.isRecording()) {
			let numChannels = this.numChannels;
			let buffer = this.buffer;
			let worker = this.worker;
			this.processor = this.context.createScriptProcessor(
				this.options.bufferSize,
				this.numChannels, this.numChannels);
			this.input.connect(this.processor);
			this.processor.connect(this.context.destination);
			this.processor.onaudioprocess = function (event) {
				if (strRecordStatus === 'RECORDING') {
					for (var ch = 0; ch < numChannels; ++ch)
						buffer[ch] = event.inputBuffer.getChannelData(ch);
					worker.postMessage({
						command: "record",
						buffer: buffer
					});
				}
			};
			this.worker.postMessage({
				command: "start",
				bufferSize: this.processor.bufferSize
			});
			this.startTime = Date.now();
		}
	}

	cancelRecording() {
		if (this.isRecording()) {
			this.input.disconnect();
			this.processor.disconnect();
			delete this.processor;
			this.worker.postMessage({
				command: "cancel"
			});
		}
	}

	finishRecording() {
		if (this.isRecording()) {
			this.input.disconnect();
			this.processor.disconnect();
			delete this.processor;
			this.worker.postMessage({
				command: "finish"
			});
		}
	}

	cancelEncoding() {
		if (this.options.encodeAfterRecord)
			if (!this.isRecording()) {
				this.onEncodingCanceled(this);
				this.initWorker();
			}
	}

	initWorker() {
		if (this.worker != null)
			this.worker.terminate();
		this.onEncoderLoading(this, this.encoding);
		this.worker = new Worker(this.workerDir + WORKER_FILE[this.encoding]);
		let _this = this;
		this.worker.onmessage = function (event) {
			let data = event.data;
			switch (data.command) {
				case "loaded":
					_this.onEncoderLoaded(_this, _this.encoding);
					break;
				case "timeout":
					_this.onTimeout(_this);
					break;
				case "progress":
					_this.onEncodingProgress(_this, data.progress);
					break;
				case "complete":
					_this.onComplete(_this, data.blob);
			}
		}
		this.worker.postMessage({
			command: "init",
			config: {
				sampleRate: this.context.sampleRate,
				numChannels: this.numChannels
			},
			options: this.options
		});
	}

	onEncoderLoading(recorder, encoding) {}
	onEncoderLoaded(recorder, encoding) {}
	onTimeout(recorder) {}
	onEncodingProgress(recorder, progress) {}
	onEncodingCanceled(recorder) {}
	onComplete(recorder, blob) {}

}

let nRecordDuration = 0;
let isPauseTimer = false;
let encoding = false;

let strRecordStatus = null;
let timerRecording;

const audioCapture = (timeLimit, muteTab, format, quality, limitRemoved) => {
	chrome.tabCapture.capture({
		audio: true
	}, (stream) => { // sets up stream for capture
		let startTabId; //tab when the capture is started
		let timeout;
		let completeTabID; //tab when the capture is stopped
		let audioURL = null; //resulting object when encoding is completed

		chrome.tabs.query({
			active: true,
			currentWindow: true
		}, (tabs) => startTabId = tabs[0].id) //saves start tab

		const liveStream = stream;
		const audioCtx = new AudioContext();
		const source = audioCtx.createMediaStreamSource(stream);
		let mediaRecorder = new Recorder(source); //initiates the recorder based on the current stream
		mediaRecorder.setEncoding(format); //sets encoding based on options
		if (limitRemoved) { //removes time limit
			mediaRecorder.setOptions({
				timeLimit: 10800
			});
		} else {
			mediaRecorder.setOptions({
				timeLimit: timeLimit / 1000
			});
		}
		if (format === "mp3") {
			mediaRecorder.setOptions({
				mp3: {
					bitRate: quality
				}
			});
		}
		mediaRecorder.startRecording();



		function onStopCommand(command) { //keypress
			if (command === "stop") {
				stopCapture();
			}
		}

		function onStopClick(request) { //click on popup
			if (request.type === "STOP_RECORD") {
				stopCapture();
				clearInterval(timerRecording);
				nRecordDuration = 0;
			} else if (request === "cancelCapture") {
				cancelCapture();
			} else if (request.cancelEncodeID) {
				if (request.cancelEncodeID === startTabId && mediaRecorder) {
					mediaRecorder.cancelEncoding();
				}
			}
		}
		chrome.runtime.onMessage.addListener(onStopClick);
		mediaRecorder.onComplete = async (recorder, blob) => {
			let recordings = [];
			let chunk = await blobToBase64(blob);

			recordings = (await chrome.storage.session?.get()).recordings ?
				JSON.parse((await chrome.storage.session?.get()).recordings) : [];

			recordings.push(chunk);
			chrome.storage.session?.set({
				"recordings": JSON.stringify(recordings)
			});

			audioURL = window.URL.createObjectURL(blob);

			if (completeTabID) {
				chrome.tabs.sendMessage(completeTabID, {
					type: "encodingComplete",
					audioURL
				});
			}
			mediaRecorder = null;
		}
		mediaRecorder.onEncodingProgress = (recorder, progress) => {
			if (completeTabID) {
				chrome.tabs.sendMessage(completeTabID, {
					type: "encodingProgress",
					progress: progress
				});
			}
		}

		function blobToBase64(blob) {
			return new Promise((resolve, _) => {
				const reader = new FileReader();
				reader.onloadend = () => resolve(reader.result);
				reader.readAsDataURL(blob);
			});
		}

		const stopCapture = function () {
			let endTabId;
			//check to make sure the current tab is the tab being captured
			chrome.tabs.query({
				active: true,
				currentWindow: true
			}, async (tabs) => {
				endTabId = tabs[0].id;
				if (mediaRecorder && startTabId === endTabId) {
					mediaRecorder.finishRecording();
					chrome.tabs.create({
						pinned: true,
						active: false,
						url: "complete.html"
					}, (tab) => {
						completeTabID = tab.id;
						let completeCallback = () => {
							chrome.tabs.sendMessage(tab.id, {
								type: "createTab",
								format: format,
								audioURL,
								startID: startTabId
							});
						}
						setTimeout(completeCallback, 500);
					});
					closeStream(endTabId);
				}
			})
		}

		const cancelCapture = function () {
			let endTabId;
			chrome.tabs.query({
				active: true,
				currentWindow: true
			}, (tabs) => {
				endTabId = tabs[0].id;
				if (mediaRecorder && startTabId === endTabId) {
					mediaRecorder.cancelRecording();
					closeStream(endTabId);
				}
			})
		}

		//removes the audio context and closes recorder to save memory
		const closeStream = function (endTabId) {
			chrome.runtime.onMessage.removeListener(onStopClick);
			mediaRecorder.onTimeout = () => {};
			audioCtx.close();
			liveStream.getAudioTracks()[0].stop();
			sessionStorage.removeItem(endTabId);
			chrome.runtime.sendMessage({
				captureStopped: endTabId
			});
		}

		mediaRecorder.onTimeout = stopCapture;

		if (!muteTab) {
			let audio = new Audio();
			audio.srcObject = liveStream;
			audio.play();
		}
	});
}

chrome.runtime.onMessage.addListener(async (message) => {
	if (message.type === "START_RECORD" && !timerRecording) {
		timerRecording = setInterval(() => {
			if (strRecordStatus === 'RECORDING') {
				nRecordDuration += 1;
				chrome.runtime.sendMessage({
					type: 'display',
					status: 'recording',
					duration: nRecordDuration
				});
			} else if (strRecordStatus === 'PAUSED') {
				chrome.runtime.sendMessage({
					type: 'display',
					status: 'paused',
					duration: nRecordDuration
				});
			}
		}, 1000);

		chrome.storage.sync.get({
			maxTime: 1200000,
			muteTab: false,
			format: "mp3",
			quality: 64,
			limitRemoved: false
		}, (options) => {
			let time = options.maxTime;
			if (time > 1200000) {
				time = 1200000
			}
			audioCapture(time, options.muteTab, options.format, options.quality, options.limitRemoved);
		}),
		chrome.runtime.sendMessage({
			type: "RECORD_STARTED"
		});
	}

	if (message.type === 'record_status') {
		strRecordStatus = message.payload;
	}
});