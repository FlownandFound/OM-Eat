// Currencies of the destinations BAEF serves from LGW, so submitters pick
// from a list instead of knowing ISO codes. Update alongside the
// destinations seed if the network changes.

export const CURRENCIES: { code: string; label: string }[] = [
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — Pound sterling" },
  { code: "CHF", label: "CHF — Swiss franc" },
  { code: "TRY", label: "TRY — Turkish lira" },
  { code: "MAD", label: "MAD — Moroccan dirham" },
  { code: "DZD", label: "DZD — Algerian dinar" },
  { code: "EGP", label: "EGP — Egyptian pound" },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);
