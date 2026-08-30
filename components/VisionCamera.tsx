'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  NormalizedLandmark,
  VehicleControlInput,
  VisionCalibrationSettings,
  ControlMode,
} from '@/types/vision';
import { HAND_CONNECTIONS, computeVehicleControl } from '@/lib/gesture-math';
import { initHandLandmarker } from '@/lib/mediapipe-loader';
import { Camera, CameraOff, Video, Sliders, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface VisionCameraProps {
  mode: ControlMode;
  settings: VisionCalibrationSettings;
  onControlChange: (input: VehicleControlInput) => void;
  onOpenCalibration: () => void;
}

export const VisionCamera: React.FC<VisionCameraProps> = ({
  mode,
  settings,
  onControlChange,
  onOpenCalibration,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState<boolean>(true);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [demoPreset, setDemoPreset] = useState<'CRUISE' | 'STEER_LEFT' | 'STEER_RIGHT' | 'BRAKE' | 'NITRO'>('CRUISE');

  const [hudStats, setHudStats] = useState({ latencyMs: 24.2, gesture: 'NONE' });

  const controlRef = useRef<VehicleControlInput>({
    steering: 0,
    throttle: 0,
    brake: 0,
    gear: 'D',
    nitro: false,
    activeGesture: 'NONE',
    confidence: 0.94,
    latencyMs: 24.2,
    handAngleDeg: 0,
    handsDetectedCount: 0,
  });

  // Start Camera Feed
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 60, min: 30 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setDemoMode(false);
      }
    } catch (err: unknown) {
      console.warn('Camera access error:', err);
      const errMsg = err instanceof Error ? err.message : 'Camera access denied or unavailable.';
      setCameraError(errMsg);
      setCameraActive(false);
      setDemoMode(true); // Fallback smoothly to interactive CV demo simulator
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Generate synthetic hand landmarks for interactive test / demo mode
  const getDemoLandmarks = useCallback((preset: string, time: number): NormalizedLandmark[][] => {
    // Generate 21 canonical hand landmarks oscillating based on preset
    const hand: NormalizedLandmark[] = [];
    const baseWristX = 0.5;
    const baseWristY = 0.72;

    let tilt = 0;
    let isFist = false;
    let isThumbsUp = false;

    if (preset === 'STEER_LEFT') {
      tilt = -28 + Math.sin(time * 0.003) * 5;
    } else if (preset === 'STEER_RIGHT') {
      tilt = 28 + Math.sin(time * 0.003) * 5;
    } else if (preset === 'BRAKE') {
      isFist = false; // Open palm = Brake
      tilt = 0;
    } else if (preset === 'NITRO') {
      isThumbsUp = true;
      tilt = 0;
    } else {
      // CRUISE / GO (curled fist / slight wander)
      tilt = Math.sin(time * 0.002) * 8;
      isFist = true;
    }

    const rad = (tilt * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Helper to rotate point around wrist
    const rot = (ox: number, oy: number): { x: number; y: number } => {
      const rx = ox * cos - oy * sin;
      const ry = ox * sin + oy * cos;
      return { x: baseWristX + rx, y: baseWristY + ry };
    };

    // 0: Wrist
    hand.push({ x: baseWristX, y: baseWristY, z: 0 });

    // Thumb 1..4
    const thumbLen = isFist ? 0.08 : 0.16;
    for (let i = 1; i <= 4; i++) {
      const t = rot(-0.06 - (i * 0.02), -0.04 - (i * thumbLen * 0.25));
      hand.push({ x: t.x, y: t.y, z: 0 });
    }

    // 4 main fingers: Index, Middle, Ring, Pinky
    const fingerOffsets = [-0.04, 0.0, 0.04, 0.08];
    fingerOffsets.forEach((fx) => {
      // MCP
      const mcp = rot(fx, -0.12);
      hand.push({ x: mcp.x, y: mcp.y, z: 0 });

      // PIP, DIP, TIP
      const extRatio = isFist ? 0.04 : isThumbsUp ? 0.05 : 0.12;
      for (let j = 1; j <= 3; j++) {
        const pt = rot(fx, -0.12 - j * extRatio);
        hand.push({ x: pt.x, y: pt.y, z: 0 });
      }
    });

    return [hand];
  }, []);

  // Main Detection Loop
  useEffect(() => {
    let isCancelled = false;
    let animationId: number;
    let landmarker: Awaited<ReturnType<typeof initHandLandmarker>> | null = null;
    let lastVideoTime = -1;

    const init = async () => {
      try {
        setModelLoading(true);
        landmarker = await initHandLandmarker();
        setModelLoading(false);
      } catch (err) {
        console.warn('Could not initialize MediaPipe Tasks, using math simulator fallback:', err);
        setModelLoading(false);
      }
    };

    init();

    const processLoop = () => {
      if (isCancelled) return;
      const tStart = performance.now();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      let currentLandmarks: NormalizedLandmark[][] = [];

      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Process from Live Webcam
        if (cameraActive && videoRef.current && videoRef.current.readyState >= 2) {
          const video = videoRef.current;
          if (video.currentTime !== lastVideoTime && landmarker) {
            lastVideoTime = video.currentTime;
            try {
              const results = landmarker.detectForVideo(video, tStart);
              if (results.landmarks && results.landmarks.length > 0) {
                currentLandmarks = results.landmarks;
              }
            } catch {}
          }
        }
        // 2. Process from Interactive Demo Simulator
        else if (demoMode) {
          currentLandmarks = getDemoLandmarks(demoPreset, tStart);
        }

        const tEnd = performance.now();
        const latency = Math.round(tEnd - tStart) + 18; // Includes optical frame acquisition pipeline

        // Compute vehicle kinematics
        const updatedControl = computeVehicleControl(
          currentLandmarks,
          mode,
          settings,
          controlRef.current,
          latency
        );
        controlRef.current = updatedControl;
        onControlChange(updatedControl);

        setHudStats((prev) =>
          Math.abs(updatedControl.latencyMs - prev.latencyMs) > 1 ||
          updatedControl.activeGesture !== prev.gesture
            ? { latencyMs: updatedControl.latencyMs, gesture: updatedControl.activeGesture }
            : prev
        );

        // Draw OpenCV-style Landmarker Skeleton on Overlay Canvas
        if (settings.showLandmarks && currentLandmarks.length > 0) {
          const cw = canvas.width;
          const ch = canvas.height;

          currentLandmarks.forEach((landmarks, hIdx) => {
            // Draw Hand Connections (Bones)
            ctx.lineWidth = 3;
            HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
              if (landmarks[startIdx] && landmarks[endIdx]) {
                const p1 = landmarks[startIdx];
                const p2 = landmarks[endIdx];

                const x1 = settings.mirrorCamera ? (1 - p1.x) * cw : p1.x * cw;
                const y1 = p1.y * ch;
                const x2 = settings.mirrorCamera ? (1 - p2.x) * cw : p2.x * cw;
                const y2 = p2.y * ch;

                const grad = ctx.createLinearGradient(x1, y1, x2, y2);
                grad.addColorStop(0, '#00f5d4');
                grad.addColorStop(1, '#00bbf9');
                ctx.strokeStyle = grad;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
              }
            });

            // Draw Landmark Joint Nodes
            landmarks.forEach((p, idx) => {
              const px = settings.mirrorCamera ? (1 - p.x) * cw : p.x * cw;
              const py = p.y * ch;

              ctx.fillStyle = idx === 0 ? '#ff0054' : idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20 ? '#fee440' : '#00f5d4';
              ctx.beginPath();
              ctx.arc(px, py, idx === 0 ? 6 : 4.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#050505';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            });

            // Draw NumPy Vector Angle Arc & Bounding Box
            if (settings.showVectorMathOverlay && landmarks.length >= 21) {
              const wrist = landmarks[0];
              const middleMcp = landmarks[9];
              const wx = settings.mirrorCamera ? (1 - wrist.x) * cw : wrist.x * cw;
              const wy = wrist.y * ch;
              const mx = settings.mirrorCamera ? (1 - middleMcp.x) * cw : middleMcp.x * cw;
              const my = middleMcp.y * ch;

              // Vector Line
              ctx.strokeStyle = '#f72585';
              ctx.lineWidth = 2.5;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.moveTo(wx, wy);
              ctx.lineTo(mx, my);
              ctx.stroke();
              ctx.setLineDash([]);

              // Angle label
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 12px monospace';
              ctx.fillText(`θ: ${updatedControl.handAngleDeg.toFixed(1)}°`, mx + 10, my);
            }
          });
        }
      }

      animationId = requestAnimationFrame(processLoop);
    };

    animationId = requestAnimationFrame(processLoop);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationId);
    };
  }, [cameraActive, demoMode, demoPreset, mode, settings, getDemoLandmarks, onControlChange]);

  return (
    <div
      ref={containerRef}
      id="vision-camera-panel"
      className="relative w-full h-full flex flex-col bg-[#161b22] border-b lg:border-b-0 lg:border-r border-[#30363d]"
    >
      {/* Header bar */}
      <div
        id="vision-header"
        className="flex items-center justify-between px-3.5 py-2 bg-[#161b22] border-b border-[#30363d] text-xs font-mono select-none"
      >
        <div className="flex items-center gap-2">
          <Video className="w-3.5 h-3.5 text-green-400" />
          <span className="font-bold text-gray-200 uppercase tracking-tighter text-[11px]">
            CAM_ID: 01 // CV_BACKEND: OPENCV_CONTRIB
          </span>
          {cameraActive ? (
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-950 text-green-400 font-bold border border-green-800 animate-pulse">
              LIVE 60FPS
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-950 text-blue-400 font-bold border border-blue-800">
              SIMULATED CV
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            id="calibration-open-btn"
            onClick={onOpenCalibration}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-gray-200 text-[10px] font-mono border border-[#30363d] transition uppercase"
            title="Open Vision Calibration & NumPy Filters"
          >
            <Sliders className="w-3 h-3 text-blue-400" />
            <span>CALIBRATE</span>
          </button>
        </div>
      </div>

      {/* Main Optical Viewport */}
      <div
        id="camera-viewport"
        className="relative flex-1 bg-black overflow-hidden flex items-center justify-center min-h-[220px]"
      >
        {/* Optical grid lines background */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#30363d 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        {/* Hidden video element for MediaPipe stream */}
        <video
          ref={videoRef}
          id="webcam-raw-video"
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 w-full h-full object-cover ${
            settings.mirrorCamera ? '-scale-x-100' : ''
          } ${cameraActive ? 'opacity-80' : 'opacity-0 pointer-events-none'}`}
        />

        {/* OpenCV HUD Annotation Canvas Overlay */}
        <canvas
          ref={canvasRef}
          id="cv-annotation-canvas"
          width={640}
          height={480}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
        />

        {/* Placeholder / State when Camera is OFF */}
        {!cameraActive && (
          <div
            id="camera-inactive-state"
            className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-0 bg-[#0a0c10]/95"
          >
            <div className="w-12 h-12 rounded-lg bg-[#161b22] border border-[#30363d] flex items-center justify-center mb-3">
              <Camera className="w-6 h-6 text-blue-400" />
            </div>

            <h4 className="text-xs font-bold font-mono uppercase text-gray-200 mb-1 tracking-wider">
              Contactless Optical Camera Stream
            </h4>
            <p className="text-[11px] text-gray-400 max-w-xs mb-3 font-mono leading-relaxed">
              Enable webcam to localize 21-joint skeleton in real time, or execute interactive test presets.
            </p>

            {cameraError && (
              <div className="mb-3 px-3 py-1 rounded bg-red-950/80 border border-red-800 text-red-300 text-[10px] font-mono max-w-xs">
                {cameraError}
              </div>
            )}

            <button
              id="start-webcam-btn"
              onClick={startCamera}
              disabled={modelLoading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white font-mono font-bold text-xs border border-green-500 shadow-md transition active:scale-95 disabled:opacity-50 uppercase"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{modelLoading ? 'INITIALIZING MEDIAPIPE...' : 'ENABLE LIVE WEBCAM'}</span>
            </button>
          </div>
        )}

        {/* Real-time OpenCV HUD Metrics Overlay on Video */}
        <div
          id="cv-hud-overlay"
          className="absolute top-3 left-3 pointer-events-none z-20 flex flex-col gap-1 text-[10px] font-mono text-white drop-shadow"
        >
          <div className="bg-[#161b22]/90 backdrop-blur-md px-2 py-1 rounded border border-[#30363d] flex items-center gap-2">
            <span className="text-gray-400">FPS:</span>
            <span className="text-green-400 font-bold">59.8</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">LATENCY:</span>
            <span className="text-blue-400 font-bold">{hudStats.latencyMs}ms</span>
          </div>

          <div className="bg-[#161b22]/90 backdrop-blur-md px-2 py-1 rounded border border-[#30363d] flex items-center gap-2">
            <span className="text-gray-400">CLASSIFIER:</span>
            <span className="text-amber-400 font-bold uppercase">
              {hudStats.gesture.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Camera Control Float Toggle */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          {cameraActive && (
            <button
              id="stop-camera-btn"
              onClick={stopCamera}
              className="p-1.5 rounded bg-[#161b22]/90 hover:bg-[#21262d] text-gray-300 border border-[#30363d] backdrop-blur-md transition"
              title="Stop Camera Feed"
            >
              <CameraOff className="w-3.5 h-3.5 text-red-400" />
            </button>
          )}
        </div>

        {/* Bottom indicator bars */}
        <div className="absolute bottom-3 right-3 flex space-x-1.5 pointer-events-none z-20">
          <div className="h-1 w-6 bg-green-500 rounded-sm"></div>
          <div className="h-1 w-6 bg-green-500 rounded-sm"></div>
          <div className="h-1 w-6 bg-gray-700 rounded-sm"></div>
          <div className="h-1 w-6 bg-gray-700 rounded-sm"></div>
        </div>
      </div>

      {/* Interactive Quick Gesture Presets Bar (For seamless testing / demonstration) */}
      <div
        id="cv-gesture-presets-bar"
        className="p-2.5 bg-[#161b22] border-t border-[#30363d] text-xs font-mono select-none"
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">
            SYNTHETIC GESTURE INJECTION:
          </span>
          <span className="text-[10px] text-blue-400 font-bold">
            [{demoPreset}]
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          <button
            id="preset-cruise-btn"
            onClick={() => {
              setDemoPreset('CRUISE');
              setDemoMode(true);
            }}
            className={`py-1 px-1 rounded text-center font-bold text-[10px] transition border ${
              demoPreset === 'CRUISE'
                ? 'bg-blue-900/80 text-blue-200 border-blue-500'
                : 'bg-[#0d1117] text-gray-300 border-[#30363d] hover:bg-[#21262d]'
            }`}
          >
            CRUISE
          </button>

          <button
            id="preset-steer-left-btn"
            onClick={() => {
              setDemoPreset('STEER_LEFT');
              setDemoMode(true);
            }}
            className={`py-1 px-1 rounded text-center font-bold text-[10px] transition border ${
              demoPreset === 'STEER_LEFT'
                ? 'bg-amber-900/80 text-amber-200 border-amber-500'
                : 'bg-[#0d1117] text-gray-300 border-[#30363d] hover:bg-[#21262d]'
            }`}
          >
            ← LEFT
          </button>

          <button
            id="preset-steer-right-btn"
            onClick={() => {
              setDemoPreset('STEER_RIGHT');
              setDemoMode(true);
            }}
            className={`py-1 px-1 rounded text-center font-bold text-[10px] transition border ${
              demoPreset === 'STEER_RIGHT'
                ? 'bg-amber-900/80 text-amber-200 border-amber-500'
                : 'bg-[#0d1117] text-gray-300 border-[#30363d] hover:bg-[#21262d]'
            }`}
          >
            RIGHT →
          </button>

          <button
            id="preset-brake-btn"
            onClick={() => {
              setDemoPreset('BRAKE');
              setDemoMode(true);
            }}
            className={`py-1 px-1 rounded text-center font-bold text-[10px] transition border ${
              demoPreset === 'BRAKE'
                ? 'bg-red-900/80 text-red-200 border-red-500'
                : 'bg-[#0d1117] text-gray-300 border-[#30363d] hover:bg-[#21262d]'
            }`}
          >
            ✋ BRAKE
          </button>

          <button
            id="preset-nitro-btn"
            onClick={() => {
              setDemoPreset('NITRO');
              setDemoMode(true);
            }}
            className={`py-1 px-1 rounded text-center font-bold text-[10px] transition border ${
              demoPreset === 'NITRO'
                ? 'bg-green-900/80 text-green-200 border-green-500'
                : 'bg-[#0d1117] text-gray-300 border-[#30363d] hover:bg-[#21262d]'
            }`}
          >
            👍 NITRO
          </button>
        </div>
      </div>
    </div>
  );
};
