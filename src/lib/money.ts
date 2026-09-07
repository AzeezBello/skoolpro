const SYMBOLS: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", GHS: "₵", KES: "KSh", ZAR: "R", XOF: "CFA" };

export const SUPPORTED_CURRENCIES = Object.keys(SYMBOLS);

export function currencySymbol(currency: string | null | undefined) {
  const code = (currency || "NGN").toUpperCase();
  return SYMBOLS[code] ?? `${code} `;
}

export function formatMoney(amount: unknown, currency: string | null | undefined, opts: { decimals?: number } = {}) {
  const n = Number(amount || 0);
  const decimals = opts.decimals ?? (Number.isInteger(n) ? 0 : 2);
  return `${currencySymbol(currency)}${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: 2 })}`;
}
