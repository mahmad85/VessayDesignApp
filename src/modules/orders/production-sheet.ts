import type { ProductionSheet } from '@/db/fulfillment-repository';
const escape = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function productionSheetHtml(s: ProductionSheet) {
  const item = s.item;
  const options = (accessories: boolean) =>
    item.options
      .filter((o) => (o.lineKind === 'accessory') === accessories)
      .map(
        (o) =>
          `<tr><th>${escape(o.groupName)} · ${escape(o.attributeName)}</th><td>${escape(o.text ?? o.valueLabel)}${o.supplierCode ? ` (${escape(o.supplierCode)})` : ''}</td></tr>`,
      )
      .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(s.number)} · Production sheet</title><style>body{font:16px system-ui;margin:2rem;max-width:900px;color:#172522}table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{text-align:left;padding:.5rem;border-bottom:1px solid #ccc;overflow-wrap:anywhere}h1{font-size:1.8rem}h2{margin-top:2rem}p{overflow-wrap:anywhere}@media print{body{margin:0;font-size:11pt}tr{break-inside:avoid}}</style></head><body><main><h1>${escape(s.number)} · Production sheet</h1><p>${escape(s.customerName)} · Specification v${s.snapshotVersion} · Item ${item.lineNo}</p><p>Customer sign-off: ${escape(s.signedOffAt)} · ${escape(s.statementVersion)}</p>${s.amended ? '<p>Amended after tailor review</p>' : ''}${s.tailorVerified ? '<p>Tailor verified</p>' : ''}<h2>${escape(item.product.name)} × ${item.quantity}</h2><p>${escape(item.template?.name ?? 'Custom design')} · ${escape(item.material.name)} · ${escape(item.material.colourName)}</p><p>Fabric code: ${escape(item.material.code)} · Supplier article: ${escape(item.material.supplierArticleCode ?? 'Not recorded')}</p><p>Components: ${item.components
    .filter((c) => c.included)
    .map((c) => escape(c.name))
    .join(
      ', ',
    )}</p><table><caption>Construction</caption><tbody>${options(false)}</tbody></table><table><caption>Accessories</caption><tbody>${options(true)}</tbody></table><h2>Measurements</h2><p>Source: ${escape(s.measurements.source)} · version ${s.measurements.version} · values in mm</p><table><thead><tr><th>Measurement</th><th>mm</th></tr></thead><tbody>${s.measurements.values.map((m) => `<tr><th>${escape(m.label)}</th><td>${m.mm}</td></tr>`).join('')}</tbody></table></main></body></html>`;
}
