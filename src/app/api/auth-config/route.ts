import { json } from '@/lib/http';
import { authConfigured } from '@/lib/auth';
export function GET() {
  return json({
    enabled: authConfigured(),
    localEmail: process.env.NODE_ENV !== 'production' && !process.env.MAIL_API_URL,
  });
}
