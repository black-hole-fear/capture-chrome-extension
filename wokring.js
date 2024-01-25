async function mergeBase64Audio(base64Audio1, base64Audio2) {
	try {
		// Convert base64 strings to Blobs
		const blob1 = await base64ToBlob(base64Audio1);
		const blob2 = await base64ToBlob(base64Audio2);

		console.log(blob1, blob2);

		// Merge the Blobs
		// const mergedBlob = new Blob([blob1, blob2], { type: 'audio/wav' });

		const mergedBlob = await concatenateAudioBlobs(blob1, blob2);

		console.log(mergedBlob);

		// Convert the merged Blob back to base64
		const mergedBase64 = await blobToBase64(mergedBlob);

		return mergedBase64;
	} catch (error) {
		console.error('Error merging base64 audio:', error);
		throw error;
	}
}

// Function to convert base64 to Blob
function base64ToBlob(base64) {
	const byteCharacters = atob(base64.split(',')[1]);
	const byteNumbers = new Array(byteCharacters.length);

	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}

	const byteArray = new Uint8Array(byteNumbers);
	return new Blob([byteArray]);
}


async function concatenateAudioBlobs(blob1, blob2) {
	try {
		const audioContext = new (window.AudioContext || window.webkitAudioContext)();

		// Decode audio data from the first blob
		const buffer1 = await decodeAudioBlob(blob1, audioContext);

		// Decode audio data from the second blob
		const buffer2 = await decodeAudioBlob(blob2, audioContext);

		console.log(buffer1, buffer2)

		// Concatenate the audio buffers
		const concatenatedBuffer = concatenateAudioBuffers(buffer1, buffer2, audioContext);

		console.log(concatenatedBuffer)

		// Encode the concatenated buffer back to a blob
		const concatenatedBlob = await encodeAudioBufferToBlob(concatenatedBuffer, audioContext);

		// Close the audio context
		audioContext.close();

		console.log(concatenatedBlob)
		return concatenatedBlob;
	} catch (error) {
		console.error('Error concatenating audio blobs:', error);
		throw error;
	}
}

function decodeAudioBlob(blob, audioContext) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onloadend = async function () {
			try {
				const arrayBuffer = reader.result;
				const buffer = await audioContext.decodeAudioData(arrayBuffer);
				resolve(buffer);
			} catch (decodeError) {
				reject(decodeError);
			}
		};

		reader.readAsArrayBuffer(blob);
	});
}

function concatenateAudioBuffers(buffer1, buffer2, audioContext) {
	const numberOfChannels = Math.max(buffer1.numberOfChannels, buffer2.numberOfChannels);
	const length = buffer1.length + buffer2.length;

	const concatenatedBuffer = audioContext.createBuffer(numberOfChannels, length, buffer1.sampleRate);

	for (let channel = 0; channel < numberOfChannels; channel++) {
		const channelData = concatenatedBuffer.getChannelData(channel);
		channelData.set(buffer1.getChannelData(channel), 0);
		channelData.set(buffer2.getChannelData(channel), buffer1.length);
	}

	return concatenatedBuffer;
}

function encodeAudioBufferToBlob(audioBuffer, audioContext) {
	return new Promise((resolve) => {
	  const numberOfChannels = audioBuffer.numberOfChannels;
	  const sampleRate = audioBuffer.sampleRate;
	  const length = audioBuffer.length;
	  const interleaved = new Float32Array(length * numberOfChannels);
  
	  for (let channel = 0; channel < numberOfChannels; channel++) {
		const channelData = audioBuffer.getChannelData(channel);
		for (let i = 0; i < length; i++) {
		  interleaved[i * numberOfChannels + channel] = channelData[i];
		}
	  }
  
	  const wavData = encodeWAV(interleaved, numberOfChannels, sampleRate);
	  const blob = new Blob([new Uint8Array(wavData)], { type: 'audio/wav' });
  
	  resolve(blob);
	});
  }
  
  function encodeWAV(samples, numChannels, sampleRate) {
	const buffer = new ArrayBuffer(44 + samples.length * 2);
	const view = new DataView(buffer);
  
	writeString(view, 0, 'RIFF');
	view.setUint32(4, 36 + samples.length * 2, true);
	writeString(view, 8, 'WAVE');
	writeString(view, 12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * numChannels * 2, true);
	view.setUint16(32, numChannels * 2, true);
	view.setUint16(34, 16, true);
	writeString(view, 36, 'data');
	view.setUint32(40, samples.length * 2, true);
  
	floatTo16BitPCM(view, 44, samples);
  
	return buffer;
  }
  
  function writeString(view, offset, string) {
	for (let i = 0; i < string.length; i++) {
	  view.setUint8(offset + i, string.charCodeAt(i));
	}
  }
  
  function floatTo16BitPCM(output, offset, input) {
	for (let i = 0; i < input.length; i++, offset += 2) {
	  const sample = Math.max(-1, Math.min(1, input[i]));
	  output.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
	}
  }