# 🏎️ GestureDrive CV — Contactless Computer Vision Vehicle Control

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-15.4.9-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks_Vision_v1.0-007FFF?style=for-the-badge&logo=google&logoColor=white)](https://developers.google.com/mediapipe)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1.11-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Web Audio API](https://img.shields.io/badge/Web_Audio-Procedural_Synth-FF5722?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

<p align="center">
  <strong>Transform your webcam into a high-precision, sub-30ms contactless steering wheel & cockpit controller.</strong><br>
  Powered by MediaPipe 21-3D landmark detection, vector kinematics, exponential moving average filters, an arcade physics engine, procedural sound synthesis, and an exportable Python game bridge.
</p>

[**Explore Features**](#-key-features) • [**Watch Demo**](#-video-demonstration) • [**Gesture Controls**](#-gesture-control-matrix) • [**Quick Start**](#-getting-started) • [**Python Bridge**](#-standalone-python-game-bridge)

---

</div>

## 🎥 Video Demonstration

Check out **GestureDrive CV** in action with real-time hand landmark tracking, zero-latency steering angle calculations, dynamic throttle/brake response, and pseudo-3D obstacle avoidance:



https://github.com/user-attachments/assets/0a4a30ca-7bdb-45c0-b3e0-09e33de2bc0c



<div align="center">
  <video src="Test.mp4" controls="controls" width="100%" style="border-radius: 12px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4); margin: 16px 0;">
    Your browser does not support the video tag. You can <a href="./Test.mp4">download and watch Test.mp4 here</a>.
  </video>
  <p><em>Demo recording featuring real-time 3D hand tracking, steering physics, dynamic traffic collision radar, and instant gesture recognition.</em></p>
</div>

---

## ⚡ Key Features

### 🖐️ 1. Ultra-Low Latency Computer Vision Pipeline
- **MediaPipe Tasks Vision 3D Hand Tracking**: Tracks 21 hand landmarks per hand at up to 60 FPS in real-time right inside the browser.
- **Euclidean Vector Kinematics**: Computes palm tilt angles, joint distance ratios, finger extension states, and hand centroid velocity.
- **Exponential Moving Average (EMA) Smoothing**: Eliminates jitter and noise with customizable smoothing filters and deadzone compensation.
- **Sub-30ms Pipeline Latency**: Optimized WebAssembly (WASM) and WebGL acceleration ensure instant response times.

### 🎮 2. Dual & Single Hand Control Modes
- **Dual-Hand Virtual Steering Wheel**: Emulates an authentic steering wheel in mid-air using geometric angles between both wrists and index knuckles.
- **Single-Hand Gesture Cockpit**: Complete one-handed driving — wrist rotation for steering, open palm for progressive throttle, closed fist for braking, pinch gesture for Nitro Boost, and peace sign for Cruise Control.
- **Full Fallback Controls**: Seamless keyboard controls (`W/A/S/D` or Arrow keys, `Space` for Handbrake, `Shift` for Nitro) for accessibility and testing.

### 🏎️ 3. 60 FPS HTML5 Canvas Physics Engine
- **Pseudo-3D Retro-Futuristic Road Renderer**: Dynamic perspective projection with curved horizons, dynamic hill elevation, and parallax scenery.
- **Realistic Kinematics & Powertrain**: Longitudinal/lateral G-force simulation, tire friction drift models, gear shifting dynamics (P, R, N, D, S), and RPM curves.
- **Autonomous Traffic AI & Obstacle Slalom**: Smart NPC vehicles with lane-changing logic and randomized slalom cones.

### 📊 4. Telemetry Dashboard & Heads-Up Display (HUD)
- **Digital Cockpit Gauges**: Real-time Speedometer (km/h & mph toggle), Tachometer (RPM redline alerts), Gear indicator, and G-Force bubble accelerometer.
- **Collision Avoidance Radar**: Proximity alerts with warning chimes when approaching traffic or track boundaries.
- **Live Performance Metrics**: Real-time FPS counter, camera latency tracker, detection confidence percentage, and trip computer.

### 🔊 5. Procedural Web Audio Engine
- **Synthesizer Engine Audio**: Pure Web Audio API procedural synthesis with zero external audio assets.
- **Dynamic RPM Pitch Modulation**: Custom harmonic oscillators that rev up and down matching vehicle throttle and gear shifts.
- **Real-Time Sound Effects**: Realistic tire screeches during hard drifts, nitro boost whoosh, horn, collision impact crunches, and alert pings.

### ⚙️ 6. Real-Time Calibration Matrix
- **Interactive Hyperparameter Tuning**: Adjust steering sensitivity (0.5x – 2.5x), deadzone angle, maximum steer threshold, and smoothing alpha.
- **Visual Vector Overlays**: Toggle skeleton landmarks, bounding boxes, angle vectors, and camera mirroring in real time.
- **Custom Throttle Schemes**: Choose between *Open-Palm Acceleration* or *Fist-Throttle Acceleration*.

### 🏆 7. Gamified Driving Challenges
- **Free Drive Mode**: Infinite cruising with dynamic weather and traffic.
- **Slalom Cones Challenge**: Test precision steering through high-speed obstacle courses with combo multipliers.
- **Emergency Brake Test**: Measure reaction time from 100 km/h to full stop in milliseconds.
- **Highway Overtake**: High-speed traffic weaving with score milestones and celebration confetti.

### 🐍 8. Exportable Standalone Python Game Bridge
- **Drive Any PC Racing Game**: Instantly export a ready-to-run Python script (`GestureDrive-CV.py`) using OpenCV, MediaPipe, NumPy, and PyAutoGUI / `vgamepad`.
- **Game Compatibility**: Play *Forza Horizon*, *Need for Speed*, *Assetto Corsa*, *Trackmania*, *Asphalt*, and *Euro Truck Simulator* using your webcam!

---

## 🕹️ Gesture Control Matrix

### Single-Hand Mode (`SINGLE_HAND_GESTURE`)

| Gesture | Visual | Vehicle Action | Telemetry Trigger |
| :--- | :---: | :--- | :--- |
| **Tilt Hand Left / Right** | 🫲 / 🫱 | Precision Steering ($-45^\circ \to +45^\circ$) | Dynamic Steer Angle ($-1.0 \to +1.0$) |
| **Open Flat Palm (5 Fingers)** | 🖐️ | Progressive Throttle / Acceleration | Throttle $0\% \to 100\%$, RPM Spool |
| **Closed Tight Fist** | ✊ | Hydraulic Braking & Brake Lights | Brake $0\% \to 100\%$, Deceleration Gs |
| **Index + Thumb Pinch** | 🤏 | **NITRO BOOST** (Instant Max Speed) | Nitro Burn, Speed Multiplier |
| **Thumbs Up** | 👍 | Shift into **Reverse Gear (R)** | Reverse Powertrain Engaged |
| **Peace Sign (V-Sign)** | ✌️ | **Cruise Control Lock** | Speed Lock Active |

### Dual-Hand Mode (`DUAL_HAND_WHEEL`)

| Gesture Configuration | Visual | Vehicle Action |
| :--- | :---: | :--- |
| **Both Hands in Mid-Air** | 👐 | Forms Virtual Steering Wheel |
| **Left Hand Down, Right Hand Up** | 🔄 | Hard Right Steer |
| **Left Hand Up, Right Hand Down** | 🔄 | Hard Left Steer |
| **Both Hands Open** | 🖐️ 🖐️ | Full Acceleration |
| **Both Hands Clenched (Fists)** | ✊ ✊ | Emergency Brake |

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    A[Webcam Feed 60 FPS] --> B[MediaPipe Tasks Vision WASM]
    B --> C[21 3D Landmark Extractor]
    
    subgraph Kinematics & Gesture Engine
        C --> D[Euclidean Distance & Joint Angle Math]
        D --> E[Palm Tilt & Finger State Classifier]
        E --> F[Exponential Moving Average Smoothing]
        F --> G[Deadzone & Sensitivity Calibration]
    end
    
    subgraph Core Output Systems
        G --> H[Canvas Pseudo-3D Driving Engine]
        G --> I[Procedural Web Audio Engine]
        G --> J[HUD & Dashboard Telemetry]
        G --> K[Python Gamepad Bridge Exporter]
    end
    
    H --> L[Collision Radar & Obstacle Physics]
    I --> M[Dynamic RPM Sound & Tire Screech]
    J --> N[Speedometer / G-Force / Lap Times]
    K --> O[PyAutoGUI / vgamepad PC Game Control]
```

---

## 🧮 Mathematical Kinematics Engine

### 1. 3D Euclidean Joint Distance
$$\text{Distance}(P_1, P_2) = \sqrt{(x_1 - x_2)^2 + (y_1 - y_2)^2 + (z_1 - z_2)^2}$$

### 2. Palm Tilt Angle Calculation
$$\theta = \operatorname{atan2}(y_{\text{middle\_mcp}} - y_{\text{wrist}},\, x_{\text{middle\_mcp}} - x_{\text{wrist}}) \times \frac{180}{\pi}$$

### 3. Exponential Moving Average (EMA) Smoothing
$$S_t = \alpha \cdot X_t + (1 - \alpha) \cdot S_{t-1}$$
*(where $\alpha = 1 - \text{smoothingFactor}$, dampening camera noise while preserving high-speed reflexes)*

---

## 🛠️ Tech Stack

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | `15.4.9` | High-performance React application shell |
| **UI Library** | React | `19.2.1` | Component lifecycle & state management |
| **Language** | TypeScript | `5.9.3` | Strict type safety across vision & physics math |
| **Computer Vision** | MediaPipe Tasks Vision | `1.0.1` | Real-time ML hand landmark inference |
| **Styling** | Tailwind CSS & Lucide Icons | `4.1.11` | Cyberpunk & telemetry UI design system |
| **Audio Engine** | Web Audio API | Native | Synthesized engine harmonics & sound effects |
| **Animation** | Motion & Canvas Confetti | `12.23.24` | Smooth transitions and achievement celebrations |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.18.0 or later (Node.js 20+ recommended)
- **Webcam**: Standard 720p or 1080p webcam (built-in or USB)
- **Modern Browser**: Chrome, Edge, Brave, or Firefox with WebGL enabled

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/VenkatMohan7/GestureDrive-CV.git
   cd GestureDrive-CV
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment (Optional):**
   ```bash
   cp .env.example .env.local
   ```

4. **Launch the development server:**
   ```bash
   npm run dev
   ```

5. **Open the application:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser. Grant camera access when prompted, place your hand in front of the lens, and start driving!

---

## 🐍 Standalone Python Game Bridge

Want to use **GestureDrive CV** to control PC games like *Forza Horizon 5*, *Need for Speed*, *Assetto Corsa*, or *Trackmania*?

1. Open the web application and click the **`Python Code`** button in the header.
2. The app generates a customized `GestureDrive-CV.py` script pre-calibrated with your exact sensitivity and deadzone settings.
3. Install the Python dependencies:
   ```bash
   pip install opencv-python mediapipe numpy pyautogui
   ```
4. Run the Python controller:
   ```bash
   python GestureDrive-CV.py
   ```
5. Switch into your favorite racing game and steer with your hands!

---

## 📂 Project Structure

```
gesturedrive-cv/
├── app/
│   ├── globals.css           # Custom styling & retro scanlines
│   ├── layout.tsx            # Root HTML layout & fonts
│   └── page.tsx              # Main application state & UI orchestrator
├── components/
│   ├── CalibrationModal.tsx  # Hyperparameter tuning matrix
│   ├── ChallengeModal.tsx    # Slalom, Emergency Brake, and Overtake modes
│   ├── CodeViewerModal.tsx   # Live exportable Python script generator
│   ├── DashboardTelemetry.tsx# Speedometer, RPM, G-Force, and HUD
│   ├── DrivingCanvas.tsx     # 60 FPS HTML5 Canvas pseudo-3D engine
│   └── VisionCamera.tsx      # MediaPipe camera pipeline & vector visualizer
├── lib/
│   ├── audio-engine.ts       # Procedural Web Audio API sound synthesizer
│   ├── gesture-math.ts       # Euclidean distance, angles, and EMA filters
│   ├── mediapipe-loader.ts   # MediaPipe WASM bundle loader
│   ├── python-generator.ts   # Standalone Python script synthesizer
│   └── utils.ts              # Classname utilities & helpers
├── types/
│   └── vision.ts             # TypeScript interfaces for telemetry & vision
├── Test.mp4                  # Full demonstration video
├── metadata.json             # AI Studio applet specifications
├── package.json              # Project dependencies & scripts
└── README.md                 # Project documentation
```

---

## 🎯 Keyboard Fallback Controls

For quick testing or keyboard-only setups:

| Key | Action |
| :---: | :--- |
| <kbd>W</kbd> or <kbd>↑</kbd> | Accelerate / Throttle |
| <kbd>S</kbd> or <kbd>↓</kbd> | Brake / Reverse |
| <kbd>A</kbd> or <kbd>←</kbd> | Steer Left |
| <kbd>D</kbd> or <kbd>→</kbd> | Steer Right |
| <kbd>Shift</kbd> | Nitro Boost |
| <kbd>Space</kbd> | Handbrake Drift |
| <kbd>R</kbd> | Toggle Reverse Gear |
| <kbd>M</kbd> | Toggle Engine Audio Mute |

---

## 🤝 Contributing

Contributions, feature requests, and optimizations are warmly welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more details.

---

## 👥 Team & Authors

- **Venkat Mohan Atmakuru** — [@VenkatMohan7](https://github.com/VenkatMohan7)
- **Sabarish Mettu** — [@sabarishmettu](https://github.com/sabarishmettu)

---

<div align="center">
  <strong>Developed with ❤️ by <a href="https://github.com/VenkatMohan7">Venkat Mohan Atmakuru</a> & <a href="https://github.com/sabarishmettu">Sabarish Mettu</a></strong>
</div>
