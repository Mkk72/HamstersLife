/**
 * Эффекты захвата: короткий разлёт частиц. Пул переиспользует `Graphics`,
 * чтобы кадр не аллоцировал объекты (бюджет кадра из ARCHITECTURE §4).
 */
import { Container, Graphics } from 'pixi.js';

interface Particle {
  readonly gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  readonly maxLife: number;
}

const PARTICLE_COUNT = 10;
const GRAVITY = 0.0008;

export class EffectsLayer {
  readonly view = new Container();
  readonly #particles: Particle[] = [];

  burst(x: number, y: number, color: number): void {
    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      const gfx = new Graphics();
      gfx.circle(0, 0, 2.2).fill({ color });
      gfx.position.set(x, y);
      const angle = (Math.PI * 2 * index) / PARTICLE_COUNT + Math.random() * 0.4;
      const speed = 0.12 + Math.random() * 0.16;
      this.#particles.push({
        gfx,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 520,
        maxLife: 520,
      });
      this.view.addChild(gfx);
    }
  }

  tick(deltaMs: number): void {
    for (let index = this.#particles.length - 1; index >= 0; index -= 1) {
      const particle = this.#particles[index];
      if (!particle) continue;
      particle.life -= deltaMs;
      if (particle.life <= 0) {
        particle.gfx.destroy();
        this.#particles.splice(index, 1);
        continue;
      }
      particle.vy += GRAVITY * deltaMs;
      particle.gfx.position.x += particle.vx * deltaMs;
      particle.gfx.position.y += particle.vy * deltaMs;
      particle.gfx.alpha = particle.life / particle.maxLife;
    }
  }
}
