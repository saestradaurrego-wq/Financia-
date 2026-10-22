// Financia feedback API helper for a Cloudflare Worker.
// Bind a Cloudflare D1 database as env.DB and route POST /api/feedback here.
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

export async function handleFeedbackRequest(request, env) {
  if (request.method !== "POST") {
    return json({ error: "Método no permitido." }, 405);
  }
  if (!env || !env.DB) {
    return json({ error: "El almacenamiento aún no está configurado." }, 503);
  }
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "Formato de solicitud no válido." }, 415);
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 10000) return json({ error: "La respuesta es demasiado larga." }, 413);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "No se pudo leer el formulario." }, 400); }

  // Honeypot: silently accept automated submissions without storing them.
  if (typeof body.website === "string" && body.website.trim()) return json({ ok: true }, 201);

  const rating = Number(body.rating);
  const ease = String(body.ease || "");
  const feature = String(body.feature || "").trim().slice(0, 120);
  const message = String(body.message || "").trim().slice(0, 2000);
  const email = String(body.email || "").trim().slice(0, 254);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "Selecciona una evaluación válida." }, 400);
  if (!["easy", "medium", "hard"].includes(ease)) return json({ error: "Selecciona una respuesta válida sobre facilidad de uso." }, 400);
  if (message.length < 3) return json({ error: "Escribe un comentario de al menos 3 caracteres." }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "El correo no parece válido." }, 400);

  const userAgent = (request.headers.get("user-agent") || "").slice(0, 300);
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO feedback (id, rating, ease, feature, message, email, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).bind(id, rating, ease, feature || null, message, email || null, userAgent || null).run();
    return json({ ok: true, id }, 201);
  } catch (error) {
    // Avoid returning database details to visitors.
    console.error("Financia feedback insert failed", error);
    return json({ error: "No se pudo guardar el comentario. Inténtalo más tarde." }, 500);
  }
}
