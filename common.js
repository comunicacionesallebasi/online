/* Funciones compartidas por todas las páginas del flujo de compra */

const STORAGE_KEY = "allebasi_pedido";
const MAX_PRENDAS = 10;

function getPedido() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function setPedido(datosParciales) {
  const actual = getPedido();
  const nuevo = Object.assign(actual, datosParciales);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nuevo));
  return nuevo;
}

function limpiarPedido() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function irA(pagina) {
  window.location.href = pagina;
}

// Identificador único de este intento de pedido.
function getIdempotencyKey() {
  const pedido = getPedido();
  if (pedido.idempotencyKey) return pedido.idempotencyKey;
  const key = "web-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  setPedido({ idempotencyKey: key });
  return key;
}

// GET al backend con reintentos silenciosos.
async function apiGet(params, intentos) {
  intentos = intentos || 3;
  let ultimoError;
  for (let i = 0; i < intentos; i++) {
    try {
      const url = new URL(API_URL);
      Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
      const resp = await fetch(url.toString());
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (err) {
      ultimoError = err;
      if (i < intentos - 1) {
        await new Promise(r => setTimeout(r, 700 * (i + 1)));
      }
    }
  }
  throw ultimoError;
}

/**
 * VERSION 5 — GET con caché en sessionStorage.
 *
 * La respuesta del servidor se guarda en sessionStorage con una clave
 * derivada de los parámetros. Durante la misma sesión de navegación:
 *  - El menú solo se descarga UNA vez.
 *  - Cada catálogo solo se descarga UNA vez, aunque el usuario vuelva
 *    al menú y lo vuelva a seleccionar.
 *
 * TTL del lado del cliente: 5 minutos (300 000 ms).
 * Pasado ese tiempo el resultado expira y la próxima llamada va al servidor
 * (que a su vez puede servir desde su propio CacheService).
 */
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function apiGetCached(params) {
  const cacheKey = 'apicache_' + JSON.stringify(params);
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) {
      const entry = JSON.parse(raw);
      if (entry && entry.ts && (Date.now() - entry.ts) < CLIENT_CACHE_TTL_MS) {
        return entry.data;
      }
    }
  } catch (e) { /* sessionStorage no disponible o JSON inválido */ }

  const data = await apiGet(params);

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: data }));
  } catch (e) { /* falla silenciosamente si sessionStorage está lleno */ }

  return data;
}

// POST al backend con reintentos silenciosos.
async function apiPost(payload, intentos) {
  intentos = intentos || 3;
  let ultimoError;
  for (let i = 0; i < intentos; i++) {
    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      if (data.ok === false) throw new Error(data.error || "El servidor rechazó el pedido");
      return data;
    } catch (err) {
      ultimoError = err;
      if (i < intentos - 1) {
        await new Promise(r => setTimeout(r, 900 * (i + 1)));
      }
    }
  }
  throw ultimoError;
}

function formatoMoneda(valor) {
  if (valor === null || valor === undefined || valor === "") return "Precio a confirmar";
  const n = Number(valor) || 0;
  return "$" + n.toLocaleString("es-CO");
}

function pintarReferencia(contenedorId) {
  const pedido = getPedido();
  const cont = document.getElementById(contenedorId);
  const items = pedido.items || [];
  if (!cont || items.length === 0) return;
  cont.innerHTML = items.map(function (item) {
    return renderTarjetaReferencia_(item, pedido.artista);
  }).join('');
}

function pintarReferenciaItem(contenedorId, item, artista) {
  const cont = document.getElementById(contenedorId);
  if (!cont || !item) return;
  cont.innerHTML = renderTarjetaReferencia_(item, artista);
}

function renderTarjetaReferencia_(item, artista) {
  return `
    <div class="referencia-item">
      <img src="${item.imagen}" alt="${item.nombrePrenda || ''}">
      <div class="desc">
        <strong>${artista || ''}</strong><br>
        ${item.nombrePrenda || ''}<br>
        ${formatoMoneda(item.valorUnitarioEstimado)} · Código ${item.codigoPrenda || ''}
      </div>
    </div>`;
}
