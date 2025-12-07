const colorPicker = document.getElementById('colorPicker');
const hexDisplay = document.getElementById('hexDisplay');
const brightnessSlider = document.getElementById('brightnessSlider');
const brightnessValue = document.getElementById('brightnessValue');
const powerBtn = document.getElementById('powerBtn');
const screenSyncBtn = document.getElementById('screenSyncBtn');
const presets = document.querySelectorAll('.preset-btn');
let isPowered = true;
let isSyncing = false;

// Utility: Hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Utility: RGB to Hex
function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// API Calls
async function setPower(on) {
    try {
        await fetch('/api/power', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ on }),
        });
    } catch (e) {
        console.error("Failed to set power", e);
    }
}

async function setColor(r, g, b) {
    try {
        await fetch('/api/color', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ r, g, b }),
        });
    } catch (e) {
        console.error("Failed to set color", e);
    }
}

async function setBrightness(level) {
    try {
        await fetch('/api/brightness', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level: parseInt(level) }),
        });
    } catch (e) {
        console.error("Failed to set brightness", e);
    }
}

// Event Listeners
const debouncedSetColor = debounce((r, g, b) => setColor(r, g, b), 100);
const debouncedSetBrightness = debounce((level) => setBrightness(level), 100);

// Color Picker
colorPicker.addEventListener('input', (e) => {
    if (isSyncing) stopScreenSync(); // Stop sync if manual override

    const hex = e.target.value;
    hexDisplay.innerText = hex.toUpperCase();
    const rgb = hexToRgb(hex);
    if (rgb && isPowered) {
        debouncedSetColor(rgb.r, rgb.g, rgb.b);
    }
    document.body.style.setProperty('--accent', hex);
});

// Brightness
brightnessSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    brightnessValue.innerText = `${val}%`;
    if (isPowered) {
        debouncedSetBrightness(val);
    }
});

// Power
powerBtn.addEventListener('click', () => {
    isPowered = !isPowered;
    powerBtn.classList.toggle('active', isPowered);
    setPower(isPowered);

    if (!isPowered) {
        if (isSyncing) stopScreenSync();
        document.querySelector('main').style.opacity = '0.5';
        document.querySelector('main').style.pointerEvents = 'none';
        powerBtn.style.pointerEvents = 'auto';
        powerBtn.parentElement.style.pointerEvents = 'auto';
    } else {
        document.querySelector('main').style.opacity = '1';
        document.querySelector('main').style.pointerEvents = 'auto';
        const rgb = hexToRgb(colorPicker.value);
        if (rgb) setColor(rgb.r, rgb.g, rgb.b);
    }
});

// Presets
presets.forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (btn.id === 'cycleBtn') return;

        if (isSyncing) stopScreenSync();

        const color = btn.getAttribute('data-color');
        colorPicker.value = color;
        hexDisplay.innerText = color.toUpperCase();
        const rgb = hexToRgb(color);
        if (rgb) debouncedSetColor(rgb.r, rgb.g, rgb.b);
    });
});

// --- Screen Sync Logic ---

let videoElement = null;
let canvasElement = null;
let canvasContext = null;

async function startScreenSync() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: false
        });

        videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        videoElement.muted = true; // Required for autoplay policy
        videoElement.playsInline = true;

        canvasElement = document.createElement('canvas');
        canvasContext = canvasElement.getContext('2d', { willReadFrequently: true });

        // Wait for video metadata to load before starting
        videoElement.onloadedmetadata = async () => {
            canvasElement.width = videoElement.videoWidth || 100;
            canvasElement.height = videoElement.videoHeight || 100;

            try {
                await videoElement.play();
            } catch (playError) {
                console.error("Video play failed:", playError);
                stopScreenSync();
                return;
            }

            isSyncing = true;
            screenSyncBtn.classList.add('active');
            screenSyncBtn.innerHTML = '<span class="icon">🔴</span> Stop Syncing';

            processFrame();
        };

        const processFrame = () => {
            if (!isSyncing || !videoElement) return;

            const isVideoReady = videoElement.readyState >= videoElement.HAVE_CURRENT_DATA;

            if (isVideoReady) {
                canvasContext.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
                const frameData = canvasContext.getImageData(0, 0, canvasElement.width, canvasElement.height).data;

                let r = 0, g = 0, b = 0, count = 0;

                // Sample pixels for average color
                const step = Math.max(4, Math.floor(frameData.length / 1000) * 4); // Sample ~1000 pixels
                for (let i = 0; i < frameData.length; i += step) {
                    r += frameData[i];
                    g += frameData[i + 1];
                    b += frameData[i + 2];
                    count++;
                }

                if (count > 0) {
                    r = Math.floor(r / count);
                    g = Math.floor(g / count);
                    b = Math.floor(b / count);

                    const hex = rgbToHex(r, g, b);
                    colorPicker.value = hex;
                    hexDisplay.innerText = hex.toUpperCase();
                    document.body.style.setProperty('--accent', hex);

                    debouncedSetColor(r, g, b);
                }
            }

            // Use setTimeout for more consistent timing (~30fps)
            setTimeout(() => requestAnimationFrame(processFrame), 33);
        };

        stream.getVideoTracks()[0].onended = () => {
            stopScreenSync();
        };

    } catch (err) {
        console.error("Error starting screen sync:", err);
        alert("Could not start screen capture.");
    }
}

function stopScreenSync() {
    isSyncing = false;
    screenSyncBtn.classList.remove('active');
    screenSyncBtn.innerHTML = '<span class="icon">🖥️</span> Start Screen Sync';

    if (videoElement && videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoElement = null;
    }
}

screenSyncBtn.addEventListener('click', () => {
    if (!isSyncing) {
        startScreenSync();
    } else {
        stopScreenSync();
    }
});
