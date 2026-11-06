// Panel aislado para movimientos pendientes de Financia API v2.
// Solo aparece si la API fue configurada explicitamente. No modifica saldos.
(function () {
  'use strict';
  if (!window.FINANCIA_API_V2_BASE_URL) return;
  const api = window.FINANCIA_API_V2;
  if (!api) return;
  const panel = document.createElement('section');
  panel.id = 'financia-v2-review-panel';
  panel.setAttribute('aria-label', 'Movimientos pendientes');
  panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:10000;width:min(390px,calc(100vw - 32px));max-height:70vh;overflow:auto;background:#fff;color:#17233d;border:1px solid #d9e1ef;border-radius:14px;padding:16px;box-shadow:0 8px 28px #0002;font:14px system-ui';
  const heading = document.createElement('h2');
  heading.textContent = 'Compras por revisar';
  heading.style.cssText = 'font-size:18px;margin:0 0 10px';
  const status = document.createElement('p');
  status.setAttribute('role','status');
  const list = document.createElement('div');
  const refresh = document.createElement('button');
  refresh.textContent = 'Actualizar';
  refresh.type = 'button';
  refresh.style.cssText = 'padding:8px 12px;border-radius:8px;border:1px solid #9daec9;background:#f3f6fc;cursor:pointer';
  panel.append(heading,refresh,status,list);

  const money = (row) => {
    const amount = Number(row.amount_minor);
    const currency = String(row.currency_code || '');
    if (!Number.isSafeInteger(amount) || !/^[A-Z]{3}$/.test(currency)) return 'Importe no disponible';
    // El contrato v2 expresa montos en unidades menores; CLP no usa decimales.
    const digits = ['CLP','JPY','KRW','PYG','VND'].includes(currency) ? 0 : 2;
    return new Intl.NumberFormat('es-CL',{
      style:'currency',currency,minimumFractionDigits:digits,
      maximumFractionDigits:digits
    }).format(amount / (10 ** digits));
  };

  async function load() {
    refresh.disabled = true;
    list.replaceChildren();
    status.textContent = 'Cargando movimientos…';
    try {
      await api.readiness();
      const data = await api.listPending();
      const movements = Array.isArray(data.movements) ? data.movements : [];
      status.textContent = movements.length ? movements.length + ' movimiento(s) pendiente(s)' : 'No hay compras pendientes.';
      movements.forEach((row) => {
        const item = document.createElement('div');
        item.style.cssText = 'border-top:1px solid #e4e8ef;padding:12px 0';
        const desc = document.createElement('strong');
        desc.textContent = String(row.description || 'Movimiento');
        const details = document.createElement('p');
        details.textContent = money(row) + ' · ' + String(row.booked_at || '');
        details.style.margin = '5px 0 8px';
        item.append(desc,details);
        [['Aprobar','approved'],['Rechazar','rejected']].forEach(([label,decision])=>{
          const btn = document.createElement('button');
          btn.type='button';
          btn.textContent=label;
          btn.style.cssText='padding:6px 10px;margin-right:8px;border:1px solid #9daec9;border-radius:7px;background:#f4f7fc;cursor:pointer';
          btn.addEventListener('click',async()=>{
            if (!window.confirm('¿' + label + ' este movimiento?')) return;
            item.querySelectorAll('button').forEach(b=>b.disabled=true);
            try {
              await api.review(row.id,decision);
              await load();
            } catch(err) {
              status.textContent=err.message || 'No se pudo revisar el movimiento';
              item.querySelectorAll('button').forEach(b=>b.disabled=false);
            }
          });
          item.append(btn);
        });
        list.append(item);
      });
    } catch (err) {
      status.textContent = err.message || 'No se pudieron cargar los movimientos';
    } finally {
      refresh.disabled = false;
    }
  }
  refresh.addEventListener('click',load);
  document.body.append(panel);
  // La primera consulta es iniciada por el usuario, no al abrir la pagina.
  status.textContent = 'Presiona Actualizar para consultar tus movimientos.';
})();
