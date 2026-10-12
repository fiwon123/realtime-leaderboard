/** Accent presets, in display order. `indigo` is the default. */
export const ACCENTS = [
  { id: 'indigo', label: 'Indigo' },
  { id: 'amber', label: 'Amber' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'rose', label: 'Rose' },
  { id: 'cyan', label: 'Cyan' },
] as const

export type Accent = (typeof ACCENTS)[number]['id']

export const DEFAULT_ACCENT: Accent = 'indigo'

export function isAccent(value: unknown): value is Accent {
  return ACCENTS.some((accent) => accent.id === value)
}
