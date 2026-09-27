export type CaptureResult = { status: 'unavailable'; code: 'contract_required'; message: string };
// Do not invent provider URLs or a scan payload. Implement only against the licensed contract.
export async function beginCapture(): Promise<CaptureResult> {
  return {
    status: 'unavailable',
    code: 'contract_required',
    message:
      '3DLOOK capture is not connected yet. You can enter measurements for this draft, but they will require verification before ordering.',
  };
}
