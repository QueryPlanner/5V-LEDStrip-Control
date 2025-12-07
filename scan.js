/* scan.js */
const noble = require("@abandonware/noble");

console.log("Scanning for Bluetooth devices... (Press Ctrl+C to stop)");

noble.on("stateChange", (state) => {
    if (state === "poweredOn") {
        noble.startScanning([], true); // Allow duplicates to see signal strength
    } else {
        noble.stopScanning();
    }
});

noble.on("discover", (peripheral) => {
    const name = peripheral.advertisement.localName || "Unknown";
    const connectable = peripheral.connectable;
    console.log(`Found: [${peripheral.uuid}] Name: ${name} (Connectable: ${connectable})`);
});