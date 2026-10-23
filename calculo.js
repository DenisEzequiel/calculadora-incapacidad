// =============================================================
// Núcleo de cálculo — Incapacidad Laboral Permanente Parcial ≤ 50 %
// =============================================================
//
// Ley 24.557 (arts. 12 y 14 ap. 2 inc. a), Ley 26.773 art. 3, DNU 669/19,
// Res. SSN 1039/2019 art. 3 y Res. SSN 332/2023 Anexo I.
//
// Módulo puro: no conoce el DOM, ni localStorage, ni de dónde vienen las
// tablas de índices y pisos. Los mensajes se devuelven como datos (`aviso`,
// `avisos`, `nota`) y es la capa de presentación la que decide cómo
// mostrarlos. Ver docs/adr/0001-nucleo-de-calculo-separado-y-vitest.md
//
// Se carga de dos formas:
//   - navegador: <script src="calculo.js"> → globalThis.Calculo
//   - tests:     require("../calculo.js")

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Calculo = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  // Fórmula por defecto: se paga el mayor entre la fórmula y el piso, y sobre
  // ese mayor se aplica el adicional del 20 % si NO es in itinere.
  const FORMULA_POR_DEFECTO =
    "IF(EN_ITINERE, MAX(BASE, PISO), MAX(BASE, PISO) * 1.2)";

  // ---------- Helpers de fecha y número ----------

  function parseISODate(s) {
    if (!s) return null;
    const [y, m, d] = String(s).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d));
  }

  function ymOf(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  // Corre un período "YYYY-MM" n meses (n puede ser negativo).
  function ymAdd(ym, n) {
    const [y, m] = ym.split("-").map(Number);
    return ymOf(new Date(Date.UTC(y, m - 1 + n, 1)));
  }

  // Días calendario reales del mes de un período "YYYY-MM".
  function diasDelMes(ym) {
    const [y, m] = ym.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  function diffDays(from, to) {
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
  }

  function calcEdad(nacimiento, ref) {
    if (!nacimiento || !ref) return NaN;
    let edad = ref.getUTCFullYear() - nacimiento.getUTCFullYear();
    const m = ref.getUTCMonth() - nacimiento.getUTCMonth();
    if (m < 0 || (m === 0 && ref.getUTCDate() < nacimiento.getUTCDate())) edad--;
    return edad;
  }

  function isoOfUTC(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function toNumber(x) {
    if (x === null || x === undefined || x === "") return NaN;
    if (typeof x === "number") return x;
    let s = String(x).trim();
    if (s === "") return NaN;
    const tieneComa = s.includes(",");
    const tienePunto = s.includes(".");
    if (tieneComa && tienePunto) {
      // Formato es-AR: punto = miles, coma = decimal → "1.234,56" → "1234.56"
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (tieneComa) {
      s = s.replace(",", ".");
    }
    return parseFloat(s);
  }

  // ---------- Evaluador de fórmulas ----------
  // La fórmula es editable desde el panel de administración, así que la
  // allowlist es lo único que impide que alcance el entorno.

  const IDENTIFICADORES_PERMITIDOS = new Set([
    "VIB", "TASA", "INC", "EDAD", "FACTOR_EDAD", "EN_ITINERE", "BASE", "PISO",
    "IF", "MAX", "MIN", "Math", "true", "false",
  ]);

  function compilarFormula(expr) {
    const ids = String(expr).match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
    for (const id of ids) {
      if (!IDENTIFICADORES_PERMITIDOS.has(id)) {
        throw new Error(`Identificador no permitido: "${id}"`);
      }
    }
    if (/[;{}[\]`]/.test(expr)) {
      throw new Error("Caracteres no permitidos en la fórmula");
    }
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      "VIB", "TASA", "INC", "EDAD", "FACTOR_EDAD", "EN_ITINERE", "BASE", "PISO",
      "IF", "MAX", "MIN", "Math",
      `"use strict"; return (${expr});`
    );
    return (v) => fn(
      v.VIB, v.TASA, v.INC, v.EDAD, v.FACTOR_EDAD, v.EN_ITINERE, v.BASE, v.PISO,
      (cond, a, b) => (cond ? a : b), Math.max, Math.min, Math
    );
  }

  // ---------- Fábrica ----------

  function crearCalculadora({ ripte = [], pisos = [] } = {}) {

    function indice(periodo) {
      const fila = ripte.find((r) => r.periodo === periodo);
      if (!fila) return null;
      const i = toNumber(fila.indice);
      return Number.isFinite(i) ? i : null;
    }

    // Tasa mensual con rezago de tres meses (Res. SSN 332/2023, Anexo I):
    //   tasaMes(m) = IND[m−3] / IND[m−4] − 1
    // Si falta cualquiera de los dos índices devuelve null: no se extrapola.
    function tasaMensual(ym) {
      const m3 = ymAdd(ym, -3);
      const m4 = ymAdd(ym, -4);
      const i3 = indice(m3);
      const i4 = indice(m4);
      if (i3 === null || i4 === null || !i4) return null;
      return { tasa: i3 / i4 - 1, desde: m4, hasta: m3 };
    }

    // Coeficiente del RIPTE (2) entre la PMI y la fecha de corte:
    //   coef = 1 + Σ [ (tasaMes(m) / díasDelMes(m)) × días transcurridos en m ]
    // Interés SIMPLE, sin capitalizar. El intervalo es [fechaPmi, fechaCorte):
    // incluye el día del siniestro y excluye el de liquidación.
    //
    // NO es un cociente de índices entre las dos puntas: ese cálculo
    // sobreestima unas seis veces.
    //
    // Por el rezago de tres meses, el resultado no depende del índice del mes
    // de corte, así que se puede liquidar con el RIPTE publicado con atraso.
    function coeficiente(fechaPmi, fechaCorte) {
      const vacio = { coef: 1, acum: 0, dias: 0, tramos: [], faltantes: [], ok: true };
      if (!fechaPmi || !fechaCorte || fechaCorte.getTime() <= fechaPmi.getTime()) {
        return vacio;
      }

      let acum = 0;
      let dias = 0;
      const tramos = [];
      const faltantes = [];
      let cursor = fechaPmi;

      while (cursor.getTime() < fechaCorte.getTime()) {
        const ym = ymOf(cursor);
        const finMes = new Date(Date.UTC(
          cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1
        ));
        const hasta = finMes.getTime() < fechaCorte.getTime() ? finMes : fechaCorte;
        const d = diffDays(cursor, hasta);
        const t = tasaMensual(ym);
        if (!t) {
          faltantes.push(ym);
        } else {
          const tasaDiaria = t.tasa / diasDelMes(ym);
          acum += tasaDiaria * d;
          tramos.push({ ym, dias: d, tasaMes: t.tasa, tasaDiaria, ref: `${t.desde} → ${t.hasta}` });
        }
        dias += d;
        cursor = hasta;
      }

      return {
        coef: 1 + acum, acum, dias, tramos,
        faltantes: [...new Set(faltantes)],
        ok: faltantes.length === 0,
      };
    }

    // Ingreso base del art. 12 inc. 1: cada sueldo se lleva al mes de la PMI
    // por cociente de índices y la suma se divide por los meses INCLUIDOS:
    // 12 menos los marcados `incluido: false`. Un mes incluido sin sueldo (o
    // que no viene en la lista) cuenta como cero; uno excluido no suma ni
    // cuenta en el divisor, lo que permite promediar menos de 12 meses (D-8).
    function ingresoBase(sueldos, periodoPmi) {
      const indiceBase = indice(periodoPmi);
      const filas = [];
      const faltantes = [];
      const sinIndice = [];
      let suma = 0;
      let mesesCargados = 0;
      let mesesExcluidos = 0;

      for (const s of sueldos || []) {
        const monto = toNumber(s.monto);
        const indicePeriodo = indice(s.periodo);
        const incluido = s.incluido !== false;
        const fila = {
          periodo: s.periodo, monto, indice: indicePeriodo, incluido,
          coef: null, actualizado: null,
        };
        filas.push(fila);
        if (!incluido) { mesesExcluidos++; continue; }

        if (indicePeriodo === null || !indicePeriodo || indiceBase === null || !indiceBase) {
          sinIndice.push(s.periodo);
        } else if (Number.isFinite(monto)) {
          fila.coef = indiceBase / indicePeriodo;
          fila.actualizado = monto * fila.coef;
          suma += fila.actualizado;
          mesesCargados++;
        }

        if (!Number.isFinite(monto)) faltantes.push(s.periodo);
      }

      const mesesIncluidos = Math.max(0, 12 - mesesExcluidos);
      return {
        vib: mesesCargados > 0 && mesesIncluidos > 0 ? suma / mesesIncluidos : 0,
        suma, filas, mesesCargados, mesesIncluidos,
        faltantes, sinIndice,
        indiceBase,
      };
    }

    // Resolución de piso mínimo vigente a la fecha de la PMI.
    function pisoVigente(fechaPmi) {
      if (!fechaPmi) return null;
      const iso = isoOfUTC(fechaPmi);
      return pisos.find((p) => p.desde && p.hasta && iso >= p.desde && iso <= p.hasta) || null;
    }

    // Piso mínimo: importe de la resolución vigente a la PMI × grado de ILP,
    // expresado a la fecha de liquidación con el mismo coeficiente que
    // actualiza el ingreso base (ver D-2 de la spec).
    function piso(incDec, fechaPmi, coef, actualizar) {
      const fila = pisoVigente(fechaPmi);
      if (!fila) {
        return {
          monto: 0, base: 0, coef: 1, norma: null, fila: null, aplicaCoef: !!actualizar,
          aviso: `No hay piso mínimo cargado para una PMI del ${fechaPmi ? isoOfUTC(fechaPmi) : "—"}.`,
        };
      }
      const coefAplicado = actualizar ? coef : 1;
      const base = toNumber(fila.monto) || 0;
      return {
        monto: base * incDec * coefAplicado,
        base, coef: coefAplicado,
        norma: fila.norma || null,
        fila, aplicaCoef: !!actualizar, aviso: null,
      };
    }

    // Liquidación completa. Devuelve el desglose para que cada componente
    // pueda controlarse por separado.
    function liquidar(entrada) {
      const {
        sueldos = [],
        fechaPmi,
        fechaNacimiento,
        incPct,
        enItinere = false,
        fechaLiquidacion,
        interesManual = null,
        actualizarPiso = true,
        formula = FORMULA_POR_DEFECTO,
      } = entrada || {};

      const avisos = [];
      const incDec = incPct / 100;
      const edad = calcEdad(fechaNacimiento, fechaPmi);
      const factorEdad = 65 / edad;

      const base = ingresoBase(sueldos, ymOf(fechaPmi));
      if (base.sinIndice.length) {
        avisos.push(`Sin índice RIPTE para: ${[...new Set(base.sinIndice)].join(", ")}.`);
      }
      if (base.mesesIncluidos < 12) {
        avisos.push(
          `Se excluyeron ${12 - base.mesesIncluidos} meses: el promedio se divide por ${base.mesesIncluidos}.`
        );
      }
      const sinCargar = base.mesesIncluidos - base.mesesCargados;
      if (base.mesesCargados > 0 && sinCargar > 0) {
        avisos.push(
          `Hay ${sinCargar} meses incluidos sin sueldo: cuentan como cero y ` +
          `el promedio igual se divide por ${base.mesesIncluidos}.`
        );
      }

      // RIPTE (2). Con interés cargado a mano, el coeficiente es el que ese
      // monto implica sobre el ingreso base, para que el piso se actualice
      // con el mismo criterio (ver D-1).
      const calculado = coeficiente(fechaPmi, fechaLiquidacion);
      const manual = Number.isFinite(toNumber(interesManual));
      const ripte2 = manual
        ? {
            coef: base.vib > 0 ? 1 + toNumber(interesManual) / base.vib : 1,
            acum: 0, dias: 0, tramos: [], faltantes: [], ok: true,
            monto: toNumber(interesManual), manual: true,
          }
        : { ...calculado, monto: base.vib * (calculado.coef - 1), manual: false };

      if (!ripte2.ok) {
        avisos.push(
          `Faltan índices RIPTE para calcular el interés en: ${ripte2.faltantes.join(", ")}. ` +
          `Cada mes usa el índice de 3 y 4 meses antes; no se extrapola.`
        );
      }

      const pisoCalc = piso(incDec, fechaPmi, ripte2.coef, actualizarPiso);
      if (pisoCalc.aviso) avisos.push(pisoCalc.aviso);

      if (incPct > 50) {
        avisos.push(
          "El grado de ILP supera el 50 %: esta variante corresponde a ILP parcial ≤ 50 %. " +
          "Para ILP > 50 % aplican otras reglas."
        );
      }

      // Sin un índice del período no hay monto: no se entrega un resultado
      // incompleto presentado como definitivo.
      if (!ripte2.ok) {
        return {
          ok: false, resultado: null, aplicada: null, rige: null, formulaSinPiso: null, adicional: null,
          ingresoBase: base, ripte2, piso: pisoCalc, edad, factorEdad, avisos,
        };
      }

      const formulaSinPiso = 53 * (base.vib + ripte2.monto) * incDec * factorEdad;
      const aplicada = Math.max(formulaSinPiso, pisoCalc.monto);
      const rige = pisoCalc.monto > formulaSinPiso ? "piso" : "formula";

      let resultado;
      try {
        resultado = compilarFormula(formula)({
          VIB: base.vib, TASA: ripte2.monto, INC: incDec, EDAD: edad,
          FACTOR_EDAD: factorEdad, EN_ITINERE: enItinere,
          BASE: formulaSinPiso, PISO: pisoCalc.monto,
        });
      } catch (e) {
        return {
          ok: false, resultado: null, aplicada, rige, formulaSinPiso, adicional: null,
          ingresoBase: base, ripte2, piso: pisoCalc, edad, factorEdad,
          avisos: [...avisos, `Error en la fórmula: ${e.message}`],
        };
      }

      // El adicional se informa como componente propio. Se deduce del
      // resultado (y no se calcula como 20 %) porque la fórmula es editable:
      // así siempre cuadra aplicada + adicional = resultado.
      const adicional = resultado - aplicada;

      return {
        ok: true, resultado, aplicada, rige, formulaSinPiso, adicional,
        ingresoBase: base, ripte2, piso: pisoCalc, edad, factorEdad, avisos,
      };
    }

    return { indice, tasaMensual, coeficiente, ingresoBase, pisoVigente, piso, liquidar };
  }

  return {
    crearCalculadora,
    compilarFormula,
    FORMULA_POR_DEFECTO,
    parseISODate, ymOf, ymAdd, diasDelMes, diffDays, calcEdad, isoOfUTC, toNumber,
  };
});
