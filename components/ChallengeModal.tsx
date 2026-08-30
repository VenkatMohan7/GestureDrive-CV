'use client';

import React from 'react';
import { ChallengeMode } from '@/types/vision';
import { X, Trophy, Flag, ShieldAlert, Zap, Compass } from 'lucide-react';

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeChallenge: ChallengeMode;
  onSelectChallenge: (challenge: ChallengeMode) => void;
}

export const CHALLENGES: ChallengeMode[] = [
  {
    id: 'FREE_DRIVE',
    title: 'Free Highway Cruise',
    description: 'Freely navigate multi-lane highway traffic using smooth hand tilt steering, dynamic throttle, and overtaking scoring.',
    targetMetric: 'High Score / Distance (km)',
    bestRecord: '4,250 pts',
  },
  {
    id: 'SLALOM_TEST',
    title: 'Slalom Steering Precision Test',
    description: 'Test sub-35ms frame latency agility by weaving continuously around slalom cones without touching boundaries.',
    targetMetric: 'Cones Cleared (100 pts each)',
    bestRecord: '15 / 15 Cones',
  },
  {
    id: 'EMERGENCY_BRAKE',
    title: 'Emergency Braking Benchmark',
    description: 'Accelerate to high speed on open highway; when sudden barrier appears, immediately trigger closed-fist emergency brake.',
    targetMetric: 'Reaction Latency (ms)',
    bestRecord: '245 ms',
  },
  {
    id: 'HIGHWAY_OVERTAKE',
    title: 'Autobahn Speed Time Trial',
    description: 'Maintain maximum top speed with Nitro Boost while dynamically slicing through fast-moving vehicle packs.',
    targetMetric: 'Top Speed & Lap Time',
    bestRecord: '278 km/h',
  },
];

export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  isOpen,
  onClose,
  activeChallenge,
  onSelectChallenge,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="challenge-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-mono"
    >
      <div
        id="challenge-modal-container"
        className="w-full max-w-xl bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl overflow-hidden flex flex-col text-[#e1e4e8]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Autonomous Driving Benchmark Modes
              </h3>
              <p className="text-[10px] text-gray-400">
                Evaluate gesture steering precision, emergency reaction time, and slalom navigation
              </p>
            </div>
          </div>

          <button
            id="close-challenge-modal-btn"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#21262d] text-gray-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Challenge List */}
        <div className="p-4 space-y-2.5 max-h-[70vh] overflow-y-auto">
          {CHALLENGES.map((ch) => {
            const isSelected = ch.id === activeChallenge.id;
            return (
              <div
                key={ch.id}
                id={`challenge-card-${ch.id}`}
                onClick={() => {
                  onSelectChallenge(ch);
                  onClose();
                }}
                className={`p-3 rounded border cursor-pointer transition flex items-start gap-3 ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-500/80 ring-1 ring-amber-500/30'
                    : 'bg-[#0d1117] border-[#30363d] hover:border-gray-500 hover:bg-[#161b22]'
                }`}
              >
                <div className="p-2 rounded bg-[#161b22] border border-[#30363d] shrink-0 text-amber-400 mt-0.5">
                  {ch.id === 'FREE_DRIVE' && <Compass className="w-4 h-4" />}
                  {ch.id === 'SLALOM_TEST' && <Flag className="w-4 h-4" />}
                  {ch.id === 'EMERGENCY_BRAKE' && <ShieldAlert className="w-4 h-4" />}
                  {ch.id === 'HIGHWAY_OVERTAKE' && <Zap className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wide">
                      {ch.title}
                    </h4>
                    {isSelected && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                        ACTIVE BENCHMARK
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 leading-snug mb-1.5">
                    {ch.description}
                  </p>
                  <div className="flex items-center gap-4 text-[9px] font-mono text-gray-500">
                    <span>TARGET: <strong className="text-gray-200">{ch.targetMetric}</strong></span>
                    <span>RECORD: <strong className="text-green-400">{ch.bestRecord}</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
