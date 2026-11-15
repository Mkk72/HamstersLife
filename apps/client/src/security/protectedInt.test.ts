import { describe, expect, it } from 'vitest';
import { ProtectedInt, checksumFor, decodeValue, encodeValue } from './protectedInt';

describe('ProtectedInt', () => {
  it('хранит и возвращает значение', () => {
    const guarded = new ProtectedInt(1234);
    expect(guarded.value).toBe(1234);
    expect(guarded.tampered).toBe(false);
  });

  it('не хранит значение открытым текстом', () => {
    const guarded = new ProtectedInt(77, 0x1234);
    // читаем приватное поле через сериализацию невозможна — проверяем косвенно:
    // у двух экземпляров с разными ключами закодированные значения разные
    const a = encodeValue(77, 0x1234);
    const b = encodeValue(77, 0x9999);
    expect(a).not.toBe(b);
    expect(guarded.value).toBe(77);
  });

  it('переживает смену ключа', () => {
    const guarded = new ProtectedInt(500);
    guarded.rotate(0xabcdef);
    expect(guarded.value).toBe(500);
    guarded.set(42);
    expect(guarded.value).toBe(42);
  });

  it('замечает испорченную контрольную сумму', () => {
    const mask = 0x1f2e3d4c;
    const stored = encodeValue(1000, mask);
    const good = decodeValue(stored, mask, checksumFor(1000, mask));
    expect(good).toEqual({ value: 1000, valid: true });

    const corrupted = decodeValue(stored, mask, checksumFor(999, mask));
    expect(corrupted.valid).toBe(false);
  });

  it('после испорченной суммы decode сообщает о вмешательстве', () => {
    // Прямая правка памяти проверяется на чистой функции: класс хранит поля
    // в приватных слотах, до которых из теста не добраться без хаков.
    const mask = 0x1234;
    const stored = encodeValue(5, mask);
    expect(decodeValue(stored, mask, checksumFor(5, mask)).valid).toBe(true);
    expect(decodeValue(stored, mask, checksumFor(6, mask)).valid).toBe(false);
  });
});
