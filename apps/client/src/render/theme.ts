/**
 * Палитра и размеры. Арт процедурный: всё рисуется кодом, поэтому цвета и
 * радиусы собраны в одном месте — клан или владелец меняется одной правкой.
 */
export const THEME = {
  space: 0x0b1026,
  spaceDeep: 0x060917,
  star: 0xffffff,
  nebula: 0x2a3a6a,
  neutral: 0x8d99ae,
  neutralDark: 0x5c6675,
  text: 0xf4f6fb,
  textDark: 0x101528,
  hull: 0xf2e8d5,
  hullDark: 0xd8c9ae,
  arrow: 0xf4f6fb,
  arrowInvalid: 0xef476f,
  boost: 0x9ad1ff,
  controlBar: 0x3a4a7a,
  success: 0x06d6a0,
  danger: 0xef476f,
} as const;

/** Цвета игроков по индексу владельца; нейтралы — серые. */
export const PLAYER_COLORS = [0xffd166, 0xef476f, 0x06d6a0, 0x4cc9f0] as const;

export const PLAYER_COLORS_DARK = [0xc9a24d, 0xb8324f, 0x059b74, 0x3593b0] as const;

export const PLANET_RADIUS: Readonly<Record<string, number>> = {
  S: 24,
  M: 32,
  L: 42,
  XL: 54,
};

/** Доля экрана, которую занимает карта (остальное — поля). */
export const WORLD_PADDING = 40;

export function colorForOwner(ownerId: number): number {
  if (ownerId < 0) return THEME.neutral;
  return PLAYER_COLORS[ownerId % PLAYER_COLORS.length] ?? THEME.neutral;
}

export function darkColorForOwner(ownerId: number): number {
  if (ownerId < 0) return THEME.neutralDark;
  return PLAYER_COLORS_DARK[ownerId % PLAYER_COLORS_DARK.length] ?? THEME.neutralDark;
}
