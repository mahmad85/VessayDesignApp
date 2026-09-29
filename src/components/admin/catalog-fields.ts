import { REGION_IDS, VISUAL_SLOTS } from '@/visualization/registry';
import { options, type Field, type Option } from './editor';
export const identityFields: Field[] = [
  { key: 'code', label: 'Code', required: true, help: 'Locked after first publication.' },
  { key: 'name', label: 'Name', required: true },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: options(['draft', 'active', 'archived']),
  },
];
export const descriptionField: Field = {
  key: 'description',
  label: 'Description',
  type: 'textarea',
  max: 2000,
};
export const sortField: Field = { key: 'sort', label: 'Position', type: 'number' };
export function structureFields(
  kind: string,
  media: Option[],
  materials: Option[],
  tokens: string[] = [],
): Field[] {
  const surcharge: Field = { key: 'surchargeMinor', label: 'Surcharge', type: 'money' };
  if (kind === 'products')
    return [
      ...identityFields,
      { key: 'shortLabel', label: 'Short label', required: true },
      descriptionField,
      {
        key: 'measurementSet',
        label: 'Measurement set',
        type: 'select',
        options: options(['suit', 'shirt', 'blazer']),
        required: true,
      },
      {
        key: 'visualModel',
        label: 'Drawing model',
        type: 'select',
        options: options(['suit', 'shirt', 'blazer']),
        required: true,
      },
      {
        key: 'defaultMaterialId',
        label: 'Default fabric',
        type: 'select',
        options: materials,
        nullable: true,
      },
      { key: 'heroMediaId', label: 'Hero image', type: 'select', options: media, nullable: true },
      {
        key: 'fabricConsumptionCm',
        label: 'Fabric consumption (cm)',
        type: 'number',
        nullable: true,
        min: 50,
        max: 1000,
      },
      sortField,
    ];
  if (kind === 'components')
    return [
      ...identityFields,
      descriptionField,
      {
        key: 'visualPart',
        label: 'Drawing part',
        type: 'select',
        options: options(['jacket', 'trousers', 'vest', 'shirt']),
        required: true,
      },
      sortField,
    ];
  if (kind === 'links')
    return [
      { key: 'required', label: 'Required part', type: 'checkbox' },
      { key: 'defaultIncluded', label: 'Included by default', type: 'checkbox' },
      surcharge,
      { key: 'includeLabel', label: 'Customer label', nullable: true },
      sortField,
    ];
  if (kind === 'groups')
    return [
      ...identityFields,
      { key: 'shortName', label: 'Short name', required: true },
      descriptionField,
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
      {
        key: 'lineKind',
        label: 'Specification line',
        type: 'select',
        options: options(['construction', 'accessory']),
      },
      { key: 'focusRegion', label: 'Drawing area', type: 'select', options: options(REGION_IDS) },
      { key: 'iconMediaId', label: 'Icon image', type: 'select', options: media, nullable: true },
      surcharge,
      sortField,
    ];
  if (kind === 'attributes')
    return [
      ...identityFields,
      { key: 'helpText', label: 'Help text', type: 'textarea' },
      {
        key: 'inputType',
        label: 'Answer type',
        type: 'select',
        options: options(['choice', 'text']),
        required: true,
      },
      { key: 'required', label: 'Answer required', type: 'checkbox' },
      {
        key: 'visualSlot',
        label: 'Drawing slot',
        type: 'select',
        options: Object.entries(VISUAL_SLOTS).map(([value, s]) => ({ value, label: s.label })),
        nullable: true,
      },
      surcharge,
      sortField,
    ];
  return [
    { key: 'label', label: 'Label', required: true },
    { key: 'code', label: 'Code', help: 'Leave blank to generate from the label.' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: options(['draft', 'active', 'archived']),
    },
    descriptionField,
    { key: 'imageMediaId', label: 'Image', type: 'select', options: media, nullable: true },
    { key: 'isDefault', label: 'Default choice', type: 'checkbox' },
    { key: 'isOff', label: 'None / without', type: 'checkbox' },
    surcharge,
    { key: 'supplierCode', label: 'Supplier code (internal)', nullable: true },
    {
      key: 'visualToken',
      label: 'Draws as',
      type: 'select',
      options: [{ value: '', label: 'Not illustrated' }, ...options(tokens)],
      nullable: true,
    },
    sortField,
  ];
}
