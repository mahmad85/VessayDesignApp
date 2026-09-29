/** Next inlines NODE_ENV for its build mode. Synthetic payments also require the
 * actual server process to be launched as a test; a production build is excluded. */
export function isPaymentTestRuntime() {
  const { NODE_ENV } = process.env;
  return process.env.NODE_ENV !== 'production' && NODE_ENV === 'test';
}
