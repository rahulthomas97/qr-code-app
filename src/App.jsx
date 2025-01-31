import React, { useState, useEffect, useRef } from "react";
import Webcam from "react-webcam";
import './App.css';
import { initializeScanner, preprocessFrame, processYoloOutput, decodeQRCode, isValidUrl } from './utils';

const CAMERA_SWITCH_DELAY = 500; // 1 second delay, adjust as needed

function App() {
  const [scanner, setScanner] = useState({
    ready: false,
    status: 'Loading dependencies...',
    progress: 0,
    error: null,
    model: null
  });
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const webcamRef = useRef(null);
  const [camera, setCamera] = useState("environment"); // Changed default to environment
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState('');
  const tempCanvasRef = useRef(document.createElement('canvas'));
  const isProcessingRef = useRef(false);
  const animationFrameRef = useRef(null);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);

  useEffect(() => {
    async function initialize() {
      initializeScanner((state) => {
        setScanner(prev => ({
          ...prev,
          ready: state.status == 'Ready',
          status: state.status,
          progress: state.progress,
          model: state.model || prev.model
        }));
      });

      // Check cameras
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputDevices = devices.filter(device => device.kind === "videoinput");
        setHasMultipleCameras(videoInputDevices.length > 1);
      } catch (error) {
        console.error("Error enumerating devices:", error);
        setError("Failed to detect cameras");
      }
    }

    initialize();
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
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
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

  const processFrame = async (video) => {
    if (isProcessingRef.current || !video || !scanner.ready) return;
    
    isProcessingRef.current = true;
    try {
      const inputTensor = preprocessFrame(video);
      if (!inputTensor) return;

      const predictions = await scanner.model.execute(inputTensor);
      const bestDetection = await processYoloOutput(predictions, video);
      
      if (bestDetection) {

        const code = decodeQRCode(video, bestDetection.bbox, tempCanvasRef.current);
        if (code) {
          const url = code.data;
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
      isProcessingRef.current = false;
    }
  };

  const startScanning = () => {
    const scan = async () => {
      if (!webcamRef.current?.video || !scanning) return;
      
      const video = webcamRef.current.video;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        await processFrame(video);
      }
      animationFrameRef.current = requestAnimationFrame(scan);
    };
    
    scan();
  };

  const handleCameraSwitch = () => {
    setIsSwitchingCamera(true);
    stopCamera();
    
    setTimeout(() => {
      setCamera(camera === "environment" ? "user" : "environment");
      setIsSwitchingCamera(false);
    }, CAMERA_SWITCH_DELAY);
  };

  return (
    <div className="app-wrapper">
      <div className="app-container">
        <h1>QR Code Scanner</h1>
        {!scanner.ready && (
          <div className="status">
            {scanner.status}
            {scanner.progress > 0 && scanner.progress < 100 && (
              <div>Loading: {scanner.progress}%</div>
            )}
            {scanner.error && (
              <div className="error">{scanner.error}</div>
            )}
          </div>
        )}
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
            disabled={!scanner.ready || isSwitchingCamera}
          >
            {scanning ? "Stop Scanning" : "Start Scanning"}
          </button>
          <button 
            onClick={handleCameraSwitch}
            disabled={!scanning || !hasMultipleCameras || isSwitchingCamera}
          >
            {isSwitchingCamera ? "Switching..." : "Switch Camera"}
          </button>
        </div>
        {scanning && !isSwitchingCamera && (
          <div style={{ position: "relative" }}>
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
                width: '400px',
                height: '400px',
                transform: camera === "user" ? "scaleX(-1)" : "none"
              }}
            />
            {/* <canvas
              ref={tempCanvasRef}
              style={{
                position: "absolute",
                top: 10,
                left: 5,
                width: '400px',
                height: '400px'
              }}
            /> */}
          </div>
        )}
        <p>{isSwitchingCamera ? "Switching camera..." : detectionStatus}</p>
      </div>
    </div>
  );
}

export default App;