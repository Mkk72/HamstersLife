/**
 * Процедурный звук на WebAudio: без файлов и лицензий. Контекст создаётся
 * лениво — браузеры разрешают звук только после действия пользователя.
 */
export class Sfx {
  #ctx: AudioContext | null = null;
  #enabled = true;

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
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
