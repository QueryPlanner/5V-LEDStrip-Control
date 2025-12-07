const noble = require("@abandonware/noble");

console.log("Scanning for LotusLantern/ELK-BLEDOM LED strips (Service UUID 0xFFF0)...");
console.log("This might take a few seconds per device. Please wait.");

const potentialDevices = [];
const knownDevices = new Set();
const TARGET_SERVICE_UUID = "fff0";

noble.on("stateChange", (state) => {
    if (state === "poweredOn") {
        noble.startScanning([], true);
    } else {
        noble.stopScanning();
    }
});

noble.on("discover", async (peripheral) => {
    if (knownDevices.has(peripheral.uuid)) return;
    knownDevices.add(peripheral.uuid);

    const name = peripheral.advertisement.localName || "Unknown";
    const connectable = peripheral.connectable;

    // Filter out obvious non-matches
    if (name.includes("iPad") || name.includes("iPhone") || name.includes("Mac")) return;
    if (!connectable) return;

    console.log(`Checking candidate: [${peripheral.uuid}] Name: ${name}`);

    // Check if service UUID is in advertisement (fast check)
    const advertisedServices = peripheral.advertisement.serviceUuids || [];
    if (advertisedServices.includes(TARGET_SERVICE_UUID)) {
        console.log(`\n🎉 FOUND MATCH! UUID: ${peripheral.uuid}`);
        console.log(`Run this command: npm start ${peripheral.uuid}\n`);
        process.exit(0);
    }

    // If not advertised, we might need to connect to verify (slower check)
    // For safety/speed, let's just list the "Unknown" candidates for now.
    if (name === "Unknown" || name.includes("ELK") || name.includes("LED") || name.includes("Triones")) {
        potentialDevices.push({ uuid: peripheral.uuid, name: name, rssi: peripheral.rssi });
    }
});

// After 10 seconds, print best guesses if no direct match found
setTimeout(() => {
    console.log("\n--- Scan Complete ---");
    if (potentialDevices.length === 0) {
        console.log("No likely devices found. Ensure the strip is plugged in and your phone is disconnected from it.");
    } else {
        console.log("Connectable 'Unknown' devices found (likely your strip):");
        potentialDevices.sort((a, b) => b.rssi - a.rssi); // Sort by signal strength
        potentialDevices.forEach(d => {
            console.log(`UUID: ${d.uuid} (Signal: ${d.rssi}) - Name: ${d.name}`);
        });
        console.log("\nTry the top UUID with: npm start <UUID>");
    }
    process.exit(0);
}, 10000);
