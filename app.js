// =============================================================
// Calculadora de Incapacidad — lógica de cálculo y UI
// =============================================================
//
// Variables de la fórmula:
//   VIB           Promedio actualizado de los 12 sueldos (con coef RIPTE)
//   TASA          Monto de tasa de interés (ingreso manual)
//   INC           Incapacidad en DECIMAL (ej 0.025 para 2.5%)
//   EDAD          Edad del trabajador
//   FACTOR_EDAD   65 / EDAD
//   EN_ITINERE    booleano
//
// Fórmula por defecto (replica el Excel):
//   IF(EN_ITINERE, 53 * (VIB + TASA) * INC * (65/EDAD),
//                  53 * (VIB + TASA) * INC * (65/EDAD) * 1.2)

const DEFAULT_FORMULA =
  "IF(EN_ITINERE, 53 * (VIB + TASA) * INC * (65/EDAD), 53 * (VIB + TASA) * INC * (65/EDAD) * 1.2)";

const STORAGE = {
  ripte: "calc-incap.ripte",
  formula: "calc-incap.formula",
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
}

let RIPTE = loadStore(STORAGE.ripte, window.SEED_RIPTE || []);
let FORMULA = loadStore(STORAGE.formula, DEFAULT_FORMULA);

// ---------- Helpers ----------
const fmtMoney = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const fmtNum = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

function parseISODate(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}
function ymOf(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function addMonths(date, n) {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + n);
  return d;
}
function toNumber(x) {
  if (x === null || x === undefined || x === "") return NaN;
  if (typeof x === "number") return x;
  let s = String(x).trim();
  if (s === "") return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Formato es-AR: punto = miles, coma = decimal → "1.234,56" → "1234.56"
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // Solo coma como decimal → "1234,56" → "1234.56"
    s = s.replace(",", ".");
  }
  // Caso "1234.56" o "123456": dejamos tal cual (los <input type="number"> siempre devuelven así).
  return parseFloat(s);
}

// ---------- RIPTE lookup ----------
function ripteIndex(periodo) {
  const row = RIPTE.find(r => r.periodo === periodo);
  return row ? row.indice : null;
}

// ---------- Fórmula: evaluación segura ----------
const ALLOWED_IDENTS = new Set([
  "VIB", "TASA", "INC", "EDAD", "FACTOR_EDAD", "EN_ITINERE",
  "IF", "Math", "true", "false",
]);

function compileFormula(expr) {
  // Validar identificadores
  const idRe = /[A-Za-z_][A-Za-z0-9_]*/g;
  const ids = expr.match(idRe) || [];
  for (const id of ids) {
    if (!ALLOWED_IDENTS.has(id)) {
      throw new Error(`Identificador no permitido: "${id}"`);
    }
  }
  // Validar caracteres
  if (/[;{}\[\]`]/.test(expr)) {
    throw new Error("Caracteres no permitidos en la fórmula");
  }
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    "VIB", "TASA", "INC", "EDAD", "FACTOR_EDAD", "EN_ITINERE", "IF", "Math",
    `"use strict"; return (${expr});`
  );
  return (v) => fn(v.VIB, v.TASA, v.INC, v.EDAD, v.FACTOR_EDAD, v.EN_ITINERE,
    (cond, a, b) => (cond ? a : b), Math);
}

// =============================================================
// UI
// =============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupCalc();
  setupAdmin();
});

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
  $("#btnCalcular").addEventListener("click", calcular);
  $("#btnDescargar").addEventListener("click", descargarExcel);
  $("#btnLimpiar").addEventListener("click", () => {
    if (!confirm("¿Limpiar todos los campos?")) return;
    $("#nombre").value = "";
    $("#fechaSiniestro").value = "";
    $("#edad").value = "";
    $("#incapacidad").value = "";
    $("#enItinere").value = "si";
    $("#periodoBase").value = "";
    $("#tblSueldos tbody").innerHTML = "";
    $("#vibCell").textContent = "—";
    $("#tasaManual").value = "";
    $("#kpiVib").textContent = "—";
    $("#kpiVibTasa").textContent = "—";
    $("#kpiFactorEdad").textContent = "—";
    $("#kpiResultado").textContent = "—";
    $("#formulaPreview").textContent = "—";
    $("#ripteWarn").classList.add("hidden");
  });
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
    inp.addEventListener("input", () => recalcSueldos(baseIndice));
  });
  // memorizamos baseIndice
  tbody.dataset.baseIndice = baseIndice ?? "";
}

function recalcSueldos(baseIndice) {
  const tbody = $("#tblSueldos tbody");
  const baseI = baseIndice ?? toNumber(tbody.dataset.baseIndice);
  let sum = 0, count = 0;
  tbody.querySelectorAll("tr").forEach(tr => {
    const indice = toNumber(tr.dataset.indice);
    const sueldo = toNumber(tr.querySelector("input.sueldo").value);
    const coefCell = tr.querySelector(".coef");
    const actCell = tr.querySelector(".actual");
    if (!isNaN(sueldo) && !isNaN(indice) && !isNaN(baseI) && indice > 0) {
      const coef = baseI / indice;
      const actual = sueldo * coef;
      coefCell.textContent = fmtNum.format(coef);
      actCell.textContent = fmtMoney.format(actual);
      sum += actual;
      count++;
    } else {
      coefCell.textContent = "—";
      actCell.textContent = "—";
    }
  });
  const vib = count > 0 ? sum / count : 0;
  $("#vibCell").textContent = count > 0 ? fmtMoney.format(vib) : "—";
  return vib;
}

function getTasaMonto() {
  const v = toNumber($("#tasaManual").value);
  return isNaN(v) ? 0 : v;
}

function calcular() {
  const fs = parseISODate($("#fechaSiniestro").value);
  if (!fs) { alert("Ingresá la fecha del siniestro."); return; }
  const edad = toNumber($("#edad").value);
  if (!edad || edad <= 0) { alert("Ingresá una edad válida."); return; }
  const incPct = toNumber($("#incapacidad").value);
  if (isNaN(incPct) || incPct < 0) { alert("Ingresá un % de incapacidad válido."); return; }
  const enItinere = $("#enItinere").value === "si";

  const baseIndice = toNumber($("#tblSueldos tbody").dataset.baseIndice);
  const vib = recalcSueldos(baseIndice);
  if (!vib || vib <= 0) { alert("Cargá al menos un sueldo válido."); return; }

  const tasaMonto = getTasaMonto();
  const factorEdad = 65 / edad;
  const incDec = incPct / 100;

  const vars = {
    VIB: vib, TASA: tasaMonto, INC: incDec, EDAD: edad,
    FACTOR_EDAD: factorEdad, EN_ITINERE: enItinere,
  };

  let resultado;
  try {
    const fn = compileFormula(FORMULA);
    resultado = fn(vars);
  } catch (e) {
    alert("Error en la fórmula: " + e.message);
    return;
  }

  $("#kpiVib").textContent = fmtMoney.format(vib);
  $("#kpiVibTasa").textContent = fmtMoney.format(vib + tasaMonto);
  $("#kpiFactorEdad").textContent = fmtNum.format(factorEdad);
  $("#kpiResultado").textContent = fmtMoney.format(resultado);
  $("#formulaPreview").textContent =
    `${FORMULA}  →  VIB=${fmtNum.format(vib)}, TASA=${fmtNum.format(tasaMonto)}, ` +
    `INC=${incDec}, EDAD=${edad}, EN_ITINERE=${enItinere}  =  ${fmtMoney.format(resultado)}`;
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

  $("#btnResetAll").addEventListener("click", () => {
    if (!confirm("¿Restablecer RIPTE y fórmula a los valores semilla? Se perderán los cambios locales.")) return;
    RIPTE = JSON.parse(JSON.stringify(window.SEED_RIPTE || []));
    FORMULA = DEFAULT_FORMULA;
    saveStore(STORAGE.ripte, RIPTE);
    saveStore(STORAGE.formula, FORMULA);
    renderRipteTable();
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

  const edad = toNumber($("#edad").value);
  const incPct = toNumber($("#incapacidad").value);
  const incDec = isNaN(incPct) ? 0 : incPct / 100;
  const enItinere = $("#enItinere").value === "si" ? "si" : "no";
  const tasaMonto = getTasaMonto();

  // Recolectar las 12 filas de sueldo (de más reciente a más antiguo, igual que el Excel original)
  const sueldoRows = [];
  $$("#tblSueldos tbody tr").forEach(tr => {
    const ym = tr.dataset.periodo;
    const indice = toNumber(tr.dataset.indice);
    const sueldo = toNumber(tr.querySelector("input.sueldo").value);
    sueldoRows.push({ ym, indice: isNaN(indice) ? null : indice, sueldo: isNaN(sueldo) ? null : sueldo });
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
  });

  // Fila 17: promedio
  setCell("D17", { t: "s", v: "total promedio" });
  setCell("E17", { t: "n", f: "AVERAGE(E4:E15)" });

  // Filas 20-27: parámetros y resultado
  setCell("A20", { t: "s", v: "VIB con ripte" });
  setCell("B20", { t: "n", f: "E17" });

  setCell("A21", { t: "s", v: "tasa interes" });
  setCell("B21", { t: "n", v: tasaMonto });

  setCell("A22", { t: "s", v: "VIB con ripte + tasa" });
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
  setCell("D27", { t: "s", v: "Resultado Final" });
  setCell("E27", { t: "n", f: translateFormulaToExcel(FORMULA) });

  // Lista de validación opcional en celdas auxiliares (como en el original A31/A32)
  setCell("A31", { t: "s", v: "si" });
  setCell("A32", { t: "s", v: "no" });

  // Rango usado por la hoja
  ws["!ref"] = "A1:E32";
  // Anchos de columna razonables
  ws["!cols"] = [
    { wch: 22 }, // A
    { wch: 18 }, // B
    { wch: 14 }, // C
    { wch: 18 }, // D
    { wch: 18 }, // E
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
