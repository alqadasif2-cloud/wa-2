/**
 * Utility formatting functions for Trust Wallet Pro
 */

/**
 * Format currency amount as USD string with standard decimals
 */
export function formatCurrency(amount: number | string | undefined | null, currency: string = 'USD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount ?? 0);
  if (isNaN(num)) return '$0.00';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format general numbers with localized formatting
 */
export function formatNumber(amount: number | string | undefined | null, decimals: number = 2): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount ?? 0);
  if (isNaN(num)) return '0.00';

  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format crypto token amounts with appropriate precision
 */
export function formatCryptoAmount(amount: number | string | undefined | null, symbol?: string, maxDecimals: number = 6): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount ?? 0);
  if (isNaN(num)) return `0${symbol ? ` ${symbol}` : ''}`;

  let formatted: string;
  if (num === 0) {
    formatted = '0.00';
  } else if (Math.abs(num) < 0.0001) {
    formatted = num.toFixed(maxDecimals);
  } else if (Math.abs(num) < 1) {
    formatted = num.toFixed(4);
  } else {
    formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Shorten wallet hex address (e.g. 0x1234...5678)
 */
export function shortenAddress(address?: string | null, prefixChars: number = 6, suffixChars: number = 4): string {
  if (!address) return '';
  if (address.length <= prefixChars + suffixChars + 2) return address;
  return `${address.substring(0, prefixChars)}...${address.substring(address.length - suffixChars)}`;
}

/**
 * Format date string into human readable Arabic or English datetime
 */
export function formatDateTime(dateInput?: string | number | Date | null, isArabic: boolean = true): string {
  if (!dateInput) return '-';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);

    if (isArabic) {
      return date.toLocaleDateString('ar-EG', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateInput);
  }
}

/**
 * Format date only (YYYY-MM-DD or localized)
 */
export function formatDate(dateInput?: string | number | Date | null, isArabic: boolean = false): string {
  if (!dateInput) return '-';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);

    if (isArabic) {
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateInput);
  }
}

/**
 * Format percentage with + / - sign
 */
export function formatPercent(value: number | string | undefined | null, includeSign: boolean = true): string {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
  if (isNaN(num)) return '0.00%';

  const formatted = Math.abs(num).toFixed(2) + '%';
  if (!includeSign) return formatted;
  return (num >= 0 ? '+' : '-') + formatted;
}

/**
 * Format remaining countdown milliseconds to HH:MM:SS or MM:SS
 */
export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '00:00:00';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}
