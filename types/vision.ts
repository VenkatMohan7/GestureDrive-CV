export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface HandLandmarksResult {
  landmarks: NormalizedLandmark[][];
  handednesses: { index: number; score: number; categoryName: string; displayName: string }[][];
}

export type GestureType = 
  | 'NONE'
  | 'STEER_LEFT'
  | 'STEER_RIGHT'
  | 'THROTTLE_ACCEL'
  | 'CRUISE'
  | 'BRAKE_HARD'
  | 'BRAKE_LIGHT'
  | 'GEAR_DRIVE'
  | 'GEAR_REVERSE'
  | 'GEAR_PARK'
  | 'NITRO_BOOST';

export type ControlMode = 'DUAL_HAND_WHEEL' | 'SINGLE_HAND_GESTURE' | 'SIMULATOR_TEST';

export type EnvironmentTheme = 'DAY_HIGHWAY' | 'SUNSET_COAST' | 'CYBER_NEON_NIGHT';

export interface VehicleControlInput {
  steering: number;      // -1.0 (full left) to +1.0 (full right)
  throttle: number;      // 0.0 to 1.0
  brake: number;         // 0.0 to 1.0
  gear: 'P' | 'R' | 'N' | 'D' | 'S';
  nitro: boolean;
  activeGesture: GestureType;
  confidence: number;    // 0.0 to 1.0 (e.g., 0.94)
  latencyMs: number;     // e.g. 28.4 ms
  handAngleDeg: number;  // -90 to +90
  handsDetectedCount: number;
}

export interface VisionCalibrationSettings {
  steeringSensitivity: number; // 0.5 to 2.5 (default 1.2)
  deadzoneAngle: number;       // degrees, e.g. 5
  maxSteerAngle: number;       // degrees, e.g. 45
  smoothingFactor: number;     // 0.1 to 0.9 (Exponential moving average)
  invertSteering: boolean;
  throttleThreshold: number;   // finger spread ratio
  brakeThreshold: number;      // fist curl ratio
  showLandmarks: boolean;
  showBoundingBox: boolean;
  showVectorMathOverlay: boolean;
  mirrorCamera: boolean;
}

export interface TelemetryData {
  speedKmh: number;
  rpm: number;
  gear: 'P' | 'R' | 'N' | 'D' | 'S';
  lateralG: number;
  longitudinalG: number;
  distanceTraveledKm: number;
  fuelOrBatteryPct: number;
  collisionWarning: boolean;
  score: number;
  lapTimeSeconds: number;
}

export interface ChallengeMode {
  id: 'FREE_DRIVE' | 'SLALOM_TEST' | 'EMERGENCY_BRAKE' | 'HIGHWAY_OVERTAKE';
  title: string;
  description: string;
  targetMetric: string;
  bestRecord: number | string;
}
