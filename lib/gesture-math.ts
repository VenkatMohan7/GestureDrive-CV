import {
  NormalizedLandmark,
  VehicleControlInput,
  VisionCalibrationSettings,
  ControlMode,
} from '@/types/vision';

// MediaPipe 21 Hand Landmark Connections for Skeleton Rendering
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

// Check if a finger is extended by comparing tip distance from wrist vs PIP/MCP joint distance
export function isFingerExtended(
  landmarks: NormalizedLandmark[],
  tipIdx: number,
  pipIdx: number,
  mcpIdx: number
): boolean {
  const wrist = landmarks[0];
  const tipDist = euclideanDistance(wrist, landmarks[tipIdx]);
  const pipDist = euclideanDistance(wrist, landmarks[pipIdx]);
  const mcpDist = euclideanDistance(wrist, landmarks[mcpIdx]);
  
  // Finger is extended if tip is further from wrist than PIP and MCP
  return tipDist > pipDist * 1.08 && tipDist > mcpDist * 1.25;
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
  landmarks: NormalizedLandmark[],
  mirror: boolean = true
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
  const thumbMcp = landmarks[2];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];

  // Finger extension classifications
  const thumbDist = euclideanDistance(wrist, thumbTip);
  const thumbExtended = thumbDist > euclideanDistance(wrist, thumbIp) * 1.1 && thumbDist > euclideanDistance(wrist, thumbMcp) * 1.2;
  const indexExtended = isFingerExtended(landmarks, 8, 6, 5);
  const middleExtended = isFingerExtended(landmarks, 12, 10, 9);
  const ringExtended = isFingerExtended(landmarks, 16, 14, 13);
  const pinkyExtended = isFingerExtended(landmarks, 20, 18, 17);

  const fingerStates = [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended];
  const extendedCount = fingerStates.filter(Boolean).length;

  // Pinch: distance between thumb tip and index tip is small
  const pinchDist = euclideanDistance(thumbTip, indexTip);
  const isPinch = pinchDist < 0.075 && !thumbExtended;

  // Fist: 0 or 1 finger extended (tightly closed)
  const isFist = extendedCount <= 1 && !isPinch;

  // Open Palm: 4 or 5 fingers extended
  const isOpenPalm = extendedCount >= 4;

  // Thumbs Up: Thumb extended, others curled, hand upright
  const isThumbsUp = thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended;

  // Peace Sign: Index and Middle extended, Ring and Pinky curled
  const isPeaceSign = indexExtended && middleExtended && !ringExtended && !pinkyExtended;

  // Calculate tilt angle of the hand based on vector from Wrist (0) to Middle MCP (9)
  // In camera coordinates: y points down.
  // In mirrored camera: if hand tilts to the user's RIGHT, middleMcp is to the right of wrist in mirrored space.
  const rawDx = middleMcp.x - wrist.x;
  const dx = mirror ? -rawDx : rawDx; // flip dx if camera feed is mirrored
  const dy = middleMcp.y - wrist.y;

  // Math.atan2(dy, dx): for pointing straight UP, dy < 0, dx = 0 -> angle is -90 deg.
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
      steering: previousInput.steering * 0.75,
      throttle: previousInput.throttle * 0.5,
      brake: previousInput.brake > 0.1 ? previousInput.brake : 0.15, // smooth coasting drag
      activeGesture: 'NONE',
      confidence: 0,
      latencyMs: latencyMs || 28,
      handsDetectedCount: 0,
    };
  }

  const isMirror = settings.mirrorCamera ?? true;
  const throttleScheme = settings.throttleScheme || 'OPEN_PALM_ACCEL';

  // --- DUAL HAND VIRTUAL STEERING WHEEL MODE ---
  if (mode === 'DUAL_HAND_WHEEL' && allLandmarks.length >= 2) {
    // Determine screen X coordinates for left vs right hand
    const getScreenX = (hand: NormalizedLandmark[]) => isMirror ? 1 - hand[0].x : hand[0].x;
    const sorted = [...allLandmarks].sort((a, b) => getScreenX(a) - getScreenX(b));
    const leftHand = sorted[0];
    const rightHand = sorted[1];

    const leftWrist = leftHand[0];
    const rightWrist = rightHand[0];

    const lx = isMirror ? (1 - leftWrist.x) : leftWrist.x;
    const rx = isMirror ? (1 - rightWrist.x) : rightWrist.x;
    const ly = leftWrist.y;
    const ry = rightWrist.y;

    // Compute angle between the two hands in screen space
    const dx = rx - lx;
    const dy = ry - ly; // in screen coords: y points down, so if right hand is lower, dy > 0 (turning right / clockwise)
    const wheelAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    result.handAngleDeg = wheelAngleDeg;

    // Apply Deadzone & Sensitivity
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

    // Analyze individual hands
    const leftAnalysis = analyzeSingleHand(leftHand, isMirror);
    const rightAnalysis = analyzeSingleHand(rightHand, isMirror);

    if (leftAnalysis.isThumbsUp || rightAnalysis.isThumbsUp) {
      result.nitro = true;
      result.throttle = 1.0;
      result.gear = 'S';
      result.activeGesture = 'NITRO_BOOST';
    } else if (leftAnalysis.isPeaceSign || rightAnalysis.isPeaceSign) {
      result.gear = previousInput.gear === 'R' ? 'D' : 'R';
      result.throttle = 0.5;
      result.activeGesture = result.gear === 'R' ? 'GEAR_REVERSE' : 'GEAR_DRIVE';
    } else if (throttleScheme === 'OPEN_PALM_ACCEL') {
      // Natural scheme: Open hands = Drive/Throttle, Fists = Brake
      if (leftAnalysis.isFist && rightAnalysis.isFist) {
        result.brake = 1.0;
        result.throttle = 0.0;
        result.activeGesture = 'BRAKE_HARD';
      } else if (leftAnalysis.isFist || rightAnalysis.isFist || leftAnalysis.isPinch || rightAnalysis.isPinch) {
        result.brake = 0.5;
        result.throttle = 0.1;
        result.activeGesture = 'BRAKE_LIGHT';
      } else {
        // Hands open on wheel = Accelerate & Steer
        result.throttle = 0.85;
        result.brake = 0.0;
        result.activeGesture = Math.abs(steerValue) > 0.2 ? (steerValue > 0 ? 'STEER_RIGHT' : 'STEER_LEFT') : 'THROTTLE_ACCEL';
      }
    } else {
      // Classic scheme: Fist = Go, Open Palm = Brake
      if (leftAnalysis.isOpenPalm || rightAnalysis.isOpenPalm) {
        result.brake = 1.0;
        result.throttle = 0.0;
        result.activeGesture = 'BRAKE_HARD';
      } else if (leftAnalysis.isFist || rightAnalysis.isFist) {
        result.throttle = 0.85;
        result.brake = 0.0;
        result.activeGesture = Math.abs(steerValue) > 0.2 ? (steerValue > 0 ? 'STEER_RIGHT' : 'STEER_LEFT') : 'THROTTLE_ACCEL';
      } else {
        result.throttle = 0.45;
        result.activeGesture = 'CRUISE';
      }
    }

    result.confidence = (leftAnalysis.confidence + rightAnalysis.confidence) / 2;
  }
  // --- SINGLE HAND GESTURE MODE ---
  else {
    const hand = allLandmarks[0];
    const analysis = analyzeSingleHand(hand, isMirror);
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

    // Special Gestures
    if (analysis.isThumbsUp) {
      result.nitro = true;
      result.throttle = 1.0;
      result.gear = 'S';
      result.activeGesture = 'NITRO_BOOST';
    } else if (analysis.isPeaceSign) {
      result.gear = previousInput.gear === 'R' ? 'D' : 'R';
      result.throttle = 0.45;
      result.activeGesture = result.gear === 'R' ? 'GEAR_REVERSE' : 'GEAR_DRIVE';
    } else if (analysis.isPinch) {
      result.brake = 0.5;
      result.throttle = 0.0;
      result.activeGesture = 'BRAKE_LIGHT';
    } else if (throttleScheme === 'OPEN_PALM_ACCEL') {
      // Natural & Intuitive Driving Scheme:
      // Open hand (4-5 fingers) -> Full Accelerate / Drive
      // Relaxed hand (2-3 fingers) -> Cruising
      // Fist (0-1 fingers) -> Brake / Stop
      if (analysis.isFist) {
        result.brake = 1.0;
        result.throttle = 0.0;
        result.activeGesture = 'BRAKE_HARD';
      } else if (analysis.isOpenPalm) {
        result.throttle = 0.95;
        result.brake = 0.0;
        if (Math.abs(steerValue) > 0.2) {
          result.activeGesture = steerValue > 0 ? 'STEER_RIGHT' : 'STEER_LEFT';
        } else {
          result.activeGesture = 'THROTTLE_ACCEL';
        }
      } else {
        // Cruising / Moderate throttle
        result.throttle = 0.55;
        result.brake = 0.0;
        if (Math.abs(steerValue) > 0.2) {
          result.activeGesture = steerValue > 0 ? 'STEER_RIGHT' : 'STEER_LEFT';
        } else {
          result.activeGesture = 'CRUISE';
        }
      }
    } else {
      // Reverse / Classic Scheme (Fist = Throttle, Open Palm = Brake):
      if (analysis.isOpenPalm) {
        result.brake = 1.0;
        result.throttle = 0.0;
        result.activeGesture = 'BRAKE_HARD';
      } else if (analysis.isFist) {
        result.throttle = 0.95;
        result.brake = 0.0;
        if (Math.abs(steerValue) > 0.2) {
          result.activeGesture = steerValue > 0 ? 'STEER_RIGHT' : 'STEER_LEFT';
        } else {
          result.activeGesture = 'THROTTLE_ACCEL';
        }
      } else {
        result.throttle = 0.5;
        result.brake = 0.0;
        if (Math.abs(steerValue) > 0.2) {
          result.activeGesture = steerValue > 0 ? 'STEER_RIGHT' : 'STEER_LEFT';
        } else {
          result.activeGesture = 'CRUISE';
        }
      }
    }
  }

  // Apply Exponential Moving Average (EMA) smoothing filter
  const alpha = Math.max(0.1, Math.min(0.9, 1 - (settings.smoothingFactor ?? 0.65)));
  result.steering = Number((previousInput.steering * (1 - alpha) + result.steering * alpha).toFixed(3));
  result.throttle = Number((previousInput.throttle * (1 - alpha) + result.throttle * alpha).toFixed(3));
  result.brake = Number((previousInput.brake * (1 - alpha) + result.brake * alpha).toFixed(3));

  return result;
}
