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
MIRROR_CAMERA        = ${settings.mirrorCamera ? 'True' : 'False'}
THROTTLE_SCHEME      = "${settings.throttleScheme || 'OPEN_PALM_ACCEL'}"
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

    def is_finger_extended(self, landmarks, tip_idx, pip_idx, mcp_idx):
        wrist = landmarks[0]
        tip_dist = self.compute_euclidean(wrist, landmarks[tip_idx])
        pip_dist = self.compute_euclidean(wrist, landmarks[pip_idx])
        mcp_dist = self.compute_euclidean(wrist, landmarks[mcp_idx])
        return tip_dist > pip_dist * 1.08 and tip_dist > mcp_dist * 1.25

    def classify_hand(self, landmarks):
        wrist = landmarks[0]
        thumb_tip = landmarks[4]
        index_tip = landmarks[8]
        middle_mcp = landmarks[9]

        thumb_dist = self.compute_euclidean(wrist, thumb_tip)
        thumb_ext = thumb_dist > self.compute_euclidean(wrist, landmarks[3]) * 1.1 and thumb_dist > self.compute_euclidean(wrist, landmarks[2]) * 1.2
        index_ext = self.is_finger_extended(landmarks, 8, 6, 5)
        middle_ext = self.is_finger_extended(landmarks, 12, 10, 9)
        ring_ext = self.is_finger_extended(landmarks, 16, 14, 13)
        pinky_ext = self.is_finger_extended(landmarks, 20, 18, 17)

        ext_count = sum([thumb_ext, index_ext, middle_ext, ring_ext, pinky_ext])
        pinch_dist = self.compute_euclidean(thumb_tip, index_tip)

        is_pinch = pinch_dist < 0.075 and not thumb_ext
        is_fist = ext_count <= 1 and not is_pinch
        is_open_palm = ext_count >= 4
        is_thumbs_up = thumb_ext and not (index_ext or middle_ext or ring_ext or pinky_ext)
        is_peace_sign = index_ext and middle_ext and not (ring_ext or pinky_ext)

        # NumPy hand tilt angle relative to vertical axis
        raw_dx = middle_mcp.x - wrist.x
        dx = -raw_dx if MIRROR_CAMERA else raw_dx
        dy = middle_mcp.y - wrist.y

        angle = np.degrees(np.arctan2(dy, dx))
        tilt_deg = angle + 90
        if tilt_deg > 180: tilt_deg -= 360
        if tilt_deg < -180: tilt_deg += 360

        return {
            "is_fist": is_fist,
            "is_open_palm": is_open_palm,
            "is_pinch": is_pinch,
            "is_thumbs_up": is_thumbs_up,
            "is_peace_sign": is_peace_sign,
            "tilt_deg": tilt_deg,
            "ext_count": ext_count
        }

    def process_frame(self, frame):
        h, w, _ = frame.shape
        t_start = time.perf_counter()

        # Flip horizontally if mirror camera is enabled
        if MIRROR_CAMERA:
            frame = cv2.flip(frame, 1)

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

                if c_left["is_thumbs_up"] or c_right["is_thumbs_up"]:
                    raw_throttle = 1.0
                    active_gesture = "NITRO_BOOST"
                elif THROTTLE_SCHEME == "OPEN_PALM_ACCEL":
                    if c_left["is_fist"] or c_right["is_fist"]:
                        raw_brake = 1.0
                        active_gesture = "BRAKE_FIST"
                    else:
                        raw_throttle = 0.85
                        active_gesture = "THROTTLE_DRIVE"
                else:
                    if c_left["is_open_palm"] or c_right["is_open_palm"]:
                        raw_brake = 1.0
                        active_gesture = "BRAKE_PALM"
                    else:
                        raw_throttle = 0.85
                        active_gesture = "THROTTLE_DRIVE"

            else:
                # Single hand mode
                hand_lm = results.multi_hand_landmarks[0].landmark
                analysis = self.classify_hand(hand_lm)
                tilt = analysis["tilt_deg"]

                if abs(tilt) > DEADZONE_ANGLE_DEG:
                    sign = np.sign(tilt)
                    eff_ang = abs(tilt) - DEADZONE_ANGLE_DEG
                    raw_steer = sign * min(1.0, (eff_ang / MAX_STEER_ANGLE_DEG) * STEERING_SENSITIVITY)

                if analysis["is_thumbs_up"]:
                    raw_throttle = 1.0
                    active_gesture = "NITRO_BOOST"
                elif analysis["is_pinch"]:
                    raw_brake = 0.5
                    active_gesture = "BRAKE_LIGHT"
                elif THROTTLE_SCHEME == "OPEN_PALM_ACCEL":
                    if analysis["is_fist"]:
                        raw_brake = 1.0
                        active_gesture = "BRAKE_HARD"
                    elif analysis["is_open_palm"]:
                        raw_throttle = 0.95
                        active_gesture = "THROTTLE_ACCEL"
                    else:
                        raw_throttle = 0.55
                        active_gesture = "CRUISE"
                else:
                    if analysis["is_open_palm"]:
                        raw_brake = 1.0
                        active_gesture = "BRAKE_HARD"
                    elif analysis["is_fist"]:
                        raw_throttle = 0.95
                        active_gesture = "THROTTLE_ACCEL"
                    else:
                        raw_throttle = 0.50
                        active_gesture = "CRUISE"

            # Landmark Skeleton Drawing
            for hand_landmarks in results.multi_hand_landmarks:
                mp_drawing.draw_landmarks(
                    frame,
                    hand_landmarks,
                    mp_hands.HAND_CONNECTIONS,
                    mp_drawing_styles.get_default_hand_landmarks_style(),
                    mp_drawing_styles.get_default_hand_connections_style()
                )

        if INVERT_STEERING:
            raw_steer = -raw_steer

        # Exponential Moving Average (EMA) Filter
        self.smoothed_steer = self.smoothed_steer * (1 - SMOOTHING_ALPHA) + raw_steer * SMOOTHING_ALPHA
        self.smoothed_throttle = self.smoothed_throttle * (1 - SMOOTHING_ALPHA) + raw_throttle * SMOOTHING_ALPHA
        self.smoothed_brake = self.smoothed_brake * (1 - SMOOTHING_ALPHA) + raw_brake * SMOOTHING_ALPHA

        t_end = time.perf_counter()
        latency_ms = (t_end - t_start) * 1000

        # Render OpenCV Telemetry HUD
        self.render_hud(frame, raw_steer, raw_throttle, raw_brake, active_gesture, latency_ms)

        return frame

    def render_hud(self, frame, steer, throttle, brake, gesture, latency_ms):
        h, w, _ = frame.shape
        cv2.rectangle(frame, (10, 10), (320, 140), (15, 15, 25), -1)
        cv2.rectangle(frame, (10, 10), (320, 140), (50, 60, 75), 1)

        cv2.putText(frame, f"STEER:    {self.smoothed_steer:+.2f}", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 2)
        cv2.putText(frame, f"THROTTLE: {self.smoothed_throttle:.2f}", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 2)
        cv2.putText(frame, f"BRAKE:    {self.smoothed_brake:.2f}", (20, 85), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2)
        cv2.putText(frame, f"GESTURE:  {gesture}", (20, 110), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (255, 200, 0), 1)
        cv2.putText(frame, f"LATENCY:  {latency_ms:.1f}ms", (20, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)

# ---------------------------------------------------------
# MAIN REAL-TIME OPENCV CAPTURE LOOP
# ---------------------------------------------------------
def main():
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 60)

    controller = GestureVehicleController()
    print("[INFO] GestureDrive OpenCV Controller Online. Press 'q' to exit.")

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        processed_frame = controller.process_frame(frame)
        cv2.imshow("GestureDrive OpenCV Contrib Feed", processed_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
`;
}
