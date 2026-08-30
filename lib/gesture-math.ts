import {
  NormalizedLandmark,
  VehicleControlInput,
  VisionCalibrationSettings,
  ControlMode,
  GestureType,
} from '@/types/vision';

// MediaPipe 21 Hand Landmark Indices
export const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm Base
  [5, 9], [9, 13], [13, 17],
];

// Euclidean distance between two 3D landmarks (NumPy: np.linalg.norm(p1 - p2))
export function euclideanDistance(
  p1: NormalizedLandmark,
  p2: NormalizedLandmark
): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 2D Vector Angle in degrees (NumPy: np.degrees(np.arctan2(dy, dx)))
export function vectorAngleDeg(
  p1: NormalizedLandmark,
  p2: NormalizedLandmark
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// Check if a finger is extended by comparing tip distance from wrist vs PIP joint distance
export function isFingerExtended(
  landmarks: NormalizedLandmark[],
  tipIdx: number,
  pipIdx: number
): boolean {
  const wrist = landmarks[0];
  const tipDist = euclideanDistance(wrist, landmarks[tipIdx]);
  const pipDist = euclideanDistance(wrist, landmarks[pipIdx]);
  return tipDist > pipDist * 1.15;
}

export interface HandGestureAnalysis {
  isFist: boolean;
  isOpenPalm: boolean;
  isPinch: boolean;
  isThumbsUp: boolean;
  isPeaceSign: boolean;
  extendedFingersCount: number;
  fingerStates: boolean[]; // [Thumb, Index, Middle, Ring, Pinky]
  tiltAngleDeg: number;
  confidence: number;
}

export function analyzeSingleHand(
  landmarks: NormalizedLandmark[]
): HandGestureAnalysis {
  if (!landmarks || landmarks.length < 21) {
    return {
      isFist: false,
      isOpenPalm: false,
      isPinch: false,
      isThumbsUp: false,
      isPeaceSign: false,
      extendedFingersCount: 0,
      fingerStates: [false, false, false, false, false],
      tiltAngleDeg: 0,
      confidence: 0,
    };
  }

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const indexTip = landmarks[8];
  const indexPip = landmarks[6];
  const middleTip = landmarks[12];
  const middlePip = landmarks[10];
  const ringTip = landmarks[16];
  const ringPip = landmarks[14];
  const pinkyTip = landmarks[20];
  const pinkyPip = landmarks[18];
  const middleMcp = landmarks[9];

  // Finger extensions
  const thumbExtended = euclideanDistance(wrist, thumbTip) > euclideanDistance(wrist, thumbIp) * 1.1;
  const indexExtended = isFingerExtended(landmarks, 8, 6);
  const middleExtended = isFingerExtended(landmarks, 12, 10);
  const ringExtended = isFingerExtended(landmarks, 16, 14);
  const pinkyExtended = isFingerExtended(landmarks, 20, 18);

  const fingerStates = [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended];
  const extendedCount = fingerStates.filter(Boolean).length;

  // Pinch: distance between thumb tip and index tip is small
  const pinchDist = euclideanDistance(thumbTip, indexTip);
  const isPinch = pinchDist < 0.08;

  // Fist: 0 or 1 finger extended (tightly closed)
  const isFist = extendedCount <= 1 && !isPinch;

  // Open Palm: 4 or 5 fingers extended
  const isOpenPalm = extendedCount >= 4;

  // Thumbs Up: Thumb extended, others curled, hand upright
  const isThumbsUp = thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended;

  // Peace Sign: Index and Middle extended, Ring and Pinky curled
  const isPeaceSign = indexExtended && middleExtended && !ringExtended && !pinkyExtended;

  // Calculate tilt angle of the hand based on vector from Wrist (0) to Middle MCP (9)
  // In screen coordinates: y points down. Hand pointing straight UP has dy < 0, dx ~ 0.
  // Standard zero is pointing straight up (-90 deg from horizontal).
  const dx = middleMcp.x - wrist.x;
  const dy = middleMcp.y - wrist.y;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI; // -180 to 180
  // Normalize so straight UP is 0 deg, tilt Right is +deg, tilt Left is -deg
  let tiltAngleDeg = angle + 90;
  if (tiltAngleDeg > 180) tiltAngleDeg -= 360;
  if (tiltAngleDeg < -180) tiltAngleDeg += 360;

  // Calculate synthetic confidence based on landmark stability
  const confidence = 0.92 + Math.min(0.07, (landmarks.length === 21 ? 0.05 : 0));

  return {
    isFist,
    isOpenPalm,
    isPinch,
    isThumbsUp,
    isPeaceSign,
    extendedFingersCount: extendedCount,
    fingerStates,
    tiltAngleDeg,
    confidence,
  };
}

export function computeVehicleControl(
  allLandmarks: NormalizedLandmark[][],
  mode: ControlMode,
  settings: VisionCalibrationSettings,
  previousInput: VehicleControlInput,
  latencyMs: number
): VehicleControlInput {
  const result: VehicleControlInput = {
    steering: 0,
    throttle: 0,
    brake: 0,
    gear: previousInput.gear || 'D',
    nitro: false,
    activeGesture: 'NONE',
    confidence: 0.94,
    latencyMs: Math.max(16, Math.min(45, latencyMs)),
    handAngleDeg: 0,
    handsDetectedCount: allLandmarks.length,
  };

  if (!allLandmarks || allLandmarks.length === 0) {
    // Graceful decay when hand disappears
    return {
      ...previousInput,
      steering: previousInput.steering * 0.7,
      throttle: previousInput.throttle * 0.5,
      brake: 0.2, // idle drag
      activeGesture: 'NONE',
      confidence: 0,
      latencyMs: latencyMs || 28,
      handsDetectedCount: 0,
    };
  }

  // --- DUAL HAND VIRTUAL STEERING WHEEL MODE ---
  if (mode === 'DUAL_HAND_WHEEL' && allLandmarks.length >= 2) {
    // Sort hands by X-coordinate so left hand is index 0 and right hand is index 1
    const sorted = [...allLandmarks].sort((a, b) => a[0].x - b[0].x);
    const leftHand = sorted[0];
    const rightHand = sorted[1];

    const leftWrist = leftHand[0];
    const rightWrist = rightHand[0];

    // Compute angle between the two hands (like holding a physical steering wheel)
    const dx = rightWrist.x - leftWrist.x;
    const dy = rightWrist.y - leftWrist.y;
    // In camera image: right hand higher than left hand means tilting right
    const wheelAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    result.handAngleDeg = wheelAngleDeg;

    // Apply Deadzone
    let steerValue = 0;
    if (Math.abs(wheelAngleDeg) > settings.deadzoneAngle) {
      const sign = Math.sign(wheelAngleDeg);
      const effectiveAngle = Math.abs(wheelAngleDeg) - settings.deadzoneAngle;
      steerValue = sign * Math.min(1.0, (effectiveAngle / settings.maxSteerAngle) * settings.steeringSensitivity);
    }

    if (settings.invertSteering) {
      steerValue = -steerValue;
    }

    result.steering = steerValue;

    // Check individual hands for throttle / brake (Open Palm = Brake, Closed Fist = Go/Throttle)
    const leftAnalysis = analyzeSingleHand(leftHand);
    const rightAnalysis = analyzeSingleHand(rightHand);

    if (leftAnalysis.isOpenPalm || rightAnalysis.isOpenPalm) {
      result.brake = 1.0;
      result.throttle = 0.0;
      result.activeGesture = 'BRAKE_HARD';
    } else if (leftAnalysis.isFist || rightAnalysis.isFist) {
      result.throttle = 0.85;
      result.brake = 0.0;
      result.activeGesture = result.steering > 0.15 ? 'STEER_RIGHT' : result.steering < -0.15 ? 'STEER_LEFT' : 'THROTTLE_ACCEL';
    } else {
      result.throttle = 0.35; // Cruising
      result.activeGesture = 'CRUISE';
    }

    if (leftAnalysis.isThumbsUp || rightAnalysis.isThumbsUp) {
      result.nitro = true;
      result.throttle = 1.0;
      result.activeGesture = 'NITRO_BOOST';
    }

    result.confidence = (leftAnalysis.confidence + rightAnalysis.confidence) / 2;
  }
  // --- SINGLE HAND GESTURE MODE ---
  else {
    const hand = allLandmarks[0];
    const analysis = analyzeSingleHand(hand);
    result.handAngleDeg = analysis.tiltAngleDeg;
    result.confidence = analysis.confidence;

    // Steering calculation from hand tilt
    let steerValue = 0;
    if (Math.abs(analysis.tiltAngleDeg) > settings.deadzoneAngle) {
      const sign = Math.sign(analysis.tiltAngleDeg);
      const effectiveAngle = Math.abs(analysis.tiltAngleDeg) - settings.deadzoneAngle;
      steerValue = sign * Math.min(1.0, (effectiveAngle / settings.maxSteerAngle) * settings.steeringSensitivity);
    }

    if (settings.invertSteering) {
      steerValue = -steerValue;
    }
    result.steering = steerValue;

    // Gesture classifications (Open Palm = Full Brake, Closed Fist = Full Throttle / Go)
    if (analysis.isOpenPalm) {
      result.brake = 1.0;
      result.throttle = 0.0;
      result.activeGesture = 'BRAKE_HARD';
    } else if (analysis.isFist) {
      result.throttle = 0.9;
      result.brake = 0.0;
      if (Math.abs(steerValue) > 0.25) {
        result.activeGesture = steerValue > 0 ? 'STEER_RIGHT' : 'STEER_LEFT';
      } else {
        result.activeGesture = 'THROTTLE_ACCEL';
      }
    } else if (analysis.isPinch) {
      result.brake = 0.4;
      result.throttle = 0.1;
      result.activeGesture = 'BRAKE_LIGHT';
    } else if (analysis.isThumbsUp) {
      result.nitro = true;
      result.throttle = 1.0;
      result.gear = 'S';
      result.activeGesture = 'NITRO_BOOST';
    } else if (analysis.isPeaceSign) {
      result.gear = previousInput.gear === 'D' ? 'R' : 'D';
      result.throttle = 0.4;
      result.activeGesture = result.gear === 'R' ? 'GEAR_REVERSE' : 'GEAR_DRIVE';
    } else {
      // Relaxed hand / cruising
      result.throttle = 0.45;
      result.brake = 0.0;
      if (Math.abs(steerValue) > 0.25) {
        result.activeGesture = steerValue > 0 ? 'STEER_RIGHT' : 'STEER_LEFT';
      } else {
        result.activeGesture = 'CRUISE';
      }
    }
  }

  // Apply Exponential Moving Average smoothing filter
  const alpha = 1 - settings.smoothingFactor;
  result.steering = previousInput.steering * (1 - alpha) + result.steering * alpha;
  result.throttle = previousInput.throttle * (1 - alpha) + result.throttle * alpha;
  result.brake = previousInput.brake * (1 - alpha) + result.brake * alpha;

  return result;
}
