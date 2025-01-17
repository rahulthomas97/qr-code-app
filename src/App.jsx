import React, { useState, useRef } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";

function App() {
  const [data, setData] = useState("Not Found");
  const [hasPermission, setHasPermission] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null); // Reference to the scanner component

  const handleScan = (err, result) => {
    if (result) {
      setData(result.text);
      // Check if the scanned result is a valid URL before redirecting
      if (isValidUrl(result.text)) {
        window.location.href = result.text; // Redirect to the scanned URL
      }
    } else {
      setData("Not Found");
    }
  };

  // Helper function to validate if the scanned text is a valid URL
  const isValidUrl = (url) => {
    try {
      new URL(url); // Try creating a URL object
      return true;
    } catch (e) {
      return false; // If it fails, it's not a valid URL
    }
  };

  // Request camera permission explicitly
  const requestCameraPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      setHasPermission(true);
      setScanning(true); // Enable scanning once permission is granted
    } catch (err) {
      console.error("Camera permission denied or error:", err);
      setHasPermission(false);
    }
  };

  // Button click to start scanning and request permission
  const handleStartScan = () => {
    if (!hasPermission) {
      requestCameraPermission();
    } else {
      setScanning(true);
    }
  };

  // Stop scanning and deactivate the camera
  const handleStopScan = () => {
    setScanning(false); // Stop scanning
    if (scannerRef.current) {
      // Stop the camera stream if it's active
      const stream = scannerRef.current.getStream();
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop()); // Stop all tracks to turn off the camera
      }
    }
  };

  return (
    <>
      <h1>QR Code Scanner</h1>
      <button onClick={scanning ? handleStopScan : handleStartScan}>
        {scanning ? "Stop Scanning" : "Start Scanning"}
      </button>

      {scanning && (
        <BarcodeScannerComponent
          ref={scannerRef} // Attach reference to the scanner
          width={500}
          height={500}
          onUpdate={handleScan} // Simplified handler
        />
      )}

      {!hasPermission && <p>Please grant camera access to scan QR codes.</p>}
      <p>{data}</p>
    </>
  );
}

export default App;

