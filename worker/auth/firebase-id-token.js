// Firebase ID token verification for Cloudflare Workers (Web Crypto).
// Server-side only. Do not import into browser code.
// Project ID is public configuration, NOT a credential.
const PROJECT_ID = 'financia-57085';
const ISSUER = 'https://securetoken.google.com/' + PROJECT_ID;
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const encoder = new TextEncoder();

function decodeBase64Url(input) {
  if (typeof input !== 'string' || !/^[A-Za-z0-9_-]+$/.test(input)) throw new Error('Invalid base64url');
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(bytes, c => c.charCodeAt(0));
}
function parseJwtPart(part) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(part)));
}
function validNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// Returns a trusted Firebase uid or throws. Requires a real Firebase ID token
// obtained by the signed-in user. Never accepts a uid from request body.
export async function verifyFirebaseIdToken(idToken) {
  if (typeof idToken !== 'string' || idToken.length > 8192) throw new Error('Missing or oversized token');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const [head, payload, signature] = parts;
  const header = parseJwtPart(head);
  const claims = parseJwtPart(payload);
  const now = Math.floor(Date.now() / 1000);

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) throw new Error('Invalid JWT header');
  if (claims.aud !== PROJECT_ID || claims.iss !== ISSUER) throw new Error('Invalid issuer or audience');
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128) throw new Error('Invalid uid');
  if (!validNumber(claims.exp) || claims.exp <= now ||
      !validNumber(claims.iat) || claims.iat > now ||
      !validNumber(claims.auth_time) || claims.auth_time > now) throw new Error('Expired or invalid token');
  if (claims.firebase && claims.firebase.tenant) throw new Error('Unexpected tenant');

  // Cloudflare may cache Google's JWKS according to response headers.
  const response = await fetch(JWKS_URL, {cf: {cacheTtl: 300, cacheEverything: true}});
  if (!response.ok) throw new Error('Cannot obtain Firebase signing keys');
  const jwks = await response.json();
  if (!jwks || !Array.isArray(jwks.keys)) throw new Error('Invalid signing key set');
  const jwk = jwks.keys.find(key => key.kid === header.kid && key.kty === 'RSA' &&
    (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'));
  if (!jwk) throw new Error('Unknown signing key');
  const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(signature), encoder.encode(head + '.' + payload));
  if (!ok) throw new Error('Invalid signature');
  return claims.sub;
}

export async function requireFirebaseUser(request) {
  const header = request.headers.get('Authorization') || '';
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(header);
  if (!match) throw new Error('Missing bearer token');
  return verifyFirebaseIdToken(match[1]);
}
