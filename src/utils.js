import * as tf from '@tensorflow/tfjs';
import "@tensorflow/tfjs-backend-webgl";
import jsQR from 'jsqr';

export const preprocessFrame = (video) => tf.tidy(() => {
  if (!video) return null;

  return tf.browser.fromPixels(video)
  .resizeBilinear([640, 640]) // resize frame
  .div(255.0) // normalize
  .expandDims(0); // add batch;
});

export const processYoloOutput = async (predictions, video) => {
  try {
    const boxes = tf.tidy(() => {
      const predTensor = Array.isArray(predictions) ? predictions[0] : predictions;
      return tf.transpose(predTensor.squeeze(), [1, 0]);
    });

    const boxesArray = await boxes.array();
    const threshold = 0.25;

    let bestDetection = null;
    let maxConfidence = threshold;

    for (let i = 0; i < boxesArray.length; i++) {
      const [x, y, w, h, confidence] = boxesArray[i];
      if (confidence > maxConfidence) {
        maxConfidence = confidence;
        bestDetection = {
          bbox: [y - h / 2, x - w / 2, w, h],
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

export const decodeQRCode = (video,bbox, canvas) => {
const ctx = canvas.getContext('2d', { willReadFrequently: true });
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  let [y1, x1, width, height] = bbox;
  x1 = Math.max(0, Math.floor(x1));
  y1 = Math.max(0, Math.floor(y1));
  width = Math.floor(width);
  height = Math.floor(height);


  //draw a rectangle around the detected QR code
//   ctx.strokeStyle = "#007bff";  // Changed from "green" to match button color
//   ctx.lineWidth = 2;
//   ctx.strokeRect(x1, y1, width, height);

  try {
    let imageData = ctx.getImageData(x1, y1, width, height);
    if (imageData.width === 0 || imageData.height === 0) {
      return null;
    }
    
    // Try to decode QR code with processed image
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    return code ? code : null;
    
  } catch (error) {
    console.error('QR decoding error:', error);
    return null;
  }
};

export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

export const initializeScanner = async (progressCallback) => {
  try {
    // Set TensorFlow.js backend to WebGL
    await tf.setBackend('webgl');
    await tf.ready();
    
    progressCallback?.({ status: 'Loading dependencies...', progress: 0 });
    
    // Preload jsQR
    const dummyData = new Uint8ClampedArray(4);
    jsQR(dummyData, 1, 1);
    
    progressCallback?.({ status: 'Loading detection model...', progress: 20 });
    
    // Load YOLO model
    const model = await tf.loadGraphModel('./model/model.json', {
      onProgress: (fraction) => {
        const totalProgress = 20 + (fraction * 80); // Scale model loading to 20-100%
        progressCallback?.({ 
          status: 'Loading detection model...', 
          progress: Math.round(totalProgress)
        });
      }
    });

    // Warm up the model
    const dummyInput = tf.ones(model.inputs[0].shape);
    const warmupResults = await model.execute(dummyInput);
    tf.dispose([dummyInput, warmupResults]);

    progressCallback?.({ status: 'Ready', progress: 100 , model: model});
    
  } catch (error) {
    console.error('Initialization failed:', error);
    progressCallback?.({ status: 'Initialization failed', progress: 0 });
  }
};
