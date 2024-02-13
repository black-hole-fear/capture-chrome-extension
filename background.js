const startAudioCapture = function() {
  chrome.tabCapture.capture({ audio: true, video: false }, async (stream) => {
		try {
			context = new AudioContext();
			var newStream = context.createMediaStreamSource(stream);
			newStream.connect(context.destination);
			recorder = new MediaRecorder(stream);
		} catch (err) {
			// if(!newrecorderonexit) return

			if (newrecorderonexit) {
				durations.pop();
				await SessionData.set("durations", durations);
				// await SessionData.set("durations", durations);
				let comments = await SessionData?.get("comments") ? SessionData?.get("comments") : [];
				// if (comments.length > 0) comments.pop();
				await SessionData?.set("comments", comments);
			}

			$("#btnPause, #btnStop, #btnMark").addClass("disabled");
			$("#btnRecord").removeClass("disabled");
			if (newrecorderonexit) $("#lblRecordTime").text("00:00:00");
			$("#record-animation2").removeClass("play");

			alert("No tab is selected, Once select the tab.");
			return;
		}

		recorder.onpause = async (e) => {
			await recorder.requestData();
		}

		recorder.onstop = async (e) => {
			var base64 = await blobToBase64(new Blob(audioData, { type: 'audio/wav' }));

			if (stashrecordings?.length > 0) {
				let whole_recordings = stashrecordings[0];
				whole_recordings = whole_recordings.replace("data:application/octet-stream;", "data:audio/wav;");
				for (let i = 1; i < stashrecordings?.length; i++) {
					whole_recordings = await mergeBase64Audio(whole_recordings, stashrecordings[i]);
				}
				base64 = await mergeBase64Audio(whole_recordings, base64);
			}
			recordings.push(base64);
			durations[durations.length - 1] = duration;
			await SessionData?.set("recordings", recordings);
			await SessionData?.set("durations", durations);

			stashrecordings = [];
			await SessionData?.set("stashrecordings", stashrecordings);

			// Calculate minutes and seconds
			var minutes = Math.floor(durations[durations?.length - 1] / 60);
			var seconds = durations[durations?.length - 1] % 60;

			// console.log("this is minutes and secnod", minutes, seconds);

			// Format the output as mm:ss
			var formattedDuration = (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

			var comment = comments[comments.length - 1];

			function breakTextIntoLines(text, maxLength) {
				let lines = "";
				for (let i = 0; i < text.length; i += maxLength) {
					lines += text.substr(i, maxLength);
				}
				return lines;
			}

			// Maximum length for each line of the comment text
			const maxCommentLineLength = 40;

			// Break comment text into lines
			const formattedComment = breakTextIntoLines(comment, maxCommentLineLength);

			var audio = $(`
                <option style="text-wrap: wrap;">
                    ${$("#slcRecordings option")?.length + 1}&nbsp;&nbsp;(${formattedDuration})  
                    : ${formattedComment}
					<div class="comment-text" style="display: none;"></div>
                </option>`
			);

			$("#slcRecordings")?.append(audio);

			stream.getAudioTracks()[0].stop();
			$("#btnUploadAudio").removeClass("disabled");

			audioData = [];
			duration = 0;
		};

		if (recorder) {
			recorder?.start();
			recordTimer = setInterval(async function () {
				duration += 1;
				$("#lblRecordTime").text(Hhmmss(duration));
				await recorder.requestData();
			}, 1000);
		}
	});
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "start") {
    startAudioCapture();
  }
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.currentTab && sessionStorage.getItem(request.currentTab)) {
    sendResponse(sessionStorage.getItem(request.currentTab));
  } else if (request.currentTab){
    sendResponse(false);
  } else if (request === "startAudioCapture") {
    startAudioCapture();
  }
});
