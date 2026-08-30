'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  VehicleControlInput,
  VisionCalibrationSettings,
  ControlMode,
  EnvironmentTheme,
  TelemetryData,
  ChallengeMode,
} from '@/types/vision';
import { DrivingCanvas } from '@/components/DrivingCanvas';
import { VisionCamera } from '@/components/VisionCamera';
import { DashboardTelemetry } from '@/components/DashboardTelemetry';
import { CalibrationModal } from '@/components/CalibrationModal';
import { CodeViewerModal } from '@/components/CodeViewerModal';
import { ChallengeModal, CHALLENGES } from '@/components/ChallengeModal';
import { vehicleAudio } from '@/lib/audio-engine';
import confetti from 'canvas-confetti';
import {
  Volume2,
  VolumeX,
  Sun,
  Sunset,
  Moon,
  Trophy,
  Sliders,
  Code2,
  HelpCircle,
  Rows,
  Columns,
  Video,
  Gauge,
  Terminal,
} from 'lucide-react';

export default function GestureDriveApp() {
  // Vehicle Control State from Vision Engine
  const [controlInput, setControlInput] = useState<VehicleControlInput>({
    steering: 0,
    throttle: 0,
    brake: 0,
    gear: 'D',
    nitro: false,
    activeGesture: 'NONE',
    confidence: 0.94,
    latencyMs: 24.5,
    handAngleDeg: 0,
    handsDetectedCount: 0,
  });

  // Telemetry from Canvas Simulator
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    speedKmh: 0,
    rpm: 900,
    gear: 'D',
    lateralG: 0,
    longitudinalG: 0,
    distanceTraveledKm: 0,
    fuelOrBatteryPct: 100,
    collisionWarning: false,
    score: 0,
    lapTimeSeconds: 0,
  });

  // Settings & Configuration
  const [mode, setMode] = useState<ControlMode>('SINGLE_HAND_GESTURE');
  const [theme, setTheme] = useState<EnvironmentTheme>('CYBER_NEON_NIGHT');
  const [challenge, setChallenge] = useState<ChallengeMode>(CHALLENGES[0]);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [centerViewMode, setCenterViewMode] = useState<'HORIZONTAL' | 'VERTICAL' | 'SIMULATION' | 'CAMERA'>('HORIZONTAL');

  // Modals
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [isCodeOpen, setIsCodeOpen] = useState<boolean>(false);
  const [isChallengeOpen, setIsChallengeOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // Vision Calibration Settings
  const [settings, setSettings] = useState<VisionCalibrationSettings>({
    steeringSensitivity: 1.25,
    deadzoneAngle: 5.0,
    maxSteerAngle: 45.0,
    smoothingFactor: 0.65,
    invertSteering: false,
    throttleThreshold: 0.8,
    brakeThreshold: 0.25,
    showLandmarks: true,
    showBoundingBox: true,
    showVectorMathOverlay: true,
    mirrorCamera: true,
  });

  // Log buffer for terminal
  const [logs, setLogs] = useState<string[]>([
    '> INIT: OpenCV 4.10.0 Optical Engine Loaded',
    '> SYNC: MediaPipe Hands v0.10.14 Ready',
    '> STREAM: 60 FPS Camera Frame Grab Active',
    '> KINEMATICS: NumPy Vector EMA Filter Engaged',
  ]);

  // Audio Toggle
  const handleToggleAudio = () => {
    vehicleAudio.init();
    const muted = vehicleAudio.toggleMute();
    setIsMuted(muted);
  };

  // Challenge Event Callbacks
  const handleChallengeEvent = useCallback((event: string, value: number) => {
    if (event === 'EMERGENCY_STOP_SUCCESS') {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
      setLogs((prev) => [`> ALERT: Emergency stop executed in ${value}ms!`, ...prev.slice(0, 5)]);
    } else if (event === 'CONE_CLEARED' && value % 500 === 0) {
      confetti({
        particleCount: 50,
        spread: 45,
        origin: { y: 0.7 },
      });
      setLogs((prev) => [`> MILESTONE: Score ${value} pts achieved`, ...prev.slice(0, 5)]);
    }
  }, []);

  // Update control inputs and record log transitions
  const handleControlChange = useCallback((newControl: VehicleControlInput) => {
    setControlInput((prev) => {
      if (newControl.activeGesture !== prev.activeGesture && newControl.activeGesture !== 'NONE') {
        const entry = `> GESTURE: ${newControl.activeGesture} | Conf: ${(newControl.confidence * 100).toFixed(0)}% | θ: ${newControl.handAngleDeg.toFixed(1)}°`;
        setLogs((currentLogs) => [entry, ...currentLogs.slice(0, 5)]);
      }
      return newControl;
    });
  }, []);

  // Simulated live 21-joint landmarks stream based on current hand tilt & active gesture
  const landmarkStream = useMemo(() => {
    const angleRad = (controlInput.handAngleDeg * Math.PI) / 180;
    const sinA = Math.sin(angleRad);
    const cosA = Math.cos(angleRad);

    const baseJoints = [
      { name: '00_WRIST', x: 0.5, y: 0.75, z: 0.0 },
      { name: '01_THUMB_CMC', x: 0.44, y: 0.68, z: -0.01 },
      { name: '02_THUMB_MCP', x: 0.39, y: 0.61, z: -0.02 },
      { name: '03_THUMB_IP', x: 0.35, y: 0.55, z: -0.03 },
      { name: '04_THUMB_TIP', x: 0.32, y: 0.50, z: -0.04 },
      { name: '05_INDEX_MCP', x: 0.46, y: 0.54, z: -0.01 },
      { name: '06_INDEX_PIP', x: 0.45, y: 0.44, z: -0.02 },
      { name: '07_INDEX_DIP', x: 0.45, y: 0.37, z: -0.03 },
      { name: '08_INDEX_TIP', x: 0.45, y: 0.30, z: -0.04 },
      { name: '09_MIDDLE_MCP', x: 0.50, y: 0.53, z: 0.0 },
      { name: '10_MIDDLE_PIP', x: 0.50, y: 0.42, z: -0.01 },
      { name: '11_MIDDLE_DIP', x: 0.50, y: 0.34, z: -0.02 },
      { name: '12_MIDDLE_TIP', x: 0.50, y: 0.27, z: -0.03 },
      { name: '13_RING_MCP', x: 0.54, y: 0.55, z: 0.01 },
      { name: '14_RING_PIP', x: 0.55, y: 0.45, z: 0.0 },
      { name: '15_RING_DIP', x: 0.55, y: 0.38, z: -0.01 },
      { name: '16_RING_TIP', x: 0.55, y: 0.31, z: -0.02 },
      { name: '17_PINKY_MCP', x: 0.58, y: 0.58, z: 0.02 },
      { name: '18_PINKY_PIP', x: 0.59, y: 0.51, z: 0.01 },
      { name: '19_PINKY_DIP', x: 0.60, y: 0.45, z: 0.0 },
      { name: '20_PINKY_TIP', x: 0.60, y: 0.40, z: -0.01 },
    ];

    return baseJoints.map((j) => {
      const dx = j.x - 0.5;
      const dy = j.y - 0.75;
      const rotX = dx * cosA - dy * sinA + 0.5;
      const rotY = dx * sinA + dy * cosA + 0.75;
      return {
        name: j.name,
        x: rotX.toFixed(3),
        y: rotY.toFixed(3),
        z: j.z.toFixed(3),
      };
    });
  }, [controlInput.handAngleDeg]);

  // Keyboard Assist Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        setControlInput((prev) => ({ ...prev, steering: -0.85, activeGesture: 'STEER_LEFT', handAngleDeg: -22 }));
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        setControlInput((prev) => ({ ...prev, steering: 0.85, activeGesture: 'STEER_RIGHT', handAngleDeg: 22 }));
      } else if (['ArrowUp', 'KeyW'].includes(e.code)) {
        setControlInput((prev) => ({ ...prev, throttle: 0.9, brake: 0, activeGesture: 'THROTTLE_ACCEL' }));
      } else if (['ArrowDown', 'KeyS', 'Space'].includes(e.code)) {
        setControlInput((prev) => ({ ...prev, brake: 1.0, throttle: 0, activeGesture: 'BRAKE_HARD' }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        setControlInput((prev) => ({ ...prev, steering: 0, handAngleDeg: 0 }));
      } else if (['ArrowUp', 'KeyW'].includes(e.code)) {
        setControlInput((prev) => ({ ...prev, throttle: 0.4 }));
      } else if (['ArrowDown', 'KeyS', 'Space'].includes(e.code)) {
        setControlInput((prev) => ({ ...prev, brake: 0, throttle: 0.4 }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div
      id="gesture-drive-applet"
      className="min-h-screen w-full bg-[#0a0c10] text-[#e1e4e8] flex flex-col font-mono selection:bg-blue-600 selection:text-white"
    >
      {/* High Density Header */}
      <header
        id="top-navbar"
        className="flex flex-wrap items-center justify-between px-4 py-2 border-b border-[#30363d] bg-[#161b22] shrink-0 select-none z-30 gap-2"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />
          <h1 className="text-xs sm:text-sm font-bold tracking-tight uppercase font-mono text-white">
            GestureDrive CV // Contactless Autonomous Vehicle Control
          </h1>
        </div>

        {/* Telemetry quick status */}
        <div className="hidden lg:flex items-center gap-4 text-[11px] font-mono">
          <div>
            <span className="text-gray-500 uppercase">LATENCY:</span>{' '}
            <span className="text-green-400 font-bold">{controlInput.latencyMs.toFixed(1)}ms</span>
          </div>
          <div>
            <span className="text-gray-500 uppercase">ACCURACY:</span>{' '}
            <span className="text-blue-400 font-bold">94.6%</span>
          </div>
          <div>
            <span className="text-gray-500 uppercase">PROTOCOL:</span>{' '}
            <span className="text-white font-bold">MP_HANDS_V2</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#0d1117] p-0.5 rounded border border-[#30363d] text-[10px]">
            <button
              id="view-horizontal-btn"
              onClick={() => setCenterViewMode('HORIZONTAL')}
              className={`px-2 py-1 rounded transition uppercase flex items-center gap-1 ${
                centerViewMode === 'HORIZONTAL' ? 'bg-[#21262d] text-blue-400 font-bold' : 'text-gray-400 hover:text-white'
              }`}
              title="Stacked Horizontal View (Vehicle on Top, Camera on Bottom)"
            >
              <Rows className="w-3 h-3 inline" />
              <span>STACKED</span>
            </button>
            <button
              id="view-vertical-btn"
              onClick={() => setCenterViewMode('VERTICAL')}
              className={`px-2 py-1 rounded transition uppercase flex items-center gap-1 ${
                centerViewMode === 'VERTICAL' ? 'bg-[#21262d] text-blue-400 font-bold' : 'text-gray-400 hover:text-white'
              }`}
              title="Side-by-Side Vertical View"
            >
              <Columns className="w-3 h-3 inline" />
              <span>SIDE-BY-SIDE</span>
            </button>
            <button
              id="view-sim-btn"
              onClick={() => setCenterViewMode('SIMULATION')}
              className={`px-2 py-1 rounded transition uppercase flex items-center gap-1 ${
                centerViewMode === 'SIMULATION' ? 'bg-[#21262d] text-blue-400 font-bold' : 'text-gray-400 hover:text-white'
              }`}
              title="Full Road Simulation Canvas"
            >
              <Gauge className="w-3 h-3 inline" />
              <span>ROAD</span>
            </button>
            <button
              id="view-cam-btn"
              onClick={() => setCenterViewMode('CAMERA')}
              className={`px-2 py-1 rounded transition uppercase flex items-center gap-1 ${
                centerViewMode === 'CAMERA' ? 'bg-[#21262d] text-blue-400 font-bold' : 'text-gray-400 hover:text-white'
              }`}
              title="Full Optical Camera Viewport"
            >
              <Video className="w-3 h-3 inline" />
              <span>CAM</span>
            </button>
          </div>

          {/* Challenge Selector */}
          <button
            id="challenge-modal-trigger-btn"
            onClick={() => setIsChallengeOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0d1117] hover:bg-[#21262d] text-amber-300 text-[10px] border border-[#30363d] transition uppercase font-bold"
          >
            <Trophy className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">{challenge.title.split(' ')[0]}</span>
          </button>

          {/* Theme Switcher */}
          <div className="hidden md:flex items-center bg-[#0d1117] p-0.5 rounded border border-[#30363d] text-gray-400">
            <button
              id="theme-cyber-btn"
              onClick={() => setTheme('CYBER_NEON_NIGHT')}
              className={`p-1 rounded ${theme === 'CYBER_NEON_NIGHT' ? 'bg-[#21262d] text-blue-400' : 'hover:text-white'}`}
              title="Cyber Neon Night"
            >
              <Moon className="w-3 h-3" />
            </button>
            <button
              id="theme-sunset-btn"
              onClick={() => setTheme('SUNSET_COAST')}
              className={`p-1 rounded ${theme === 'SUNSET_COAST' ? 'bg-[#21262d] text-amber-400' : 'hover:text-white'}`}
              title="Sunset Coast"
            >
              <Sunset className="w-3 h-3" />
            </button>
            <button
              id="theme-day-btn"
              onClick={() => setTheme('DAY_HIGHWAY')}
              className={`p-1 rounded ${theme === 'DAY_HIGHWAY' ? 'bg-[#21262d] text-yellow-300' : 'hover:text-white'}`}
              title="Day Highway"
            >
              <Sun className="w-3 h-3" />
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            id="sound-toggle-btn"
            onClick={handleToggleAudio}
            className={`p-1.5 rounded border text-[10px] transition ${
              !isMuted
                ? 'bg-green-950/80 border-green-700 text-green-300'
                : 'bg-[#0d1117] hover:bg-[#21262d] border-[#30363d] text-gray-400'
            }`}
            title={isMuted ? 'Unmute Vehicle Audio Engine' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3 animate-pulse text-green-400" />}
          </button>

          {/* Calibration Modal */}
          <button
            id="open-calibration-header-btn"
            onClick={() => setIsCalibrationOpen(true)}
            className="p-1.5 rounded bg-[#0d1117] hover:bg-[#21262d] text-gray-300 text-[10px] border border-[#30363d] transition uppercase"
            title="Calibration Settings"
          >
            <Sliders className="w-3 h-3" />
          </button>

          {/* Python Code Export */}
          <button
            id="python-export-header-btn"
            onClick={() => setIsCodeOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white text-[10px] font-bold transition uppercase shadow"
          >
            <Code2 className="w-3 h-3" />
            <span className="hidden sm:inline">.PY EXPORT</span>
          </button>

          {/* Help / Gesture Guide */}
          <button
            id="help-guide-btn"
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            className={`p-1.5 rounded border text-[10px] transition ${
              isHelpOpen ? 'bg-blue-950 border-blue-500 text-blue-400' : 'bg-[#0d1117] hover:bg-[#21262d] border-[#30363d] text-gray-400'
            }`}
            title="Hand Gesture Guide"
          >
            <HelpCircle className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Collapsible Gesture Guide Drawer */}
      {isHelpOpen && (
        <div
          id="gesture-guide-banner"
          className="bg-[#161b22] border-b border-[#30363d] px-4 py-2.5 text-[11px] text-gray-300 grid grid-cols-2 sm:grid-cols-4 gap-2.5 animate-in slide-in-from-top-2 duration-200"
        >
          <div className="bg-[#0d1117] p-2 rounded border border-[#30363d] flex items-center gap-2">
            <span className="text-lg">🖐️</span>
            <div>
              <strong className="text-white block uppercase text-[10px]">Hand Tilt Left/Right</strong>
              <span className="text-[9px] text-gray-400">Wrist angle steers the vehicle</span>
            </div>
          </div>
          <div className="bg-[#0d1117] p-2 rounded border border-[#30363d] flex items-center gap-2">
            <span className="text-lg">✋</span>
            <div>
              <strong className="text-white block uppercase text-[10px]">Open Palm</strong>
              <span className="text-[9px] text-gray-400">Emergency heavy brake</span>
            </div>
          </div>
          <div className="bg-[#0d1117] p-2 rounded border border-[#30363d] flex items-center gap-2">
            <span className="text-lg">✊</span>
            <div>
              <strong className="text-white block uppercase text-[10px]">Closed Fist</strong>
              <span className="text-[9px] text-gray-400">Full throttle / Go acceleration</span>
            </div>
          </div>
          <div className="bg-[#0d1117] p-2 rounded border border-[#30363d] flex items-center gap-2">
            <span className="text-lg">👍</span>
            <div>
              <strong className="text-white block uppercase text-[10px]">Thumbs Up</strong>
              <span className="text-[9px] text-gray-400">Nitro boost engagement</span>
            </div>
          </div>
        </div>
      )}

      {/* High Density Main 3-Column Grid */}
      <main
        id="main-workspace-grid"
        className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden min-h-0 bg-[#0a0c10]"
      >
        {/* Left Section: Classifiers & Landmark Stream (3 cols) */}
        <section className="col-span-12 lg:col-span-3 flex flex-col space-y-3 min-h-0">
          {/* Card 1: Hand Classifiers */}
          <div className="bg-[#161b22] border border-[#30363d] p-3 rounded shrink-0">
            <h2 className="text-[10px] uppercase text-gray-500 mb-2 border-b border-[#30363d] pb-1 font-bold tracking-wider">
              Hand Classifiers
            </h2>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">THROTTLE_FIST</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    controlInput.throttle > 0.3
                      ? 'bg-green-950 text-green-400 border border-green-800'
                      : 'bg-[#0d1117] text-gray-500 border border-[#30363d]'
                  }`}
                >
                  {controlInput.throttle > 0.3 ? 'ACTIVE' : 'IDLE'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">STEER_HORIZONTAL</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    Math.abs(controlInput.steering) > 0.1
                      ? 'bg-blue-950 text-blue-400 border border-blue-800'
                      : 'bg-[#0d1117] text-gray-500 border border-[#30363d]'
                  }`}
                >
                  {Math.abs(controlInput.steering) > 0.1 ? 'ACTIVE' : 'CENTER'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">BRAKE_PALM</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    controlInput.brake > 0.2
                      ? 'bg-red-950 text-red-400 border border-red-800'
                      : 'bg-[#0d1117] text-gray-500 border border-[#30363d]'
                  }`}
                >
                  {controlInput.brake > 0.2 ? 'ENGAGED' : 'INACTIVE'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">NITRO_THUMBS</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    controlInput.nitro
                      ? 'bg-purple-950 text-purple-400 border border-purple-800'
                      : 'bg-[#0d1117] text-gray-500 border border-[#30363d]'
                  }`}
                >
                  {controlInput.nitro ? 'BOOST' : 'OFF'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Landmark Coordinate Stream */}
          <div className="bg-[#161b22] border border-[#30363d] p-3 rounded flex-1 relative overflow-hidden flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-1 mb-2">
              <h2 className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">
                Landmark Coordinate Stream
              </h2>
              <span className="text-[9px] text-green-400 font-mono font-bold">21 JOINTS</span>
            </div>
            <div className="text-[10px] space-y-1 font-mono text-gray-400 overflow-y-auto pr-1 flex-1">
              {landmarkStream.map((lm) => (
                <div key={lm.name} className="flex justify-between hover:bg-[#0d1117] px-1 py-0.5 rounded">
                  <span className="text-gray-500">[{lm.name}]</span>
                  <span className="text-gray-300 font-mono">
                    x:{lm.x} y:{lm.y} z:{lm.z}
                  </span>
                </div>
              ))}
            </div>
            {/* Fade effect at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#161b22] to-transparent pointer-events-none" />
          </div>
        </section>

        {/* Center Section: Primary Viewport + 4-Col Telemetry Strip (6 cols) */}
        <section className="col-span-12 lg:col-span-6 flex flex-col space-y-3 min-h-0">
          {/* Main Simulation / Camera Viewport Area */}
          <div className="bg-[#161b22] border border-[#30363d] rounded flex-1 flex flex-col overflow-hidden min-h-[500px] relative">
            {/* HORIZONTAL (STACKED) VIEW - Vehicle on Top, Camera on Bottom */}
            {centerViewMode === 'HORIZONTAL' && (
              <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden divide-y divide-[#30363d]">
                {/* Top: Vehicle View (Horizontal Rect) */}
                <div className="flex-1 min-h-[220px] flex flex-col relative overflow-hidden bg-[#050512]">
                  <div className="absolute top-2 left-2 z-20 bg-[#161b22]/85 backdrop-blur-sm px-2 py-0.5 rounded border border-[#30363d] text-[9px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 pointer-events-none select-none">
                    <Gauge className="w-3 h-3 text-blue-400" />
                    <span>Vehicle View</span>
                  </div>
                  <DrivingCanvas
                    controlInput={controlInput}
                    theme={theme}
                    challenge={challenge}
                    onTelemetryUpdate={setTelemetry}
                    onChallengeEvent={handleChallengeEvent}
                  />
                </div>

                {/* Bottom: Camera View (Horizontal Rect) */}
                <div className="flex-1 min-h-[220px] flex flex-col relative overflow-hidden bg-[#0d1117]">
                  <div className="absolute top-2 left-2 z-20 bg-[#161b22]/85 backdrop-blur-sm px-2 py-0.5 rounded border border-[#30363d] text-[9px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5 pointer-events-none select-none">
                    <Video className="w-3 h-3 text-purple-400" />
                    <span>Camera View</span>
                  </div>
                  <VisionCamera
                    mode={mode}
                    settings={settings}
                    onControlChange={handleControlChange}
                    onOpenCalibration={() => setIsCalibrationOpen(true)}
                  />
                </div>
              </div>
            )}

            {/* VERTICAL (SIDE-BY-SIDE) VIEW */}
            {centerViewMode === 'VERTICAL' && (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 h-full min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#30363d]">
                <div className="h-full flex flex-col min-h-0 relative overflow-hidden bg-[#050512]">
                  <div className="absolute top-2 left-2 z-20 bg-[#161b22]/85 backdrop-blur-sm px-2 py-0.5 rounded border border-[#30363d] text-[9px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 pointer-events-none select-none">
                    <Gauge className="w-3 h-3 text-blue-400" />
                    <span>Vehicle View</span>
                  </div>
                  <DrivingCanvas
                    controlInput={controlInput}
                    theme={theme}
                    challenge={challenge}
                    onTelemetryUpdate={setTelemetry}
                    onChallengeEvent={handleChallengeEvent}
                  />
                </div>
                <div className="h-full flex flex-col min-h-0 relative overflow-hidden bg-[#0d1117]">
                  <div className="absolute top-2 left-2 z-20 bg-[#161b22]/85 backdrop-blur-sm px-2 py-0.5 rounded border border-[#30363d] text-[9px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5 pointer-events-none select-none">
                    <Video className="w-3 h-3 text-purple-400" />
                    <span>Camera View</span>
                  </div>
                  <VisionCamera
                    mode={mode}
                    settings={settings}
                    onControlChange={handleControlChange}
                    onOpenCalibration={() => setIsCalibrationOpen(true)}
                  />
                </div>
              </div>
            )}

            {/* FULL SIMULATION VIEW */}
            {centerViewMode === 'SIMULATION' && (
              <div className="flex-1 h-full flex flex-col min-h-0 relative bg-[#050512]">
                <div className="absolute top-2 left-2 z-20 bg-[#161b22]/85 backdrop-blur-sm px-2 py-0.5 rounded border border-[#30363d] text-[9px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 pointer-events-none select-none">
                  <Gauge className="w-3 h-3 text-blue-400" />
                  <span>Full Road View</span>
                </div>
                <DrivingCanvas
                  controlInput={controlInput}
                  theme={theme}
                  challenge={challenge}
                  onTelemetryUpdate={setTelemetry}
                  onChallengeEvent={handleChallengeEvent}
                />
              </div>
            )}

            {/* FULL CAMERA VIEW */}
            {centerViewMode === 'CAMERA' && (
              <div className="flex-1 h-full flex flex-col min-h-0 relative bg-[#0d1117]">
                <div className="absolute top-2 left-2 z-20 bg-[#161b22]/85 backdrop-blur-sm px-2 py-0.5 rounded border border-[#30363d] text-[9px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5 pointer-events-none select-none">
                  <Video className="w-3 h-3 text-purple-400" />
                  <span>Full Optical Sensor View</span>
                </div>
                <VisionCamera
                  mode={mode}
                  settings={settings}
                  onControlChange={handleControlChange}
                  onOpenCalibration={() => setIsCalibrationOpen(true)}
                />
              </div>
            )}
          </div>

          {/* Bottom 4-Column Metric Strip */}
          <div className="grid grid-cols-4 gap-2.5 shrink-0">
            {/* Steering */}
            <div className="bg-[#161b22] border border-[#30363d] p-2 rounded flex flex-col justify-center items-center">
              <span className="text-[9px] uppercase text-gray-500 font-bold">STEERING</span>
              <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                {controlInput.handAngleDeg > 0 ? `+${controlInput.handAngleDeg.toFixed(1)}°` : `${controlInput.handAngleDeg.toFixed(1)}°`}
              </span>
            </div>

            {/* Throttle */}
            <div className="bg-[#161b22] border border-[#30363d] border-t-2 border-t-green-500 p-2 rounded flex flex-col justify-center items-center">
              <span className="text-[9px] uppercase text-gray-500 font-bold">THROTTLE</span>
              <span className="text-base sm:text-lg font-bold text-green-400 tracking-tight">
                {Math.round(controlInput.throttle * 100)}%
              </span>
            </div>

            {/* Brake */}
            <div className="bg-[#161b22] border border-[#30363d] border-t-2 border-t-red-500 p-2 rounded flex flex-col justify-center items-center">
              <span className="text-[9px] uppercase text-gray-500 font-bold">BRAKE</span>
              <span className="text-base sm:text-lg font-bold text-red-400 tracking-tight">
                {Math.round(controlInput.brake * 100)}%
              </span>
            </div>

            {/* Velocity */}
            <div className="bg-[#161b22] border border-[#30363d] p-2 rounded flex flex-col justify-center items-center">
              <span className="text-[9px] uppercase text-gray-500 font-bold">VELOCITY</span>
              <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                {telemetry.speedKmh} <span className="text-[10px] text-gray-500 font-normal">km/h</span>
              </span>
            </div>
          </div>
        </section>

        {/* Right Section: Performance Analytics & Telemetry Log (3 cols) */}
        <section className="col-span-12 lg:col-span-3 flex flex-col space-y-3 min-h-0">
          {/* Card 1: Performance Analytics */}
          <div className="bg-[#161b22] border border-[#30363d] p-3 rounded flex-1 flex flex-col">
            <h2 className="text-[10px] uppercase text-gray-500 mb-2 border-b border-[#30363d] pb-1 font-bold tracking-wider">
              Performance Analytics
            </h2>

            <div className="space-y-3 text-[11px] flex-1">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">Inference Time:</span>
                  <span className="text-green-400 font-bold">{(controlInput.latencyMs * 0.58).toFixed(1)}ms</span>
                </div>
                <div className="w-full bg-[#0d1117] h-1.5 rounded overflow-hidden border border-[#30363d]">
                  <div className="bg-green-500 h-full" style={{ width: '45%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">Pre-processing:</span>
                  <span className="text-blue-400 font-bold">{(controlInput.latencyMs * 0.28).toFixed(1)}ms</span>
                </div>
                <div className="w-full bg-[#0d1117] h-1.5 rounded overflow-hidden border border-[#30363d]">
                  <div className="bg-blue-500 h-full" style={{ width: '28%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">Jitter Level:</span>
                  <span className="text-gray-300 font-bold">LOW (EMA 0.65)</span>
                </div>
                <div className="w-full bg-[#0d1117] h-1.5 rounded overflow-hidden border border-[#30363d]">
                  <div className="bg-purple-500 h-full" style={{ width: '18%' }} />
                </div>
              </div>

              {/* Kinematics Vector Angle */}
              <div className="bg-[#0d1117] p-2 rounded border border-[#30363d] text-[10px]">
                <div className="text-gray-500 uppercase mb-1 font-bold">NumPy Kinematics</div>
                <div className="text-gray-300 flex justify-between">
                  <span>Wrist-MCP Vector:</span>
                  <span className="text-blue-400 font-bold">θ: {controlInput.handAngleDeg.toFixed(1)}°</span>
                </div>
                <div className="text-gray-300 flex justify-between pt-0.5">
                  <span>Classification:</span>
                  <span className="text-amber-400 font-bold">{controlInput.activeGesture}</span>
                </div>
              </div>

              {/* Quick Gesture Map */}
              <div className="bg-[#0d1117] p-2 rounded border border-[#30363d] text-[9px] text-gray-400 space-y-0.5">
                <div className="text-gray-500 uppercase font-bold mb-1">Gesture Mapping</div>
                <div className="flex justify-between">
                  <span>Open Palm</span>
                  <span className="text-red-400">Heavy Brake</span>
                </div>
                <div className="flex justify-between">
                  <span>Closed Fist</span>
                  <span className="text-green-400">Throttle / Go</span>
                </div>
                <div className="flex justify-between">
                  <span>Hand Tilt</span>
                  <span className="text-blue-400">Analog Steer</span>
                </div>
                <div className="flex justify-between">
                  <span>Thumbs Up</span>
                  <span className="text-purple-400">Nitro Boost</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Telemetry Log Terminal */}
          <div className="bg-[#0d1117] border border-[#30363d] p-2.5 rounded shrink-0 flex flex-col h-28 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1.5 text-gray-500 text-[10px] font-bold uppercase border-b border-[#30363d] pb-1">
              <Terminal className="w-3 h-3 text-amber-400" />
              <span>SYSTEM EVENT LOG</span>
            </div>
            <div className="text-[10px] space-y-1 font-mono text-amber-400/90 overflow-hidden leading-snug">
              {logs.map((log, idx) => (
                <div key={idx} className="truncate">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Telemetry Bar */}
      <DashboardTelemetry
        telemetry={telemetry}
        control={controlInput}
        settings={settings}
        onOpenCalibration={() => setIsCalibrationOpen(true)}
        onOpenCode={() => setIsCodeOpen(true)}
      />

      {/* Footer Status Bar */}
      <footer className="h-7 bg-[#010409] border-t border-[#30363d] flex items-center px-4 justify-between text-[9px] text-gray-500 font-mono shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span>NUMPY_AVX2_OPTIMIZED</span>
          <span className="hidden sm:inline">MEDIAPIPE_GPU_ACCEL</span>
          <span className="hidden md:inline">PYAUTOGUI_BRIDGED</span>
        </div>
        <div>
          <span>PROJECT_NEURALDRIVE_CV // UID: 0xFD29A1</span>
        </div>
      </footer>

      {/* Modals */}
      <CalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        settings={settings}
        mode={mode}
        onUpdateSettings={setSettings}
        onUpdateMode={setMode}
      />

      <CodeViewerModal
        isOpen={isCodeOpen}
        onClose={() => setIsCodeOpen(false)}
        settings={settings}
        mode={mode}
      />

      <ChallengeModal
        isOpen={isChallengeOpen}
        onClose={() => setIsChallengeOpen(false)}
        activeChallenge={challenge}
        onSelectChallenge={setChallenge}
      />
    </div>
  );
}

