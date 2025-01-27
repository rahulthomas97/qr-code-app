import * as tf from '@tensorflow/tfjs';
import jsQR from 'jsqr';

export const loadModel = async () => {
  return await tf.loadGraphModel('./model/model.json');
};

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

const processImage = (imageData) => {
  const data = imageData.data;
  const brightness = -50; // Reduce exposure first
  const contrast = 2.5;   // Then increase contrast

  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      // First reduce brightness
      let pixel = data[i + j] + brightness;
      // Then apply contrast
      pixel = (((pixel / 255 - 0.5) * contrast + 0.5) * 255);
      data[i + j] = Math.max(0, Math.min(255, pixel));
    }
  }

  return imageData;
};

export const decodeQRCode = (video, bbox, canvas) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let [y1, x1, width, height] = bbox;
  x1 = Math.max(0, Math.floor(x1));
  y1 = Math.max(0, Math.floor(y1));
  width = Math.floor(width);
  height = Math.floor(height);

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  try {
    let imageData = ctx.getImageData(x1, y1, width, height);
    if (imageData.width === 0 || imageData.height === 0) {
      return null;
    }

    // Process the image
    imageData = processImage(imageData);
    
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
