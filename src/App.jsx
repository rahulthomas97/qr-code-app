import React, { useState, useEffect, useRef } from "react";
import Webcam from "react-webcam";
import * as tf from '@tensorflow/tfjs';
import jsQR from 'jsqr';
import './App.css';

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

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoInputDevices = devices.filter(device => device.kind === "videoinput");
      setHasMultipleCameras(videoInputDevices.length > 1);
    }).catch(error => {
      console.error("Error enumerating devices:", error);
      setError("Failed to detect cameras");
    });

    // Load the YOLO model
    tf.loadGraphModel('./model/model.json').then(model => {
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
        if (webcamRef.current?.srcObject) {
          const tracks = webcamRef.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
        }
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
        }
      };
    }
  }, [scanning, camera]);

  const processFrame = () => tf.tidy(() => {
    if (!webcamRef.current?.video) return null;
    const video = webcamRef.current.video;
    return tf.browser.fromPixels(video)
      .resizeBilinear([640, 640])
      .expandDims(0)
      .toFloat()
      .div(255.0);
  });

  const processYoloOutput = async (predictions, video) => {
    try {
      const boxes = tf.tidy(() => {
        const predTensor = Array.isArray(predictions) ? predictions[0] : predictions;
        return tf.transpose(predTensor.squeeze(), [1, 0]);
      });

      const boxesArray = await boxes.array();
      const threshold = 0.25;

      // Find detection with highest confidence
      let bestDetection = null;
      let maxConfidence = threshold;

      for (let i = 0; i < boxesArray.length; i++) {
        const [x, y, w, h, confidence] = boxesArray[i];
        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          bestDetection = {
            bbox: [x/640, y/640, w/640, h/640],
            confidence
          };
        }
      }

      boxes.dispose();
      return bestDetection;
    } catch (error) {
      console.error("Error processing YOLO output:", error);
      return null;
    }
  };

  const decodeQRCode = (video, bbox) => {
    const canvas = tempCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // YOLO outputs center_x, center_y, width, height
    const [center_x, center_y, width, height] = bbox;
    
    // Convert normalized values to actual pixels
    const actualWidth = video.videoWidth;
    const actualHeight = video.videoHeight;
    
    // Calculate top-left corner from center
    const x = Math.round((center_x * actualWidth) - ((width * actualWidth) / 2));
    const y = Math.round((center_y * actualHeight) - ((height * actualHeight) / 2));
    
    // Calculate dimensions in pixels
    const cropWidth = Math.round(width * actualWidth);
    const cropHeight = Math.round(height * actualHeight);

    // Add padding
    const padding = Math.round(Math.min(cropWidth, cropHeight) * 0.1); // 10% padding
    const cropX = Math.max(0, x - padding);
    const cropY = Math.max(0, y - padding);
    const finalWidth = Math.min(cropWidth + (2 * padding), actualWidth - cropX);
    const finalHeight = Math.min(cropHeight + (2 * padding), actualHeight - cropY);

    if (finalWidth <= 0 || finalHeight <= 0) {
      console.warn('Invalid crop dimensions:', {
        original: { x, y, width: cropWidth, height: cropHeight },
        withPadding: { cropX, cropY, cropWidth: finalWidth, cropHeight: finalHeight },
        bbox
      });
      return null;
    }

    canvas.width = finalWidth;
    canvas.height = finalHeight;

    try {
      ctx.drawImage(
        video,
        cropX, cropY, finalWidth, finalHeight,
        0, 0, finalWidth, finalHeight
      );

      const imageData = ctx.getImageData(0, 0, finalWidth, finalHeight);
      return jsQR(imageData.data, finalWidth, finalHeight);
    } catch (error) {
      console.error('QR decoding error:', error);
      return null;
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
          const inputTensor = processFrame();
          if (!inputTensor) {
            processingRef.current = false;
            return;
          }

          const predictions = await model.executeAsync(inputTensor);
          const bestDetection = await processYoloOutput(predictions, video);
          
          if (bestDetection) {
            const code = decodeQRCode(video, bestDetection.bbox);
            if (code) {
              const url = code.data;
              const confidence = (bestDetection.confidence * 100).toFixed(1);
              if (isValidUrl(url)) {
                setDetectionStatus(`Opening URL (${confidence}% confidence): ${url.substring(0, 50)}...`);
                window.open(url, '_blank');
                setScanning(false);
              } else {
                setDetectionStatus(`Decoded text (${confidence}% confidence): ${url.substring(0, 50)}...`);
              }
            } else {
              setDetectionStatus(`QR code detected (${(bestDetection.confidence * 100).toFixed(1)}% confidence) but could not decode`);
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
        {error && <div className="error">{error}</div>}
        <div className="button-container">
          <button onClick={() => {
            setScanning(!scanning);
            setDetectionStatus(scanning ? "" : "Scanning...");
            setError(null);
          }}>
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