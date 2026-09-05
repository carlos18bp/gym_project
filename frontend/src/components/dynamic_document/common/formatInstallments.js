/**
 * Format a payment-installments count for display.
 *
 * @param {number|null|undefined} installments - agreed installment count
 * @returns {string} '' when not configured, 'Pago único' for 1, 'N cuotas' otherwise
 */
export function formatInstallments(installments) {
  const count = Number(installments);
  if (!Number.isInteger(count) || count < 1) return "";
  return count === 1 ? "Pago único" : `${count} cuotas`;
}
