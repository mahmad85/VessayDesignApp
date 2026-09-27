// Main choices drawn in 3D. Everything else with a drawing region is shown in
// the 2D technical drawing, which the studio points to when it is edited.
const SHOWN_IN_3D = new Set([
  'product',
  'fabricId',
  'fit',
  'lapel',
  'pockets',
  'closure',
  'collar',
  'cuffs',
  'style.jacket.jacket_style_combined',
  'style.jacket.jacket_fit',
  'style.jacket.jacket_lapel_type_combinated',
  'style.jacket.jacket_pockets_type',
  'style.jacket.jacket_sleeve_buttons_combinated',
  'style.jacket.jacket_vent',
  'style.jacket.jacket_chest_pocket',
  'style.pants.pants_fit',
  'style.pants.pants_length',
  'style.pants.pants_break',
  'style.pants.pants_cuff',
  'style.vest.waistcoat',
  'style.vest.waistcoat_style_combined',
  'style.vest.waistcoat_bottom',
  'accents.jacket.buttons_color',
  'accents.jacket.shoes',
]);

export function shownIn3D(leafId: string) {
  return SHOWN_IN_3D.has(leafId);
}
