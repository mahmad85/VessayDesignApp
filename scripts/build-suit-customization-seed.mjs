import fs from 'node:fs';
import path from 'node:path';

const sources = [
  {
    id: 'style',
    label: 'Style',
    source: 'docs/hockerty_suit_style_menu/hockerty_suit_style_menu',
  },
  {
    id: 'accents',
    label: 'Accents',
    source: 'docs/hockerty_suit_accents_menu/hockerty_suit_accents_menu',
  },
];
const outputAssets = 'public/reference-assets/hockerty-suit';
const slug = (value) =>
  String(value || 'option')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

function normalizeMenu(config) {
  const sourceManifest = JSON.parse(
    fs.readFileSync(path.join(config.source, 'menu_structure.json'), 'utf8'),
  );
  const publicRoot = path.join(outputAssets, config.id);
  fs.mkdirSync(publicRoot, { recursive: true });
  for (const entry of fs.readdirSync(config.source, { withFileTypes: true })) {
    if (entry.name === 'menu_structure.json') continue;
    fs.cpSync(path.join(config.source, entry.name), path.join(publicRoot, entry.name), {
      recursive: true,
      force: true,
    });
  }
  return {
    id: config.id,
    label: config.label,
    sourceUrl: sourceManifest.source_url,
    extractedAt: sourceManifest.extracted_at,
    note: sourceManifest.note,
    categories: sourceManifest.categories.map((category, categoryIndex) => {
      const categoryId = slug(category.category);
      return {
        id: categoryId,
        label: String(category.category).replaceAll('_', ' '),
        order: categoryIndex + 1,
        shown: category.shown_in_menu !== false,
        groups: category.subcategories.map((group, groupIndex) => ({
          id: group.id,
          label: group.label,
          shortLabel: group.short_label || group.label,
          order: groupIndex + 1,
          shown: group.shown_in_menu !== false,
          referenceMenuPrice: group.menu_price ?? null,
          asset: group.menu_icon?.thumbnail_file
            ? `/reference-assets/hockerty-suit/${config.id}/${group.menu_icon.thumbnail_file.replaceAll('\\', '/')}`
            : null,
          sections: (group.sections || []).map((section, sectionIndex) => {
            const sectionId = slug(section.field || section.title || `section-${sectionIndex + 1}`);
            const selectionKey = `${config.id}.${categoryId}.${group.id}.${sectionId}`;
            return {
              id: sectionId,
              label: section.title || group.label,
              field: section.field || null,
              selectionKey,
              note: section.note || null,
              order: sectionIndex + 1,
              options: (section.options || []).map((option, optionIndex) => ({
                id: `${selectionKey}.${slug(option.value ?? option.label)}.${optionIndex + 1}`,
                label: option.label,
                value: String(option.value ?? option.label),
                order: option.order ?? optionIndex + 1,
                selected: option.selected === true,
                referencePrice: option.price ?? null,
                asset: option.thumbnail_file
                  ? `/reference-assets/hockerty-suit/${config.id}/${option.thumbnail_file.replaceAll('\\', '/')}`
                  : null,
                attributes: option.attributes || {},
              })),
            };
          }),
        })),
      };
    }),
  };
}

const menus = sources.map(normalizeMenu);
const optionCount = menus.reduce(
  (total, menu) =>
    total +
    menu.categories.reduce(
      (categoryTotal, category) =>
        categoryTotal +
        category.groups.reduce(
          (groupTotal, group) =>
            groupTotal +
            group.sections.reduce(
              (sectionTotal, section) => sectionTotal + section.options.length,
              0,
            ),
          0,
        ),
      0,
    ),
  0,
);
const seed = {
  id: 'hockerty-suit-reference-2026-09-27',
  version: 1,
  product: 'suit',
  sourceKind: 'user-supplied-reference-export',
  commercialStatus: 'reference-only-unverified',
  priceStatus: 'source-metadata-not-approved-for-display-or-checkout',
  assetRightsStatus: 'not-provided',
  optionCount,
  menus,
};
fs.mkdirSync('src/modules/catalog', { recursive: true });
fs.writeFileSync(
  'src/modules/catalog/suit-customization.seed.json',
  `${JSON.stringify(seed, null, 2)}\n`,
);
console.log(`Built ${optionCount} suit reference options across ${menus.length} menus.`);
