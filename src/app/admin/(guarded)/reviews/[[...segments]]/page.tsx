import { notFound } from 'next/navigation';
import { staffPage } from '@/modules/staff/page-guard';
import { ReviewQueue, TailorReview } from '@/components/admin/reviews';
export default async function Reviews({
  params,
  searchParams,
}: {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const staff = await staffPage('reviews.read'),
    segments = (await params).segments ?? [];
  if (segments.length > 1) notFound();
  return segments[0] ? (
    <TailorReview
      id={segments[0]}
      canDecide={staff.permissions.includes('reviews.decide')}
      userId={staff.user.id}
    />
  ) : (
    <ReviewQueue
      initialFilter={
        '?' +
        new URLSearchParams(
          Object.entries(await searchParams).filter(
            (p): p is [string, string] => typeof p[1] === 'string',
          ),
        ).toString()
      }
    />
  );
}
