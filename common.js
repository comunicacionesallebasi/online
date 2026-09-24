/* Funciones compartidas por todas las páginas del flujo de compra */

const STORAGE_KEY = "allebasi_pedido";
const MAX_PRENDAS = 3;

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

// Identificador único de este intento de pedido. Se genera una sola vez
// por pedido y viaja en cada POST: si el navegador reintenta el envío
// (por un error de red momentáneo) el backend reconoce la misma clave y
// NO vuelve a crear una fila duplicada en la hoja.
function getIdempotencyKey() {
  const pedido = getPedido();
  if (pedido.idempotencyKey) return pedido.idempotencyKey;
  const key = "web-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  setPedido({ idempotencyKey: key });
  return key;
}

// GET al backend, ej: apiGet({action:"menu"})
async function apiGet(params) {
  const url = new URL(API_URL);
  Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
  const resp = await fetch(url.toString());
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// POST al backend, con reintentos silenciosos ante fallos de red
// transitorios (frecuentes justo después de publicar una nueva versión
// del Apps Script). Solo se propaga el error al llamador si los 3
// intentos fallan. Gracias a la idempotencyKey que ya viaja en el
// payload, un reintento nunca crea un pedido duplicado en la hoja.
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

// Pinta en la barra lateral las imágenes de TODAS las prendas elegidas
// en el catálogo (hasta 3), para que sirvan de referencia mientras se
// llenan los formularios.
function pintarReferencia(contenedorId) {
  const pedido = getPedido();
  const cont = document.getElementById(contenedorId);
  const items = pedido.items || [];
  if (!cont || items.length === 0) return;
  cont.innerHTML = items.map(function (item) {
    return `
      <div class="referencia-item">
        <img src="${item.imagen}" alt="${item.nombrePrenda || ''}">
        <div class="desc">
          <strong>${pedido.artista || ''}</strong><br>
          ${item.nombrePrenda || ''}<br>
          ${formatoMoneda(item.valorUnitarioEstimado)} · Código ${item.codigoPrenda || ''}
        </div>
      </div>`;
  }).join('');
}
