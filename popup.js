var username = null;
var password = null;

var colorChosen = false;
var currentSelection = "";
const rgb2hex = (rgb) => `#${rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/).slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('')}`;
var quality = 90;
var selections;

const API_URL = "http://alpha.yourarchiv.com/api";
const WEBSITE_URL = "http://alpha.yourarchiv.com";

// const API_URL = "http://yourarchiv.com/api";
// const WEBSITE_URL = "http://yourarchiv.com";

// const API_URL = "http://localhost:5000/api";
// const WEBSITE_URL = "http://localhost:3000";

var finalScreenshot = null;
var finalScreenshot2 = null;

// record
var recorder;
var saveRecording = false;
var audioData = [];
var duration = 0;
var recordings = [];
var durations = [];

var comments = [];

var selectedAudoiIndex;
// https://www.ta3.com/clanok/241096/potrebujeme-posilnit-timy-na-chirurgii-a-traumatologii-hovori-sefka-spisskonovoveskej-nemocnice
// document.getElementById("changeColor").onclick = Foo;
document.getElementById("btnAdd").addEventListener("click", () => AddSelection(null, null, null, null));
document.getElementById("btnCapture").addEventListener("click", Capture);
// document.getElementById("btnConnect").addEventListener("click", Connect);
document.getElementById("btnLogin").addEventListener("click", Login);
document.getElementById("btnLogout").addEventListener("click", Logout);
// document.getElementById("btnConnections").addEventListener("click", SeeSelections);
document.getElementById("btnBack").addEventListener("click", Back);
document.getElementById("btnHomepage").addEventListener("click", () => Website());
document.getElementById("btnSaveArticle").addEventListener("click", SaveArticle);
document.getElementById("btnCancel").addEventListener("click", Cancel);
document.getElementById("title").addEventListener("input", UpdateTitle);
// document.getElementById("description").addEventListener("input", UpdateDescription);
document.getElementById("description").addEventListener("input", UpdateDescription);

document.getElementById("date").addEventListener("change", UpdateDate);
document.getElementById("color").addEventListener("change", SaveColor);
document.getElementById("btnRecord").addEventListener("click", Record);
document.getElementById("btnPause").addEventListener("click", Pause);
document.getElementById("btnStop").addEventListener("click", Stop);
document.getElementById("slcRecordings").addEventListener("change", SelectAudio);
// document.getElementById("txtAudioDescription").addEventListener("input", AudioDescription);
document.getElementById("txtAudioDescription").addEventListener("input", TextAudioDescription);

// document.getElementById("btnMark").addEventListener("click", Mark);
document.getElementById("btnUploadAudio").addEventListener("click", UploadAudio);
document.addEventListener('DOMContentLoaded', function () {
	setTimeout(OnLoad, 0);
});

document.getElementById("tabAudio").addEventListener("click", () => SelectTab("audio"))
document.getElementById("tabText").addEventListener("click", () => SelectTab("text"))
document.getElementById("btnrecording").addEventListener("click", () => SelectTab("video"))

document.getElementById("options").addEventListener("click", () => { chrome.runtime.openOptionsPage() })

const progressBar = document.getElementById('progress-bar-inner');
const cancelButton = document.getElementById('cancel-button');

cancelButton.addEventListener('click', cancelUpload)

chrome.runtime.onMessage.addListener((request) => {
	if (request.type === 'display') {
		if (request.status === 'recording') {
			$("#btnRecordCancel").show();
			$("#btnRecord").addClass("disabled");
			$("#btnStop, #btnPause").removeClass("disabled");
			$("#record-animation2").addClass("play");
			$("#lblRecordTime").text(Hhmmss(request.duration));
			duration = request.duration;
			// $("#btnUploadAudio").removeClass("disabled");
		} else if (request.status === 'paused') {
			$("#btnPause").addClass("disabled");
			$("#btnRecord").removeClass("disabled");
			$("#btnStop").removeClass("disabled");
			duration = request.duration;
			$("#lblRecordTime").text(Hhmmss(request.duration));
		}
	}
});

async function OnLoad() {
	const selectedTab = localStorage.getItem('tab')
	if (selectedTab && selectedTab === "text") {
		SelectTab("text")
	} else if (selectedTab === "audio") {
		SelectTab("audio")
	} else if (selectedTab === "video") {
		SelectTab("video")
	} else {
		SelectTab("text")
	};


	comments = await SessionData?.get("comments") ?? [];
	durations = await SessionData?.get("durations") ?? [];
	savedRecordings = (await chrome.storage.session?.get()).recordings;

	console.log("savedRecordings: ", savedRecordings ? JSON.parse(savedRecordings) : null);

	if (savedRecordings?.length > 0) {
		var description = await SessionData?.get("recordingDescription");
		durations = await SessionData?.get("durations");

		if (description) 
			$("#txtAudioDescription").val(description);

		savedRecordings = JSON.parse(savedRecordings);

		savedRecordings.forEach(async (recording, index) => {

			recordings?.push(recording);

			comments = (await chrome.storage.session?.get()).comments ?? '[]';
			comments = JSON.parse(comments);
			durations = (await chrome.storage.session?.get()).durations ?? '[]';
			durations = JSON.parse(durations);

			const comment = index < comments.length ? (comments[index] ? comments[index] : " ") : " ";
			// Calculate minutes and seconds
			var minutes = Math.floor(durations[index] / 60);
			var seconds = durations[index] % 60;
			// Format the output as mm:ss
			var formattedDuration = (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

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
			var recordedAudio = $(`
				<option style="text-wrap: wrap;">
					${$("#slcRecordings option")?.length + 1}&nbsp;&nbsp;(${formattedDuration})  
					: ${formattedComment}
					<div class="comment-text" style="display: none;"></div>
				</option>`);
			$("#slcRecordings").append(recordedAudio);

			$("#btnUploadAudio").removeClass("disabled");
		});
	}
	
	var token = await GetStorage("token");
	$.ajax({
		type: "GET",
		url: `${API_URL + "/ext/val"}`,
		dataType: "json",
		async: false,
		contentType: 'application/json',
		beforeSend: function (xhr) {
			xhr.setRequestHeader("Authorization", "bearer " + token);
		},
		success: async function (x) {
			$("#login").hide();
			$("#popupShadow").hide();
			// SessionData.clear();
		},
		error: function (error) {
			$("#login").show();
			$("#popupShadow").hide();
		}
	});

	// check if article has already been saved
	var token = await GetStorage("token");
	var [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true
	});
	$.ajax({
		type: "POST",
		url: `${API_URL}/ext/article-exists`,
		dataType: "json",
		async: false,
		contentType: 'application/json',
		data: JSON.stringify({
			url: tab.url
		}),
		beforeSend: function (xhr) {
			xhr.setRequestHeader("Authorization", "bearer " + token);
		},
		success: async function (x) {

			if (x) {
				// $("#btnSaveArticle").addClass("disabled");
				$("#btnCapture").addClass("disabled");
				$("#btnSaveArticle").text("Url exists");
				$("#btnCapture").text("Url exists");
			}
		},
		error: function (error) {}
	});

	var meta = await GetMeta();

	$("#title").val(meta.title);

	var date = await SessionData.get("date");
	var title = await SessionData.get("title");
	var description = await SessionData.get("description");
	var color = await SessionData.get("color");
	var saved = await SessionData.get("saved");
	var dateTimeNow = (new Date().toISOString().slice(0, 16));

	if (date) $("#date").val(date);
	else $('#date').val(dateTimeNow);
	if (title) $("#title").val(title);

	$('#title').attr('title', `${title || meta.title}`);


	if (description) $("#description").val(description);
	if (color) $("#color").val(color);
	if (saved) {
		$("#btnSaveArticle").text("✔️ Saved");
		$("#btnSaveArticle").addClass('disabled');
	}

	$(".color").unbind().click(function () {
		SelectColor(this)
	});
	$('#percent').on('mousedown', function (e) {
		e = e || window.event;
		e.preventDefault();
		$("#percent").select()
	});
	$('#percent').on('input', CheckSelectionActive);

	if (await HasActiveSelection()) {
		$(".color").removeClass("disabled");
		$("#percent").prop("disabled", false);
	}

	let sd = localStorage.getItem('newSelections');

	if (sd && sd)
		sd = JSON.parse(sd);
	if (sd && Array.isArray(sd))
		for (var selection of sd)

			AddSelection(selection.text, selection.color, selection.percentage, selection.id);

	var id = await SessionData.get("id");
	if (!id) await SessionData.set("id", 0);

	var [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true
	});
	const {
		hostname
	} = new URL(tab.url);
	UrlSettings.initialize();
	if (UrlSettings.exists(hostname)) {
		$("#static-capture").prop('checked', true);
	}
}

let email = "";
async function Login() {
	if (!username || !password) {
		email = $("#txtUser").val();
		password = $("#txtPassword").val();
	}
	$.ajax({
		url: `${API_URL}/ext/login`,
		type: "POST",
		dataType: 'json',
		data: {
			email,
			password
		},
		success: async function (data) {
			console.log('datadatadatadata>>>>>>', data);
			localStorage.setItem('loggedUsername', email);
			if (!data.error) {
				await SetStorage("token", data.token);
				$("#lbl-username").text(`👤 ${localStorage.getItem('loggedUsername')}`);
				localStorage.setItem('lbl-username', data.user_name)
				$("#login").hide();
				$("#popupShadow").hide();
			}
		},
		error: async function (data) {
			alert("Wrong user and/or password");
			window.location.reload();
		}
	});
}

$(document).ready(function () {
	$("#txtPassword").keypress(function (event) {
		if (event.which === 13) { // Check if Enter key is pressed
			event.preventDefault(); // Prevent default form submission
			Login(); // Call the Login function
		}
	});

	const slider = $('#toggleSlider');
	let isOn = false;

	slider.click(function () {
		isOn = !isOn; // Toggle the state

		if (isOn) {
			slider.addClass('active'); // Apply the "active" class
			$("#qualityVisible").text("Normal Quality")
			sessionStorage.setItem("qualityStatus", "normal")
		} else {
			slider.removeClass('active'); // Remove the "active" class
			$("#qualityVisible").text("High Quality")
			sessionStorage.setItem("qualityStatus", "high")
		}
	});

	$("#slcRecordings").on("change", function () {
		selectedAudoiIndex = $(this).prop("selectedIndex");
		$("#editButton").removeClass("disabled");
		$("#deleteButton").removeClass("disabled");
	});
});


async function Logout() {
	await ClearStorage("token");
	localStorage.clear();
	await SessionData.clear();
	$("#login").show();
	window.location.reload();

}

// main panels

function ArticlePanel() {
	$("#articlePanel").show();
	$("#home").hide();
}

function AudioPanel() {
	$("#audioPanel").show();
	$("#home").hide();
}

var btnrecording = document.getElementById('btnrecording')

btnrecording.addEventListener('click', async function () {
	const url = `/videorec.html?login=${btoa(username + ":" + password)}&user=${username}`;
	window.open(url, 'popup', 'width=800,height=600,scrollbars=yes,resizable=yes')
})


const addBgColor = (tab) => {
	if (tab === "audio") {
		$("#tabAudio").css("background", "#333")
		$("#tabText").css("background", "#FFC90E");
		$("#btnrecording").css("background", "#FFC90E");

	} else if (tab === "text") {
		$("#tabText").css("background", "#333");
		$("#tabAudio").css("background", "#FFC90E");
		$("#btnrecording").css("background", "#FFC90E");


	} else {
		$("#tabText").css("background", "#FFC90E");
		$("#tabAudio").css("background", "#FFC90E");
		$("#btnrecording").css("background", "#333");
	}
}



async function SelectTab(tab) {
	addBgColor(tab)

	$('ul#tabsPanel .tabText').removeClass('activetab');


	$("#lbl-username").text(`👤 ${localStorage.getItem('loggedUsername')}`)
	if (tab === "audio") {
		$("#tabAudio").addClass("active")
		$("#tabText").removeClass("active")

		// $("#tabsPanel").css("background-image", "linear-gradient(-135deg, #333 70%, #bbb 70%)");
		// $("#tabSelected").attr("style", "background-image: linear-gradient(-135deg, #FFC90E 70%, #333 70%) !important");


		$("#tabAudio").css("color", "#fff");
		$("#tabText").css("color", "black");
		$("#audioPanel").show();
		$("#articlePanel").hide();
		$("#description").hide();

	} else if (tab === "text") {
		// $("#tabsPanel").css("background-image", "linear-gradient(-135deg, #FFC90E 70%, #bbb 70%)");
		// $("#tabSelected").attr("style", "background-image: linear-gradient(-135deg, #333 70%, #FFC90E 70%) !important");

		$("#tabText").addClass("active")
		$("#tabAudio").removeClass("active")


		$("#tabText").css("color", "#fff");
		$("#btnrecording").css("color", "black");
		$("#tabAudio").css("color", "black");

		$("#articlePanel").show();
		$("#audioPanel").hide();
		$("#description").show();
	} else if (tab === "video") {
		// $("#tabsPanel").css("background-image", "linear-gradient(-135deg, #FFC90E 70%, #bbb 70%)");
		// $("#tabSelected").attr("style", "background-image: linear-gradient(-135deg, #333 70%, #FFC90E 70%) !important");

		$("#btnrecording").addClass("active")
		$("#tabAudio").removeClass("active")
		$("#tabText").removeClass("active")

		$("#tabText").css("color", "black");
		$("#tabAudio").css("color", "black");
		$("#btnrecording").css("color", "#fff");

		$("#articlePanel").hide();
		$("#audioPanel").hide();
		$("#description").hide();
	}

	// await SessionData.set("tab", tab) 
	localStorage.setItem('tab', tab)
	$("#bgPanel").hide();
}


let x
// var recordTimer;
// var recordTime = 0
const MIN_BLOB_SIZE = 5000000;
var partSize = 0;
var parts = [];
// var comments = [];
// var recordings = [];


async function Record() {
	chrome.runtime.sendMessage({
		type: 'AUDIO_RECORD'
	});

	$("#btnRecordCancel").show();
	$("#btnRecord").addClass("disabled");
	$("#btnStop, #btnPause, #btnMark").removeClass("disabled");
	$("#record-animation2").addClass("play");
}

$(document)?.on("click", "#editButton", editComment)
$(document)?.on("click", "#deleteButton", deleteAudio);

async function deleteAudio() {
	var audioIndex = selectedAudoiIndex;
	if (audioIndex == undefined) {
		alert("Select an Item!");
		return;
	}

	recordings = JSON.parse((await chrome.storage.session.get()).recordings);
	recordings.splice(audioIndex, 1);
	comments.splice(audioIndex, 1);
	durations.splice(audioIndex, 1);

	await chrome.storage.session.set({ "recordings": JSON.stringify(recordings) });
	await chrome.storage.session?.set({ "durations": JSON.stringify(durations) });
	await chrome.storage.session?.set({ "comments": JSON.stringify(comments) });

	$("#slcRecordings option").eq(audioIndex).remove();

	const selectedTab = localStorage.getItem("tab");
	if (selectedTab && selectedTab === "text")
		SelectTab("text");
	else
		SelectTab("audio");

	if (recordings.length === 0) {
		$("#btnUploadAudio").addClass("disabled");
	}

	// await SessionData?.removeData('recordings');
	const updateRecord = await SessionData?.get('recordings')
	// updateRecord.splice(audioIndex, 1);
	selectedAudoiIndex = undefined;
	$("#editButton").addClass("disabled");
	$("#deleteButton").addClass("disabled");

	await SessionData?.set('recordings', updateRecord)
}


async function editComment() {
	var commentContainer = $("#slcRecordings option:selected");
	var commentIndex = selectedAudoiIndex;
	if (commentIndex == undefined) {
		alert("Select an Item!");
		return;
	}

	comments = (await chrome.storage.session?.get()).comments;
	comments = JSON.parse(comments);

	durations = (await chrome.storage.session?.get()).durations;
	durations = JSON.parse(durations);

	var commentText = comments[commentIndex];
	var editedCommentText = prompt("Edit the comment:", commentText);
	// var editedCommentText = prompt("Edit the comment:", commentText);
	if (editedCommentText !== null) {

		commentContainer.find(".comment-text").text(editedCommentText);
		comments[commentIndex] = editedCommentText;

		await chrome.storage.session?.set({ "comments": JSON.stringify(comments) });

		const selectedTab = localStorage.getItem("tab");

		if (selectedTab && selectedTab === "text") {
			SelectTab("text");
		} else {
			SelectTab("audio");
		}

		// Calculate minutes and seconds
		var minutes = Math.floor(durations[commentIndex] / 60);
		var seconds = durations[commentIndex] % 60;

		// Format the output as mm:ss
		var formattedDuration = (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

		function breakTextIntoLines(text, maxLength) {
			let lines = ``;
			for (let i = 0; i < text.length; i += maxLength) {
				lines += text.substr(i, maxLength);
			}
			return lines;
		}

		// Maximum length for each line of the comment text
		const maxCommentLineLength = 40;

		// Break comment text into lines
		const formattedComment = breakTextIntoLines(editedCommentText, maxCommentLineLength);

		var audioOption = $("#slcRecordings option").eq(commentIndex);
		audioOption.html(
			`${commentIndex + 1}&nbsp;&nbsp;(${formattedDuration} ): 
			${formattedComment} <div class="comment-text" style="display: none;"></div>`
		);
	}
}

/************ */
async function Stop() {
	chrome.runtime.sendMessage({
		type: 'AUDIO_PAUSE'
	});
	var comment = prompt("Please enter a comment for the recording:");
	if (comment === null) {
		chrome.runtime.sendMessage({
			type: 'AUDIO_RECORD'
		});
		return;
	}

	chrome.runtime.sendMessage({
		type: 'AUDIO_STOP'
	});

	$("#btnPause, #btnStop, #btnMark").addClass("disabled");
	$("#btnRecord").removeClass("disabled");

	$("#lblRecordTime").text("00:00:00");
	$("#record-animation2").removeClass("play");

	comments[comments.length] = comment;
	durations?.push(duration);

	await chrome.storage.session?.set({ "comments": JSON.stringify(comments) });
	await chrome.storage.session?.set({ "durations": JSON.stringify(durations) });

	display();
}

function display() {
	var minutes = Math.floor(durations[durations?.length - 1] / 60);
	var seconds = durations[durations?.length - 1] % 60;

	var formattedDuration = (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

	var comment = comments[comments.length - 1];

	function breakTextIntoLines(text, maxLength) {
		let lines = "";
		for (let i = 0; i < text.length; i += maxLength) {
			lines += text.substr(i, maxLength);
		}
		return lines;
	}

	const maxCommentLineLength = 40;
	const formattedComment = breakTextIntoLines(comment, maxCommentLineLength);
	var audio = $(`
                <option style="text-wrap: wrap;">
                    ${$("#slcRecordings option")?.length + 1}&nbsp;&nbsp;(${formattedDuration})  
                    : ${formattedComment}
					<div class="comment-text" style="display: none;"></div>
                </option>`);

	$("#slcRecordings")?.append(audio);
	$("#btnUploadAudio").removeClass("disabled");
}

async function SelectAudio() {
	$("#btnUploadAudio").removeClass("disabled");
	var i = $("#slcRecordings")[0].selectedIndex;
	_recordings = JSON.parse((await chrome.storage.session?.get()).recordings);
	$("audio").attr("src", _recordings[i]);
}

/************************************************************************ */
async function Pause() {
	$("#btnPause").addClass("disabled");
	$("#btnRecord").removeClass("disabled");
	$("#record-animation2").removeClass("play");

	chrome.runtime.sendMessage({
		type: 'AUDIO_PAUSE'
	});
}

function blobToBase64(blob) {
	return new Promise((resolve, _) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result);
		reader.readAsDataURL(blob);
	});
}

async function saveToFile(blob, name) {
	const url = window.URL.createObjectURL(blob);
	audioData = [];
	await SessionData?.set("recording", audioData);
	duration = 0;
	const a = document.createElement("a");
	document.body.appendChild(a);
	a.style = "display: none";
	a.href = url;
	a.download = name;
	a.click();
	URL.revokeObjectURL(url);
	a.remove();
}

function Hhmmss(seconds) {
	return new Date(seconds * 1000).toISOString().substr(11, 8);
}


function TextAudioDescription() {
	localStorage.setItem('texAudio', $("#txtAudioDescription").val())
}

const texAudio = localStorage.getItem('texAudio')

document.getElementById("txtAudioDescription").value = texAudio


//********** Audio uploading  ********/
const progressBars = document.getElementById("progress-bar");

async function UploadAudio() {
	if (recorder && recorder.state === "recording") {
		alert("Audio Recording is in progress, Can not upload")
		return;
	}

	const successMessage = document.getElementById("success-message")
	const uploadingMessage = document.getElementById("uploading-message")

	progressBars.style.display = "block";

	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true
	});
	const url = new URL(tab.url).toString();
	const title = tab.title || "";

	const description = $("#txtAudioDescription").val();
	const date = new Date().toISOString().slice(0, 16);
	const meta = await GetMeta();

	const pageDate = meta.date || new Date().toISOString().slice(0, 16);
	const token = await GetStorage("token");
	const formData = new FormData();

	recordings = JSON.parse((await chrome.storage.session.get()).recordings) ?? [];

	const obj = recordings.reduce((acc, curr, index) => {
		acc[index] = curr;
		return acc;
	}, {});

	formData.append("comment", JSON.stringify(comments));
	formData.append("recording", JSON.stringify(obj));

	formData.append("title", title);
	formData.append("description", description);
	formData.append("pageDate", pageDate);
	formData.append("date", date);
	formData.append("url", url);

	// Create XMLHttpRequest object
	const xhr = new XMLHttpRequest();
	// Set progress event listener

	// Set load event listener
	xhr.addEventListener("load", async () => {
		if (xhr.status === 200) {
			$("#txtAudioDescription").val("");
			$("#btnUploadAudio").addClass("disabled");
			recordings = [];
			$("#btnUploadAudio").text("Audio saved");
			$("#slcRecordings").html("");
			await SessionData?.set("recordingDescription", "");
			await SessionData?.set("recordings", []);
			await chrome.storage.session?.set({ "durations": '[]' });
			setTimeout(() => $("#btnUploadAudio").text("Upload"), 2000);
			localStorage.removeItem("texAudio");

			// console.log(recorder);

			// resseting 
			comments = []
			durations = []
			recordings = []
			chrome.storage.session.remove("recordings");

			// localStorage.removeItem("comments");
			await chrome.storage.session?.set({ "comments": '[]' });
			localStorage.removeItem("recordings");
			await chrome.storage.session?.set({ "durations": '[]' });

			// Reset the audio element's "muted" attribute
			// const audioElement = document.getElementById("yourAudioElementId");
			// audioElement.muted = false;
		} else {
			console.log("Error uploading audio file: " + xhr.statusText);
			const x = JSON.parse(xhr.response)

			progressBar.style.display = "none";
			cancelButton.style.display = "none";
			successMessage.style.display = "block";
			uploadingMessage.style.display = "none";

			alert(x.error.message[0])

		}
	});


	xhr.upload.addEventListener("progress", (event) => {
		if (event.lengthComputable) {
			const progress = Math.round((event.loaded / event.total) * 100);
			progressBar.style.width = progress + "%";
			uploadingMessage.style.display = "block";

			if (progress === 100) {
				setTimeout(() => {
					cancelButton.style.display = "none";
					progressBars.style.display = "none";


					if (xhr.statusText == 200) {
						successMessage.style.display = "block";
						uploadingMessage.style.display = "none";
					} else {
						successMessage.style.display = "none";
						uploadingMessage.style.display = "none";
					}

				}, 1000)

			}
		}
	});

	// Send the request
	xhr.open("POST", `${API_URL}/ext/upload-audio`);
	xhr.setRequestHeader("Authorization", "bearer " + token);

	// Display the progress bar and cancel button
	progressBar.style.width = "0%";
	progressBar.style.display = "block";
	cancelButton.style.display = "block";

	xhr.send(formData);

	// Cancel button click event listener
	cancelButton.addEventListener("click", () => {
		xhr.abort();
		progressBar.style.width = "0%";
		progressBar.style.display = "none";
		cancelButton.style.display = "none";
	});
}

async function cancelUpload() {
	// recorder.stop();
	$("#btnPause, #btnStop, #btnMark").addClass("disabled");
	$("#btnRecord").removeClass("disabled");
	$("#lblRecordTime").text("00:00:00");
	$("#record-animation2").removeClass("play");
	// recording = false;
	// recordTime = 0;
	// clearInterval(recordTimer);
	audioData = [];
	duration = 0;
	progressBar.style.width = "0%";
	progressBar.style.display = "none";
	cancelButton.style.display = "none";
}



function b64toBlob(b64Data, contentType = '', sliceSize = 512) {
	const byteCharacters = atob(b64Data);
	const byteArrays = [];

	for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
		const slice = byteCharacters.slice(offset, offset + sliceSize);

		const byteNumbers = new Array(slice.length);
		for (let i = 0; i < slice.length; i++) {
			byteNumbers[i] = slice.charCodeAt(i);
		}

		const byteArray = new Uint8Array(byteNumbers);
		byteArrays.push(byteArray);
	}

	const blob = new Blob(byteArrays, {
		type: contentType
	});
	return blob;
}

const capturetextDescription = localStorage.getItem('description')

document.getElementById("description").value = capturetextDescription

async function SaveArticle() {
	if ($("#btnSaveArticle").text() === "Url exists") {
		var [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true
		});
		window.open(`${WEBSITE_URL}/user?open=${tab.url}`);
		return;
	}
	$("#btnSaveArticle").text("Saving...");
	$("#btnSaveArticle").addClass('disabled');
	$("#btnCapture").addClass("disabled");
	var username = await SessionData.get("username");
	var password = await SessionData.get("password");
	var title = $("#title").val();
	var description = $("#description").val();
	var date = new Date($("#date").val()).toISOString().slice(0, 19).replace('T', ' ');
	const check_later = true;

	var [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true
	});
	var url = (new URL(tab.url)).toString();
	// if (url.includes("?")) url = url.substring(0, url.indexOf('?'));
	// if (url.endsWith("/")) url = url.substring(0, url.length - 1);

	$("#lblCapturing").text("Uploading...");
	var token = await GetStorage("token");

	const selections = localStorage.getItem('newSelections')
	$.ajax({
		type: "POST",
		url: `${API_URL}/ext/save-article`,
		dataType: "json",
		async: false,
		contentType: 'application/json',

		data: JSON.stringify({
			user: username,
			title,
			description,
			url,
			date,
			selections,

		}),
		beforeSend: function (xhr) {
			xhr.setRequestHeader("Authorization", "bearer " + token);
		},
		success: async function (x) {
			await SessionData.set("saved", true);
			$("#btnSaveArticle").text("✔️ Saved");
			localStorage.removeItem("description")

			localStorage.removeItem("newSelections")
			localStorage.removeItem("id")
			window.close()
		},
		error: function (error) {
			$("#btnSaveArticle").text("Check Article Later");
			$("#btnSaveArticle").removeClass('disabled');
			alert("Could not save the article at this time, try again later.");
		}
	});
}

async function GetMeta() {
	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true
	});
	var p = new Promise(function (resolve, reject) {
		chrome.scripting.executeScript({
			target: {
				tabId: tab.id
			},
			function: function () {
				var metas = document.getElementsByTagName('meta');
				var title, date;
				for (var x of metas)
					if (x.getAttribute("property")) {
						if (x.getAttribute("property").includes("title"))
							title = x.getAttribute("content");
						else if (x.getAttribute("property").includes("date"))
							date = x.getAttribute("content");
					}

				return {
					title,
					date
				};
			}
		}, function (response) {
			resolve(response[0].result);
		});
	});
	var meta = await p;
	return meta;
}

async function GetStorage(key) {
	var p = new Promise(function (resolve, reject) {
		chrome.storage.local.get(key, function (x) {
			resolve(x[key]);
		})
	});
	return p;
}

async function SetStorage(key, value) {
	var data = {};
	data[key] = value;
	await chrome?.storage?.local?.set(data, function () {});
}

async function ClearStorage(key) {
	var data = {};
	data[key] = null;
	await chrome?.storage?.local?.set(data, function () {});
}

var SessionData = (function () {
	async function get(key) {
		const [tab] = await chrome?.tabs?.query({
			active: true,
			currentWindow: true
		});
		var p = new Promise(function (resolve, reject) {
			chrome.scripting.executeScript({
				target: {
					tabId: tab.id
				},
				args: [key],
				function: function (key) {
					window.SessionData = window.SessionData || {};
					return window.SessionData[key];
				}
			}, function (response) {
				resolve(response[0]?.result);
			});
		});
		var data = await p;
		return data;
	}

	async function set(key, value) {
		const [tab] = await chrome?.tabs?.query({
			active: true,
			currentWindow: true
		});
		var p = new Promise(function (resolve, reject) {
			chrome.scripting.executeScript({
				target: {
					tabId: tab.id
				},
				args: [key, value],
				function: function (key, value) {
					window.SessionData = window.SessionData || {};
					window.SessionData[key] = value;
				}
			}, function (response) {
				resolve(response[0].result);
			});
		});
	}
	async function clear() {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true
		});
		var p = new Promise(function (resolve, reject) {
			chrome.scripting.executeScript({
				target: {
					tabId: tab.id
				},
				function: function () {
					window.SessionData = {};
				}
			}, function (response) {
				resolve(response[0].result);
			});
		});
	}

	async function removeData(key, index) {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true
		});
		var p = new Promise(function (resolve, reject) {
			chrome.scripting.executeScript({
				target: {
					tabId: tab.id
				},
				function: function () {
					window.SessionData = window.SessionData
					return window.SessionData.recordings.splice(index, 1);
				}
			}, function (response) {
				resolve(response[0]?.result);
			});
		});
		var data = await p;
		return data;
	}


	return {
		get,
		set,
		clear,
		removeData
	};
})();


async function UpdateTitle() {
	await SessionData?.set("title", $("#title").val());
}


// async function UpdateDescription() {
// 	await SessionData.set("description", $("#description").val());
// }


async function UpdateDescription() {
	localStorage.setItem('description', $("#description").val())
}

async function UpdateDate() {
	await SessionData.set("date", $("#date").val());
}

async function CheckSelectionActive() {
	if (parseInt($("#percent").val()) > 0 && await HasActiveSelection()) {
		$("#btnAdd").removeClass("disabled");
	} else {
		$("#btnAdd").addClass("disabled");
	}

	if ($("#selections li.selected").length === 2 && parseInt($("#percent").val()) > 0)
		$("#btnConnect").removeClass("disabled")
	else $("#btnConnect").addClass("disabled")
}

async function SetStaticCapture() {
	var [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true
	});
	const {
		hostname
	} = new URL(tab.url);
	if ($("#static-capture").prop('checked'))
		UrlSettings.add(hostname);
	else
		UrlSettings.remove(hostname);
}

async function SaveColor() {
	await SessionData.set("color", $("#color").val());
}

var UrlSettings = (function () {
	var key = "urlSettings";
	var add = function (url) {
		var data = JSON.parse(localStorage.getItem(key));
		if (data.indexOf(url) === -1) data.push(url);

		localStorage.setItem(key, JSON.stringify(data));
	}

	var remove = function (url) {
		var data = JSON.parse(localStorage.getItem(key));
		const index = data.indexOf(url);
		if (index > -1) {
			data.splice(index, 1);
			localStorage.setItem(key, JSON.stringify(data));
		}
	}

	var exists = function (url) {
		if (localStorage.getItem(key) === null)
			return false;

		var data = JSON.parse(localStorage.getItem(key));
		if (data.indexOf(url) === -1) return false;
		else return true;
	}

	var initialize = function (url) {
		if (localStorage.getItem(key) === null)
			localStorage.setItem(key, JSON.stringify(["twitter.com"]));
	}

	return {
		add: add,
		exists: exists,
		remove: remove,
		initialize: initialize
	};
})();


function Back() {
	$("#connectionsPanel").hide();
}

async function SeeSelections() {
	var html = "";
	var connections = await SessionData?.get("connections");
	if (!connections) connections = [];
	var index = 1;
	for (var connection of connections) {
		html += `\n
			<li data-id="${connection.id}">
				<div class="connectionPanel">
					<span class="removeSelection">X</span>
					<p class="title">Connection ${index++}</p>
					<p>${connection.text1}</p>
					<p>${connection.text2}</p>
				</div>
			</li>
		`;
	}
	$("#connections").html(html);
	$(".removeSelection").unbind().click(async function () {
		var connections = await SessionData.get("connections");
		var id = $(this).closest("li").data("id");
		connections = connections.filter(function (obj) {
			return obj.id !== id;
		});
		SessionData.set("connections", connections);
		$(this).closest("li").remove();
	});
	$("#connectionsPanel").show();
}

async function Capture() {
	if ($("#btnSaveArticle").text() === "Url exists") {
		var [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true
		});
		window.open(`${WEBSITE_URL}/user?open=${tab.url}`);
		return;
	}
	try {
		// var q = $("#quality").val();
		var q;
		if (sessionStorage.getItem("qualityStatus") == "normal") {
			q = 15;
		} else {
			q = 95;
		}

		quality = parseInt(q);
		var [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true
		});
		currentTab = tab;
		var filename = getFilename(tab.url);

		console.log('"""""""""""""""""CaptureAPI""""""""""""""""""""""""""""""""""""""""');

		Capture.captureToFiles(tab, filename, displayCaptures, errorHandler, progress, splitnotifier);

		$("#capturing").show();
		$("#lblCapturing").text("Capturing...");
		$("#record-animation1").addClass("play");
		$("#btnCapture").addClass('disabled');


		await chrome.scripting.executeScript({
			target: {
				tabId: tab.id
			},
			function: function () {
				document.getSelection().removeAllRanges();
			}
		});
		await chrome.tabs.captureVisibleTab(tab.windowId, {
			"format": "png"
		}, function (img) {
			var a = document.createElement("a");
			a.href = img;
			// a.download = "Image.png";
			a.click();
		});
	} catch (e) {
		alert(e);
		return null;
	}
	return JSON.stringify(res);
}

async function Cancel() {
	window.close();
}

async function SelectColor(e) {
	colorChosen = true;
	CheckSelectionActive();
}

async function SetColor(color, id) {
	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true
	});
	var p = new Promise(function (resolve, reject) {
		chrome.scripting.executeScript({
			target: {
				tabId: tab.id
			},
			args: [color, id],
			function: function (color, id) {
				var text = window.getSelection().toString();
				const selectedRange = window.getSelection().getRangeAt(0);
				const span = document.createElement('span');
				span.style.backgroundColor = color;
				span.setAttribute("id", `selection-${id}`);
				selectedRange.surroundContents(span);
				document.getSelection().removeAllRanges();
			}
		}, function (response) {
			resolve(response[0].result);
		});
	});
	await p;
}

function Website() {
	var data = btoa(JSON.stringify({
		username,
		password
	}));
	// window.open(`http://beta.saveyournews.com?access=${data}`);
	window.open(`${WEBSITE_URL}`);

}

async function Connect() {
	var items = [];
	var id = Math.random().toString(36).substr(2, 5);
	var ids = [];
	var percent = $("#percent").val();
	$("li.selected").each(function () {
		items.push($(this).find(".selection-text").text().trim())
		ids.push($(this).data("id"));
	});
	$("li").removeClass("selected");
	$("#btnConnect").addClass("disabled");
	// for (var item of items) alert(item);
	var connections = await SessionData?.get("connections");
	if (!connections) connections = [];

	connections.push({
		id: id,
		text1: items[0],
		text2: items[1],
		ids: ids,
		percentage: percent
	});
	await SessionData?.set("connections", connections);
	$("#percent").val(0);
}

async function GetSelectedText() {
	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true
	});
	var p = new Promise(function (resolve, reject) {
		chrome.scripting.executeScript({
			target: {
				tabId: tab.id
			},
			function: function () {
				if (!window.selections) window.selections = [];
				var text = window.getSelection().toString();
				if (text) window.selections.push(text);
				return text;
			}
		}, function (response) {
			resolve(response[0].result);
		});
	});
	var text = await p;
	return text;
}
let cnt = 0;
const messageList = $('#selections');

function scrollToBottom() {
	messageList.scrollTop(messageList.prop('scrollHeight'));
}

async function AddSelection(text, color, percentage, id) {

	var newSelection = text ? false : true;
	if (!id) {
		id = localStorage.getItem("id");
		id++;
		localStorage.setItem("id", id);
	}

	text = text || await GetSelectedText();
	color = $("#color").val();
	percentage = percentage || parseInt($("#percent").val());
	if (text) {
		$("#lblSelections").remove();
		$("#lblSelectionsNone").remove();
		$("#selections").css("height", "225px");
		cnt = cnt + 1;
		var selection = $(`<li data-id="${id}" style = "height: fit-content; display: flex; justify-content: space-between;">
								<div style="display: inline-flex; height: fit-content;">
									<label class="color-icon" style="background-color: ${color};">&nbsp;&nbsp;</label>
									<span style="line-height: 1rem;">&nbsp;${cnt}.&nbsp; </span>
									<label class="selection-text" title="${id}. ${text}">${text}</label>
								</div>
							</li>
							`);
		var removeSelection = $(`<span style="line-height: 1rem;">❌</span>`);
		removeSelection.appendTo(selection).click(() => RemoveSelection(selection, id));
		selection.appendTo("#selections").click(() => Selection_OnClick(selection));
		if (newSelection) {
			$("#btnAdd").addClass("disabled");
			SetColor(color, id);
			var selections = await SessionData.get("selections")
			if (!selections) selections = [];
			selections.push({
				id: id,
				text: text,
				color: color,
				percentage: percentage
			})
			// await SessionData.set("selections", selections)
			const previousArray = JSON.parse(localStorage.getItem("newSelections"))
			if (!previousArray) {
				localStorage.setItem('newSelections', JSON.stringify(selections))
			} else {
				const concatenatedArray = previousArray.concat(selections);
				localStorage.setItem("newSelections", JSON.stringify(concatenatedArray));
			}
		}
	}
	scrollToBottom();
}

function Selection_OnClick(selection) {
	if ($(selection).hasClass("selected")) {
		$(selection).removeClass("selected")
	} else {
		if ($("#selections li.selected").length < 2)
			$(selection).addClass("selected")
	}

	if ($("#selections li.selected").length === 2 && parseInt($("#percent").val()) > 0) {
		$("#btnConnect").removeClass("disabled");
	} else $("#btnConnect").addClass("disabled");
}

async function RemoveSelection(selection, id) {

	var storedArray = JSON.parse(localStorage.getItem("newSelections"))

	var index = storedArray.findIndex(item => item.id === id);
	if (index !== -1) {
		storedArray.splice(index, 1);
	}
	localStorage.setItem("newSelections", JSON.stringify(storedArray));

	$(selection).remove();

	if (!$("#selections li").length) {
		$(`<lbl id="lblSelectionsNone">No selections added yet</lbl>`).insertAfter("#lblSelections");
		$("#btnConnect").addClass("disabled")
	}
	var selections = await SessionData.get("selections");
	if (!selections) selections = [];
	selections = selections.filter(function (selection) {
		return selection.id !== id;
	});

	await SessionData?.set("selections", selections);

	var connections = await SessionData?.get("connections");
	if (connections) {
		connections = connections.filter(function (connection) {
			return !connection.ids.includes(id);
		});
		await SessionData?.set("connections", connections);
	}

	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true
	});
	var p = new Promise(function (resolve, reject) {
		chrome.scripting.executeScript({
			target: {
				tabId: tab.id
			},
			args: [id],
			function: function (id) {
				var selection = document.querySelector(`#selection-${id}`);
				if (!selection) return;
				selection.outerHTML = selection.innerHTML;
			}
		}, function (response) {
			resolve(response[0].result);
		});
	});

	await p;
	refreshComments();
}

function refreshComments() {
	$("#selections").empty();
	const refreshedData = JSON.parse(localStorage.getItem("newSelections"));
	color = $("#color").val();
	let cnt = 0;
	while (cnt < refreshedData.length) {
		cnt++;
		var selection = $(`<li data-id="${refreshedData[cnt - 1].id}" style = "height: fit-content; display: flex; justify-content: space-between;">
								<div style="display: inline-flex; height: fit-content;">
									<label class="color-icon" style="background-color: ${color};">&nbsp;&nbsp;</label>
									<span style="line-height: 1rem;">&nbsp;${cnt}.&nbsp; </span>
									<label class="selection-text" title="${refreshedData[cnt - 1].id}. ${refreshedData[cnt - 1].text}">${refreshedData[cnt - 1].text}</label>
								</div>
							</li>
								`);
		var removeSelection = $(`<span style="line-height: 1rem;">❌</span>`);
		removeSelection.appendTo(selection).click(() => RemoveSelection(selection, refreshedData[cnt - 1].id));
		selection.appendTo("#selections").click(() => Selection_OnClick(selection));
		$('#selections').append(selection);
	};
}

async function HasActiveSelection() {
	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true
	});
	var p = new Promise(function (resolve, reject) {
		chrome.scripting.executeScript({
			target: {
				tabId: tab.id
			},
			function: function () {
				var hasSelection = false;
				var text = window.getSelection().toString();
				if (text) hasSelection = true;
				return hasSelection;
			}
		}, function (response) {
			resolve(response[0].result);
		});
	});
	var hasSelection = await p;
	return hasSelection;
}

function SelectItem(e) {
	$(e).toggleClass("selected");
	if ($(".selected").length > 1)
		$("#btnConnect").prop('disabled', false);
	else $("#btnConnect").prop('disabled', true);
}


//////////////////////////////////
//////// CAPTURE API //////////
//////////////////////////////////

var currentTab, resultWindowId;

//
// Utility methods
//

// function Element(id) { return document.getElementById(id); }
function show(id) {
	document.getElementById(id).style.display = 'block';
}

function hide(id) {
	document.getElementById(id).style.display = 'none';
}


function getFilename(contentURL) {
	var name = contentURL.split('?')[0].split('#')[0];
	if (name) {
		name = name
			.replace(/^https?:\/\//, '')
			.replace(/[^A-z0-9]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^[_\-]+/, '')
			.replace(/[_\-]+$/, '');
		name = '-' + name;
	} else {
		name = '';
	}
	return 'screencapture' + name + '-' + Date.now() + '.jpeg';
}

//
// Capture Handlers
//

async function displayCaptures(filenames) {
	if (!filenames || !filenames.length) return;

	_displayCapture(filenames);
	return;
}


async function _displayCapture(filenames, index) {
	index = index || 0;
	var filename = filenames[index];
	var last = index === filenames.length - 1;

	if (currentTab.incognito && index === 0) {
		// cannot access file system in incognito, so open in non-incognito
		// window and add any additional tabs to that window.
		//
		// we have to be careful with focused too, because that will close
		// the popup.


		chrome.tabs.create({
			url: `x.html?capture=${filename}&credentials=${btoa(username + ":" + password)}`
		});

		// original new tab displaying screenshot code
		// chrome.windows.create({
		// 		url: filename,
		// 		incognito: false,
		// 		focused: last
		// }, function(win) {
		// 		resultWindowId = win.id;
		// });




	} else {
		// chrome.tabs.create({
		// 		url: filename,
		// 		active: last,
		// 		windowId: resultWindowId,
		// 		openerTabId: currentTab.id,
		// 		index: (currentTab.incognito ? 0 : currentTab.index) + 1 + index
		// });


		var selections = await SessionData.get("selections");
		var connections = await SessionData.get("connections");
		if (connections) {
			for (var c of connections) {
				c.text1 = c.text1.substring(c.text1.indexOf(' ') + 1);
				c.text2 = c.text2.substring(c.text2.indexOf(' ') + 1);
			}
		} else connections = [];
		var meta = await GetMeta();
		var data = new FormData();
		var username = await SessionData.get("username");
		var password = await SessionData.get("password");
		var title = $("#title").val();
		var description = $("#description").val();
		var date = new Date($("#date").val()).toISOString().slice(0, 19).replace('T', ' ');
		var pageDate = meta.date || (new Date().toISOString().slice(0, 16));

		var [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true
		});
		var url = (new URL(tab.url)).toString();
		if (url.includes("?"))
			url = url.substring(0, url.indexOf('?'));
		if (url.endsWith("/"))
			url = url.substring(0, url.length - 1);



		var captureData = {};
		captureData.username = username;
		captureData.password = password;
		captureData.selections = selections || [];
		captureData.connections = connections || [];
		captureData.title = title;
		captureData.description = description;
		captureData.date = date;
		captureData.url = url;
		captureData.pageDate = pageDate;
		captureData.quality = quality;

		localStorage.setItem("captureData", JSON.stringify(captureData));

		chrome.tabs.create({
			url: `x.html?capture=${filename}`,
			active: last,
			windowId: resultWindowId,
			openerTabId: currentTab.id,
			index: (currentTab.incognito ? 0 : currentTab.index) + 1 + index
		});
	}

	if (!last) {
		_displayCapture(filenames, index + 1);
	}
}


function errorHandler(reason) {
	// show('uh-oh'); // TODO - extra uh-oh info?
}


function progress(complete) {
	if (complete === 0) {
		// Page capture has just been initiated.
		// show('loading');
	} else {
		// document.getElementById('bar').style.width = parseInt(complete * 100, 10) + '%';
	}
}


function splitnotifier() {
	return;
	// show('split-image');
}


//
// start doing stuff immediately! - including error cases
//


window.Capture = (function () {

	var MAX_PRIMARY_DIMENSION = 15000 * 2,
		MAX_SECONDARY_DIMENSION = 4000 * 2,
		MAX_AREA = MAX_PRIMARY_DIMENSION * MAX_SECONDARY_DIMENSION;
	//
	// URL Matching test - to verify we can talk to this URL
	//

	var matches = ['http://*/*', 'https://*/*', 'ftp://*/*', 'file://*/*'],
		noMatches = [/^https?:\/\/chrome.google.com\/.*$/];

	function isValidUrl(url) {
		// couldn't find a better way to tell if executeScript
		// wouldn't work -- so just testing against known urls
		// for now...
		var r, i;
		for (i = noMatches.length - 1; i >= 0; i--) {
			if (noMatches[i].test(url)) {
				return false;
			}
		}
		for (i = matches.length - 1; i >= 0; i--) {
			r = new RegExp('^' + matches[i].replace(/\*/g, '.*') + '$');
			if (r.test(url)) {
				return true;
			}
		}
		return false;
	}


	function initiateCapture(tab, static, callback) {
		chrome.tabs.sendMessage(tab.id, {
			msg: 'scrollPage',
			static: static
		}, function () {
			// We're done taking snapshots of all parts of the window. Display
			// the resulting full screenshot images in a new browser tab.
			callback();
		});
	}


	function capture(data, screenshots, sendResponse, splitnotifier) {
		chrome.tabs.captureVisibleTab(
			null, {
				format: 'png'
			},
			function (dataURI) {
				if (dataURI) {

					var image = new Image();
					image.onload = function () {
						data.image = {
							width: image.width,
							height: image.height
						};

						// given device mode emulation or zooming, we may end up with
						// a different sized image than expected, so let's adjust to
						// match it!
						if (data.windowWidth !== image.width) {
							var scale = image.width / data.windowWidth;
							data.x *= scale;
							data.y *= scale;
							data.totalWidth *= scale;
							data.totalHeight *= scale;
						}

						// lazy initialization of screenshot canvases (since we need to wait
						// for actual image size)
						if (!screenshots.length) {
							Array.prototype.push.apply(
								screenshots,
								_initScreenshots(data.totalWidth, data.totalHeight)
							);
							if (screenshots.length > 1) {
								if (splitnotifier) {
									splitnotifier();
								}
								document.getElementById('screenshot-count').innerText = screenshots.length;
							}
						}

						// draw it on matching screenshot canvases
						_filterScreenshots(
							data.x, data.y, image.width, image.height, screenshots
						).forEach(function (screenshot) {
							screenshot.ctx.drawImage(
								image,
								data.x - screenshot.left,
								data.y - screenshot.top
							);
						});

						// send back log data for debugging (but keep it truthy to
						// indicate success)
						sendResponse(JSON.stringify(data, null, 4) || true);
					};
					image.src = dataURI;

				}
			});
	}


	function _initScreenshots(totalWidth, totalHeight) {
		// Create and return an array of screenshot objects based
		// on the `totalWidth` and `totalHeight` of the final image.
		// We have to account for multiple canvases if too large,
		// because Chrome won't generate an image otherwise.
		//
		var badSize = (totalHeight > MAX_PRIMARY_DIMENSION ||
				totalWidth > MAX_PRIMARY_DIMENSION ||
				totalHeight * totalWidth > MAX_AREA),
			biggerWidth = totalWidth > totalHeight,
			maxWidth = (!badSize ? totalWidth :
				(biggerWidth ? MAX_PRIMARY_DIMENSION : MAX_SECONDARY_DIMENSION)),
			maxHeight = (!badSize ? totalHeight :
				(biggerWidth ? MAX_SECONDARY_DIMENSION : MAX_PRIMARY_DIMENSION)),
			numCols = Math.ceil(totalWidth / maxWidth),
			numRows = Math.ceil(totalHeight / maxHeight),
			row, col, canvas, left, top;

		var canvasIndex = 0;
		var result = [];

		for (row = 0; row < numRows; row++) {
			for (col = 0; col < numCols; col++) {
				canvas = document.createElement('canvas');
				canvas.width = (col == numCols - 1 ? totalWidth % maxWidth || maxWidth :
					maxWidth);
				canvas.height = (row == numRows - 1 ? totalHeight % maxHeight || maxHeight :
					maxHeight);

				left = col * maxWidth;
				top = row * maxHeight;

				result.push({
					canvas: canvas,
					ctx: canvas.getContext('2d'),
					index: canvasIndex,
					left: left,
					right: left + canvas.width,
					top: top,
					bottom: top + canvas.height
				});

				canvasIndex++;
			}
		}

		return result;
	}


	function _filterScreenshots(imgLeft, imgTop, imgWidth, imgHeight, screenshots) {
		// Filter down the screenshots to ones that match the location
		// of the given image.
		//
		var imgRight = imgLeft + imgWidth,
			imgBottom = imgTop + imgHeight;
		return screenshots.filter(function (screenshot) {
			return (imgLeft < screenshot.right &&
				imgRight > screenshot.left &&
				imgTop < screenshot.bottom &&
				imgBottom > screenshot.top);
		});
	}


	function getBlobs(screenshots) {
		return screenshots.map(function (screenshot) {
			var dataURI = screenshot.canvas.toDataURL('image/jpeg', quality / 100);
			finalScreenshot = dataURI;


			// convert base64 to raw binary data held in a string
			// doesn't handle URLEncoded DataURIs
			var byteString = atob(dataURI.split(',')[1]);

			// separate out the mime component
			var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

			// write the bytes of the string to an ArrayBuffer
			var ab = new ArrayBuffer(byteString.length);
			var ia = new Uint8Array(ab);
			for (var i = 0; i < byteString.length; i++) {
				ia[i] = byteString.charCodeAt(i);
			}

			// create a blob for writing to a file
			var blob = new Blob([ab], {
				type: mimeString
			});
			return blob;
		});
	}


	function saveBlob(blob, filename, index, callback, errback) {
		filename = _addFilenameSuffix(filename, index);

		function onwriteend() {
			// open the file that now contains the blob - calling
			// `openPage` again if we had to split up the image
			var urlName = ('filesystem:chrome-extension://' +
				chrome.i18n.getMessage('@@extension_id') +
				'/temporary/' + filename);

			callback(urlName);
		}

		// come up with file-system size with a little buffer
		var size = blob.size + (1024 / 2);

		// create a blob for writing to a file
		var reqFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
		reqFileSystem(window.TEMPORARY, size, function (fs) {
			fs.root.getFile(filename, {
				create: true
			}, function (fileEntry) {
				fileEntry.createWriter(function (fileWriter) {
					fileWriter.onwriteend = onwriteend;
					fileWriter.write(blob);
				}, errback); // TODO - standardize error callbacks?
			}, errback);
		}, errback);
	}


	function _addFilenameSuffix(filename, index) {
		if (!index) {
			return filename;
		}
		var sp = filename.split('.');
		var ext = sp.pop();
		return sp.join('.') + '-' + (index + 1) + '.' + ext;
	}


	function captureToBlobs(tab, callback, errback, progress, splitnotifier) {
		var loaded = false,
			screenshots = [],
			timeout = 3000,
			timedOut = false,
			noop = function () {};

		callback = callback || noop;
		errback = errback || noop;
		progress = progress || noop;

		if (!isValidUrl(tab.url)) {
			errback('invalid url'); // TODO errors
		}

		// TODO will this stack up if run multiple times? (I think it will get cleared?)
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			if (request.msg === 'capture') {
				progress(request.complete);
				capture(request, screenshots, sendResponse, splitnotifier);

				// https://developer.chrome.com/extensions/messaging#simple
				//
				// If you want to asynchronously use sendResponse, add return true;
				// to the onMessage event handler.
				//
				return true;
			} else {
				console.error('Unknown message received from content script: ' + request.msg);
				errback('internal error');
				return false;
			}
		});

		chrome.scripting.executeScript({
			target: {
				tabId: tab.id
			},
			files: ['capture-page.js']
		}, function () {
			if (timedOut) {
				console.error('Timed out too early while waiting for ' +
					'chrome.tabs.executeScript. Try increasing the timeout.');
			} else {
				loaded = true;
				progress(0);
				var static = $("#static").prop("checked");
				initiateCapture(tab, static, function () {
					callback(getBlobs(screenshots));
				});
			}
		});

		window.setTimeout(function () {
			if (!loaded) {
				timedOut = true;
				errback('execute timeout');
			}
		}, timeout);
	}


	function captureToFiles(tab, filename, callback, errback, progress, splitnotifier) {
		captureToBlobs(tab, function (blobs) {
			var i = 0,
				len = blobs.length,
				filenames = [];

			(function doNext() {
				saveBlob(blobs[i], filename, i, function (filename) {
					i++;
					filenames.push(filename);
					i >= len ? callback(filenames) : doNext();
				}, errback);
			})();
		}, errback, progress, splitnotifier);
	}


	return {
		captureToBlobs: captureToBlobs,
		captureToFiles: captureToFiles
	};

})();



// function concatenateBase64Audio(audioData1, audioData2) {
// 	// Decode Base64 strings
// 	const decodedData1 = atob(audioData1);
// 	const decodedData2 = atob(audioData2);

// 	// Convert to ArrayBuffer
// 	const arrayBuffer1 = new ArrayBuffer(decodedData1.length);
// 	const arrayBuffer2 = new ArrayBuffer(decodedData2.length);

// 	const view1 = new Uint8Array(arrayBuffer1);
// 	const view2 = new Uint8Array(arrayBuffer2);

// 	for (let i = 0; i < decodedData1.length; i++) {
// 		view1[i] = decodedData1.charCodeAt(i);
// 	}

// 	for (let i = 0; i < decodedData2.length; i++) {
// 		view2[i] = decodedData2.charCodeAt(i);
// 	}


// 	const mergedArray = new Uint8Array(arrayBuffer1.byteLength + arrayBuffer2.byteLength);
// 	mergedArray.set(view1, 0);
// 	mergedArray.set(view2, arrayBuffer1.byteLength);


// 	const mergedBase64 = btoa(String.fromCharCode.apply(null, mergedArray));

// 	return mergedBase64;
// }

// const recorderonstopnull = async () => {
// 	console.log(stashrecordings);
// 	if (stashrecordings?.length === 0) return;

// 	let whole_recordings = stashrecordings[0];
// 	whole_recordings = whole_recordings.replace("data:application/octet-stream;", "data:audio/wav;");
// 	for (let i = 1; i < stashrecordings?.length; i++) {
// 		whole_recordings = await mergeBase64Audio(whole_recordings, stashrecordings[i]);
// 	}
// 	// base64 = await mergeBase64Audio(whole_recordings, base64)
// 	// base64 = base64.replace("data:application/octet-stream;", "data:audio/wav;");

// 	base64 = whole_recordings;

// 	recordings.push(base64);
// 	await SessionData?.set("recordings", recordings);
// 	await SessionData?.set("durations", durations);

// 	stashrecordings = [];
// 	await SessionData?.set("stashrecordings", stashrecordings);

// 	var index = recordings.length;
// 	duration = durations[index - 1] || 0;
// 	// Calculate minutes and seconds
// 	// var duration = await SessionData?.get('duration');
// 	var minutes = Math.floor(duration / 60);
// 	var seconds = duration % 60;

// 	// Format the output as mm:ss
// 	var formattedDuration = (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

// 	// let c = localStorage.getItem("durations");

// 	var comment = comments[comments.length - 1];

// 	function breakTextIntoLines(text, maxLength) {
// 		let lines = '';
// 		for (let i = 0; i < text.length; i += maxLength) {
// 			lines += text.substr(i, maxLength);
// 		}
// 		return lines;
// 	}

// 	// Maximum length for each line of the comment text
// 	const maxCommentLineLength = 40;

// 	// Break comment text into lines
// 	const formattedComment = breakTextIntoLines(comment, maxCommentLineLength);


// 	// ${c && c ? c : formattedDuration}

// 	var audio = $(`
// 			<option style="text-wrap: wrap;">
// 				${$("#slcRecordings option")?.length + 1}&nbsp;&nbsp;(${formattedDuration})  
// 				: ${formattedComment}
// 				<div class="comment-text" style="display: none;"></div>
// 			</option>`);

// 	$("#slcRecordings")?.append(audio);
// 	$("#btnUploadAudio").removeClass("disabled");

// 	audioData = [];
// 	duration = 0;
// };

////////////////////////////////////////
// ///////////

// async function mergeBase64Audio(base64Audio1, base64Audio2) {
// 	try {
// 		// Convert base64 strings to Blobs
// 		const blob1 = await base64ToBlob(base64Audio1);
// 		const blob2 = await base64ToBlob(base64Audio2);

// 		// Merge the Blobs
// 		// const mergedBlob = new Blob([blob1, blob2], { type: 'audio/wav' });

// 		const mergedBlob = await concatenateAudioBlobs(blob1, blob2);
// 		// Convert the merged Blob back to base64
// 		const mergedBase64 = await blobToBase64(mergedBlob);
// 		return mergedBase64;
// 	} catch (error) {
// 		console.error('Error merging base64 audio:', error);
// 		throw error;
// 	}
// }

// // Function to convert base64 to Blob
// function base64ToBlob(base64) {
// 	const byteCharacters = atob(base64.split(',')[1]);
// 	const byteNumbers = new Array(byteCharacters.length);

// 	for (let i = 0; i < byteCharacters.length; i++) {
// 		byteNumbers[i] = byteCharacters.charCodeAt(i);
// 	}

// 	const byteArray = new Uint8Array(byteNumbers);
// 	return new Blob([byteArray]);
// }


// // This function concatenates two audio blobs
// async function concatenateAudioBlobs(blob1, blob2) {
// 	try {
// 		// Create an audio context
// 		const audioContext = new(window.AudioContext || window.webkitAudioContext)();
// 		// Decode audio data from the first blob
// 		const buffer1 = await decodeAudioBlob(blob1, audioContext);
// 		// Decode audio data from the second blob
// 		const buffer2 = await decodeAudioBlob(blob2, audioContext);
// 		// Log the decoded audio data
// 		console.log(buffer1, buffer2);
// 		// Concatenate the audio buffers
// 		const concatenatedBuffer = concatenateAudioBuffers(buffer1, buffer2, audioContext);
// 		// Log the concatenated buffer
// 		console.log(concatenatedBuffer);
// 		// Encode the concatenated buffer back to a blob
// 		const concatenatedBlob = await encodeAudioBufferToBlob(concatenatedBuffer, audioContext);
// 		// Close the audio context
// 		audioContext.close();
// 		// Return the concatenated blob
// 		return concatenatedBlob;
// 	} catch (error) {
// 		// Log and rethrow any errors
// 		console.error('Error concatenating audio blobs:', error);
// 		throw error;
// 	}
// }

// function decodeAudioBlob(blob, audioContext) {
// 	return new Promise((resolve, reject) => {
// 		const reader = new FileReader();

// 		reader.onloadend = async function () {
// 			try {
// 				const arrayBuffer = reader.result;
// 				const buffer = await audioContext.decodeAudioData(arrayBuffer);
// 				resolve(buffer);
// 			} catch (decodeError) {
// 				reject(decodeError);
// 			}
// 		};

// 		reader.readAsArrayBuffer(blob);
// 	});
// }

// function concatenateAudioBuffers(buffer1, buffer2, audioContext) {
// 	const numberOfChannels = Math.max(buffer1.numberOfChannels, buffer2.numberOfChannels);
// 	const length = buffer1.length + buffer2.length;

// 	const concatenatedBuffer = audioContext.createBuffer(numberOfChannels, length, buffer1.sampleRate);

// 	for (let channel = 0; channel < numberOfChannels; channel++) {
// 		const channelData = concatenatedBuffer.getChannelData(channel);
// 		channelData.set(buffer1.getChannelData(channel), 0);
// 		channelData.set(buffer2.getChannelData(channel), buffer1.length);
// 	}

// 	return concatenatedBuffer;
// }

// function encodeAudioBufferToBlob(audioBuffer, audioContext) {
// 	return new Promise((resolve) => {
// 		const numberOfChannels = audioBuffer.numberOfChannels;
// 		const sampleRate = audioBuffer.sampleRate;
// 		const length = audioBuffer.length;
// 		const interleaved = new Float32Array(length * numberOfChannels);

// 		for (let channel = 0; channel < numberOfChannels; channel++) {
// 			const channelData = audioBuffer.getChannelData(channel);
// 			for (let i = 0; i < length; i++) {
// 				interleaved[i * numberOfChannels + channel] = channelData[i];
// 			}
// 		}

// 		const wavData = encodeWAV(interleaved, numberOfChannels, sampleRate);
// 		const blob = new Blob([new Uint8Array(wavData)], {
// 			type: 'audio/wav'
// 		});

// 		resolve(blob);
// 	});
// }

// function encodeWAV(samples, numChannels, sampleRate) {
// 	const buffer = new ArrayBuffer(44 + samples.length * 2);
// 	const view = new DataView(buffer);

// 	writeString(view, 0, 'RIFF');
// 	view.setUint32(4, 36 + samples.length * 2, true);
// 	writeString(view, 8, 'WAVE');
// 	writeString(view, 12, 'fmt ');
// 	view.setUint32(16, 16, true);
// 	view.setUint16(20, 1, true);
// 	view.setUint16(22, numChannels, true);
// 	view.setUint32(24, sampleRate, true);
// 	view.setUint32(28, sampleRate * numChannels * 2, true);
// 	view.setUint16(32, numChannels * 2, true);
// 	view.setUint16(34, 16, true);
// 	writeString(view, 36, 'data');
// 	view.setUint32(40, samples.length * 2, true);

// 	floatTo16BitPCM(view, 44, samples);

// 	return buffer;
// }

// function writeString(view, offset, string) {
// 	for (let i = 0; i < string.length; i++) {
// 		view.setUint8(offset + i, string.charCodeAt(i));
// 	}
// }

// function floatTo16BitPCM(output, offset, input) {
// 	for (let i = 0; i < input.length; i++, offset += 2) {
// 		const sample = Math.max(-1, Math.min(1, input[i]));
// 		output.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
// 	}
// }

// function createWriter(dataView) {
// 	let pos = 0;

// 	return {
// 		string(val) {
// 			for (let i = 0; i < val.length; i++) {
// 				dataView.setUint8(pos++, val.charCodeAt(i));
// 			}
// 		},
// 		uint16(val) {
// 			dataView.setUint16(pos, val, true);
// 			pos += 2;
// 		},
// 		uint32(val) {
// 			dataView.setUint32(pos, val, true);
// 			pos += 4;
// 		},
// 		pcm16s: function (value) {
// 			value = Math.round(value * 32768);
// 			value = Math.max(-32768, Math.min(value, 32767));
// 			dataView.setInt16(pos, value, true);
// 			pos += 2;
// 		},
// 	}
// }