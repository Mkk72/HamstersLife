import { describe, expect, it } from 'vitest';
import {
  TROOP_KINDS,
  cloneTroops,
  createTroopStack,
  isEmptyTroops,
  mergeTroops,
  scaleTroops,
  splitTroops,
  subtractTroops,
  troopTotal,
} from './troops';

describe('TroopStack', () => {
  it('создаёт пустой состав по всем родам войск', () => {
    const stack = createTroopStack();
    expect(Object.keys(stack).sort()).toEqual([...TROOP_KINDS].sort());
    expect(troopTotal(stack)).toBe(0);
    expect(isEmptyTroops(stack)).toBe(true);
  });

  it('заполняет частичный состав, остальное — нули', () => {
    const stack = createTroopStack({ swordsman: 5000, archer: 2000 });
    expect(stack.swordsman).toBe(5000);
    expect(stack.archer).toBe(2000);
    expect(stack.cannon).toBe(0);
    expect(troopTotal(stack)).toBe(7000);
  });

  it('складывает составы', () => {
    const merged = mergeTroops(
      createTroopStack({ swordsman: 1000, mage: 500 }),
      createTroopStack({ swordsman: 2000, cavalry: 3000 }),
    );
    expect(merged.swordsman).toBe(3000);
    expect(merged.cavalry).toBe(3000);
    expect(merged.mage).toBe(500);
    expect(troopTotal(merged)).toBe(6500);
  });

  it('масштабирует по permille с округлением вниз', () => {
    const half = scaleTroops(createTroopStack({ swordsman: 3333, archer: 1000 }), 500);
    expect(half.swordsman).toBe(1666);
    expect(half.archer).toBe(500);
  });

  it('вычитает без отрицательных значений', () => {
    const rest = subtractTroops(
      createTroopStack({ swordsman: 1000 }),
      createTroopStack({ swordsman: 4000 }),
    );
    expect(rest.swordsman).toBe(0);
  });

  it('делит состав пропорционально количеству', () => {
    const part = splitTroops(createTroopStack({ swordsman: 6000, archer: 2000 }), 4000);
    expect(part.swordsman).toBe(3000);
    expect(part.archer).toBe(1000);
    expect(troopTotal(part)).toBe(4000);
  });

  it('не делит пустой состав', () => {
    expect(isEmptyTroops(splitTroops(createTroopStack(), 1000))).toBe(true);
  });

  it('cloneTroops не делит ссылку', () => {
    const stack = createTroopStack({ swordsman: 1000 });
    const copy = cloneTroops(stack);
    copy.swordsman = 5000;
    expect(stack.swordsman).toBe(1000);
  });
});
