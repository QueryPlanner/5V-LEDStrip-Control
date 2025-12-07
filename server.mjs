import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Device from "@bjclopes/homebridge-ledstrip-bledom/Device.js";

// --- Configuration ---
const PORT = 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

// --- BLE Setup ---
if (!process.argv[2]) {
    console.error("Error: Please provide the UUID as an argument.");
    console.error("Usage: node server.mjs <UUID>");
    process.exit(1);
}

const uuid = process.argv[2];
console.log(`Initializing Controller for Device: ${uuid}...`);
const device = new Device(uuid);

// --- Express Setup ---
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// --- Routes ---

// Set Color (R, G, B)
app.post('/api/color', async (req, res) => {
    const { r, g, b } = req.body;
    if (r === undefined || g === undefined || b === undefined) {
        return res.status(400).json({ error: "Missing r, g, or b values" });
    }
    try {
        await device.set_rgb(r, g, b);
        res.json({ success: true, message: `Color set to rgb(${r}, ${g}, ${b})` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to set color" });
    }
});

// Set Power
app.post('/api/power', async (req, res) => {
    const { on } = req.body; // boolean
    try {
        await device.set_power(on);
        res.json({ success: true, message: `Power set to ${on ? 'ON' : 'OFF'}` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to set power" });
    }
});

// Set Brightness
app.post('/api/brightness', async (req, res) => {
    const { level } = req.body; // 0-100
    try {
        await device.set_brightness(level);
        res.json({ success: true, message: `Brightness set to ${level}%` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to set brightness" });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`\n✨ Web Controller running at http://localhost:${PORT}`);
    console.log(`   Target Device: ${uuid}`);
    console.log(`   (Make sure the previous 'npm start' process is stopped!)\n`);
});
