import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http'; // Required for WS
import { WebSocketServer } from 'ws'; // Required for WS
import Device from "@bjclopes/homebridge-ledstrip-bledom/Device.js";

// --- Configuration ---
const PORT = 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

// --- BLE Setup ---
if (!process.argv[2]) {
    console.error("Error: Please provide the UUID as an argument.");
    process.exit(1);
}

const uuid = process.argv[2];
console.log(`Initializing Controller for Device: ${uuid}...`);
const device = new Device(uuid);

// --- HACK: Prevent Auto-Disconnect ---
// The library disconnects after every command, which is too slow for streaming.
// We override it to keep the connection open.
device.debounceDisconnect = () => {
    // console.log("Keeping connection alive for streaming...");
};

// Ensure we disconnect when the server stops
process.on('SIGINT', async () => {
    console.log("\nClosing connection...");
    if (device.connected && device.peripheral) {
        await device.peripheral.disconnectAsync();
    }
    process.exit();
});

// --- Express & WS Setup ---
const app = express();
const server = createServer(app); // Wrap Express
const wss = new WebSocketServer({ server }); // Attach WS to server

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// --- Concurrency Control ---
let isBusy = false; // Prevent BLE command flooding
let lastUpdateTime = 0;

async function safeSetColor(r, g, b) {
    const now = Date.now();

    // Safety Force Reset: If stuck for > 1 second, force free
    if (isBusy && (now - lastUpdateTime > 1000)) {
        console.warn("⚠️ Force resetting hung BLE busy flag");
        isBusy = false;
    }

    if (isBusy) {
        console.log('Skipping frame: BLE Busy');
        return;
    }

    isBusy = true;
    lastUpdateTime = now;

    try {
        console.log(`Setting Color: ${r}, ${g}, ${b}`);

        // Add a race timeout to prevent infinite hanging
        await Promise.race([
            device.set_rgb(r, g, b),
            new Promise((_, reject) => setTimeout(() => reject(new Error("BLE Timeout")), 500))
        ]);

    } catch (e) {
        console.error("BLE Error:", e);
    } finally {
        isBusy = false;
    }
}

// --- WebSocket Logic (Real-time) ---
wss.on('connection', (ws) => {
    console.log('Client connected via WebSocket');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'color') {
                console.log('WS received color:', data.r, data.g, data.b);
                // Fire and forget, protected by isBusy flag
                safeSetColor(data.r, data.g, data.b);
            }
        } catch (e) {
            console.error('WS Parse Error', e);
        }
    });
});

// --- HTTP Routes (Existing) ---
app.post('/api/color', async (req, res) => {
    const { r, g, b } = req.body;
    await safeSetColor(r, g, b); // Use safe wrapper
    res.json({ success: true });
});

app.post('/api/power', async (req, res) => {
    const { on } = req.body;
    try {
        await device.set_power(on);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/brightness', async (req, res) => {
    const { level } = req.body;
    try {
        await device.set_brightness(level);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`\n✨ Dashboard running at http://localhost:${PORT}`);
    console.log(`   Target Device: ${uuid}\n`);
});
