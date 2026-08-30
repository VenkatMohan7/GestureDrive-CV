'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  VehicleControlInput,
  EnvironmentTheme,
  TelemetryData,
  ChallengeMode,
} from '@/types/vision';
import { vehicleAudio } from '@/lib/audio-engine';

interface DrivingCanvasProps {
  controlInput: VehicleControlInput;
  theme: EnvironmentTheme;
  challenge: ChallengeMode;
  onTelemetryUpdate: (telemetry: TelemetryData) => void;
  onChallengeEvent?: (event: string, value: number) => void;
}

interface TrafficCar {
  x: number; // -1 to 1 across road
  z: number; // distance ahead in world units
  speed: number;
  color: string;
  lane: number;
  width: number;
}

interface ConeObstacle {
  x: number;
  z: number;
  cleared: boolean;
}

export const DrivingCanvas: React.FC<DrivingCanvasProps> = ({
  controlInput,
  theme,
  challenge,
  onTelemetryUpdate,
  onChallengeEvent,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const speedDisplayRef = useRef<HTMLSpanElement | null>(null);
  const gearDisplayRef = useRef<HTMLSpanElement | null>(null);
  const throttleBarRef = useRef<HTMLDivElement | null>(null);
  const brakeBarRef = useRef<HTMLDivElement | null>(null);

  // Store props in refs for 60fps render loop stability
  const controlInputRef = useRef(controlInput);
  const themeRef = useRef(theme);
  const challengeRef = useRef(challenge);
  const onTelemetryUpdateRef = useRef(onTelemetryUpdate);
  const onChallengeEventRef = useRef(onChallengeEvent);

  const [unitMph, setUnitMph] = useState(false);
  const unitMphRef = useRef(unitMph);

  useEffect(() => {
    controlInputRef.current = controlInput;
  }, [controlInput]);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    challengeRef.current = challenge;
  }, [challenge]);

  useEffect(() => {
    onTelemetryUpdateRef.current = onTelemetryUpdate;
  }, [onTelemetryUpdate]);

  useEffect(() => {
    onChallengeEventRef.current = onChallengeEvent;
  }, [onChallengeEvent]);

  useEffect(() => {
    unitMphRef.current = unitMph;
  }, [unitMph]);

  // Physics state
  const stateRef = useRef({
    speed: 0, // km/h
    maxSpeed: 230,
    carX: 0, // -1 (left shoulder) to 1 (right shoulder)
    roadPosition: 0,
    curveAngle: 0,
    targetCurve: 0,
    curveTimer: 0,
    score: 0,
    distanceKm: 0,
    lapTime: 0,
    collisionAlert: false,
    traffic: [] as TrafficCar[],
    cones: [] as ConeObstacle[],
    particles: [] as { x: number; y: number; z: number; speed: number; alpha: number }[],
    emergencyObstacleZ: -1,
    emergencyTriggered: false,
    emergencyStartTime: 0,
    reactionRecorded: false,
    lastTelemetryTime: 0,
  });

  // Initialize Traffic and Cones
  const resetObstacles = useCallback(() => {
    const s = stateRef.current;
    s.traffic = [];
    s.cones = [];
    s.emergencyObstacleZ = -1;
    s.emergencyTriggered = false;
    s.reactionRecorded = false;

    if (challenge.id === 'SLALOM_TEST') {
      for (let i = 0; i < 15; i++) {
        s.cones.push({
          x: (i % 2 === 0 ? 0.45 : -0.45),
          z: 300 + i * 220,
          cleared: false,
        });
      }
    } else {
      const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff'];
      for (let i = 0; i < 8; i++) {
        const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
        s.traffic.push({
          x: lane * 0.55,
          z: 250 + i * 380,
          speed: 70 + Math.random() * 60,
          color: colors[i % colors.length],
          lane,
          width: 0.28,
        });
      }
    }
  }, [challenge.id]);

  useEffect(() => {
    resetObstacles();
  }, [resetObstacles]);

  // Main 60fps render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const updateCanvasSize = () => {
      if (!containerRef.current || !canvas) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.floor(rect.width * dpr);
      const targetH = Math.floor(rect.height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    updateCanvasSize();
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimestamp) / 1000);
      lastTimestamp = now;

      const s = stateRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      if (w <= 0 || h <= 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const activeControl = controlInputRef.current;
      const activeTheme = themeRef.current;
      const activeChallenge = challengeRef.current;
      const { steering, throttle, brake, gear, nitro } = activeControl;

      // Acceleration / Deceleration
      let maxSpd = s.maxSpeed;
      if (nitro) maxSpd = 280;
      if (gear === 'R') maxSpd = 45;
      if (gear === 'P') maxSpd = 0;

      const effectiveThrottle = gear === 'P' || gear === 'N' ? 0 : throttle;
      const isReverse = gear === 'R';

      // Power curves
      if (gear === 'P') {
        s.speed = Math.max(0, s.speed - 90 * dt);
      } else if (brake > 0.05) {
        // High-performance braking
        const brakeForce = 120 * brake;
        s.speed = Math.max(0, s.speed - brakeForce * dt);
      } else if (effectiveThrottle > 0.05) {
        const accelRate = (nitro ? 65 : 42) * effectiveThrottle * (1 - s.speed / maxSpd);
        s.speed = Math.min(maxSpd, s.speed + accelRate * dt);
      } else {
        // Air resistance & engine drag
        s.speed = Math.max(0, s.speed - 12 * dt);
      }

      // Lateral Movement
      const steerAgility = Math.min(1.0, 0.25 + (s.speed / 120) * 0.75);
      const lateralSpeed = steering * 2.8 * steerAgility * (isReverse ? -1 : 1);
      s.carX = Math.max(-0.95, Math.min(0.95, s.carX + lateralSpeed * dt));

      // Off-road shoulder drag
      if (Math.abs(s.carX) > 0.78 && s.speed > 50) {
        s.speed = Math.max(30, s.speed - 35 * dt);
      }

      // World road advancement
      const speedMs = (s.speed * 1000) / 3600;
      s.roadPosition += speedMs * dt * 25;
      s.distanceKm += (s.speed * dt) / 3600;
      s.lapTime += dt;

      // Dynamic road curving
      s.curveTimer += dt;
      if (s.curveTimer > 4.5) {
        s.curveTimer = 0;
        s.targetCurve = (Math.random() - 0.5) * 1.6;
      }
      s.curveAngle += (s.targetCurve - s.curveAngle) * dt * 1.2;

      // Calculate RPM for audio & HUD
      const gearRatios = [3.8, 2.4, 1.6, 1.1, 0.85, 0.65];
      const activeGearIdx = Math.min(5, Math.floor(s.speed / 38));
      const gearRatio = gearRatios[activeGearIdx];
      let rpm = 900 + (s.speed * 45 * gearRatio) + effectiveThrottle * 1200;
      if (nitro) rpm += 800;
      if (gear === 'N' || gear === 'P') rpm = 900 + effectiveThrottle * 5500;
      rpm = Math.min(7800, Math.max(850, rpm));

      // G-Forces calculation
      const lateralG = (steering * (s.speed / 100) * 0.95) - (s.curveAngle * (s.speed / 140));
      const longitudinalG = (effectiveThrottle * 0.7) - (brake * 1.2);

      // Sound update
      vehicleAudio.updateVehicleSound(s.speed, rpm, effectiveThrottle, brake, lateralG);

      // --- DRAW BACKGROUND & SKY ---
      const horizonY = h * 0.44;
      const gradient = ctx.createLinearGradient(0, 0, 0, horizonY);

      if (activeTheme === 'CYBER_NEON_NIGHT') {
        gradient.addColorStop(0, '#050512');
        gradient.addColorStop(0.5, '#0d0c2b');
        gradient.addColorStop(1, '#2b0938');
      } else if (activeTheme === 'SUNSET_COAST') {
        gradient.addColorStop(0, '#2d1b4e');
        gradient.addColorStop(0.4, '#b43a59');
        gradient.addColorStop(0.75, '#e07a5f');
        gradient.addColorStop(1, '#f4a261');
      } else {
        // DAY_HIGHWAY
        gradient.addColorStop(0, '#1e3a8a');
        gradient.addColorStop(0.6, '#38bdf8');
        gradient.addColorStop(1, '#bae6fd');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, horizonY);

      // Distant Mountains / City Skyline
      ctx.save();
      const skyOffset = -s.curveAngle * 120;
      if (activeTheme === 'CYBER_NEON_NIGHT') {
        // Cyberpunk neon grid skyline
        ctx.fillStyle = '#09081a';
        for (let i = -2; i < 16; i++) {
          const bx = (i * 90 + skyOffset * 0.4) % (w + 180) - 90;
          const bh = 50 + ((i * 37) % 80);
          ctx.fillRect(bx, horizonY - bh, 70, bh);
          ctx.fillStyle = '#06b6d4';
          ctx.fillRect(bx + 15, horizonY - bh + 10, 4, bh - 15);
          ctx.fillStyle = '#f43f5e';
          ctx.fillRect(bx + 45, horizonY - bh + 20, 4, bh - 25);
          ctx.fillStyle = '#09081a';
        }
      } else {
        // Mountains
        ctx.fillStyle = activeTheme === 'SUNSET_COAST' ? '#38184c' : '#475569';
        ctx.beginPath();
        ctx.moveTo(0, horizonY);
        for (let i = 0; i <= w; i += 40) {
          const mh = Math.sin((i + skyOffset) * 0.008) * 35 + Math.cos((i + skyOffset) * 0.02) * 15;
          ctx.lineTo(i, horizonY - Math.abs(mh) - 15);
        }
        ctx.lineTo(w, horizonY);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // --- DRAW GROUND / TERRAIN ---
      const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
      if (activeTheme === 'CYBER_NEON_NIGHT') {
        groundGrad.addColorStop(0, '#0c0721');
        groundGrad.addColorStop(1, '#05020d');
      } else if (activeTheme === 'SUNSET_COAST') {
        groundGrad.addColorStop(0, '#4a2c1f');
        groundGrad.addColorStop(1, '#1b120c');
      } else {
        groundGrad.addColorStop(0, '#166534');
        groundGrad.addColorStop(1, '#14532d');
      }
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, horizonY, w, h - horizonY);

      // --- 3D PERSPECTIVE ROAD RENDERING ---
      const roadSegments = 160;
      const roadBaseW = w * 0.82;
      const roadTopW = w * 0.035;
      const vanishX = w * 0.5 + s.curveAngle * 180;

      for (let i = roadSegments; i > 0; i--) {
        const p1 = (i - 1) / roadSegments;
        const p2 = i / roadSegments;

        // Exponential perspective curve
        const y1 = horizonY + Math.pow(p1, 2.2) * (h - horizonY);
        const y2 = horizonY + Math.pow(p2, 2.2) * (h - horizonY);

        const rw1 = roadTopW + Math.pow(p1, 2.2) * (roadBaseW - roadTopW);
        const rw2 = roadTopW + Math.pow(p2, 2.2) * (roadBaseW - roadTopW);

        const curveOffset1 = Math.sin(p1 * Math.PI) * s.curveAngle * 140;
        const curveOffset2 = Math.sin(p2 * Math.PI) * s.curveAngle * 140;

        const rx1 = vanishX + (w * 0.5 - vanishX) * (1 - p1) + curveOffset1 - s.carX * rw1 * 0.5;
        const rx2 = vanishX + (w * 0.5 - vanishX) * (1 - p2) + curveOffset2 - s.carX * rw2 * 0.5;

        // Alternating asphalt segments
        const isStripe = Math.floor((s.roadPosition * 0.05 + i * 0.5)) % 2 === 0;

        // Shoulder Curbs (Red / White rumble strips)
        const curbW1 = rw1 * 0.12;
        const curbW2 = rw2 * 0.12;
        ctx.fillStyle = isStripe ? '#dc2626' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(rx1 - rw1 * 0.5 - curbW1, y1);
        ctx.lineTo(rx1 - rw1 * 0.5, y1);
        ctx.lineTo(rx2 - rw2 * 0.5, y2);
        ctx.lineTo(rx2 - rw2 * 0.5 - curbW2, y2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(rx1 + rw1 * 0.5, y1);
        ctx.lineTo(rx1 + rw1 * 0.5 + curbW1, y1);
        ctx.lineTo(rx2 + rw2 * 0.5 + curbW2, y2);
        ctx.lineTo(rx2 + rw2 * 0.5, y2);
        ctx.fill();

        // Asphalt
        ctx.fillStyle = activeTheme === 'CYBER_NEON_NIGHT'
          ? (isStripe ? '#141428' : '#0f0f1f')
          : (isStripe ? '#292524' : '#1c1917');
        ctx.beginPath();
        ctx.moveTo(rx1 - rw1 * 0.5, y1);
        ctx.lineTo(rx1 + rw1 * 0.5, y1);
        ctx.lineTo(rx2 + rw2 * 0.5, y2);
        ctx.lineTo(rx2 - rw2 * 0.5, y2);
        ctx.fill();

        // Road Lane Dividers (Dash lines)
        if (isStripe) {
          ctx.fillStyle = activeTheme === 'CYBER_NEON_NIGHT' ? '#06b6d4' : '#facc15';
          const lineW1 = Math.max(1, rw1 * 0.015);
          const lineW2 = Math.max(1, rw2 * 0.015);

          // Left dash lane
          const ldx1 = rx1 - rw1 * 0.18;
          const ldx2 = rx2 - rw2 * 0.18;
          ctx.beginPath();
          ctx.moveTo(ldx1 - lineW1, y1);
          ctx.lineTo(ldx1 + lineW1, y1);
          ctx.lineTo(ldx2 + lineW2, y2);
          ctx.lineTo(ldx2 - lineW2, y2);
          ctx.fill();

          // Right dash lane
          const rdx1 = rx1 + rw1 * 0.18;
          const rdx2 = rx2 + rw2 * 0.18;
          ctx.beginPath();
          ctx.moveTo(rdx1 - lineW1, y1);
          ctx.lineTo(rdx1 + lineW1, y1);
          ctx.lineTo(rdx2 + lineW2, y2);
          ctx.lineTo(rdx2 - lineW2, y2);
          ctx.fill();
        }
      }

      // --- AUTONOMOUS LANE ASSIST GUIDANCE LINE ---
      ctx.save();
      ctx.strokeStyle = activeTheme === 'CYBER_NEON_NIGHT' ? 'rgba(6, 182, 212, 0.6)' : 'rgba(34, 197, 94, 0.65)';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const p = i / 30;
        const py = horizonY + Math.pow(p, 2.2) * (h - horizonY);
        const prw = roadTopW + Math.pow(p, 2.2) * (roadBaseW - roadTopW);
        const curveOffset = Math.sin(p * Math.PI) * s.curveAngle * 140;
        const px = vanishX + (w * 0.5 - vanishX) * (1 - p) + curveOffset - s.carX * prw * 0.5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // --- OBSTACLES & TRAFFIC SIMULATION ---
      let collisionDetected = false;

      // 1. Slalom Cones
      if (activeChallenge.id === 'SLALOM_TEST') {
        s.cones.forEach((cone) => {
          cone.z -= speedMs * dt * 25;
          if (cone.z < -50) cone.z += 15 * 220; // recycle

          if (cone.z > 0 && cone.z < 2500) {
            const p = Math.max(0.01, Math.min(1.0, 1 - cone.z / 2500));
            const cy = horizonY + Math.pow(p, 2.2) * (h - horizonY);
            const crw = roadTopW + Math.pow(p, 2.2) * (roadBaseW - roadTopW);
            const curveOffset = Math.sin(p * Math.PI) * s.curveAngle * 140;
            const cx = vanishX + (w * 0.5 - vanishX) * (1 - p) + curveOffset + (cone.x - s.carX) * crw * 0.5;

            const coneSize = Math.max(6, p * 36);

            // Draw Traffic Cone
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(cx, cy - coneSize);
            ctx.lineTo(cx - coneSize * 0.45, cy);
            ctx.lineTo(cx + coneSize * 0.45, cy);
            ctx.closePath();
            ctx.fill();

            // White reflective stripe on cone
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(cx - coneSize * 0.2, cy - coneSize * 0.4);
            ctx.lineTo(cx + coneSize * 0.2, cy - coneSize * 0.4);
            ctx.lineTo(cx + coneSize * 0.3, cy - coneSize * 0.2);
            ctx.lineTo(cx - coneSize * 0.3, cy - coneSize * 0.2);
            ctx.closePath();
            ctx.fill();

            // Collision with cone
            if (cone.z < 80 && cone.z > 10 && Math.abs(cone.x - s.carX) < 0.22) {
              collisionDetected = true;
              s.speed = Math.max(15, s.speed - 30 * dt);
            } else if (cone.z <= 10 && !cone.cleared) {
              cone.cleared = true;
              s.score += 100;
              if (onChallengeEventRef.current) onChallengeEventRef.current('CONE_CLEARED', s.score);
            }
          }
        });
      }
      // 2. Emergency Obstacle Test
      else if (activeChallenge.id === 'EMERGENCY_BRAKE') {
        if (!s.emergencyTriggered && s.speed > 80 && s.lapTime > 3.0) {
          s.emergencyTriggered = true;
          s.emergencyObstacleZ = 750;
          s.emergencyStartTime = performance.now();
        }

        if (s.emergencyObstacleZ > -100) {
          s.emergencyObstacleZ -= speedMs * dt * 25;
          const p = Math.max(0.01, Math.min(1.0, 1 - s.emergencyObstacleZ / 2500));
          const ey = horizonY + Math.pow(p, 2.2) * (h - horizonY);
          const erw = roadTopW + Math.pow(p, 2.2) * (roadBaseW - roadTopW);
          const curveOffset = Math.sin(p * Math.PI) * s.curveAngle * 140;
          const ex = vanishX + (w * 0.5 - vanishX) * (1 - p) + curveOffset - s.carX * erw * 0.5;

          const barW = Math.max(20, erw * 0.65);
          const barH = Math.max(10, p * 45);

          // Construction barrier / Stop obstacle
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(ex - barW * 0.5, ey - barH, barW, barH);
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(9, Math.floor(p * 20))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('EMERGENCY BRAKE !', ex, ey - barH * 0.35);

          if (s.emergencyObstacleZ < 100 && s.emergencyObstacleZ > 0) {
            if (s.speed > 10) {
              collisionDetected = true;
              s.speed = 0;
            } else if (!s.reactionRecorded) {
              s.reactionRecorded = true;
              const reactionMs = performance.now() - s.emergencyStartTime;
              s.score = Math.max(100, Math.floor(2000 - reactionMs));
              if (onChallengeEventRef.current) onChallengeEventRef.current('EMERGENCY_STOP_SUCCESS', reactionMs);
            }
          }
        }
      }
      // 3. Ambient AI Highway Traffic
      else {
        s.traffic.forEach((car) => {
          const relativeSpeedMs = ((car.speed - s.speed) * 1000) / 3600;
          car.z += relativeSpeedMs * dt * 25;

          // Recycle traffic car
          if (car.z < -80) {
            car.z = 2200 + Math.random() * 800;
            car.lane = Math.floor(Math.random() * 3) - 1;
            car.x = car.lane * 0.55;
            car.speed = 70 + Math.random() * 60;
            s.score += 50; // Overtake points
          } else if (car.z > 3000) {
            car.z = -50;
          }

          if (car.z > 0 && car.z < 2500) {
            const p = Math.max(0.01, Math.min(1.0, 1 - car.z / 2500));
            const ty = horizonY + Math.pow(p, 2.2) * (h - horizonY);
            const trw = roadTopW + Math.pow(p, 2.2) * (roadBaseW - roadTopW);
            const curveOffset = Math.sin(p * Math.PI) * s.curveAngle * 140;
            const tx = vanishX + (w * 0.5 - vanishX) * (1 - p) + curveOffset + (car.x - s.carX) * trw * 0.5;

            const carWidthPx = Math.max(12, p * 90);
            const carHeightPx = Math.max(8, p * 55);

            // Car Body
            ctx.fillStyle = car.color;
            ctx.beginPath();
            ctx.roundRect(tx - carWidthPx * 0.5, ty - carHeightPx, carWidthPx, carHeightPx, [4, 4, 1, 1]);
            ctx.fill();

            // Rear windshield
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(tx - carWidthPx * 0.38, ty - carHeightPx * 0.85, carWidthPx * 0.76, carHeightPx * 0.4);

            // Red Taillights
            ctx.fillStyle = car.speed < s.speed ? '#ef4444' : '#991b1b';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = p > 0.4 ? 8 : 0;
            ctx.fillRect(tx - carWidthPx * 0.45, ty - carHeightPx * 0.35, carWidthPx * 0.22, carHeightPx * 0.2);
            ctx.fillRect(tx + carWidthPx * 0.23, ty - carHeightPx * 0.35, carWidthPx * 0.22, carHeightPx * 0.2);
            ctx.shadowBlur = 0;

            // License plate
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(tx - carWidthPx * 0.16, ty - carHeightPx * 0.3, carWidthPx * 0.32, carHeightPx * 0.15);

            // Proximity Collision Check
            if (car.z < 95 && car.z > 10 && Math.abs(car.x - s.carX) < 0.24) {
              collisionDetected = true;
              s.speed = Math.max(10, s.speed - 60 * dt);
            }
          }
        });
      }

      if (collisionDetected && !s.collisionAlert) {
        s.collisionAlert = true;
        vehicleAudio.playCollisionAlert();
      } else if (!collisionDetected) {
        s.collisionAlert = false;
      }

      // --- SPEED LINES & NITRO PARTICLES ---
      if (s.speed > 130 || nitro) {
        ctx.save();
        ctx.strokeStyle = nitro ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = nitro ? 3 : 1.5;
        const particleCount = nitro ? 22 : 12;
        for (let i = 0; i < particleCount; i++) {
          const randAngle = Math.random() * Math.PI * 2;
          const dist = 80 + Math.random() * (w * 0.45);
          const px = w * 0.5 + Math.cos(randAngle) * dist;
          const py = horizonY + Math.sin(randAngle) * (dist * 0.6);
          const len = 30 + Math.random() * 60;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(randAngle) * len, py + Math.sin(randAngle) * len);
          ctx.stroke();
        }
        ctx.restore();
      }

      // --- VEHICLE COCKPIT & RACING STEERING WHEEL ---
      const cockpitY = h * 0.68;
      const cockpitGrad = ctx.createLinearGradient(0, cockpitY, 0, h);
      cockpitGrad.addColorStop(0, '#0f172a');
      cockpitGrad.addColorStop(0.2, '#1e293b');
      cockpitGrad.addColorStop(1, '#020617');

      ctx.fillStyle = cockpitGrad;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, cockpitY + 45);
      ctx.bezierCurveTo(w * 0.2, cockpitY - 15, w * 0.8, cockpitY - 15, w, cockpitY + 45);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Windshield A-Pillars
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w * 0.08, 0);
      ctx.lineTo(w * 0.18, cockpitY + 20);
      ctx.lineTo(0, cockpitY + 40);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(w, 0);
      ctx.lineTo(w * 0.92, 0);
      ctx.lineTo(w * 0.82, cockpitY + 20);
      ctx.lineTo(w, cockpitY + 40);
      ctx.closePath();
      ctx.fill();

      // Steering Wheel Position & Dynamic Rotation
      const wheelCenterX = w * 0.5;
      const wheelCenterY = h * 0.86;
      const wheelRadius = Math.min(w * 0.16, 120);
      const wheelAngleRad = steering * (Math.PI * 0.45); // up to ~80 deg rotation

      ctx.save();
      ctx.translate(wheelCenterX, wheelCenterY);
      ctx.rotate(wheelAngleRad);

      // Steering wheel outer rim
      ctx.lineWidth = Math.max(14, wheelRadius * 0.18);
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Center cap and spokes
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, wheelRadius * 0.42, 0, Math.PI * 2);
      ctx.fill();

      // Top 12 o'clock racing marker stripe (Neon / Red)
      ctx.lineWidth = Math.max(14, wheelRadius * 0.18);
      ctx.strokeStyle = activeTheme === 'CYBER_NEON_NIGHT' ? '#06b6d4' : '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 0, wheelRadius, -Math.PI * 0.54, -Math.PI * 0.46);
      ctx.stroke();

      // Horizontal spoke
      ctx.fillStyle = '#475569';
      ctx.fillRect(-wheelRadius * 0.9, -wheelRadius * 0.12, wheelRadius * 1.8, wheelRadius * 0.24);

      // AI Studio / Vision Emblem
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Collision Red Flash Effect
      if (s.collisionAlert) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.restore(); // Restore base transform

      // Direct DOM HUD Updates (Zero React re-render lag or flicker)
      const currentSpeedRounded = Math.round(s.speed);
      const isMph = unitMphRef.current;
      const displaySpeed = Math.round(isMph ? currentSpeedRounded * 0.621371 : currentSpeedRounded);
      if (speedDisplayRef.current) {
        speedDisplayRef.current.textContent = String(displaySpeed);
      }
      if (gearDisplayRef.current) {
        gearDisplayRef.current.textContent = gear || 'D';
      }
      if (throttleBarRef.current) {
        throttleBarRef.current.style.width = `${Math.round(throttle * 100)}%`;
      }
      if (brakeBarRef.current) {
        brakeBarRef.current.style.width = `${Math.round(brake * 100)}%`;
      }

      // Throttled Telemetry Dispatch (~10 Hz)
      if (now - s.lastTelemetryTime > 100) {
        s.lastTelemetryTime = now;
        onTelemetryUpdateRef.current({
          speedKmh: currentSpeedRounded,
          rpm: Math.round(rpm),
          gear: gear || 'D',
          lateralG: Number(lateralG.toFixed(2)),
          longitudinalG: Number(longitudinalG.toFixed(2)),
          distanceTraveledKm: Number(s.distanceKm.toFixed(2)),
          fuelOrBatteryPct: 98,
          collisionWarning: s.collisionAlert,
          score: s.score,
          lapTimeSeconds: Math.floor(s.lapTime),
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, []); // Run effect once on mount for rock-solid 60 FPS animation

  return (
    <div
      ref={containerRef}
      id="driving-canvas-container"
      className="relative w-full h-full min-h-[380px] bg-slate-950 overflow-hidden select-none flex items-center justify-center"
    >
      <canvas
        ref={canvasRef}
        id="driving-simulation-viewport"
        className="w-full h-full block"
      />

      {/* Top Cockpit Telemetry Bar */}
      <div
        id="cockpit-top-hud"
        className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none text-white text-xs font-mono drop-shadow-md z-20"
      >
        <div className="flex items-center gap-3 bg-[#161b22]/90 backdrop-blur-md px-3 py-1.5 rounded border border-[#30363d]">
          <span className="flex items-center gap-1.5 text-green-400 font-semibold text-[11px]">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            VISION_LINKED
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-[11px] text-gray-400">
            MODE: <strong className="text-blue-400">{challenge.title.toUpperCase()}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            id="mph-kmh-toggle-btn"
            onClick={() => setUnitMph(!unitMph)}
            className="px-2.5 py-1 rounded bg-[#161b22] hover:bg-[#21262d] text-gray-300 border border-[#30363d] transition text-[10px] font-mono uppercase"
            title="Toggle Speedometer Unit"
          >
            UNIT: {unitMph ? 'MPH' : 'KM/H'}
          </button>
        </div>
      </div>

      {/* Center Gear / Speedometer HUD Overlaid */}
      <div
        id="cockpit-digital-cluster"
        className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center justify-center font-mono z-20"
      >
        <div className="bg-[#161b22]/95 backdrop-blur-md px-5 py-2 rounded-lg border border-[#30363d] shadow-2xl flex items-center gap-5">
          {/* Gear Indicator */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-gray-500 uppercase">GEAR</span>
            <span ref={gearDisplayRef} className="text-xl font-bold text-amber-400">
              {controlInput.gear || 'D'}
            </span>
          </div>

          {/* Large Speed Display */}
          <div className="flex flex-col items-center min-w-[80px]">
            <div className="text-3xl font-bold text-white tracking-tight flex items-baseline gap-1">
              <span ref={speedDisplayRef}>0</span>
              <span className="text-[10px] text-gray-500 font-normal">{unitMph ? 'mph' : 'km/h'}</span>
            </div>
          </div>

          {/* Throttle status */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-gray-500 uppercase">THROTTLE</span>
            <div className="w-12 bg-[#0d1117] h-2 rounded overflow-hidden mt-1 border border-[#30363d]">
              <div
                ref={throttleBarRef}
                className="bg-green-400 h-full transition-all duration-75"
                style={{ width: `${Math.round(controlInput.throttle * 100)}%` }}
              />
            </div>
          </div>

          {/* Brake pressure status */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-gray-500 uppercase">BRAKE</span>
            <div className="w-12 bg-[#0d1117] h-2 rounded overflow-hidden mt-1 border border-[#30363d]">
              <div
                ref={brakeBarRef}
                className="bg-red-500 h-full transition-all duration-75"
                style={{ width: `${Math.round(controlInput.brake * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
