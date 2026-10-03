import { REGION_IDS, VISUAL_SLOTS } from '@/visualization/registry';
import { options, type Field, type Option } from './editor';
export const identityFields: Field[] = [
  { key: 'name', label: 'Name', required: true },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: options(['draft', 'active', 'archived']),
  },
  {
    key: 'code',
    label: 'Code',
    help: 'Generated from the name if left blank. Locked after first publication.',
    advanced: true,
  },
];
export const descriptionField: Field = {
  key: 'description',
  label: 'Description',
  type: 'textarea',
  max: 2000,
};
export const sortField: Field = { key: 'sort', label: 'Position', type: 'number', advanced: true };
export function structureFields(
  kind: string,
  media: Option[],
  materials: Option[],
  tokens: string[] = [],
): Field[] {
  const surcharge: Field = { key: 'surchargeMinor', label: 'Extra charge', type: 'money' };
  if (kind === 'products')
    return [
      ...identityFields,
      descriptionField,
      {
        key: 'measurementSet',
        label: 'Garment type',
        type: 'select',
        options: options(['suit', 'shirt', 'blazer']),
        required: true,
      },
      { key: 'heroMediaId', label: 'Main image', type: 'select', options: media, nullable: true },
      {
        key: 'defaultMaterialId',
        label: 'Default fabric',
        type: 'select',
        options: materials,
        nullable: true,
      },
      {
        key: 'shortLabel',
        label: 'Short label',
        help: 'Defaults to the name.',
        advanced: true,
      },
      {
        key: 'visualModel',
        label: 'Drawing model',
        type: 'select',
        options: options(['suit', 'shirt', 'blazer']),
        help: 'Defaults to the garment type.',
        advanced: true,
      },
      {
        key: 'fabricConsumptionCm',
        label: 'Fabric consumption (cm)',
        type: 'number',
        nullable: true,
        min: 50,
        max: 1000,
        advanced: true,
      },
      sortField,
    ];
  if (kind === 'components')
    return [
      ...identityFields,
      {
        key: 'visualPart',
        label: 'Garment piece',
        type: 'select',
        options: options(['jacket', 'trousers', 'vest', 'shirt']),
        required: true,
      },
      { ...descriptionField, advanced: true },
      sortField,
    ];
  if (kind === 'links')
    return [
      { key: 'required', label: 'Always included', type: 'checkbox' },
      { key: 'defaultIncluded', label: 'Included by default', type: 'checkbox' },
      { ...surcharge, label: 'Price when added' },
      { key: 'includeLabel', label: 'Customer label', nullable: true },
      sortField,
    ];
  if (kind === 'groups')
    return [
      ...identityFields,
      {
        key: 'kind',
        label: 'Customer tab',
        type: 'select',
        options: [
          { value: 'style', label: 'Part details' },
          { value: 'accent', label: 'Accents' },
        ],
        required: true,
      },
      { ...descriptionField, advanced: true },
      { key: 'shortName', label: 'Short name', help: 'Defaults to the name.', advanced: true },
      {
        key: 'lineKind',
        label: 'Specification line',
        type: 'select',
        options: options(['construction', 'accessory']),
        advanced: true,
      },
      {
        key: 'focusRegion',
        label: 'Drawing area',
        type: 'select',
        options: options(REGION_IDS),
        advanced: true,
      },
      {
        key: 'iconMediaId',
        label: 'Icon image',
        type: 'select',
        options: media,
        nullable: true,
        advanced: true,
      },
      sortField,
    ];
  if (kind === 'attributes')
    return [
      ...identityFields,
      { key: 'helpText', label: 'Help text', type: 'textarea' },
      { key: 'required', label: 'Answer required', type: 'checkbox' },
      {
        key: 'inputType',
        label: 'Answer type',
        type: 'select',
        options: [
          { value: 'choice', label: 'Pick from choices' },
          { value: 'text', label: 'Free text (e.g. monogram)' },
        ],
        required: true,
        advanced: true,
      },
      {
        key: 'visualSlot',
        label: 'Drawing slot',
        type: 'select',
        options: Object.entries(VISUAL_SLOTS).map(([value, s]) => ({ value, label: s.label })),
        nullable: true,
        advanced: true,
      },
      sortField,
    ];
  return [
    { key: 'label', label: 'Label', required: true },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: options(['draft', 'active', 'archived']),
    },
    { key: 'imageMediaId', label: 'Image', type: 'select', options: media, nullable: true },
    surcharge,
    { key: 'isDefault', label: 'Default choice', type: 'checkbox' },
    { key: 'isOff', label: 'None / without', type: 'checkbox' },
    { ...descriptionField, advanced: true },
    {
      key: 'code',
      label: 'Code',
      help: 'Leave blank to generate from the label.',
      advanced: true,
    },
    { key: 'supplierCode', label: 'Supplier code (internal)', nullable: true, advanced: true },
    {
      key: 'visualToken',
      label: 'Draws as',
      type: 'select',
      options: [{ value: '', label: 'Not illustrated' }, ...options(tokens)],
      nullable: true,
      advanced: true,
    },
    sortField,
  ];
}
