// =============================================================
// Calculadora de Incapacidad — lógica de cálculo y UI
// =============================================================
//
// Variables de la fórmula:
//   VIB           Ingreso base: suma de los sueldos incluidos llevados al mes
//                 de la PMI por cociente de índices RIPTE, dividida por la
//                 cantidad de meses incluidos (12 por defecto) (RIPTE 1)
//   TASA          Interés del ingreso base (RIPTE 2): VIB × (coef − 1), donde
//                 el coef sale de sumar variaciones diarias del RIPTE entre la
//                 PMI y la liquidación, en forma simple y con rezago de 3 meses
//   INC           Incapacidad en DECIMAL (ej 0.025 para 2.5%)
//   EDAD          Edad del trabajador
//   FACTOR_EDAD   65 / EDAD
//   EN_ITINERE    booleano
//   BASE          53 * (VIB + TASA) * INC * FACTOR_EDAD  (fórmula SRT sin piso)
//   PISO          Piso mínimo de la Res. SRT vigente a la PMI, ya multiplicado
//                 por el grado de ILP y actualizado por RIPTE a la liquidación
//
// Fórmula por defecto (ILP parcial ≤ 50%, Ley 26.773 / 27.348 / Dto. 669/19):
// se toma el mayor entre la fórmula y el piso mínimo, y sobre ese mayor se
// aplica el adicional de pago único del 20% si la contingencia NO es in itinere.
//   IF(EN_ITINERE, MAX(BASE, PISO), MAX(BASE, PISO) * 1.2)

const DEFAULT_FORMULA =
  "IF(EN_ITINERE, MAX(BASE, PISO), MAX(BASE, PISO) * 1.2)";

// Fórmulas anteriores (sin piso mínimo): si el usuario tenía guardada una de
// ellas sin modificar, se migra sola a la nueva por defecto.
const LEGACY_FORMULAS = [
  "IF(EN_ITINERE, 53 * (VIB + TASA) * INC * (65/EDAD), 53 * (VIB + TASA) * INC * (65/EDAD) * 1.2)",
];

const STORAGE = {
  ripte: "calc-incap.ripte",
  pisos: "calc-incap.pisos",
  formula: "calc-incap.formula",
  theme: "calc-incap.theme",
};

// ---------- Persistencia ----------
function loadStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function saveStore(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
  // Si cambiaron las tablas de cálculo, la calculadora se rehace con los
  // datos nuevos. Va acá para que ningún punto de guardado pueda olvidarlo.
  if (key === STORAGE.ripte || key === STORAGE.pisos) recrearCalculadora();
}

let RIPTE = loadStore(STORAGE.ripte, window.SEED_RIPTE || []);
let PISOS = loadStore(STORAGE.pisos, window.SEED_PISOS || []);
let FORMULA = loadStore(STORAGE.formula, DEFAULT_FORMULA);

// Migración: fórmulas guardadas antes de que existiera el piso mínimo.
if (LEGACY_FORMULAS.includes(FORMULA.replace(/\s+/g, " ").trim())) {
  FORMULA = DEFAULT_FORMULA;
  saveStore(STORAGE.formula, FORMULA);
}

// ---------- Formato ----------
// Presentación: viven acá, no en el núcleo, que devuelve números crudos.
const fmtMoney = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const fmtNum = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtPct = new Intl.NumberFormat("es-AR", {
  style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2,
});
// Para el detalle del RIPTE (2): las tasas mensuales se comparan a 4 decimales.
const fmtPct4 = new Intl.NumberFormat("es-AR", {
  style: "percent", minimumFractionDigits: 4, maximumFractionDigits: 4,
});

// ---------- Núcleo de cálculo ----------
// Toda la lógica de cálculo vive en calculo.js (ver ADR 0001). Acá quedan
// solo los adaptadores que la capa de UI consume, con los mismos nombres
// de antes para no tocar los puntos de llamada.

const {
  parseISODate, ymOf, ymAdd, diasDelMes, diffDays, calcEdad, isoOfUTC, toNumber,
  compilarFormula: compileFormula,
} = Calculo;

// La calculadora se recrea cuando cambian las tablas (panel de administración).
let CALC = Calculo.crearCalculadora({ ripte: RIPTE, pisos: PISOS });
function recrearCalculadora() {
  CALC = Calculo.crearCalculadora({ ripte: RIPTE, pisos: PISOS });
}

function addMonths(date, n) {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + n);
  return d;
}
function todayUTC() {
  const t = new Date();
  return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
}

const ripteIndex = (periodo) => CALC.indice(periodo);
const pisoVigente = (fechaPmi) => CALC.pisoVigente(fechaPmi);
const tasaMensualRipte = (ym) => CALC.tasaMensual(ym);
const coefRipte2 = (fechaPmi, fechaCorte) => CALC.coeficiente(fechaPmi, fechaCorte);

// Mismo coeficiente para el ingreso base y para el piso, incluso con el
// interés cargado a mano (ver D-1 de la spec).
function coefEfectivoRipte2(vib, fechaPmi, fechaLiq) {
  const r2 = calcularRipte2(vib, fechaPmi, fechaLiq);
  if (r2.manual) {
    return { coef: vib > 0 ? 1 + r2.monto / vib : 1, ok: true, faltantes: [], manual: true };
  }
  return { coef: r2.coef, ok: r2.ok, faltantes: r2.faltantes, manual: false };
}

function calcularPiso(incDec, fechaPmi, fechaLiq, actualizar, r2) {
  const p = CALC.piso(incDec, fechaPmi, r2.coef, actualizar);
  let aviso = null;
  if (p.aviso) {
    aviso = p.aviso + ' Cargalo en Administración → Pisos mínimos.';
  } else if (!r2.ok) {
    aviso = 'Faltan índices RIPTE para los tramos de ' + r2.faltantes.join(', ') +
      ': el piso quedó mal actualizado.';
  }
  return Object.assign({}, p, { norma: p.norma || '—', manual: !!r2.manual, aviso });
}

// =============================================================
// UI
// =============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(getPreferredTheme());
  setupTabs();
  setupThemeToggle();
  setupCalc();
  setupAdmin();
});

function getPreferredTheme() {
  const stored = loadStore(STORAGE.theme, null);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("theme-dark", normalized === "dark");
  document.body.classList.toggle("theme-light", normalized === "light");
  document.body.style.colorScheme = normalized;

  const btn = $("#btnTheme");
  if (btn) {
    const isDark = normalized === "dark";
    btn.textContent = isDark ? "☀" : "☾";
    btn.setAttribute("aria-pressed", String(isDark));
    btn.setAttribute("aria-label", isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    btn.setAttribute("title", isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  }
}

function setupThemeToggle() {
  const btn = $("#btnTheme");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("theme-dark") ? "light" : "dark";
    saveStore(STORAGE.theme, nextTheme);
    applyTheme(nextTheme);
  });
}

function setupTabs() {
  $$(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const v = btn.dataset.view;
      $("#view-calc").classList.toggle("hidden", v !== "calc");
      $("#view-admin").classList.toggle("hidden", v !== "admin");
      if (v === "admin") {
        renderRipteTable();
        renderPisosTable();
        $("#formulaEditor").value = FORMULA;
      }
    });
  });
}

// =============================================================
// Vista: Calculadora
// =============================================================
function setupCalc() {
  $("#fechaSiniestro").addEventListener("change", onSiniestroChange);
  $("#fechaSiniestro").addEventListener("change", actualizarEdadCalculada);
  $("#fechaNacimiento").addEventListener("change", actualizarEdadCalculada);
  $("#btnCalcular").addEventListener("click", calcular);
  $("#btnDescargarPdf").addEventListener("click", descargarPdf);
  $("#btnDescargar").addEventListener("click", descargarExcel);
  $("#fechaHasta").value = isoOfUTC(todayUTC());
  $("#fechaLiquidacion").value = isoOfUTC(todayUTC());
  ["#fechaSiniestro", "#incapacidad", "#fechaLiquidacion", "#actualizarPiso"].forEach(sel => {
    $(sel).addEventListener("change", refrescarPiso);
  });
  $("#incapacidad").addEventListener("input", refrescarPiso);
  ["#fechaSiniestro", "#fechaLiquidacion", "#tasaManualOn", "#tasaManual"].forEach(sel => {
    $(sel).addEventListener("change", refrescarRipte2);
  });
  $("#tasaManual").addEventListener("input", refrescarRipte2);
  $("#btnLimpiar").addEventListener("click", () => {
    if (!confirm("¿Limpiar todos los campos?")) return;
    $("#nombre").value = "";
    $("#fechaSiniestro").value = "";
    $("#fechaNacimiento").value = "";
    actualizarEdadCalculada();
    $("#incapacidad").value = "";
    $("#enItinere").value = "no";
    $("#periodoBase").value = "";
    $("#tblSueldos tbody").innerHTML = "";
    $("#vibCell").textContent = "—";
    $("#vibDivisor").textContent = "";
    $("#tasaManual").value = "";
    $("#tasaManualOn").checked = false;
    $("#tasaManual").disabled = true;
    $("#tasaAnual").value = "";
    $("#fechaHasta").value = isoOfUTC(todayUTC());
    $("#fechaLiquidacion").value = isoOfUTC(todayUTC());
    $("#actualizarPiso").checked = true;
    limpiarResultado();
    ["#kpiVib", "#kpiVibTasa", "#kpiFactorEdad",
     "#kpiPisoBase", "#kpiPisoNorma", "#kpiPisoCoef", "#kpiPiso",
     "#kpiRipte2Dias", "#kpiRipte2Var", "#kpiRipte2Coef", "#kpiRipte2Monto"].forEach(sel => {
      $(sel).textContent = "—";
    });
    $("#ripteWarn").classList.add("hidden");
    $("#pisoWarn").classList.add("hidden");
    $("#ripte2Warn").classList.add("hidden");
    $("#ripte2Detalle").classList.add("hidden");
    $("#tblRipte2 tbody").innerHTML = "";
  });
}

// Refresca la tarjeta "Piso mínimo" a medida que cambian sus insumos.
// Devuelve el resultado de calcularPiso(), o null si faltan datos.
function refrescarPiso() {
  const fs = parseISODate($("#fechaSiniestro").value);
  const incPct = toNumber($("#incapacidad").value);
  const warn = $("#pisoWarn");
  const setKpis = (b, n, c, p) => {
    $("#kpiPisoBase").textContent = b;
    $("#kpiPisoNorma").textContent = n;
    $("#kpiPisoCoef").textContent = c;
    $("#kpiPiso").textContent = p;
    $("#kpiPisoResultado").textContent = p;
  };

  if (!fs || isNaN(incPct) || incPct < 0) {
    setKpis("—", "—", "—", "—");
    warn.classList.add("hidden");
    return null;
  }

  const fechaLiq = parseISODate($("#fechaLiquidacion").value) || todayUTC();
  // Mismo coeficiente que el ingreso base, sea calculado o cargado a mano.
  const vib = recalcSueldos();
  const r2 = coefEfectivoRipte2(vib, fs, fechaLiq);
  const piso = calcularPiso(incPct / 100, fs, fechaLiq, $("#actualizarPiso").checked, r2);

  const detalleCoef = !piso.aplicaCoef ? " (sin aplicar)" : (piso.manual ? " (implícito del monto manual)" : "");
  setKpis(
    piso.fila ? fmtMoney.format(piso.base) : "—",
    piso.norma || "—",
    piso.fila ? fmtNum.format(piso.coef) + detalleCoef : "—",
    piso.fila ? fmtMoney.format(piso.monto) : "—"
  );

  const avisos = [];
  if (piso.aviso) avisos.push(piso.aviso);
  if (incPct > 50) {
    avisos.push("El grado de ILP supera el 50%: esta variante corresponde a ILP parcial ≤ 50%. " +
      "Para ILP > 50% aplican otras reglas (renta periódica / prestación complementaria).");
  }
  if (avisos.length) {
    warn.textContent = avisos.join(" ");
    warn.classList.remove("hidden");
  } else {
    warn.classList.add("hidden");
  }
  return piso;
}

function actualizarEdadCalculada() {
  const el = $("#edadCalculada");
  if (!el) return;
  const fs = parseISODate($("#fechaSiniestro").value);
  const fn = parseISODate($("#fechaNacimiento").value);
  if (!fn) {
    el.textContent = "La edad se calcula a la fecha del siniestro.";
    return;
  }
  if (!fs) {
    el.textContent = "Ingresá la fecha del siniestro para calcular la edad.";
    return;
  }
  const edad = calcEdad(fn, fs);
  if (isNaN(edad) || edad < 0) {
    el.textContent = "Fecha de nacimiento inválida respecto al siniestro.";
    return;
  }
  el.textContent = `Edad calculada: ${edad} años (a la fecha del siniestro).`;
}

function onSiniestroChange() {
  const fs = parseISODate($("#fechaSiniestro").value);
  if (!fs) return;
  const baseYM = ymOf(fs);
  $("#periodoBase").value = baseYM;
  buildSueldosTable(fs);
}

function buildSueldosTable(fechaSiniestro) {
  const tbody = $("#tblSueldos tbody");
  const baseMonthStart = new Date(Date.UTC(fechaSiniestro.getUTCFullYear(), fechaSiniestro.getUTCMonth(), 1));
  const baseYM = ymOf(baseMonthStart);
  const baseIndice = ripteIndex(baseYM);
  const missing = [];
  if (baseIndice === null) missing.push(baseYM);

  const rows = [];
  for (let i = 1; i <= 12; i++) {
    const d = addMonths(baseMonthStart, -i);
    rows.push(ymOf(d));
  }
  // Mostrar de más reciente a más antiguo (como el Excel)
  tbody.innerHTML = "";
  rows.forEach(ym => {
    const indice = ripteIndex(ym);
    if (indice === null) missing.push(ym);
    const tr = document.createElement("tr");
    tr.dataset.periodo = ym;
    tr.dataset.indice = indice ?? "";
    tr.innerHTML = `
      <td class="center"><input type="checkbox" class="incluido" checked aria-label="Incluir ${ym} en el promedio" /></td>
      <td>${ym}</td>
      <td><input type="number" step="0.01" class="sueldo" placeholder="0,00" /></td>
      <td class="num">${indice !== null ? fmtNum.format(indice) : "—"}</td>
      <td class="num coef">—</td>
      <td class="num actual">—</td>
    `;
    tbody.appendChild(tr);
  });

  // Indicar warn si faltan ripte
  const warn = $("#ripteWarn");
  if (missing.length) {
    warn.textContent = `Atención: faltan datos de RIPTE para los períodos: ${[...new Set(missing)].join(", ")}. Cargá los valores en Administración.`;
    warn.classList.remove("hidden");
  } else {
    warn.classList.add("hidden");
  }

  tbody.querySelectorAll("input.sueldo").forEach(inp => {
    // El interés del RIPTE (2) se calcula sobre el VIB, así que se recalcula
    // junto con los sueldos (refrescarRipte2 ya llama a recalcSueldos).
    inp.addEventListener("input", () => { recalcSueldos(); refrescarRipte2(); });
  });
  tbody.querySelectorAll("input.incluido").forEach(chk => {
    chk.addEventListener("change", () => { recalcSueldos(); refrescarRipte2(); });
  });
}

// Lee los sueldos cargados en la tabla, en el formato que espera el núcleo.
function leerSueldos() {
  return $$("#tblSueldos tbody tr").map(tr => ({
    periodo: tr.dataset.periodo,
    monto: tr.querySelector("input.sueldo").value,
    incluido: tr.querySelector("input.incluido").checked,
  }));
}

// Pinta la tabla de sueldos. El cálculo lo hace el núcleo; acá solo se leen
// los valores del DOM y se escribe el resultado.
function recalcSueldos() {
  const tbody = $("#tblSueldos tbody");
  const fs = parseISODate($("#fechaSiniestro").value);
  if (!fs) return 0;

  const filasDom = Array.from(tbody.querySelectorAll("tr"));
  const base = CALC.ingresoBase(leerSueldos(), ymOf(fs));

  base.filas.forEach((fila, i) => {
    const tr = filasDom[i];
    const hayValor = fila.actualizado !== null;
    tr.classList.toggle("excluido", !fila.incluido);
    tr.querySelector(".coef").textContent = hayValor ? fmtNum.format(fila.coef) : "—";
    tr.querySelector(".actual").textContent = hayValor ? fmtMoney.format(fila.actualizado) : "—";
  });

  const hayAlguno = base.mesesCargados > 0;
  $("#vibCell").textContent = hayAlguno ? fmtMoney.format(base.vib) : "—";
  $("#vibDivisor").textContent = ` ÷ ${base.mesesIncluidos}`;

  const avisoDiv = $("#vibAviso");
  if (avisoDiv) {
    const divisor = base.mesesIncluidos;
    const faltan = divisor - base.mesesCargados;
    const textos = [];
    if (divisor === 0) {
      textos.push("No hay meses incluidos: marcá al menos uno para calcular el promedio.");
    } else if (hayAlguno && faltan > 0) {
      textos.push(`Hay ${faltan} ${faltan === 1 ? "mes incluido sin cargar" : "meses incluidos sin cargar"}: ` +
        `cuentan como cero y el promedio igual se divide por ${divisor}.`);
    }
    if (divisor > 0 && divisor < 12) {
      textos.push(`El promedio se calcula sobre ${divisor} ${divisor === 1 ? "mes incluido" : "meses incluidos"}.`);
    }
    avisoDiv.textContent = textos.join(" ");
    avisoDiv.classList.toggle("hidden", textos.length === 0);
  }
  return base.vib;
}

// RIPTE (2): entre la PMI y la puesta a disposición, el ingreso base devenga
// un interés igual a la variación del RIPTE del período (nota 2 de la SRT).
// No es una tasa que se cargue a mano; sale del propio índice.
//   TASA = VIB × (RIPTE(liquidación) / RIPTE(PMI) − 1)
// de modo que VIB + TASA = VIB actualizado a la fecha de liquidación.
// Devuelve { monto, coef, desde, hasta, manual, aviso, nota }.
function calcularRipte2(vib, fechaPmi, fechaLiq) {
  if ($("#tasaManualOn").checked) {
    const v = toNumber($("#tasaManual").value);
    return {
      monto: isNaN(v) ? 0 : v, coef: NaN, dias: 0, tramos: [], faltantes: [],
      ok: true, manual: true, aviso: null,
    };
  }
  const r = coefRipte2(fechaPmi, fechaLiq);
  const aviso = r.ok ? null
    : `Faltan índices RIPTE para calcular la tasa de ${r.faltantes.join(", ")}. Cada mes usa el ` +
      `índice de 3 y 4 meses antes; no se extrapola, así que esos tramos quedaron fuera del cálculo. ` +
      `Cargalos en Administración → RIPTE.`;
  return {
    monto: vib * (r.coef - 1), coef: r.coef, dias: r.dias, tramos: r.tramos,
    faltantes: r.faltantes, ok: r.ok, manual: false, aviso,
  };
}

// Recalcula la tarjeta de RIPTE (2) y devuelve el resultado.
function refrescarRipte2() {
  const manual = $("#tasaManualOn").checked;
  $("#tasaManual").disabled = !manual;

  const fs = parseISODate($("#fechaSiniestro").value);
  const fechaLiq = parseISODate($("#fechaLiquidacion").value) || todayUTC();
  const vib = recalcSueldos();
  const r2 = calcularRipte2(vib, fs, fechaLiq);

  $("#kpiRipte2Dias").textContent = r2.manual ? "manual" : (r2.dias ? `${r2.dias} días` : "—");
  $("#kpiRipte2Var").textContent = r2.manual || isNaN(r2.coef) ? "—" : fmtPct.format(r2.coef - 1);
  $("#kpiRipte2Coef").textContent = r2.manual || isNaN(r2.coef) ? "—" : fmtNum.format(r2.coef);
  $("#kpiRipte2Monto").textContent = fmtMoney.format(r2.monto);
  renderTramosRipte2(r2);

  const warn = $("#ripte2Warn");
  warn.textContent = r2.aviso || "";
  warn.classList.toggle("hidden", !r2.aviso);

  return r2;
}

// Detalle mes a mes del RIPTE (2). El método es poco intuitivo (rezago de tres
// meses, tasas diarias, sin capitalizar), así que conviene poder auditarlo.
function renderTramosRipte2(r2) {
  const det = $("#ripte2Detalle");
  const tbody = $("#tblRipte2 tbody");
  if (!r2.tramos.length) {
    tbody.innerHTML = "";
    det.classList.add("hidden");
    return;
  }
  det.classList.remove("hidden");
  $("#ripte2Resumen").textContent =
    `Detalle mes a mes (${r2.tramos.length} tramos, ${r2.dias} días, acumulado ${fmtPct4.format(r2.coef - 1)})`;
  tbody.innerHTML = r2.tramos.map(t => `
    <tr>
      <td>${t.ym}</td>
      <td>${t.ref}</td>
      <td class="num">${fmtPct4.format(t.tasaMes)}</td>
      <td class="num">${(t.tasaDiaria * 100).toFixed(6)} %</td>
      <td class="num">${t.dias}</td>
      <td class="num">${fmtPct4.format(t.tasaDiaria * t.dias)}</td>
    </tr>`).join("");
}


// Cuando el cálculo no se puede completar, el resultado anterior se borra.
// Dejarlo en pantalla haría que un monto viejo pase por el actual, que es
// justo lo que AC-8 busca evitar.
function abortarCalculo(mensaje) {
  limpiarResultado();
  alert(mensaje);
}

// Último cálculo completo; es la fuente del informe PDF.
let ULTIMA_LIQUIDACION = null;

// Los KPI del resultado que dependen de un cálculo completo.
const KPI_RESULTADO = [
  "#kpiBase", "#kpiPisoResultado", "#kpiAdicional", "#kpiResultado",
  "#kpiTasaSentencia", "#kpiDias", "#kpiInteresSentencia", "#kpiTotal",
];

// Resalta en el paso 2 cuál de los dos términos rige.
function marcarRige(rige, hayPiso) {
  const formula = $("#cardFormula");
  const piso = $("#cardPiso");
  formula.classList.toggle("rige", rige === "formula");
  formula.classList.toggle("descartado", rige === "piso");
  piso.classList.toggle("rige", rige === "piso");
  piso.classList.toggle("descartado", rige === "formula" && hayPiso);
}

function limpiarResultado() {
  ULTIMA_LIQUIDACION = null;
  KPI_RESULTADO.forEach(sel => { $(sel).textContent = "—"; });
  marcarRige(null, false);
  $("#kpiAdicionalDetalle").textContent = "Se suma salvo que la contingencia sea in itinere";
  ["#formulaPreview", "#ripte2Preview", "#pisoPreview", "#sentenciaPreview"].forEach(sel => {
    $(sel).textContent = "—";
  });
}

function calcular() {
  const fs = parseISODate($("#fechaSiniestro").value);
  if (!fs) { abortarCalculo("Ingresá la fecha del siniestro."); return; }
  const fechaNac = parseISODate($("#fechaNacimiento").value);
  if (!fechaNac) { abortarCalculo("Ingresá la fecha de nacimiento."); return; }
  const edad = calcEdad(fechaNac, fs);
  if (!edad || edad <= 0) { abortarCalculo("La fecha de nacimiento no es válida respecto a la fecha del siniestro."); return; }
  const incPct = toNumber($("#incapacidad").value);
  if (isNaN(incPct) || incPct < 0) { abortarCalculo("Ingresá un % de incapacidad válido."); return; }
  const enItinere = $("#enItinere").value === "si";

  // Refrescan sus propias tarjetas; el cálculo que vale es el de liquidar().
  const vibPrevio = recalcSueldos();
  if (!vibPrevio || vibPrevio <= 0) { abortarCalculo("Cargá al menos un sueldo válido."); return; }
  refrescarRipte2();
  refrescarPiso();

  // Una sola fuente de verdad: toda la liquidación la resuelve el núcleo.
  const r = CALC.liquidar({
    sueldos: leerSueldos(),
    fechaPmi: fs,
    fechaNacimiento: fechaNac,
    incPct,
    enItinere,
    fechaLiquidacion: parseISODate($("#fechaLiquidacion").value) || todayUTC(),
    interesManual: $("#tasaManualOn").checked ? toNumber($("#tasaManual").value) : null,
    actualizarPiso: $("#actualizarPiso").checked,
    formula: FORMULA,
  });

  if (!r.ok) {
    // La Res. SSN 332/2023 no admite extrapolar: sin índice no hay resultado.
    abortarCalculo(r.avisos.join("\n\n") || "No se pudo completar el cálculo.");
    return;
  }

  const vib = r.ingresoBase.vib;
  const ripte2 = r.ripte2;
  const tasaMonto = ripte2.monto;
  const factorEdad = r.factorEdad;
  const incDec = incPct / 100;
  const base = r.formulaSinPiso;
  const piso = r.piso;
  const pisoMonto = piso.monto;
  const resultado = r.resultado;

  // --- Fórmula de sentencia: interés adicional ---
  const tasaAnualPct = toNumber($("#tasaAnual").value);
  const tasaAnualDec = isNaN(tasaAnualPct) ? 0 : tasaAnualPct / 100;
  const fechaHasta = parseISODate($("#fechaHasta").value) || todayUTC();
  const dias = diffDays(fs, fechaHasta);
  const interesSentencia = resultado * tasaAnualDec * (dias / 365);
  const total = resultado + interesSentencia;

  $("#kpiVib").textContent = fmtMoney.format(vib);
  $("#kpiVibTasa").textContent = fmtMoney.format(vib + tasaMonto);
  $("#ripte2Preview").textContent = ripte2.manual
    ? `Monto ingresado a mano: ${fmtMoney.format(tasaMonto)}`
    : ripte2.tramos.length
      ? `Suma simple de variaciones diarias sobre ${ripte2.dias} días (${ripte2.tramos.length} tramos, ` +
        `rezago de 3 meses) = ${fmtPct.format(ripte2.coef - 1)}  →  coef. ${fmtNum.format(ripte2.coef)}  →  ` +
        `${fmtMoney.format(vib)} × (${fmtNum.format(ripte2.coef)} − 1) = ${fmtMoney.format(tasaMonto)}  →  ` +
        `ingreso base actualizado: ${fmtMoney.format(vib + tasaMonto)}`
      : "Sin interés de RIPTE (2): la fecha de liquidación no es posterior a la PMI.";
  $("#kpiFactorEdad").textContent = fmtNum.format(factorEdad);

  // Paso 2: fórmula vs piso. El que rige se resalta; el otro queda atenuado.
  $("#kpiBase").textContent = fmtMoney.format(base);
  marcarRige(r.rige, !!(piso && piso.fila));

  // Paso 3: adicional e indemnización.
  $("#kpiAdicional").textContent = fmtMoney.format(r.adicional);
  $("#kpiAdicionalDetalle").textContent = enItinere
    ? "No aplica: la contingencia es in itinere"
    : `20 % sobre ${fmtMoney.format(r.aplicada)}`;
  $("#kpiResultado").textContent = fmtMoney.format(resultado);

  // Paso 4: sentencia.
  $("#kpiTasaSentencia").textContent = tasaAnualDec > 0 ? fmtPct.format(tasaAnualDec) : "Sin tasa";
  $("#kpiDias").textContent = String(dias);
  $("#kpiInteresSentencia").textContent = fmtMoney.format(interesSentencia);
  $("#kpiTotal").textContent = fmtMoney.format(total);

  // El informe PDF se arma desde estos datos, no leyendo la pantalla.
  ULTIMA_LIQUIDACION = {
    liquidacion: r,
    entrada: {
      nombre: ($("#nombre").value || "").trim() || "Sin nombre",
      fechaPmi: fs, fechaNacimiento: fechaNac, incPct, enItinere,
      fechaLiquidacion: parseISODate($("#fechaLiquidacion").value) || todayUTC(),
    },
    sentencia: { tasaAnualDec, fechaHasta, dias, interes: interesSentencia, total },
    formula: FORMULA,
  };
  $("#formulaPreview").textContent =
    `${FORMULA}  →  VIB=${fmtNum.format(vib)}, TASA=${fmtNum.format(tasaMonto)}, ` +
    `INC=${incDec}, EDAD=${edad}, EN_ITINERE=${enItinere}, ` +
    `BASE=${fmtNum.format(base)}, PISO=${fmtNum.format(pisoMonto)}  =  ${fmtMoney.format(resultado)}`;
  $("#pisoPreview").textContent = piso && piso.fila
    ? `${fmtMoney.format(piso.base)} (${piso.norma || "—"}) × ${incDec} × ${fmtNum.format(piso.coef)}` +
      (piso.aplicaCoef
        ? (ripte2.manual ? " (coef. implícito del monto manual)" : " (mismo coef. que el ingreso base)")
        : " (sin actualizar por RIPTE)") +
      ` = ${fmtMoney.format(pisoMonto)}  →  ${pisoMonto > base ? "rige el piso mínimo" : "rige la fórmula"}`
    : "Sin piso mínimo aplicable (no hay norma cargada para la fecha de PMI).";
  $("#sentenciaPreview").textContent =
    `${fmtMoney.format(resultado)} × ${fmtNum.format(tasaAnualDec)} × (${dias} / 365) = ` +
    `${fmtMoney.format(interesSentencia)}  →  Total: ${fmtMoney.format(resultado)} + ` +
    `${fmtMoney.format(interesSentencia)} = ${fmtMoney.format(total)}`;
}

// =============================================================
// Descarga a PDF - informe de lo mostrado en pantalla
// =============================================================
function assertResultadoCalculado() {
  if (!ULTIMA_LIQUIDACION) {
    alert("Primero realizá el cálculo para generar el informe.");
    return false;
  }
  return true;
}

function pdfSafeFileName(name) {
  return (name || "calculo")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s.-]/g, "")
    .trim() || "calculo";
}

// Informe PDF. Se arma desde el último cálculo completo (ULTIMA_LIQUIDACION),
// no leyendo textos de la pantalla, y sigue el orden del razonamiento:
// primero qué se paga, después cada paso con su cuenta a la vista.
function descargarPdf() {
  if (!assertResultadoCalculado()) return;

  const jsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDF) {
    alert("No se pudo cargar la librería para generar PDF. Revisá la conexión e intentá nuevamente.");
    return;
  }

  const { liquidacion: r, entrada: e, sentencia: s } = ULTIMA_LIQUIDACION;
  const base = r.ingresoBase;
  const r2 = r.ripte2;
  const piso = r.piso;
  const incDec = e.incPct / 100;

  // Las fuentes estándar de jsPDF codifican en WinAnsi: los acentos y la ñ
  // salen bien, pero los signos fuera de Latin-1 hay que reemplazarlos.
  const txt = (v) => String(v ?? "—")
    .replace(/→/g, "->")
    .replace(/[−–—]/g, "-")
    .replace(/[^\u0000-ÿ]/g, "");
  const fecha = (d) => (d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : "—");
  const money = (n) => (Number.isFinite(n) ? fmtMoney.format(n) : "—");
  const num = (n, dec = 4) => (Number.isFinite(n)
    ? n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : "—");
  const pct = (n, dec = 2) => (Number.isFinite(n) ? `${num(n * 100, dec)} %` : "—");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const ANCHO = W - M * 2;
  // El pie va desde H - 12; el contenido puede llegar hasta 2 mm antes.
  const LIMITE = H - 14;
  const COLOR = { tinta: [31, 41, 55], gris: [100, 116, 139], linea: [223, 228, 237],
    fondo: [244, 246, 251], acento: [37, 99, 235], ok: [22, 163, 74] };
  let y = M;

  const color = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const espacio = (alto) => {
    if (y + alto <= LIMITE) return;
    doc.addPage();
    y = M;
  };

  // Título de sección numerada, con regla debajo.
  const seccion = (n, titulo, nota) => {
    espacio(16);
    y += 3;
    doc.setFillColor(...COLOR.acento);
    doc.circle(M + 2.6, y - 1.4, 2.6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(String(n), M + 2.6, y - 0.4, { align: "center" });
    doc.setFontSize(11.5);
    color(COLOR.tinta);
    doc.text(txt(titulo), M + 7.5, y);
    if (nota) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      color(COLOR.gris);
      doc.text(txt(nota), W - M, y, { align: "right" });
    }
    y += 2.5;
    doc.setDrawColor(...COLOR.linea);
    doc.line(M, y, W - M, y);
    y += 4.5;
  };

  // Pares etiqueta / valor en dos columnas.
  const pares = (items) => {
    const col = ANCHO / 2;
    for (let i = 0; i < items.length; i += 2) {
      espacio(6);
      items.slice(i, i + 2).forEach(([k, v], j) => {
        const x = M + j * col;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        color(COLOR.gris);
        doc.text(txt(k), x, y);
        const anchoEtiqueta = doc.getTextWidth(txt(k));
        doc.setFont("helvetica", "bold");
        // Si el valor no entra al lado de la etiqueta, se achica en vez de pisarla.
        let tam = 9.5;
        doc.setFontSize(tam);
        while (tam > 7 && anchoEtiqueta + doc.getTextWidth(txt(v)) > col - 7) {
          tam -= 0.5;
          doc.setFontSize(tam);
        }
        color(COLOR.tinta);
        doc.text(txt(v), x + col - 4, y, { align: "right" });
      });
      y += 5.1;
    }
  };

  // Tabla simple. `alineacion`: "l" | "r" por columna.
  const tabla = (cabecera, filas, anchos, alineacion, opciones = {}) => {
    const xs = [];
    anchos.reduce((x, w) => { xs.push(x); return x + w; }, M);
    const celda = (texto, i) => {
      const al = alineacion[i];
      const x = al === "r" ? xs[i] + anchos[i] - 1.5 : al === "c" ? xs[i] + anchos[i] / 2 : xs[i] + 1.5;
      const ajustado = doc.splitTextToSize(txt(texto), anchos[i] - 3)[0] || "";
      doc.text(ajustado, x, y, { align: al === "r" ? "right" : al === "c" ? "center" : "left" });
    };
    const dibujarCabecera = () => {
      espacio(7);
      doc.setFillColor(...COLOR.fondo);
      doc.rect(M, y - 4, ANCHO, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      color(COLOR.gris);
      cabecera.forEach(celda);
      y += 5;
    };
    dibujarCabecera();
    filas.forEach((fila, idx) => {
      if (y + 4.4 > LIMITE) { doc.addPage(); y = M; dibujarCabecera(); }
      const destacada = opciones.destacar === idx;
      if (destacada) {
        doc.setFillColor(236, 253, 243);
        doc.rect(M, y - 3.3, ANCHO, 4.6, "F");
      }
      doc.setFont("helvetica", destacada ? "bold" : "normal");
      doc.setFontSize(8.8);
      color(COLOR.tinta);
      fila.forEach(celda);
      y += 4.4;
    });
  };

  // Renglón de total, alineado a la derecha.
  const total = (etiqueta, valor, { fuerte = false, nota } = {}) => {
    espacio(7);
    doc.setFont("helvetica", fuerte ? "bold" : "normal");
    doc.setFontSize(fuerte ? 10.5 : 9.5);
    color(COLOR.tinta);
    doc.text(txt(etiqueta), M + 1.5, y);
    doc.text(txt(valor), W - M - 1.5, y, { align: "right" });
    if (nota) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      color(COLOR.gris);
      doc.text(txt(nota), M + 1.5, y + 4);
      y += 3.6;
    }
    y += 5.2;
  };

  const parrafo = (texto) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    color(COLOR.gris);
    const lineas = doc.splitTextToSize(txt(texto), ANCHO);
    espacio(lineas.length * 3.8 + 1);
    doc.text(lineas, M, y);
    y += lineas.length * 3.8 + 1.5;
  };

  // ---------- Encabezado ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  color(COLOR.tinta);
  doc.text("Liquidación de incapacidad laboral permanente", M, y + 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  color(COLOR.gris);
  doc.text(txt("Parcial hasta el 50 % — régimen administrativo (Ley 24.557, art. 14 ap. 2 inc. a)"), M, y + 7.5);
  doc.text(`Emitido el ${fecha(todayUTC())}`, W - M, y + 2, { align: "right" });
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  color(COLOR.tinta);
  doc.text(txt(e.nombre), M, y);
  y += 6;

  // ---------- Resumen: lo que se paga ----------
  const conSentencia = s.tasaAnualDec > 0;
  const bloques = [
    ["Indemnización", money(r.resultado),
      r.rige === "piso" ? `Rige el piso mínimo (${piso.norma || "—"})` : "Rige la fórmula"],
    ["Interés de sentencia", conSentencia ? money(s.interes) : "—",
      conSentencia ? `Tasa anual ${pct(s.tasaAnualDec)} · ${s.dias} días` : "No se cargó tasa"],
    ["Total a pagar", money(s.total), `Liquidado al ${fecha(e.fechaLiquidacion)}`],
  ];
  const altoResumen = 21;
  espacio(altoResumen + 4);
  const anchoBloque = ANCHO / 3;
  doc.setFillColor(...COLOR.fondo);
  doc.roundedRect(M, y, ANCHO, altoResumen, 2, 2, "F");
  doc.setFillColor(...COLOR.acento);
  doc.roundedRect(M + anchoBloque * 2, y, anchoBloque, altoResumen, 2, 2, "F");
  bloques.forEach(([etiqueta, valor, nota], i) => {
    const x = M + anchoBloque * i + 4;
    const enAcento = i === 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    enAcento ? doc.setTextColor(219, 234, 254) : color(COLOR.gris);
    doc.text(txt(etiqueta.toUpperCase()), x, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    enAcento ? doc.setTextColor(255, 255, 255) : color(COLOR.tinta);
    doc.text(txt(valor), x, y + 12.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    enAcento ? doc.setTextColor(219, 234, 254) : color(COLOR.gris);
    doc.text(txt(nota), x, y + 17.5);
  });
  y += altoResumen + 4;

  // ---------- 1. Datos del caso ----------
  seccion(1, "Datos del caso");
  pares([
    ["Primera manifestación invalidante", fecha(e.fechaPmi)],
    ["Fecha de liquidación", fecha(e.fechaLiquidacion)],
    ["Fecha de nacimiento", fecha(e.fechaNacimiento)],
    ["Edad a la PMI", `${r.edad} años`],
    ["Grado de incapacidad", `${num(e.incPct, 2)} %`],
    ["Contingencia", e.enItinere ? "In itinere" : "Accidente o enfermedad laboral"],
  ]);

  // ---------- 2. Ingreso base ----------
  seccion(2, "Ingreso base — RIPTE (1)", `Sueldos llevados a ${ymOf(e.fechaPmi)} por cociente de índices`);
  tabla(
    ["Período", "Incluido", "Sueldo", "Índice RIPTE", "Coeficiente", "Actualizado"],
    base.filas.map(f => [
      f.periodo,
      f.incluido ? "Sí" : "No",
      Number.isFinite(f.monto) ? money(f.monto) : "sin cargar",
      Number.isFinite(f.indice) ? num(f.indice, 2) : "—",
      Number.isFinite(f.coef) ? num(f.coef) : "—",
      f.incluido ? (Number.isFinite(f.actualizado) ? money(f.actualizado) : "—") : "excluido",
    ]),
    [24, 20, 36, 34, 30, 38],
    ["l", "c", "r", "r", "r", "r"]
  );
  y += 1;
  const sinCargar = base.mesesIncluidos - base.mesesCargados;
  const notasBase = [];
  if (base.mesesIncluidos < 12) notasBase.push(`${12 - base.mesesIncluidos} meses excluidos del promedio.`);
  if (sinCargar > 0) notasBase.push(`${sinCargar} meses incluidos sin cargar: cuentan como cero.`);
  total("Suma de sueldos actualizados (incluidos)", money(base.suma));
  total(`Ingreso base (suma ÷ ${base.mesesIncluidos})`, money(base.vib), {
    fuerte: true,
    nota: notasBase.length ? notasBase.join(" ") : null,
  });

  // ---------- 3. Actualización del ingreso base ----------
  seccion(3, "Actualización a la liquidación — RIPTE (2)",
    r2.manual ? "Interés cargado a mano" : "Res. SSN 332/2023, Anexo I");
  if (r2.manual) {
    pares([
      ["Interés cargado a mano", money(r2.monto)],
      ["Coeficiente implícito", num(r2.coef)],
    ]);
  } else {
    pares([
      ["Período", `del ${fecha(e.fechaPmi)} al ${fecha(e.fechaLiquidacion)}`],
      ["Días computados", String(r2.dias)],
      ["Interés acumulado", pct(r2.acum, 4)],
      ["Coeficiente", num(r2.coef, 6)],
    ]);
    parrafo("Interés simple: suma de las variaciones diarias del RIPTE, sin capitalizar. Cada mes usa la " +
      "variación de tres meses antes, dividida por los días de ese mes. Incluye el día de la PMI y " +
      "excluye el de liquidación.");
  }
  total("Interés del ingreso base", money(r2.monto));
  total("Ingreso base actualizado", money(base.vib + r2.monto), { fuerte: true });

  // ---------- 4. Fórmula o piso ----------
  seccion(4, "Fórmula o piso mínimo", "Se paga el mayor de los dos");
  const filaFormula = [
    "Fórmula",
    `53 × ${money(base.vib + r2.monto)} × ${num(e.incPct, 2)} % × ${num(r.factorEdad)}`,
    money(r.formulaSinPiso),
    r.rige === "formula" ? "RIGE" : "",
  ];
  const filaPiso = piso.fila
    ? [
      "Piso mínimo",
      `${money(piso.base)} (${piso.norma}) × ${num(e.incPct, 2)} % × ${num(piso.coef)}` +
        (piso.aplicaCoef ? "" : " (sin actualizar)"),
      money(piso.monto),
      r.rige === "piso" ? "RIGE" : "",
    ]
    : ["Piso mínimo", "Sin resolución cargada para la fecha de la PMI", "—", ""];
  tabla(
    ["Concepto", "Cálculo", "Importe", ""],
    [filaFormula, filaPiso],
    [30, 100, 36, 16],
    ["l", "l", "r", "r"],
    { destacar: r.rige === "formula" ? 0 : 1 }
  );
  y += 1;
  total("Mayor de los dos", money(r.aplicada));
  total(
    e.enItinere ? "Adicional de pago único (no aplica: in itinere)" : "Adicional de pago único (20 %)",
    money(r.adicional)
  );
  total("Indemnización", money(r.resultado), { fuerte: true });

  // ---------- 5. Interés de sentencia ----------
  // La sección se mantiene entera: si no entra, pasa completa a la página siguiente.
  espacio(conSentencia ? 36 : 20);
  seccion(5, "Interés de sentencia", "Fuera del régimen administrativo");
  if (conSentencia) {
    pares([
      ["Tasa anual", pct(s.tasaAnualDec)],
      ["Días", String(s.dias)],
      ["Desde (PMI)", fecha(e.fechaPmi)],
      ["Hasta", fecha(s.fechaHasta)],
    ]);
    total("Interés de sentencia", money(s.interes), {
      nota: `${money(r.resultado)} × ${pct(s.tasaAnualDec)} × ${s.dias} / 365 días`,
    });
  } else {
    parrafo("No se cargó tasa anual: no se aplica interés de sentencia.");
  }
  total("Total a pagar", money(s.total), { fuerte: true });

  // ---------- Pie en todas las páginas ----------
  const paginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(...COLOR.linea);
    doc.line(M, H - 12, W - M, H - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    color(COLOR.gris);
    doc.text(txt("Ley 24.557 · Ley 26.773 · DNU 669/19 · Res. SSN 332/2023 · Res. SRT de pisos mínimos"),
      M, H - 7.5);
    doc.text(`Página ${p} de ${paginas}`, W - M, H - 7.5, { align: "right" });
  }

  const sufijo = new Date().toISOString().slice(0, 10);
  doc.save(`${pdfSafeFileName(e.nombre)} - informe incapacidad ${sufijo}.pdf`);
}

// =============================================================
// Vista: Administración
// =============================================================
function setupAdmin() {
  $("#btnGuardarFormula").addEventListener("click", () => {
    const expr = $("#formulaEditor").value.trim();
    try {
      compileFormula(expr); // valida
      FORMULA = expr;
      saveStore(STORAGE.formula, expr);
      flash("#formulaStatus", "Fórmula guardada ✓", "ok");
    } catch (e) {
      flash("#formulaStatus", "Error: " + e.message, "err");
    }
  });
  $("#btnResetFormula").addEventListener("click", () => {
    if (!confirm("¿Restaurar la fórmula por defecto?")) return;
    $("#formulaEditor").value = DEFAULT_FORMULA;
    FORMULA = DEFAULT_FORMULA;
    saveStore(STORAGE.formula, DEFAULT_FORMULA);
    flash("#formulaStatus", "Fórmula restaurada ✓", "ok");
  });

  $("#uploadRipte").addEventListener("change", (e) => importExcel(e, "ripte"));
  $("#btnAddRipte").addEventListener("click", () => {
    RIPTE.push({ periodo: "", indice: 0 });
    saveStore(STORAGE.ripte, RIPTE);
    renderRipteTable();
  });
  $("#btnExportRipte").addEventListener("click", () => downloadJson(RIPTE, "ripte.json"));
  $("#searchRipte").addEventListener("input", renderRipteTable);

  $("#btnAddPiso").addEventListener("click", () => {
    PISOS.push({ desde: "", hasta: "", monto: 0, norma: "" });
    saveStore(STORAGE.pisos, PISOS);
    renderPisosTable();
  });
  $("#btnExportPisos").addEventListener("click", () => downloadJson(PISOS, "pisos-minimos.json"));
  $("#btnResetPisos").addEventListener("click", () => {
    if (!confirm("¿Restaurar la tabla de pisos mínimos a los valores semilla?")) return;
    PISOS = JSON.parse(JSON.stringify(window.SEED_PISOS || []));
    saveStore(STORAGE.pisos, PISOS);
    renderPisosTable();
    flash("#pisoStatus", "Pisos restaurados ✓", "ok");
  });

  $("#btnResetAll").addEventListener("click", () => {
    if (!confirm("¿Restablecer RIPTE, pisos mínimos y fórmula a los valores semilla? Se perderán los cambios locales.")) return;
    RIPTE = JSON.parse(JSON.stringify(window.SEED_RIPTE || []));
    PISOS = JSON.parse(JSON.stringify(window.SEED_PISOS || []));
    FORMULA = DEFAULT_FORMULA;
    saveStore(STORAGE.ripte, RIPTE);
    saveStore(STORAGE.pisos, PISOS);
    saveStore(STORAGE.formula, FORMULA);
    renderRipteTable();
    renderPisosTable();
    $("#formulaEditor").value = FORMULA;
    flash("#formulaStatus", "Datos restablecidos ✓", "ok");
  });
}

function flash(sel, msg, cls) {
  const el = $(sel);
  el.textContent = msg;
  el.className = "status " + (cls || "");
  setTimeout(() => { el.textContent = ""; el.className = "status"; }, 3500);
}

function downloadJson(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Render tablas admin ----------
function renderRipteTable() {
  const q = ($("#searchRipte").value || "").toLowerCase();
  const tbody = $("#tblRipte tbody");
  tbody.innerHTML = "";
  const sorted = [...RIPTE].sort((a, b) => a.periodo.localeCompare(b.periodo));
  sorted.forEach((row) => {
    if (q && !row.periodo.toLowerCase().includes(q)) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" data-field="periodo" value="${row.periodo}" placeholder="YYYY-MM" /></td>
      <td><input type="number" step="0.01" data-field="indice" value="${row.indice}" /></td>
      <td><button class="row-del" title="Eliminar">✕</button></td>
    `;
    tr.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("change", () => {
        const f = inp.dataset.field;
        const idx = RIPTE.findIndex(r => r === row);
        if (idx >= 0) {
          RIPTE[idx][f] = f === "indice" ? toNumber(inp.value) : inp.value.trim();
          saveStore(STORAGE.ripte, RIPTE);
        }
      });
    });
    tr.querySelector(".row-del").addEventListener("click", () => {
      const idx = RIPTE.findIndex(r => r === row);
      if (idx >= 0) {
        RIPTE.splice(idx, 1);
        saveStore(STORAGE.ripte, RIPTE);
        renderRipteTable();
      }
    });
    tbody.appendChild(tr);
  });
  flash("#ripteStatus", `${RIPTE.length} filas`, "");
}

function renderPisosTable() {
  const tbody = $("#tblPisos tbody");
  tbody.innerHTML = "";
  const sorted = [...PISOS].sort((a, b) => String(a.desde).localeCompare(String(b.desde)));
  sorted.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="date" data-field="desde" value="${row.desde || ""}" /></td>
      <td><input type="date" data-field="hasta" value="${row.hasta || ""}" /></td>
      <td><input type="number" step="0.01" data-field="monto" value="${row.monto ?? 0}" /></td>
      <td><input type="text" data-field="norma" value="${row.norma || ""}" placeholder="Res. SRT …" /></td>
      <td><button class="row-del" title="Eliminar">✕</button></td>
    `;
    tr.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("change", () => {
        const f = inp.dataset.field;
        const idx = PISOS.findIndex(p => p === row);
        if (idx >= 0) {
          PISOS[idx][f] = f === "monto" ? toNumber(inp.value) : inp.value.trim();
          saveStore(STORAGE.pisos, PISOS);
          refrescarPiso();
        }
      });
    });
    tr.querySelector(".row-del").addEventListener("click", () => {
      const idx = PISOS.findIndex(p => p === row);
      if (idx >= 0) {
        PISOS.splice(idx, 1);
        saveStore(STORAGE.pisos, PISOS);
        renderPisosTable();
        refrescarPiso();
      }
    });
    tbody.appendChild(tr);
  });
  flash("#pisoStatus", `${PISOS.length} filas`, "");
}

// ---------- Importación desde Excel/CSV (RIPTE) ----------
function importExcel(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: "yyyy-mm-dd" });
      importRipteRows(rows);
    } catch (err) {
      alert("Error al leer el archivo: " + err.message);
    }
    evt.target.value = ""; // permite re-subir el mismo archivo
  };
  reader.readAsArrayBuffer(file);
}

function importRipteRows(rows) {
  // Detectar fila de header
  let startIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].some(c => typeof c === "string" && /per[ií]odo/i.test(c))) {
      startIdx = i + 1; break;
    }
  }
  const out = [];
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const period = parsePeriodCell(r[0]);
    // En el Excel original el "índice" estaba en col D (4ª columna)
    let indice = toNumber(r[3]);
    if (isNaN(indice) || !indice) indice = toNumber(r[1]); // fallback: 2ª columna
    if (!period || isNaN(indice)) continue;
    out.push({ periodo: period, indice });
  }
  if (!out.length) {
    alert("No se encontraron filas válidas (esperaba columna Período y columna Índice).");
    return;
  }
  RIPTE = out;
  saveStore(STORAGE.ripte, RIPTE);
  renderRipteTable();
  flash("#ripteStatus", `Importadas ${out.length} filas ✓`, "ok");
}

function parsePeriodCell(v) {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return ymOf(new Date(Date.UTC(v.getFullYear(), v.getMonth(), 1)));
  const s = String(v).trim();
  // YYYY-MM or YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}`;
  // DD/MM/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${String(+m[2]).padStart(2, "0")}`;
  // MM/YYYY
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${String(+m[1]).padStart(2, "0")}`;
  return null;
}

// =============================================================
// Descarga a Excel — replica la hoja "CALVO" del Excel original
// =============================================================
function sanitizeSheetName(name) {
  // Excel: max 31 chars, no \ / ? * [ ] :
  let s = (name || "Calculo").replace(/[\\\/\?\*\[\]:]/g, "-").trim();
  if (!s) s = "Calculo";
  return s.slice(0, 31);
}

// Traduce la fórmula JS (variables VIB/TASA/INC/EDAD/...) al formato Excel
// usando las celdas correspondientes en el layout CALVO.
function translateFormulaToExcel(jsExpr) {
  let expr = jsExpr;
  // Reemplazos por palabra completa
  const replacements = [
    [/\bEN_ITINERE\b/g, '(B27="si")'],
    [/\bFACTOR_EDAD\b/g, "B24"],
    [/\bBASE\b/g, "E37"],
    [/\bPISO\b/g, "B34"],
    [/\bVIB\b/g, "B20"],
    [/\bTASA\b/g, "B21"],
    [/\bINC\b/g, "B25"],
    [/\bEDAD\b/g, "B23"],
  ];
  for (const [re, val] of replacements) expr = expr.replace(re, val);
  return expr;
}

function descargarExcel() {
  const nombre = ($("#nombre").value || "").trim();
  if (!nombre) { alert("Ingresá un nombre antes de descargar."); return; }
  const fs = parseISODate($("#fechaSiniestro").value);
  if (!fs) { alert("Falta la fecha del siniestro."); return; }

  const baseMonthStart = new Date(Date.UTC(fs.getUTCFullYear(), fs.getUTCMonth(), 1));
  const baseYM = ymOf(baseMonthStart);
  const baseIndice = ripteIndex(baseYM);
  if (baseIndice === null) {
    alert(`No hay RIPTE cargado para el período base ${baseYM}. Cargalo en Administración.`);
    return;
  }

  const fechaNac = parseISODate($("#fechaNacimiento").value);
  const edad = fechaNac ? calcEdad(fechaNac, fs) : NaN;
  const incPct = toNumber($("#incapacidad").value);
  const incDec = isNaN(incPct) ? 0 : incPct / 100;
  const enItinere = $("#enItinere").value === "si" ? "si" : "no";
  const ripte2 = refrescarRipte2();
  const tasaMonto = ripte2.monto;
  const tasaAnualPct = toNumber($("#tasaAnual").value);
  const tasaAnualDec = isNaN(tasaAnualPct) ? 0 : tasaAnualPct / 100;
  const fechaHasta = parseISODate($("#fechaHasta").value) || todayUTC();
  const fechaLiq = parseISODate($("#fechaLiquidacion").value) || todayUTC();
  const vibExcel = recalcSueldos();
  const coefEfectivo = coefEfectivoRipte2(vibExcel, fs, fechaLiq);
  const piso = calcularPiso(incDec, fs, fechaLiq, $("#actualizarPiso").checked, coefEfectivo);

  // Recolectar las 12 filas de sueldo (de más reciente a más antiguo, igual que el Excel original)
  const sueldoRows = [];
  $$("#tblSueldos tbody tr").forEach(tr => {
    const ym = tr.dataset.periodo;
    const indice = toNumber(tr.dataset.indice);
    const sueldo = toNumber(tr.querySelector("input.sueldo").value);
    const incluido = tr.querySelector("input.incluido").checked;
    sueldoRows.push({ ym, indice: isNaN(indice) ? null : indice, sueldo: isNaN(sueldo) ? null : sueldo, incluido });
  });
  if (sueldoRows.length === 0) {
    alert("No hay filas de sueldo. Cargá primero la fecha del siniestro.");
    return;
  }

  // ----- Construir el worksheet celda por celda -----
  const ws = {};
  const setCell = (addr, cell) => { ws[addr] = cell; };
  const ymToDate = (ym) => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
  };

  // Fila 1: A1 = mes del siniestro (período base), C1 = ripte base
  setCell("A1", { t: "d", v: baseMonthStart, z: "yyyy-mm-dd" });
  setCell("C1", { t: "n", v: baseIndice });

  // Fila 2: encabezados
  setCell("C2", { t: "s", v: "ripte" });
  setCell("D2", { t: "s", v: "coeficiente" });
  setCell("E2", { t: "s", v: "actual" });
  setCell("F2", { t: "s", v: "incluido" });

  // Fila 3: encabezados
  setCell("A3", { t: "s", v: "periodo" });
  setCell("B3", { t: "s", v: "sueldo" });

  // Filas 4-15: períodos y sueldos
  sueldoRows.forEach((r, i) => {
    const row = 4 + i; // 4..15
    setCell(`A${row}`, { t: "d", v: ymToDate(r.ym), z: "yyyy-mm-dd" });
    if (r.sueldo !== null) setCell(`B${row}`, { t: "n", v: r.sueldo });
    if (r.indice !== null) setCell(`C${row}`, { t: "n", v: r.indice });
    // D: coeficiente = $C$1 / Cn
    setCell(`D${row}`, { t: "n", f: `$C$1/C${row}` });
    // E: actual = Bn * Dn
    setCell(`E${row}`, { t: "n", f: `B${row}*D${row}` });
    // F: incluido en el promedio (VERDADERO/FALSO, editable en el Excel)
    setCell(`F${row}`, { t: "b", v: r.incluido });
  });

  // Fila 17: promedio de los meses incluidos (un incluido vacío cuenta como cero)
  setCell("D17", { t: "s", v: "total promedio" });
  setCell("E17", { t: "n", f: "IF(COUNTIF(F4:F15,TRUE)=0,0,SUMIF(F4:F15,TRUE,E4:E15)/COUNTIF(F4:F15,TRUE))" });
  setCell("F17", { t: "n", f: "COUNTIF(F4:F15,TRUE)" });
  setCell("G17", { t: "s", v: "meses incluidos" });

  // Filas 20-27: parámetros y resultado
  setCell("A20", { t: "s", v: "VIB con ripte" });
  setCell("B20", { t: "n", f: "E17" });

  // Interés del RIPTE (2): VIB × (coef − 1). Con carga manual queda el importe.
  // El interés sale siempre del mismo coeficiente de B35; con carga manual el
  // coeficiente es el que ese monto implica, así que la fórmula lo reproduce.
  setCell("A21", { t: "s", v: "interes ripte (2)" });
  setCell("B21", { t: "n", f: "B20*(B35-1)" });

  setCell("A22", { t: "s", v: "VIB con ripte (1) + ripte (2)" });
  setCell("B22", { t: "n", f: "B21+B20" });

  setCell("A23", { t: "s", v: "edad" });
  setCell("B23", { t: "n", v: isNaN(edad) ? 0 : edad });

  setCell("A24", { t: "s", v: "factor de edad" });
  setCell("B24", { t: "n", f: "65/B23" });

  setCell("A25", { t: "s", v: "incapacidad" });
  setCell("B25", { t: "n", v: incDec });

  setCell("A26", { t: "s", v: "fecha siniestro" });
  setCell("B26", { t: "d", v: fs, z: "yyyy-mm-dd" });

  setCell("A27", { t: "s", v: "en intinere" });
  setCell("B27", { t: "s", v: enItinere });

  // Fórmula de sentencia: monto × tasa anual × (días / 365)
  setCell("A28", { t: "s", v: "tasa anual" });
  setCell("B28", { t: "n", v: tasaAnualDec, z: "0.00%" });

  setCell("A29", { t: "s", v: "fecha hasta" });
  setCell("B29", { t: "d", v: fechaHasta, z: "yyyy-mm-dd" });

  setCell("A30", { t: "s", v: "días desde siniestro" });
  setCell("B30", { t: "n", f: "B29-B26" });

  // Piso mínimo (Res. SRT) — vigente a la PMI, por el grado de ILP y por RIPTE
  setCell("A31", { t: "s", v: "piso base (norma)" });
  setCell("B31", { t: "n", v: piso.base });
  setCell("C31", { t: "s", v: piso.norma || "—" });

  // El piso se actualiza con el mismo coeficiente que el ingreso base (B35).
  setCell("A32", { t: "s", v: "coef ripte piso" });
  setCell("B32", piso.aplicaCoef ? { t: "n", f: "B35" } : { t: "n", v: 1 });
  setCell("C32", {
    t: "s",
    v: piso.aplicaCoef ? "mismo coef. que el ingreso base" : "sin actualizar",
  });

  setCell("A33", { t: "s", v: "fecha liquidación" });
  setCell("B33", { t: "d", v: fechaLiq, z: "yyyy-mm-dd" });

  setCell("A34", { t: "s", v: "piso mínimo" });
  setCell("B34", { t: "n", f: "B31*B25*B32" });

  setCell("A35", { t: "s", v: "coef ripte (2)" });
  setCell("B35", { t: "n", v: coefEfectivo.coef });
  setCell("C35", {
    t: "s",
    v: coefEfectivo.manual
      ? "implícito del monto cargado a mano"
      : `suma simple de variaciones diarias, ${ripte2.dias} días (Res. SSN 332/2023)`,
  });

  setCell("D37", { t: "s", v: "Fórmula (sin piso)" });
  setCell("E37", { t: "n", f: "53*B22*B25*B24" });

  setCell("D38", { t: "s", v: "Resultado fórmula" });
  setCell("E38", { t: "n", f: translateFormulaToExcel(FORMULA) });

  setCell("D39", { t: "s", v: "Interés sentencia" });
  setCell("E39", { t: "n", f: "E38*B28*(B30/365)" });

  setCell("D40", { t: "s", v: "Total final" });
  setCell("E40", { t: "n", f: "E38+E39" });

  // Lista de validación opcional en celdas auxiliares
  setCell("A42", { t: "s", v: "si" });
  setCell("A43", { t: "s", v: "no" });

  // Rango usado por la hoja
  ws["!ref"] = "A1:G43";
  // Anchos de columna razonables
  ws["!cols"] = [
    { wch: 22 }, // A
    { wch: 18 }, // B
    { wch: 14 }, // C
    { wch: 18 }, // D
    { wch: 18 }, // E
    { wch: 10 }, // F
    { wch: 16 }, // G
  ];

  // Crear workbook
  const wb = XLSX.utils.book_new();
  const sheetName = sanitizeSheetName(nombre);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Nombre del archivo
  const safeFile = nombre.replace(/[^\w\s.\-áéíóúÁÉÍÓÚñÑ]/g, "").trim() || "calculo";
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${safeFile} - incapacidad ${stamp}.xlsx`);
}
