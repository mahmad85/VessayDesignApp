import { json } from '@/lib/http';
export async function POST() {
  return json(
    {
      error: {
        code: 'endpoint_removed',
        message: 'Place and sign off an order before starting checkout.',
      },
    },
    undefined,
    410,
  );
}
