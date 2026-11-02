/**
 * Financia — clasificación conservadora de movimientos importados.
 * Las reglas del usuario tienen prioridad sobre las sugerencias predefinidas.
 * No transmite datos ni accede a Gmail.
 */
export const DEFAULT_MERCHANT_RULES = Object.freeze([
  { pattern: /\\b(lider|jumbo|unimarc|santa isabel|tottus)\\b/i, category: "Alimentación" },
  { pattern: /\\b(copec|shell|petrobras|metro de santiago)\\b/i, category: "Transporte" },
  { pattern: /\\b(cruz verde|salcobrand|ahumada)\\b/i, category: "Salud" },
  { pattern: /\\b(cineplanet|cinemark)\\b/i, category: "Entretenimiento" }
]);

export function normalizeMerchant(value) {
  return String(value ?? "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\\s+/g, " ");
}

export function categorizeMovement(movement, options = {}) {
  const merchant = normalizeMerchant(movement?.merchant);
  const categories = Array.isArray(options.categories) ? options.categories : [];
  const allowed = new Set(categories.map(c => typeof c === "string" ? c : c?.name).filter(Boolean));
  const remembered = options.remembered || {};
  const saved = merchant && Object.hasOwn(remembered, merchant) ? remembered[merchant] : null;

  if (saved && allowed.has(saved)) {
    return { category: saved, reviewRequired: false, source: "user-rule" };
  }
  if (!merchant) return { category: "Otros", reviewRequired: true, source: "unknown-merchant" };
  const hits = DEFAULT_MERCHANT_RULES.filter(r => r.pattern.test(merchant) && allowed.has(r.category));
  if (hits.length === 1) return { category: hits[0].category, reviewRequired: false, source: "merchant-rule" };
  return { category: allowed.has("Otros") ? "Otros" : null, reviewRequired: true, source: "unclassified" };
}

export function rememberCorrection(remembered, merchant, category, categories) {
  const key = normalizeMerchant(merchant);
  const allowed = new Set(categories.map(c => typeof c === "string" ? c : c?.name));
  if (!key || !allowed.has(category)) throw new Error("Comercio o categoría no válida");
  return { ...remembered, [key]: category };
}

export function mergeImportedMovement(existing, incoming) {
  if (!incoming?.externalId || !incoming?.source) throw new Error("Identificador de origen requerido");
  if (existing.some(m => m.source === incoming.source && m.externalId === incoming.externalId)) {
    return { movements: existing, inserted: false };
  }
  return { movements: [...existing, incoming], inserted: true };
}
