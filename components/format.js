export const rupees = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const KEY = "rent-receipt:last";

// Session storage only carries the last receipt over to the verify page; nothing depends on it.
export function saveReceipt(receipt) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(receipt));
  } catch {
    // private window or storage off
  }
}

export function loadReceipt() {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// The quote's place in the page text, allowing for any spacing and line breaks between its words.
export function findQuote(page, quote) {
  const words = String(quote || "").match(/[\p{L}\p{N}]+/gu) || [];
  if (words.length < 2) return null;
  const esc = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const m = new RegExp(esc.join("[^\\p{L}\\p{N}]+"), "iu").exec(page);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}
