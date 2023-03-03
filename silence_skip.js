((scope) => {

    /**
     * General helpers
     */

    // Fast max function which we add to arrays.
    Array.max = function(arr) {

        let l = arr.length;
        let max = -Infinity;

        while (l--) {

            if (arr[l] > max) {

                max = arr[l];

            }
        }

        return max;
    };

    // Abstraction for dealing directly in video frames. This is
    // an innacurate way of seeking, but is useful in our context.
    Object.defineProperties(HTMLVideoElement.prototype, {
        framerate: {
            value: 30
        },
        currentFrame: {
            enumerable: true,
            get: function() {
                return Math.floor(this.currentTime * this.framerate);
            },
            set: function(value) {
                this.currentTime = value / this.framerate;
            } 
        }
    });

    /**
     * Scaffolding code.
     */
    const vUpload = document.createElement('input');
    vUpload.type = "file";

    document.getElementById('contentHolder').appendChild(vUpload);

    const vUploadButton = document.createElement('button');
    vUploadButton.innerText = "Upload file";

    document.getElementById('contentHolder').appendChild(vUpload);
    document.getElementById('contentHolder').appendChild(vUploadButton);


    /**
     * Video element
     */
    const videoNode = document.createElement('video');

    videoNode.controls = true;
    videoNode.muted = false;
    videoNode.height = 960;
    videoNode.width = 1280;

    document.getElementById('contentHolder').appendChild(videoNode);

    scope.vN = videoNode;

    vUploadButton.addEventListener('click', (e) => {

        if (!vUpload.files) {
            return;
        }

        videoNode.src = URL.createObjectURL(vUpload.files[0]);
        videoNode.srcBlob = vUpload.files[0];

        detectSilence(videoNode);
        seekVideo(videoNode);

    });

    const seekVideo = (videoNode) => {

        setInterval(() => {

            if (videoNode.showFrames && !videoNode.paused) {

                if (!videoNode.showFrames.includes(videoNode.currentFrame)) {

                    videoNode.currentFrame = videoNode.showFrames.lookup[videoNode.currentFrame];

                }

            }

        }, 100)

    }

    /**
     * Detect silence in the provided video node and generate a list of
     * non-silent sections.
     * 
     * @param {*} videoNode 
     */
    const detectSilence = (videoNode) => {

        // Convert videoNode audio into an arraybuffer
        videoNode.srcBlob.arrayBuffer()

            // Use an audio context to decode the audio data
            .then((buffer) => {

                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                return audioCtx.decodeAudioData(buffer);

            })

            // Convert to native audioBuffer
            .then((audioBuffer) => {

                const offlineAudioContext = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
                const soundSource = offlineAudioContext.createBufferSource();

                soundSource.buffer = audioBuffer;
                soundSource.connect(offlineAudioContext.destination);
                soundSource.start(0);

                // Render the audio context so we can deal with the\
                // raw floats individually.
                offlineAudioContext

                    .startRendering()

                    .then(renderedBuffer => {
                        console.log("Generating frame averages...");
                        // Each index is essentially a frame number, and each data point is the
                        // corresponding normalised average vol for that frame.
                        const frameAverages = detectSilence.frameBlockData(
                            renderedBuffer.getChannelData(0), 
                            audioBuffer, 
                            videoNode);

                        console.log("Calculating which frames to show..."); 
                        videoNode.showFrames = detectSilence.getFramesHigherThanThres(frameAverages);
                        console.log("Generating a lookup array..."); 
                        videoNode.showFrames.lookup = detectSilence.getFrameLookupArray(videoNode.showFrames); 

                        const duration = `${Math.ceil(videoNode.showFrames.length / (30 * 60))} min}`;
                        console.log(`Updated duration: ${duration}`)
                    })
            })

            .catch(function (err) {

                console.error('Rendering failed: ' + err);

            })
    }

    /**
     * Turn the data into blocks the size of video frames and represent that
     * block with the highest value in that block. 
     * 
     * @param {Array} rawData 
     * @param {*} audioBuffer 
     * @param {*} videoNode 
     * @returns 
     */
    detectSilence.frameBlockData = (rawData, audioBuffer, videoNode) => {

        const blockSize = Math.floor(audioBuffer.sampleRate / videoNode.framerate); // the number of samples in each subdivision
        const samples = Math.floor(rawData.length / blockSize)
        const filteredData = [];

        for (let i = 0; i < samples; i++) {

            let blockStart = blockSize * i; // the location of the first sample in the block
            let maxVol = Array.max(rawData.slice(blockStart, blockStart + blockSize));
            filteredData.push(maxVol)

        }

        return filteredData;

    }

    /**
     * Returns an array of only frames with a higher value than the provided threshold.
     * Threshold is calculated as frame_max/video_max > thres.
     * 
     * @param {*} data 
     * @param {*} thres 
     * @returns 
     */
    detectSilence.getFramesHigherThanThres = (data, thres = 0.03) => {

        let maxVol = Array.max(data);
        let frameIndexes = [];

        for (let i = 0; i < data.length; i++) {

            if (data[i]/maxVol > thres) {

                frameIndexes.push(i);

            }

        }

        return frameIndexes;
    }

    /**
     * Create a lookup array of every frame in the video to the next
     * non-silent frame, to make finding the next frame an O(n) problem.
     * 
     * @param {} showFrames 
     * @returns 
     */
    detectSilence.getFrameLookupArray = (showFrames) => {

        let arrayIterator = 0,
            frameLookupArray = [];

        for (let i = 0; i < showFrames.length; i++) {

            while (arrayIterator <= showFrames[i]) {

                frameLookupArray[arrayIterator++] = showFrames[i];

            }

        }

        return frameLookupArray;

    }

})(window)
