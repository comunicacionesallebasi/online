/* Funciones compartidas por todas las páginas del flujo de compra */

const STORAGE_KEY = "allebasi_pedido";

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

// GET al backend, ej: apiGet({action:"menu"})
async function apiGet(params) {
  const url = new URL(API_URL);
  Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
  const resp = await fetch(url.toString());
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// POST al backend. Se usa Content-Type text/plain para evitar el
// preflight CORS que Apps Script no maneja bien.
async function apiPost(payload) {
  const resp = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
}

function formatoMoneda(valor) {
  if (valor === null || valor === undefined || valor === "") return "Precio a confirmar";
  const n = Number(valor) || 0;
  return "$" + n.toLocaleString("es-CO");
}

// Pinta en la barra lateral la imagen/producto elegido en el catálogo
function pintarReferencia(contenedorId) {
  const pedido = getPedido();
  const cont = document.getElementById(contenedorId);
  if (!cont || !pedido.imagen) return;
  cont.innerHTML = `
    <img src="${pedido.imagen}" alt="${pedido.nombrePrenda || ''}">
    <div class="desc">
      <strong>${pedido.artista || ''}</strong><br>
      ${pedido.nombrePrenda || ''}<br>
      ${formatoMoneda(pedido.valorUnitarioEstimado)} · Código ${pedido.codigoPrenda || ''}
    </div>`;
}
