'use client';

import React from 'react';
import { VisionCalibrationSettings, ControlMode } from '@/types/vision';
import { X, Sliders, RotateCcw, Check, Sparkles } from 'lucide-react';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VisionCalibrationSettings;
  mode: ControlMode;
  onUpdateSettings: (newSettings: VisionCalibrationSettings) => void;
  onUpdateMode: (mode: ControlMode) => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  settings,
  mode,
  onUpdateSettings,
  onUpdateMode,
}) => {
  if (!isOpen) return null;

  const handleResetDefaults = () => {
    onUpdateSettings({
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
      throttleScheme: 'OPEN_PALM_ACCEL',
    });
  };

  return (
    <div
      id="calibration-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div
        id="calibration-modal-container"
        className="w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl overflow-hidden flex flex-col text-[#e1e4e8] text-xs font-mono"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Vision & Kinematics Calibration Parameters
              </h3>
              <p className="text-[10px] text-gray-400">
                Live MediaPipe threshold & NumPy EMA vector filters
              </p>
            </div>
          </div>
          <button
            id="close-calibration-modal-btn"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#21262d] text-gray-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto font-mono">
          {/* Tracking Mode Switcher */}
          <div>
            <label className="block text-gray-400 text-[10px] uppercase font-bold mb-1.5">
              Gestural Tracking Architecture
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="mode-single-hand-btn"
                onClick={() => onUpdateMode('SINGLE_HAND_GESTURE')}
                className={`p-2.5 rounded border text-left transition ${
                  mode === 'SINGLE_HAND_GESTURE'
                    ? 'bg-blue-950/80 border-blue-500 text-blue-200'
                    : 'bg-[#0d1117] border-[#30363d] hover:border-gray-600 text-gray-300'
                }`}
              >
                <div className="font-bold text-xs mb-0.5 uppercase">Single-Hand Tilt</div>
                <div className="text-[10px] text-gray-400 leading-snug">
                  Wrist-to-middle MCP angle steers vehicle; open hand accelerates & drives, closed fist brakes.
                </div>
              </button>

              <button
                id="mode-dual-hand-btn"
                onClick={() => onUpdateMode('DUAL_HAND_WHEEL')}
                className={`p-2.5 rounded border text-left transition ${
                  mode === 'DUAL_HAND_WHEEL'
                    ? 'bg-blue-950/80 border-blue-500 text-blue-200'
                    : 'bg-[#0d1117] border-[#30363d] hover:border-gray-600 text-gray-300'
                }`}
              >
                <div className="font-bold text-xs mb-0.5 uppercase">Dual-Hand Wheel</div>
                <div className="text-[10px] text-gray-400 leading-snug">
                  Vector between both hands forms a virtual rotating steering wheel.
                </div>
              </button>
            </div>
          </div>

          {/* Throttle / Brake Scheme Selector */}
          <div>
            <label className="block text-gray-400 text-[10px] uppercase font-bold mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Throttle & Brake Control Scheme</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="scheme-open-palm-btn"
                onClick={() =>
                  onUpdateSettings({ ...settings, throttleScheme: 'OPEN_PALM_ACCEL' })
                }
                className={`p-2.5 rounded border text-left transition ${
                  (settings.throttleScheme || 'OPEN_PALM_ACCEL') === 'OPEN_PALM_ACCEL'
                    ? 'bg-green-950/80 border-green-500 text-green-200'
                    : 'bg-[#0d1117] border-[#30363d] hover:border-gray-600 text-gray-300'
                }`}
              >
                <div className="font-bold text-xs mb-0.5 uppercase text-green-400">
                  Open Palm = Drive (Recommended)
                </div>
                <div className="text-[10px] text-gray-400 leading-snug">
                  🖐️ Open Hand accelerates & cruises; ✊ Fist brakes & stops.
                </div>
              </button>

              <button
                id="scheme-fist-btn"
                onClick={() =>
                  onUpdateSettings({ ...settings, throttleScheme: 'FIST_ACCEL' })
                }
                className={`p-2.5 rounded border text-left transition ${
                  settings.throttleScheme === 'FIST_ACCEL'
                    ? 'bg-blue-950/80 border-blue-500 text-blue-200'
                    : 'bg-[#0d1117] border-[#30363d] hover:border-gray-600 text-gray-300'
                }`}
              >
                <div className="font-bold text-xs mb-0.5 uppercase text-blue-400">
                  Fist = Drive (Classic)
                </div>
                <div className="text-[10px] text-gray-400 leading-snug">
                  ✊ Closed Fist accelerates; ✋ Open Palm brakes hard.
                </div>
              </button>
            </div>
          </div>

          {/* Slider 1: Steering Sensitivity */}
          <div className="bg-[#0d1117] p-3 rounded border border-[#30363d]">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-[10px] uppercase text-gray-300">Steering Sensitivity</span>
              <span className="font-mono text-blue-400 font-bold text-xs">
                {settings.steeringSensitivity.toFixed(2)}x
              </span>
            </div>
            <input
              id="slider-steering-sensitivity"
              type="range"
              min="0.5"
              max="2.5"
              step="0.05"
              value={settings.steeringSensitivity}
              onChange={(e) =>
                onUpdateSettings({ ...settings, steeringSensitivity: parseFloat(e.target.value) })
              }
              className="w-full accent-blue-400 h-1.5 bg-[#161b22] rounded cursor-pointer"
            />
            <span className="text-[9px] text-gray-500 mt-1 block">
              Multiplies raw angular deflection for tighter vehicle response.
            </span>
          </div>

          {/* Slider 2: Deadzone Angle */}
          <div className="bg-[#0d1117] p-3 rounded border border-[#30363d]">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-[10px] uppercase text-gray-300">Deadzone Angle</span>
              <span className="font-mono text-blue-400 font-bold text-xs">
                {settings.deadzoneAngle.toFixed(1)}°
              </span>
            </div>
            <input
              id="slider-deadzone-angle"
              type="range"
              min="1.0"
              max="15.0"
              step="0.5"
              value={settings.deadzoneAngle}
              onChange={(e) =>
                onUpdateSettings({ ...settings, deadzoneAngle: parseFloat(e.target.value) })
              }
              className="w-full accent-blue-400 h-1.5 bg-[#161b22] rounded cursor-pointer"
            />
            <span className="text-[9px] text-gray-500 mt-1 block">
              Prevents unintended vehicle drift when hand is resting near center.
            </span>
          </div>

          {/* Slider 3: Exponential Moving Average Smoothing */}
          <div className="bg-[#0d1117] p-3 rounded border border-[#30363d]">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-[10px] uppercase text-gray-300">EMA Filter Smoothing</span>
              <span className="font-mono text-blue-400 font-bold text-xs">
                {settings.smoothingFactor.toFixed(2)}
              </span>
            </div>
            <input
              id="slider-smoothing-factor"
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={settings.smoothingFactor}
              onChange={(e) =>
                onUpdateSettings({ ...settings, smoothingFactor: parseFloat(e.target.value) })
              }
              className="w-full accent-blue-400 h-1.5 bg-[#161b22] rounded cursor-pointer"
            />
            <span className="text-[9px] text-gray-500 mt-1 block">
              Reduces webcam jitter while maintaining sub-35ms frame latency.
            </span>
          </div>

          {/* Toggles */}
          <div className="space-y-1.5 pt-1">
            <label className="flex items-center justify-between p-2 rounded bg-[#0d1117] border border-[#30363d] cursor-pointer">
              <span className="text-gray-300 text-[11px]">Invert Steering Direction</span>
              <input
                id="toggle-invert-steering"
                type="checkbox"
                checked={settings.invertSteering}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, invertSteering: e.target.checked })
                }
                className="w-3.5 h-3.5 accent-blue-400 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#0d1117] border border-[#30363d] cursor-pointer">
              <span className="text-gray-300 text-[11px]">Mirror Camera Viewport</span>
              <input
                id="toggle-mirror-camera"
                type="checkbox"
                checked={settings.mirrorCamera}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, mirrorCamera: e.target.checked })
                }
                className="w-3.5 h-3.5 accent-blue-400 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#0d1117] border border-[#30363d] cursor-pointer">
              <span className="text-gray-300 text-[11px]">Render MediaPipe 21-Joint Skeleton</span>
              <input
                id="toggle-show-landmarks"
                type="checkbox"
                checked={settings.showLandmarks}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, showLandmarks: e.target.checked })
                }
                className="w-3.5 h-3.5 accent-blue-400 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#010409] border-t border-[#30363d]">
          <button
            id="reset-calibration-defaults-btn"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-gray-300 text-[10px] font-mono border border-[#30363d] transition uppercase"
          >
            <RotateCcw className="w-3 h-3" />
            <span>RESET DEFAULTS</span>
          </button>

          <button
            id="save-calibration-btn"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white font-bold text-[10px] font-mono transition uppercase shadow"
          >
            <Check className="w-3 h-3" />
            <span>APPLY & CLOSE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
