// Financia: cliente seguro de API v2.
// La identidad se obtiene de Firebase Authentication, no de un uid ingresado.
// El navegador nunca recibe el secreto del Worker ni tokens bancarios.
(function () {
  'use strict';
  // No enviar tokens Firebase al Worker antiguo. Activar solo tras desplegar
  // y verificar el endpoint v2 bajo un origen autorizado.
  function apiBase() {
    const configured = window.FINANCIA_API_V2_BASE_URL;
    if (typeof configured !== 'string' || !configured) {
      throw new Error('La API bancaria v2 todavía no está habilitada');
    }
    const url = new URL(configured, location.origin);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw new Error('Configuración de API inválida');
    }
    return url.origin + url.pathname.replace(/\/$/, '');
  }
  async function currentToken() {
    if (!window.firebase || !firebase.auth) throw new Error('Firebase no disponible');
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Inicia sesión para continuar');
    return user.getIdToken();
  }
  async function api(path, options) {
    const token = await currentToken();
    const response = await fetch(apiBase() + path, {
      method: options?.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        ...(options?.body ? {'Content-Type':'application/json'} : {})
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
      credentials: 'omit'
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('Respuesta inesperada del servidor'); }
    if (!response.ok || !data.ok) throw new Error(data.error || 'Error de conexión');
    return data;
  }
  // API v2 todavía NO desplegada: no se llama hasta activación explícita.
  window.FINANCIA_API_V2 = Object.freeze({
    readiness: async () => {
      const response = await fetch(apiBase() + '/api/v2/ready', {
        method:'GET',cache:'no-store',credentials:'omit'
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ready) {
        throw new Error('La API bancaria todavía no está preparada. No se enviaron datos.');
      }
      return data;
    },
    listPending: () => api('/api/v2/movements/pending'),
    entitlements: () => api('/api/v2/entitlements'),
    listAccounts: () => api('/api/v2/accounts'),
    createAccount: (account) => api('/api/v2/accounts', {method:'POST',body:account}),
    createPending: (movement) => api('/api/v2/movements/create', {method:'POST',body:movement}),
    review: (movementId, decision) => api('/api/v2/movements/review', {
      method:'POST', body:{movementId,decision}
    })
  });
})();
