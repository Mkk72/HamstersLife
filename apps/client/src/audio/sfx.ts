/**
 * Процедурный звук на WebAudio: без файлов и лицензий. Контекст создаётся
 * лениво — браузеры разрешают звук только после действия пользователя.
 */
export class Sfx {
  #ctx: AudioContext | null = null;
  #enabled = true;
  #music: OscillatorNode[] = [];
  #master: GainNode | null = null;

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    if (!enabled) this.stopMusic();
  }

  /** Вызвать из обработчика ввода: разблокирует звук. */
  ensure(): void {
    if (!this.#enabled) return;
    if (!this.#ctx) {
      const Ctor = window.AudioContext;
      if (!Ctor) return;
      this.#ctx = new Ctor();
    }
    if (this.#ctx.state === 'suspended') void this.#ctx.resume();
  }

  click(): void {
    this.#tone(520, 0.045, 'triangle', 0.035);
  }

  select(): void {
    this.#tone(740, 0.04, 'sine', 0.028);
  }

  cut(): void {
    this.#sweep(680, 220, 0.14, 0.04);
  }

  victory(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      this.#tone(frequency, 0.2, 'triangle', 0.05, index * 0.12);
    });
  }

  defeat(): void {
    [392, 329.63, 261.63].forEach((frequency, index) => {
      this.#tone(frequency, 0.26, 'sine', 0.05, index * 0.16);
    });
  }

  send(): void {
    this.#tone(660, 0.09, 'triangle', 0.05);
    this.#tone(880, 0.07, 'sine', 0.03, 0.03);
  }

  capture(): void {
    this.#tone(392, 0.1, 'sine', 0.06);
    this.#tone(587, 0.12, 'sine', 0.05, 0.06);
  }

  boost(): void {
    this.#sweep(320, 760, 0.22, 0.05);
  }

  error(): void {
    this.#tone(170, 0.14, 'sawtooth', 0.03);
  }

  /**
   * Тихая «космическая» подложка: четыре ноты с расстройкой и медленным
   * дыханием громкости. Процедурно, как и остальной звук.
   */
  startMusic(): void {
    const ctx = this.#ctx;
    if (!ctx || !this.#enabled || this.#music.length > 0) return;

    const master = ctx.createGain();
    master.gain.value = 0.045;
    master.connect(ctx.destination);
    this.#master = master;

    const notes = [110, 164.81, 220, 277.18];
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 4 - 6;

      const voice = ctx.createGain();
      voice.gain.value = index === 0 ? 0.55 : 0.22;
      oscillator.connect(voice).connect(master);
      oscillator.start();
      this.#music.push(oscillator);
    });

    // Медленное «дыхание» — LFO на общую громкость.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.055;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(master.gain);
    lfo.start();
    this.#music.push(lfo);
  }

  stopMusic(): void {
    for (const oscillator of this.#music) {
      try {
        oscillator.stop();
      } catch {
        // уже остановлен — не ошибка
      }
      oscillator.disconnect();
    }
    this.#music = [];
    this.#master?.disconnect();
    this.#master = null;
  }

  #tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void {
    const ctx = this.#ctx;
    if (!ctx || !this.#enabled) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  #sweep(from: number, to: number, duration: number, gain: number): void {
    const ctx = this.#ctx;
    if (!ctx || !this.#enabled) return;
    const start = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}
