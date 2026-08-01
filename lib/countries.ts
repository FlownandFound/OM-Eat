// One row per country on the network: the flag shown beside a destination and
// the currency symbol shown against a price. The destination fixes the country
// and the country fixes the currency, so submitters never pick either — both
// are derived at display time. Keyed by the country name stored in
// destinations.country; add a row here whenever a destination migration adds a
// new country.

const COUNTRIES: Record<string, { flag: string; symbol: string }> = {
  Algeria: { flag: "🇩🇿", symbol: "DZD " },
  Austria: { flag: "🇦🇹", symbol: "€" },
  Croatia: { flag: "🇭🇷", symbol: "€" },
  Cyprus: { flag: "🇨🇾", symbol: "€" },
  Egypt: { flag: "🇪🇬", symbol: "E£" },
  Finland: { flag: "🇫🇮", symbol: "€" },
  France: { flag: "🇫🇷", symbol: "€" },
  Greece: { flag: "🇬🇷", symbol: "€" },
  Italy: { flag: "🇮🇹", symbol: "€" },
  Jersey: { flag: "🇯🇪", symbol: "£" },
  Malta: { flag: "🇲🇹", symbol: "€" },
  Morocco: { flag: "🇲🇦", symbol: "MAD " },
  Portugal: { flag: "🇵🇹", symbol: "€" },
  Spain: { flag: "🇪🇸", symbol: "€" },
  Switzerland: { flag: "🇨🇭", symbol: "CHF " },
  Turkey: { flag: "🇹🇷", symbol: "₺" },
};

export function countryFlag(country: string | null | undefined): string {
  return country ? (COUNTRIES[country]?.flag ?? "") : "";
}

// Currency symbol for the price input's prefix, trimmed because it sits in its
// own box there. Empty if the country is unknown.
export function countrySymbol(country: string | null | undefined): string {
  return country ? (COUNTRIES[country]?.symbol.trim() ?? "") : "";
}

// Price is a number and cost_qty says how many items it buys, so the symbol
// placement is never ambiguous: qty 1 -> "€11.50 each", qty 6 -> "€11.50 for 6".
// Unknown country: the bare number is shown rather than a wrong symbol.
export function formatCost(
  amount: number | string,
  qty: number | null,
  country: string | null | undefined,
): string {
  const n = Number(amount);
  const price = Number.isFinite(n)
    ? n.toFixed(2).replace(/\.00$/, "")
    : String(amount);
  const symbol = country ? (COUNTRIES[country]?.symbol ?? "") : "";
  const priced = `${symbol}${price}`;
  return qty != null && qty > 1 ? `${priced} for ${qty}` : `${priced} each`;
}
