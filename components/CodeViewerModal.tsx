'use client';

import React, { useState } from 'react';
import { VisionCalibrationSettings, ControlMode } from '@/types/vision';
import { generatePythonSourceCode } from '@/lib/python-generator';
import { X, Copy, Check, Download, Terminal, Code2 } from 'lucide-react';

interface CodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VisionCalibrationSettings;
  mode: ControlMode;
}

export const CodeViewerModal: React.FC<CodeViewerModalProps> = ({
  isOpen,
  onClose,
  settings,
  mode,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const pythonCode = generatePythonSourceCode(settings, mode);

  const handleCopy = () => {
    navigator.clipboard.writeText(pythonCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([pythonCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gesture_drive_cv.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="code-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-mono"
    >
      <div
        id="code-modal-container"
        className="w-full max-w-3xl bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#e1e4e8]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-blue-400" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Python, OpenCV & MediaPipe Source Export
              </h3>
              <p className="text-[10px] text-gray-400">
                Calibrated script ready for local execution with virtual hardware bridge
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="copy-python-code-btn"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-gray-300 text-[10px] uppercase font-bold transition border border-[#30363d]"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-green-400" />
                  <span className="text-green-400">COPIED!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>COPY CODE</span>
                </>
              )}
            </button>

            <button
              id="download-python-code-btn"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white text-[10px] uppercase font-bold transition shadow"
            >
              <Download className="w-3 h-3" />
              <span>DOWNLOAD .PY</span>
            </button>

            <button
              id="close-code-modal-btn"
              onClick={onClose}
              className="p-1 rounded hover:bg-[#21262d] text-gray-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dependency Notice */}
        <div className="px-4 py-2 bg-[#0d1117] border-b border-[#30363d] flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-2 text-gray-400">
            <Terminal className="w-3.5 h-3.5 text-green-400" />
            <span className="uppercase text-[10px]">Install Dependencies:</span>
            <code className="text-green-400 bg-[#161b22] px-2 py-0.5 rounded border border-[#30363d] text-[10px]">
              pip install opencv-python mediapipe numpy pyautogui
            </code>
          </div>
          <span className="text-gray-500 text-[10px]">PYTHON 3.10+ // NUMPY 1.26+</span>
        </div>

        {/* Code Content */}
        <div className="flex-1 p-4 overflow-y-auto bg-[#0a0c10] font-mono text-[11px] text-gray-300 leading-relaxed border-t border-[#30363d]">
          <pre className="whitespace-pre">
            <code>{pythonCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
