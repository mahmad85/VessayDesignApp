// Mappings from the pre-D-019 design fields to catalog codes. One source for
// the legacy importer (CATALOG-ADMIN.md §10), the v1 → v2 draft upgrade
// (ADMIN-BACKEND.md §7.2) and the visual slot registry tests.

export const LEGACY_KEYS = {
  jacketStyle: 'style.jacket.jacket_style_combined.jacket-style-combined',
  jacketFit: 'style.jacket.jacket_fit.jacket-fit',
  lapelType: 'style.jacket.jacket_lapel_type_combinated.jacket-lapel-type',
  pocketsType: 'style.jacket.jacket_pockets_type.jacket-pockets-type',
  shirtFit: 'style.shirt.shirt_fit.shirt-fit',
  shirtCollar: 'style.shirt.shirt_collar.shirt-collar',
  shirtCuffs: 'style.shirt.shirt_cuffs.shirt-cuffs',
  /** Replaced by including the `vest` component. */
  vest: 'style.vest.waistcoat.waistcoat',
} as const;

/** Legacy `design.fit` for suits and blazers → jacket-fit. `relaxed` is added by the importer (Q-026). */
export const LEGACY_JACKET_FIT = { Tailored: '1', Classic: '0', Relaxed: 'relaxed' } as const;
export const LEGACY_SHIRT_FIT = {
  Tailored: 'tailored',
  Classic: 'classic',
  Relaxed: 'relaxed',
} as const;
export const LEGACY_LAPEL = { Notch: 'standard', Peak: 'peak' } as const;
export const LEGACY_POCKETS = { Flap: '2', Patch: '2b' } as const;
export const LEGACY_CLOSURE = { 'One button': 'simple_1', 'Two buttons': 'simple_2' } as const;
export const LEGACY_COLLAR = { Spread: 'spread', Point: 'point' } as const;
export const LEGACY_CUFFS = { Button: 'button', French: 'french' } as const;
export const LEGACY_OCCASIONS = {
  Office: 'office',
  Wedding: 'wedding',
  'Formal event': 'formal_event',
  Everyday: 'everyday',
} as const;
export const LEGACY_CLIMATES = { Warm: 'warm', 'All season': 'all_season', Cool: 'cool' } as const;

/** Values of the legacy shirt options, as the importer creates them. */
export const LEGACY_SHIRT_VALUES: Record<string, readonly string[]> = {
  [LEGACY_KEYS.shirtFit]: Object.values(LEGACY_SHIRT_FIT),
  [LEGACY_KEYS.shirtCollar]: Object.values(LEGACY_COLLAR),
  [LEGACY_KEYS.shirtCuffs]: Object.values(LEGACY_CUFFS),
};
/** Choices the importer adds to seed options, beyond the supplied export. */
export const IMPORTED_EXTRA_VALUES: Record<string, readonly string[]> = {
  [LEGACY_KEYS.jacketFit]: [LEGACY_JACKET_FIT.Relaxed],
};
