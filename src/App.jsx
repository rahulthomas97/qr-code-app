import React, { useState, useEffect, useRef } from "react";
import Webcam from "react-webcam";
import './App.css';
import { loadModel, preprocessFrame, processYoloOutput, decodeQRCode, isValidUrl } from './utils';

function App() {
  const [model, setModel] = useState(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const webcamRef = useRef(null);
  const [modelStatus, setModelStatus] = useState("Loading model...");
  const [camera, setCamera] = useState("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState('');
  const tempCanvasRef = useRef(document.createElement('canvas'));
  const processingRef = useRef(false);
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoInputDevices = devices.filter(device => device.kind === "videoinput");
      setHasMultipleCameras(videoInputDevices.length > 1);
    }).catch(error => {
      console.error("Error enumerating devices:", error);
      setError("Failed to detect cameras");
    });

    // Load the YOLO model
    loadModel().then(model => {
      setModel(model);
    }).catch(error => {
      console.error("Error loading YOLO model:", error);
      setError("Failed to load QR detection model");
    });
  }, []);

  useEffect(() => {
    if (scanning && webcamRef.current) {
      // Start video stream
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: camera }
      })
        .then(stream => {
          webcamRef.current.srcObject = stream;
          startScanning();
        })
        .catch(err => {
          console.error("Error accessing camera:", err);
          setError("Failed to access camera");
          setScanning(false);
        });

      // Cleanup function
      return () => {
        stopCamera();
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
        }
      };
    }
  }, [scanning, camera]);

  const stopCamera = () => {
    if (webcamRef.current?.srcObject) {
      const tracks = webcamRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const startScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    scanIntervalRef.current = setInterval(async () => {
      if (processingRef.current || !webcamRef.current?.video || !model || !scanning) {
        return;
      }

      const video = webcamRef.current.video;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        processingRef.current = true;
        try {
          const inputTensor = preprocessFrame(video);
          if (!inputTensor) {
            processingRef.current = false;
            return;
          }
          const predictions = await model.executeAsync(inputTensor);
          const bestDetection = await processYoloOutput(predictions, video);
          
          if (bestDetection) {
            const code = decodeQRCode(
              video, 
              bestDetection.bbox, 
              tempCanvasRef.current
            );
            if (code) {
              const url = code.data;
              const confidence = (bestDetection.confidence * 100).toFixed(1);
              if (isValidUrl(url)) {
                setDetectionStatus(`URL: ${url.substring(0)}`);
                stopCamera();
                window.open(url, '_blank');
                setScanning(false);
              } else {
                setDetectionStatus(`Decoded text: ${url.substring(0)}`);
              }
            } else {
              setDetectionStatus(`Please adjust placement or brightness of QR code`);
            }
          }

          inputTensor.dispose();
          predictions.forEach(t => t.dispose());
        } catch (err) {
          console.error("Detection error:", err);
        } finally {
          processingRef.current = false;
        }
      }
    }, 150);
  };

  return (
    <div className="app-wrapper">
      <div className="app-container">
        <h1>QR Code Scanner</h1>
        {!model && <div className="status">{modelStatus}</div>}
        {error && <div className="error">{error}</div>}
        <div className="button-container">
          <button 
            onClick={() => {
              if (scanning) {
                stopCamera();
              }
              setScanning(!scanning);
              setDetectionStatus(scanning ? "" : "Scanning...");
              setError(null);
            }}
            disabled={!model}
          >
            {scanning ? "Stop Scanning" : "Start Scanning"}
          </button>
          <button 
            onClick={() => setCamera(camera === "user" ? "environment" : "user")}
            disabled={!scanning || !hasMultipleCameras}
          >
            Switch Camera
          </button>
        </div>
        {scanning && (
          <div className="scanner-container">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                facingMode: camera,
                width: 640,
                height: 640
              }}
              style={{
                width: '640px',
                height: '640px',
                transform: camera === "user" ? "scaleX(-1)" : "none"
              }}
            />
          </div>
        )}
        <p>{detectionStatus}</p>
      </div>
    </div>
  );
}

export default App;