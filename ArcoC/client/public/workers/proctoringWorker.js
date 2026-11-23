/**
 * Proctoring Web Worker for C-Arm Master
 * Offloads face detection, landmark calculation, and biometric distance comparison
 * from the browser main thread to keep UI interaction smooth at 60 FPS.
 */

// 1. Shims for WorkerGlobalScope (face-api.js expects browser globals)
self.window = self;
if (!self.document) {
  self.document = {
    createElement: (type) => {
      if (type === 'canvas' && typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(300, 150);
      }
      return {};
    }
  };
}
if (typeof HTMLImageElement === 'undefined') {
  self.HTMLImageElement = class HTMLImageElement {};
}
if (typeof HTMLCanvasElement === 'undefined') {
  self.HTMLCanvasElement = typeof OffscreenCanvas !== 'undefined' ? OffscreenCanvas : class HTMLCanvasElement {};
}
if (typeof HTMLVideoElement === 'undefined') {
  self.HTMLVideoElement = class HTMLVideoElement {};
}
if (typeof CanvasRenderingContext2D === 'undefined' && typeof OffscreenCanvasRenderingContext2D !== 'undefined') {
  self.CanvasRenderingContext2D = OffscreenCanvasRenderingContext2D;
}

// 2. Load face-api.min.js
try {
  importScripts('/workers/face-api.min.js');
} catch (err) {
  console.error('[Proctoring Worker] Error importing face-api:', err);
}

// 3. Monkey patch faceapi environment to use OffscreenCanvas
if (self.faceapi && typeof OffscreenCanvas !== 'undefined') {
  try {
    self.faceapi.env.monkeyPatch({
      Canvas: OffscreenCanvas,
      createCanvasElement: () => new OffscreenCanvas(300, 150)
    });
  } catch (err) {
    console.warn('[Proctoring Worker] monkeyPatch warning:', err);
  }
}

let isInitialized = false;
let registeredDescriptor = null;
let sharedCanvas = null;
let sharedCtx = null;

// Message handler
self.onmessage = async (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'INIT': {
      try {
        const modelUri = payload?.modelUri || '/models';
        if (payload?.registeredDescriptor) {
          registeredDescriptor = new Float32Array(payload.registeredDescriptor);
        }

        if (!isInitialized && self.faceapi) {
          await self.faceapi.nets.tinyFaceDetector.loadFromUri(modelUri);
          await self.faceapi.nets.faceLandmark68Net.loadFromUri(modelUri);
          await self.faceapi.nets.faceRecognitionNet.loadFromUri(modelUri);
          isInitialized = true;
        }

        self.postMessage({ type: 'INIT_SUCCESS' });
      } catch (err) {
        console.error('[Proctoring Worker] Init failed:', err);
        self.postMessage({ type: 'INIT_ERROR', error: err.message });
      }
      break;
    }

    case 'SET_DESCRIPTOR': {
      if (payload?.descriptor) {
        registeredDescriptor = new Float32Array(payload.descriptor);
      }
      break;
    }

    case 'PROCESS_FRAME': {
      if (!isInitialized || !self.faceapi) {
        self.postMessage({
          type: 'FRAME_PROCESSED',
          hasFace: false,
          match: false,
          error: 'Models not initialized'
        });
        return;
      }

      const { imageBitmap, frameData } = payload || {};

      try {
        let inputTarget = null;

        if (imageBitmap) {
          if (!sharedCanvas || sharedCanvas.width !== imageBitmap.width || sharedCanvas.height !== imageBitmap.height) {
            sharedCanvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
            sharedCtx = sharedCanvas.getContext('2d');
          }
          sharedCtx.drawImage(imageBitmap, 0, 0);
          inputTarget = sharedCanvas;
          // Close transferred ImageBitmap to free memory immediately
          if (typeof imageBitmap.close === 'function') {
            imageBitmap.close();
          }
        } else if (frameData) {
          const { width, height, data } = frameData;
          if (!sharedCanvas || sharedCanvas.width !== width || sharedCanvas.height !== height) {
            sharedCanvas = new OffscreenCanvas(width, height);
            sharedCtx = sharedCanvas.getContext('2d');
          }
          const imgData = new ImageData(new Uint8ClampedArray(data), width, height);
          sharedCtx.putImageData(imgData, 0, 0);
          inputTarget = sharedCanvas;
        }

        if (!inputTarget) {
          self.postMessage({
            type: 'FRAME_PROCESSED',
            hasFace: false,
            match: false,
            error: 'No frame data received'
          });
          return;
        }

        // Perform face detection, landmarks, and descriptor inference in worker thread
        const detection = await self.faceapi
          .detectSingleFace(inputTarget, new self.faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        const hasFace = !!detection;
        let match = false;
        let distance = null;

        if (hasFace && registeredDescriptor && detection.descriptor) {
          try {
            distance = self.faceapi.euclideanDistance(detection.descriptor, registeredDescriptor);
            match = distance < 0.6;
          } catch (compErr) {
            console.error('[Proctoring Worker] Error comparing descriptors:', compErr);
          }
        }

        self.postMessage({
          type: 'FRAME_PROCESSED',
          hasFace,
          match,
          distance
        });
      } catch (procErr) {
        console.error('[Proctoring Worker] Inference error:', procErr);
        self.postMessage({
          type: 'FRAME_PROCESSED',
          hasFace: false,
          match: false,
          error: procErr.message
        });
      }
      break;
    }

    default:
      break;
  }
};
