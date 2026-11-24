// Web Audio API Synthesizer for Kitchen and Customer Alerts
// Works reliably across all browsers without external audio asset dependencies

class SoundManager {
  private ctx: AudioContext | null = null;
  private alertInterval: any = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play a single tone
  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.5, startTimeOffset = 0) {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTimeOffset);

      gain.gain.setValueAtTime(gainVal, ctx.currentTime + startTimeOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTimeOffset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + startTimeOffset);
      osc.stop(ctx.currentTime + startTimeOffset + duration);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Incoming Order Alarm: Loud, distinct multi-tone bell chime
  public playIncomingOrder(volume = 0.9) {
    // 3 harmonic bells: 587.33Hz (D5), 880Hz (A5), 1174.66Hz (D6)
    this.playTone(587.33, 0.4, 'triangle', volume * 0.8, 0);
    this.playTone(880, 0.4, 'sine', volume * 0.9, 0.15);
    this.playTone(1174.66, 0.8, 'sine', volume, 0.3);
  }

  // Continuous loop alarm until dismissed by cafe staff
  public startRepeatingAlarm(volume = 0.9) {
    this.stopRepeatingAlarm();
    this.playIncomingOrder(volume);
    this.alertInterval = setInterval(() => {
      this.playIncomingOrder(volume);
    }, 2500);
  }

  public stopRepeatingAlarm() {
    if (this.alertInterval) {
      clearInterval(this.alertInterval);
      this.alertInterval = null;
    }
  }

  // Customer Assistance Chime (Waiter, Bill, Water)
  public playAssistanceChime(volume = 0.8) {
    this.playTone(659.25, 0.3, 'sine', volume * 0.8, 0); // E5
    this.playTone(830.61, 0.5, 'sine', volume, 0.2); // G#5
  }

  // Order Placement Success Chime
  public playOrderSuccess(volume = 0.7) {
    this.playTone(523.25, 0.2, 'sine', volume * 0.7, 0); // C5
    this.playTone(659.25, 0.2, 'sine', volume * 0.8, 0.1); // E5
    this.playTone(783.99, 0.4, 'sine', volume, 0.2); // G5
  }
}

export const soundManager = new SoundManager();
