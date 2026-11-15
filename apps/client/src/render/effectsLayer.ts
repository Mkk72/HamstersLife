/**
 * Эффекты: разлёт частиц в одной `Graphics`. Раньше каждая частица была
 * отдельным объектом Pixi — при частых столкновениях это давало десятки
 * draw call'ов и аллокаций на ровном месте. Теперь геометрия перерисовывается
 * раз в кадр, объектов не создаётся.
 */
import { Container, Graphics } from 'pixi.js';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  readonly maxLife: number;
  readonly color: number;
}

const PARTICLE_COUNT = 10;
const GRAVITY = 0.0008;
const MAX_PARTICLES = 160;

export class EffectsLayer {
  readonly view = new Container();
  readonly #gfx = new Graphics();
  readonly #particles: Particle[] = [];

  constructor() {
    this.view.addChild(this.#gfx);
  }

  burst(x: number, y: number, color: number): void {
    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      if (this.#particles.length >= MAX_PARTICLES) break;
      const angle = (Math.PI * 2 * index) / PARTICLE_COUNT + Math.random() * 0.4;
      const speed = 0.12 + Math.random() * 0.16;
      this.#particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 520,
        maxLife: 520,
        color,
      });
    }
  }

  tick(deltaMs: number): void {
    for (let index = this.#particles.length - 1; index >= 0; index -= 1) {
      const particle = this.#particles[index];
      if (!particle) continue;
      particle.life -= deltaMs;
      if (particle.life <= 0) {
        this.#particles.splice(index, 1);
        continue;
      }
      particle.vy += GRAVITY * deltaMs;
      particle.x += particle.vx * deltaMs;
      particle.y += particle.vy * deltaMs;
    }
    this.#draw();
  }

  #draw(): void {
    const g = this.#gfx;
    g.clear();
    for (const particle of this.#particles) {
      g.circle(particle.x, particle.y, 2.2).fill({
        color: particle.color,
        alpha: particle.life / particle.maxLife,
      });
    }
  }
}
