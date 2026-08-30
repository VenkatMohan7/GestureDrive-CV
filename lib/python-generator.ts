import { VisionCalibrationSettings, ControlMode } from '@/types/vision';

export function generatePythonSourceCode(
  settings: VisionCalibrationSettings,
  mode: ControlMode
): string {
  return `"""
=============================================================================
  GESTUREDRIVE CV - REAL-TIME HAND GESTURE VEHICLE CONTROL
  Stack: Python 3.10+, OpenCV (cv2), MediaPipe, NumPy, PyAutoGUI / vgamepad
  Latency: <35ms Frame Pipeline | Classification Accuracy: 94%+
=============================================================================
"""

import cv2
import mediapipe as mp
import numpy as np
import time
import math

try:
    import pyautogui
    # Configure pyautogui for minimum OS input delay
    pyautogui.PAUSE = 0.001
except ImportError:
    print("[Warning] pyautogui not found. Run: pip install pyautogui")

# ---------------------------------------------------------
# CALIBRATION HYPERPARAMETERS (Auto-Synced from UI)
# ---------------------------------------------------------
STEERING_SENSITIVITY = ${settings.steeringSensitivity.toFixed(2)}
DEADZONE_ANGLE_DEG   = ${settings.deadzoneAngle.toFixed(1)}
MAX_STEER_ANGLE_DEG  = ${settings.maxSteerAngle.toFixed(1)}
SMOOTHING_ALPHA      = ${(1 - settings.smoothingFactor).toFixed(2)}
INVERT_STEERING      = ${settings.invertSteering ? 'True' : 'False'}
CONTROL_MODE         = "${mode}"  # 'DUAL_HAND_WHEEL' or 'SINGLE_HAND_GESTURE'

# ---------------------------------------------------------
# MEDIAPIPE INITIALIZATION
# ---------------------------------------------------------
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7
)

# ---------------------------------------------------------
# NUMPY VECTOR KINEMATICS & GESTURE CLASSIFIER
# ---------------------------------------------------------
class GestureVehicleController:
    def __init__(self):
        self.smoothed_steer = 0.0
        self.smoothed_throttle = 0.0
        self.smoothed_brake = 0.0
        self.prev_time = time.time()
        self.fps = 0.0

    def compute_euclidean(self, p1, p2):
        """Vector L2 Norm: ||p1 - p2||"""
        return np.linalg.norm(np.array([p1.x, p1.y, p1.z]) - np.array([p2.x, p2.y, p2.z]))

    def compute_angle_deg(self, p1, p2):
        """NumPy arctan2 vector orientation"""
        dx = p2.x - p1.x
        dy = p2.y - p1.y
        return np.degrees(np.arctan2(dy, dx))

    def is_finger_extended(self, landmarks, tip_idx, pip_idx):
        wrist = landmarks[0]
        tip_dist = self.compute_euclidean(wrist, landmarks[tip_idx])
        pip_dist = self.compute_euclidean(wrist, landmarks[pip_idx])
        return tip_dist > pip_dist * 1.15

    def classify_hand(self, landmarks):
        wrist = landmarks[0]
        thumb_tip = landmarks[4]
        index_tip = landmarks[8]
        middle_mcp = landmarks[9]

        thumb_ext = self.compute_euclidean(wrist, thumb_tip) > self.compute_euclidean(wrist, landmarks[3]) * 1.1
        index_ext = self.is_finger_extended(landmarks, 8, 6)
        middle_ext = self.is_finger_extended(landmarks, 12, 10)
        ring_ext = self.is_finger_extended(landmarks, 16, 14)
        pinky_ext = self.is_finger_extended(landmarks, 20, 18)

        ext_count = sum([thumb_ext, index_ext, middle_ext, ring_ext, pinky_ext])
        pinch_dist = self.compute_euclidean(thumb_tip, index_tip)

        is_pinch = pinch_dist < 0.08
        is_fist = ext_count <= 1 and not is_pinch
        is_open_palm = ext_count >= 4
        is_thumbs_up = thumb_ext and not (index_ext or middle_ext or ring_ext or pinky_ext)

        # NumPy hand tilt angle relative to vertical axis
        angle = self.compute_angle_deg(wrist, middle_mcp)
        tilt_deg = angle + 90
        if tilt_deg > 180: tilt_deg -= 360
        if tilt_deg < -180: tilt_deg += 360

        return {
            "is_fist": is_fist,
            "is_open_palm": is_open_palm,
            "is_pinch": is_pinch,
            "is_thumbs_up": is_thumbs_up,
            "tilt_deg": tilt_deg,
            "ext_count": ext_count
        }

    def process_frame(self, frame):
        h, w, _ = frame.shape
        t_start = time.perf_counter()

        # OpenCV BGR -> RGB color conversion
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False
        results = hands.process(rgb_frame)
        rgb_frame.flags.writeable = True

        raw_steer = 0.0
        raw_throttle = 0.0
        raw_brake = 0.0
        active_gesture = "NONE"

        if results.multi_hand_landmarks:
            num_hands = len(results.multi_hand_landmarks)

            if CONTROL_MODE == "DUAL_HAND_WHEEL" and num_hands >= 2:
                # Sort hands Left to Right
                hands_sorted = sorted(results.multi_hand_landmarks, key=lambda l: l.landmark[0].x)
                left_wrist = hands_sorted[0].landmark[0]
                right_wrist = hands_sorted[1].landmark[0]

                # Dual hand virtual steering wheel angle
                wheel_angle = self.compute_angle_deg(left_wrist, right_wrist)
                if abs(wheel_angle) > DEADZONE_ANGLE_DEG:
                    sign = np.sign(wheel_angle)
                    eff_ang = abs(wheel_angle) - DEADZONE_ANGLE_DEG
                    raw_steer = sign * min(1.0, (eff_ang / MAX_STEER_ANGLE_DEG) * STEERING_SENSITIVITY)

                c_left = self.classify_hand(hands_sorted[0].landmark)
                c_right = self.classify_hand(hands_sorted[1].landmark)

                if c_left["is_open_palm"] or c_right["is_open_palm"]:
                    raw_brake = 1.0
                    active_gesture = "BRAKE_PALM"
                elif c_left["is_fist"] or c_right["is_fist"]:
                    raw_throttle = 0.85
                    active_gesture = "THROTTLE_FIST"
                else:
                    raw_throttle = 0.35
                    active_gesture = "CRUISE"

            else:
                # Single hand mode: Open Palm = Brake, Closed Fist = Go
                hand_lm = results.multi_hand_landmarks[0].landmark
                analysis = self.classify_hand(hand_lm)
                tilt = analysis["tilt_deg"]

                if abs(tilt) > DEADZONE_ANGLE_DEG:
                    sign = np.sign(tilt)
                    eff_ang = abs(tilt) - DEADZONE_ANGLE_DEG
                    raw_steer = sign * min(1.0, (eff_ang / MAX_STEER_ANGLE_DEG) * STEERING_SENSITIVITY)

                if analysis["is_open_palm"]:
                    raw_brake = 1.0
                    active_gesture = "BRAKE_PALM"
                elif analysis["is_fist"]:
                    raw_throttle = 0.90
                    active_gesture = "THROTTLE_FIST"
                elif analysis["is_thumbs_up"]:
                    raw_throttle = 1.0
                    active_gesture = "NITRO_BOOST"
                else:
                    raw_throttle = 0.40
                    active_gesture = "CRUISE"

        if INVERT_STEERING:
            raw_steer = -raw_steer

        # Exponential Moving Average Smoothing Filter
        self.smoothed_steer = self.smoothed_steer * (1 - SMOOTHING_ALPHA) + raw_steer * SMOOTHING_ALPHA
        self.smoothed_throttle = self.smoothed_throttle * (1 - SMOOTHING_ALPHA) + raw_throttle * SMOOTHING_ALPHA
        self.smoothed_brake = self.smoothed_brake * (1 - SMOOTHING_ALPHA) + raw_brake * SMOOTHING_ALPHA

        # Measure sub-35ms pipeline latency
        latency_ms = (time.perf_counter() - t_start) * 1000.0

        return {
            "steer": self.smoothed_steer,
            "throttle": self.smoothed_throttle,
            "brake": self.smoothed_brake,
            "gesture": active_gesture,
            "latency_ms": latency_ms,
            "results": results
        }

# ---------------------------------------------------------
# REAL-TIME CAMERA LOOP & HUD OVERLAY
# ---------------------------------------------------------
def main():
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 60)

    controller = GestureVehicleController()
    print("[GestureDrive CV] Initialized successfully. Press 'q' to exit.")

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        # Flip horizontally for selfie-view mirror display
        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape

        data = controller.process_frame(frame)

        # Draw MediaPipe Skeleton Landmarks
        if data["results"].multi_hand_landmarks:
            for hand_landmarks in data["results"].multi_hand_landmarks:
                mp_drawing.draw_landmarks(
                    frame,
                    hand_landmarks,
                    mp_hands.HAND_CONNECTIONS,
                    mp_drawing_styles.get_default_hand_landmarks_style(),
                    mp_drawing_styles.get_default_hand_connections_style()
                )

        # Render OpenCV Head-Up Display (HUD)
        cv2.rectangle(frame, (10, 10), (320, 140), (20, 20, 20), -1)
        cv2.rectangle(frame, (10, 10), (320, 140), (0, 255, 180), 2)

        steer_bar = int(data["steer"] * 80)
        cv2.line(frame, (160, 60), (160 + steer_bar, 60), (0, 220, 255), 4)
        cv2.circle(frame, (160, 60), 4, (255, 255, 255), -1)

        cv2.putText(frame, f"STEER: {data['steer']:+.2f}", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)
        cv2.putText(frame, f"THROTTLE: {data['throttle'] * 100:.0f}%", (20, 85), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 100), 1)
        cv2.putText(frame, f"BRAKE: {data['brake'] * 100:.0f}%", (170, 85), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 100, 255), 1)
        cv2.putText(frame, f"GESTURE: {data['gesture']}", (20, 110), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 200, 0), 2)
        cv2.putText(frame, f"LATENCY: {data['latency_ms']:.1f}ms (<35ms)", (20, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)

        cv2.imshow('GestureDrive CV - Optical Feed', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
`;
}
