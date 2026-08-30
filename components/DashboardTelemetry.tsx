'use client';

import React from 'react';
import { TelemetryData, VehicleControlInput, VisionCalibrationSettings } from '@/types/vision';
import { Activity, Gauge, Cpu, CheckCircle, Zap, ShieldAlert, Sparkles, Sliders } from 'lucide-react';

interface DashboardTelemetryProps {
  telemetry: TelemetryData;
  control: VehicleControlInput;
  settings: VisionCalibrationSettings;
  onOpenCalibration: () => void;
  onOpenCode: () => void;
}

export const DashboardTelemetry: React.FC<DashboardTelemetryProps> = ({
  telemetry,
  control,
  settings,
  onOpenCalibration,
  onOpenCode,
}) => {
  return (
    <div
      id="dashboard-telemetry-panel"
      className="bg-[#161b22] border-t border-[#30363d] p-3 select-none text-[#e1e4e8] font-mono shrink-0"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Latency & Frame Pipeline */}
        <div
          id="metric-card-latency"
          className="bg-[#0d1117] rounded border border-[#30363d] p-3 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>FRAME LATENCY</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-green-950 text-green-300 font-bold border border-green-800/80">
              TARGET &lt;35MS
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-xl font-mono font-bold text-white tracking-tight">
              {control.latencyMs.toFixed(1)}
            </span>
            <span className="text-[10px] text-gray-500 font-mono">ms / frame</span>
          </div>

          {/* Latency Pipeline Breakdown Progress Bars */}
          <div className="space-y-1 text-[9px] font-mono text-gray-400">
            <div className="flex justify-between">
              <span>OpenCV Optical Grab</span>
              <span className="text-gray-300">{(control.latencyMs * 0.28).toFixed(1)}ms</span>
            </div>
            <div className="w-full bg-[#161b22] h-1 rounded-full overflow-hidden border border-[#30363d]">
              <div className="bg-blue-500 h-full" style={{ width: '28%' }} />
            </div>

            <div className="flex justify-between pt-0.5">
              <span>MediaPipe 21-LM Inference</span>
              <span className="text-gray-300">{(control.latencyMs * 0.58).toFixed(1)}ms</span>
            </div>
            <div className="w-full bg-[#161b22] h-1 rounded-full overflow-hidden border border-[#30363d]">
              <div className="bg-green-500 h-full" style={{ width: '58%' }} />
            </div>

            <div className="flex justify-between pt-0.5">
              <span>NumPy Vector Kinematics</span>
              <span className="text-gray-300">{(control.latencyMs * 0.14).toFixed(1)}ms</span>
            </div>
            <div className="w-full bg-[#161b22] h-1 rounded-full overflow-hidden border border-[#30363d]">
              <div className="bg-purple-500 h-full" style={{ width: '14%' }} />
            </div>
          </div>
        </div>

        {/* Card 2: Classification Accuracy */}
        <div
          id="metric-card-accuracy"
          className="bg-[#0d1117] rounded border border-[#30363d] p-3 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase">
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              <span>CLASSIFICATION ACCURACY</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 font-bold border border-blue-800/80">
              BENCHMARK
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-xl font-mono font-bold text-green-400 tracking-tight">
              94.6%
            </span>
            <span className="text-[10px] text-gray-500">Confidence: {(control.confidence * 100).toFixed(0)}%</span>
          </div>

          <div className="bg-[#161b22] rounded p-2 border border-[#30363d] text-[10px] font-mono flex items-center justify-between">
            <span className="text-gray-500 uppercase">ACTIVE CLASSIFIER:</span>
            <span className="text-amber-400 font-bold">
              {control.activeGesture.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Card 3: Lateral / Longitudinal G-Forces */}
        <div
          id="metric-card-gforces"
          className="bg-[#0d1117] rounded border border-[#30363d] p-3 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              <span>VEHICLE DYNAMICS</span>
            </div>
            <span className="text-[9px] font-mono text-gray-500 uppercase">
              G-METER
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-[#161b22] p-1.5 rounded border border-[#30363d]">
              <span className="text-[9px] text-gray-500 uppercase block mb-0.5">LATERAL G</span>
              <span className="text-base font-bold text-white">
                {telemetry.lateralG > 0 ? `+${telemetry.lateralG}` : telemetry.lateralG}
              </span>
            </div>
            <div className="bg-[#161b22] p-1.5 rounded border border-[#30363d]">
              <span className="text-[9px] text-gray-500 uppercase block mb-0.5">RPM TACH</span>
              <span className="text-base font-bold text-blue-400">
                {telemetry.rpm}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1.5 text-[10px] text-gray-400">
            <span>Score: <strong className="text-amber-400">{telemetry.score} pts</strong></span>
            <span>Dist: <strong className="text-gray-200">{telemetry.distanceTraveledKm} km</strong></span>
          </div>
        </div>

        {/* Card 4: Quick Actions & Python Code Exporter */}
        <div
          id="metric-card-actions"
          className="bg-[#0d1117] rounded border border-[#30363d] p-3 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>PYTHON CODE INTEGRATION</span>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
            Export standalone OpenCV + MediaPipe script calibrated with current kinematics filters.
          </p>

          <div className="flex items-center gap-2">
            <button
              id="view-python-script-btn"
              onClick={onOpenCode}
              className="flex-1 py-1 px-2.5 rounded bg-blue-700 hover:bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition uppercase"
            >
              <Zap className="w-3 h-3" />
              <span>PYTHON (.PY)</span>
            </button>

            <button
              id="calibrate-params-btn"
              onClick={onOpenCalibration}
              className="py-1 px-2.5 rounded bg-[#21262d] hover:bg-[#30363d] text-gray-300 text-[10px] border border-[#30363d] transition uppercase"
              title="Calibration Settings"
            >
              <Sliders className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
