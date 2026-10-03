import { notFound } from 'next/navigation';
import { staffPage } from '@/modules/staff/page-guard';
import { ProductEditor } from '@/components/admin/product-editor';
import { ProductList, ProductPage } from '@/components/admin/product-builder';
import { MediaLibrary, ListsEditor, RulesEditor } from '@/components/admin/catalog-tools';
import { Fabrics, FabricEditor } from '@/components/admin/materials';
import { PricingEditor } from '@/components/admin/pricing';
import { Looks, LookEditor } from '@/components/admin/templates';
import { Publishing } from '@/components/admin/publishing';
export default async function CatalogPage({ params }: { params: Promise<{ segments: string[] }> }) {
  const staff = await staffPage('catalog.read');
  const [screen, id] = (await params).segments;
  const canWrite = staff.permissions.includes('catalog.write');
  const canPublish = staff.permissions.includes('catalog.publish');
  // D-022: the business product screens; the full structure editor stays for developers.
  if (screen === 'products')
    return id ? <ProductPage id={id} canWrite={canWrite} /> : <ProductList canWrite={canWrite} />;
  if (screen === 'structure') return <ProductEditor canWrite={canWrite} />;
  if (screen === 'media') return <MediaLibrary canWrite={canWrite} />;
  if (screen === 'lists') return <ListsEditor canWrite={canWrite} />;
  if (screen === 'rules') return <RulesEditor canWrite={canWrite} />;
  if (screen === 'fabrics')
    return id ? (
      <FabricEditor id={id} canWrite={canWrite} canPublish={canPublish} />
    ) : (
      <Fabrics canWrite={canWrite} />
    );
  if (screen === 'pricing') return <PricingEditor canWrite={canWrite} />;
  if (screen === 'templates')
    return id ? <LookEditor id={id} canWrite={canWrite} /> : <Looks canWrite={canWrite} />;
  if (screen === 'publish') return <Publishing canPublish={canPublish} />;
  notFound();
}
