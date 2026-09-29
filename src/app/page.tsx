import Studio from '@/components/studio';
import { staffPage } from '@/modules/staff/page-guard';
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ catalog?: string; product?: string; group?: string }>;
}) {
  const params = await searchParams;
  const staff = params.catalog === 'working' ? await staffPage('catalog.read') : null;
  return (
    <Studio
      preview={params.catalog === 'working'}
      previewCanWrite={staff?.permissions.includes('catalog.write')}
      initialProduct={params.product}
      initialGroup={params.group}
    />
  );
}
