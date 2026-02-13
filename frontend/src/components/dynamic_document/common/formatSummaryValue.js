/**
 * Formats a document's summary_value with proper currency label and thousand separators.
 *
 * @param {Object} document - Document object with summary_value and summary_value_currency fields.
 * @returns {string} Formatted value string (e.g. "COP $ 1.234.567") or empty string if no value.
 */
export function formatSummaryValue(document) {
  if (document.summary_value === null || document.summary_value === undefined || document.summary_value === '') {
    return '';
  }

  // Parse numeric value safely
  const numericValue = Number(
    String(document.summary_value)
      .replace(/[^0-9.,-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
  );
  if (Number.isNaN(numericValue)) {
    // Fallback: return raw value if parsing fails
    return document.summary_value;
  }

  // Format number with thousands separators (locale-style: 1.234.567,89)
  const formattedNumber = numericValue.toLocaleString('es-CO', {
    maximumFractionDigits: 2,
  });

  const currencyCode = document.summary_value_currency || '';
  const currencyLabelMap = {
    COP: 'COP $',
    USD: 'USD $',
    EUR: 'EUR €',
  };

  const currencyLabel = currencyLabelMap[currencyCode] || currencyCode || '';

  if (currencyLabel) {
    return `${currencyLabel} ${formattedNumber}`;
  }

  return formattedNumber;
}
