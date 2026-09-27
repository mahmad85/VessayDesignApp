import { json } from '@/lib/http';
import { SCAN_SERVICE_FEE_CENTS, SCAN_SERVICE_CURRENCY, scanServiceCustomerTerms } from '@/lib/scan-service-policy';
export function GET() {
  return json({
    fee: { amountCents: SCAN_SERVICE_FEE_CENTS, currency: SCAN_SERVICE_CURRENCY },
    terms: scanServiceCustomerTerms(),
  });
}
