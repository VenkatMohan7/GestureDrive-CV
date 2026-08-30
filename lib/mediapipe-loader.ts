'use client';

import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let handLandmarkerInstance: HandLandmarker | null = null;
let isInitializing = false;

export async function initHandLandmarker(): Promise<HandLandmarker> {
  if (handLandmarkerInstance) {
    return handLandmarkerInstance;
  }

  if (isInitializing) {
    // Wait for existing initialization promise
    while (isInitializing) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (handLandmarkerInstance) return handLandmarkerInstance;
  }

  isInitializing = true;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    handLandmarkerInstance = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    return handLandmarkerInstance;
  } catch (error) {
    console.warn('Failed to load GPU delegate for MediaPipe, retrying with CPU:', error);
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      handLandmarkerInstance = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      return handLandmarkerInstance;
    } catch (cpuErr) {
      console.error('Failed to initialize MediaPipe HandLandmarker:', cpuErr);
      throw cpuErr;
    }
  } finally {
    isInitializing = false;
  }
}
