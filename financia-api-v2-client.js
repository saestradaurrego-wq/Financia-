// Financia: cliente seguro de API v2.
// La identidad se obtiene de Firebase Authentication, no de un uid ingresado.
// El navegador nunca recibe el secreto del Worker ni tokens bancarios.
(function () {
  'use strict';
  const API_BASE = 'https://cold-surf-9305.sa-estradaurrego.workers.dev';
  async function currentToken() {
    if (!window.firebase || !firebase.auth) throw new Error('Firebase no disponible');
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Inicia sesión para continuar');
    return user.getIdToken();
  }
  async function api(path, options) {
    const token = await currentToken();
    const response = await fetch(API_BASE + path, {
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
    listPending: () => api('/api/v2/movements/pending'),
    review: (movementId, decision) => api('/api/v2/movements/review', {
      method:'POST', body:{movementId,decision}
    })
  });
})();
