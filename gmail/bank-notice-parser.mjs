/* Financia Gmail notification parser (draft). Run on trusted backend, never in browser with Gmail tokens. */
export function parseBankNotice(message) {
  const from = String(message?.from || "");
  const subject = String(message?.subject || "");
  const body = String(message?.text || "");
  const raw = (subject + "\n" + body).normalize("NFKC");
  // Sender domain is an allowlist configured after validating real samples; display names alone are not trusted.
  if (!message?.trustedSender) return { status: "ignored", reason: "unverified_sender" };
  if (!/compra|cargo|transacci[oó]n|pago/i.test(raw)) return { status: "ignored", reason: "not_purchase" };
  if (/anulad[ao]|revers[ao]|devoluci[oó]n|rechazad[ao]/i.test(raw)) return { status: "review", reason: "reversal_or_rejection" };
  const matches = [...raw.matchAll(/(?:\$|CLP\s*)(\d{1,3}(?:[.,]\d{3})+|\d{1,9})(?![\d.,])/gi)];
  const values = matches.map(m => Number(m[1].replace(/[.,]/g, ""))).filter(n => Number.isSafeInteger(n) && n > 0);
  if (values.length !== 1) return { status: "review", reason: "ambiguous_amount" };
  if (!message?.gmailMessageId) return { status: "review", reason: "missing_message_id" };
  return {
    status: "candidate",
    movement: { type: "expense", amount: values[0], currency: "CLP", source: "gmail_banco_chile",
      externalId: String(message.gmailMessageId), date: message.date || null,
      description: subject.slice(0, 120), reviewRequired: true }
  };
}
