/** Shared types for canonical reference palette data (Tailwind, Radix, Spectrum). */

export interface PaletteShade { L: number; C: number; H: number }
export interface PaletteFamily { name: string; shades: Record<string, PaletteShade> }
