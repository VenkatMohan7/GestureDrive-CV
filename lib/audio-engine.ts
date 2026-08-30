'use client';

class VehicleAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Engine sound nodes
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Tire screech nodes
  private tireNoiseNode: AudioBufferSourceNode | null = null;
  private tireGain: GainNode | null = null;

  // Master volume
  private masterGain: GainNode | null = null;

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Create Engine Synth
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.setValueAtTime(22.5, this.ctx.currentTime);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

      this.engineOsc.connect(this.engineFilter);
      this.engineSubOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc.start();
      this.engineSubOsc.start();

      // Create Noise Generator for Tire Screech
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.tireGain = this.ctx.createGain();
      this.tireGain.gain.setValueAtTime(0, this.ctx.currentTime);

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      noiseFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

      const tireNoise = this.ctx.createBufferSource();
      tireNoise.buffer = noiseBuffer;
      tireNoise.loop = true;
      tireNoise.connect(noiseFilter);
      noiseFilter.connect(this.tireGain);
      this.tireGain.connect(this.masterGain);
      tireNoise.start();

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API not allowed yet or failed to start:', e);
    }
  }

  public updateVehicleSound(speedKmh: number, rpm: number, throttle: number, brake: number, lateralG: number) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;

    // RPM mapping (Idle ~900 to Redline ~7500 RPM)
    const baseFreq = 35 + (rpm / 7500) * 140;
    if (this.engineOsc && this.engineSubOsc && this.engineFilter && this.engineGain) {
      this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
      this.engineSubOsc.frequency.setTargetAtTime(baseFreq / 2, now, 0.05);

      // Filter opens up with throttle
      const filterCutoff = 250 + throttle * 1200 + (speedKmh / 200) * 800;
      this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.05);

      // Volume increases with throttle & speed
      const targetGain = 0.15 + throttle * 0.25 + (speedKmh / 250) * 0.1;
      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
    }

    // Tire Screech volume on high lateral G or hard braking
    if (this.tireGain) {
      const isHardBraking = brake > 0.6 && speedKmh > 35;
      const isHardCornering = Math.abs(lateralG) > 0.65 && speedKmh > 50;
      const screechIntensity = isHardBraking ? brake * 0.5 : isHardCornering ? Math.min(0.4, (Math.abs(lateralG) - 0.65) * 0.8) : 0;
      this.tireGain.gain.setTargetAtTime(screechIntensity, now, 0.08);
    }
  }

  public playGearShift() {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      if (this.masterGain) gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch {}
  }

  public playCollisionAlert() {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
      osc.connect(gain);
      if (this.masterGain) gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch {}
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}

export const vehicleAudio = new VehicleAudioEngine();
