/**
 * Маскировка чисел на границе клиента (SECURITY.md §6.1).
 *
 * Значение хранится как XOR с ключом, рядом — контрольная сумма. Ключ
 * периодически меняется с перешифровкой. Это защита от правки памяти и
 * DevTools **на границе отображения**: правила считает ядро, а сетевой матч —
 * сервер, поэтому «взлом» меняет только картинку у себя.
 *
 * Ядро намеренно не использует эту обёртку: сервер и тесты считают открытыми
 * целыми, иначе ломаются хэш и детерминизм (ARCHITECTURE.md §10).
 */

export function encodeValue(value: number, mask: number): number {
  return (value ^ mask) >>> 0;
}

export function checksumFor(value: number, mask: number): number {
  return (value + mask) >>> 0;
}

export interface DecodedValue {
  readonly value: number;
  readonly valid: boolean;
}

export function decodeValue(stored: number, mask: number, checksum: number): DecodedValue {
  const value = (stored ^ mask) >>> 0;
  return { value, valid: checksumFor(value, mask) === (checksum >>> 0) };
}

export class ProtectedInt {
  #stored = 0;
  #mask = 0;
  #checksum = 0;
  #tampered = false;

  constructor(value = 0, mask = 0x9e3779b9) {
    this.#mask = mask >>> 0;
    this.set(value);
  }

  get value(): number {
    const decoded = decodeValue(this.#stored, this.#mask, this.#checksum);
    if (!decoded.valid) this.#tampered = true;
    return decoded.value;
  }

  set(value: number): void {
    this.#stored = encodeValue(value, this.#mask);
    this.#checksum = checksumFor(value, this.#mask);
  }

  /** Сменить ключ, перешифровав текущее значение. */
  rotate(mask: number): void {
    const current = this.value;
    this.#mask = mask >>> 0;
    this.set(current);
  }

  /** Был ли замечен признак вмешательства. */
  get tampered(): boolean {
    return this.#tampered;
  }
}
