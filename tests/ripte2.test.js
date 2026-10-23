// RIPTE (2) — interés del art. 12 inc. 2, metodología del Anexo I de la
// Res. SSN 332/2023. AC-3 y AC-8 de la US.
//
// El error que estos tests existen para impedir: calcular el interés como
// cociente de índices entre las dos puntas del período sobreestima unas seis
// veces (2.202 % en lugar de 336 % para el caso de referencia).

const { crearCalculadora } = require("../calculo.js");
const { cargarSemillas, fecha } = require("./semillas.js");

describe("tasaMensual", () => {
  let calc;
  let ripte;

  beforeEach(() => {
    const semillas = cargarSemillas();
    ripte = semillas.ripte;
    calc = crearCalculadora(semillas);
  });

  // AC-3 — la tasa de un mes usa la variación ocurrida tres meses antes.
  it.each([
    { mes: "2021-06", desde: "2021-02", hasta: "2021-03", pct: 4.8632, diaria: 0.162106 },
    { mes: "2021-07", desde: "2021-03", hasta: "2021-04", pct: 6.1903, diaria: 0.199687 },
    { mes: "2026-06", desde: "2026-02", hasta: "2026-03", pct: 2.3817, diaria: 0.079390 },
    { mes: "2026-09", desde: "2026-05", hasta: "2026-06", pct: 3.5762, diaria: 0.119208 },
  ])(
    "para $mes usa la variación de $desde a $hasta y da $pct %",
    ({ mes, desde, hasta, pct, diaria }) => {
      // Given el mes dentro del período de cálculo
      // When se determina su tasa
      const t = calc.tasaMensual(mes);

      // Then usa la variación de tres meses antes
      expect(t.desde).toBe(desde);
      expect(t.hasta).toBe(hasta);
      expect(t.tasa * 100).toBeCloseTo(pct, 4);

      // And la tasa diaria la divide por los días calendario de ese mes
      const dias = new Date(Date.UTC(
        Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0
      )).getUTCDate();
      expect((t.tasa / dias) * 100).toBeCloseTo(diaria, 6);
    }
  );

  it("devuelve null cuando falta alguno de los dos índices, sin extrapolar", () => {
    // Given un mes cuyo índice de 3 meses antes no está publicado
    // When se determina su tasa
    const t = calc.tasaMensual("2026-11");

    // Then no se estima ningún valor
    expect(t).toBeNull();
  });
});

describe("coeficiente", () => {
  let calc;

  beforeEach(() => {
    calc = crearCalculadora(cargarSemillas());
  });

  // AC-3 — acumulado por suma simple de variaciones diarias, sin capitalizar.
  // Los cuatro valores están verificados contra la especificación normativa.
  it.each([
    { hasta: "2025-08-06", acum: 305.7702, coef: 4.057702 },
    { hasta: "2026-06-11", acum: 327.8004, coef: 4.278004 },
    { hasta: "2026-07-31", acum: 332.7643, coef: 4.327643 },
    { hasta: "2026-09-21", acum: 335.9204, coef: 4.359204 },
  ])(
    "acumula $acum % entre el 16/06/2021 y el $hasta",
    ({ hasta, acum, coef }) => {
      // Given un siniestro del 16/06/2021
      // When se calcula el interés hasta la fecha de corte
      const r = calc.coeficiente(fecha("2021-06-16"), fecha(hasta));

      // Then el acumulado y el coeficiente son los esperados
      expect(r.ok).toBe(true);
      expect(r.acum * 100).toBeCloseTo(acum, 4);
      expect(r.coef).toBeCloseTo(coef, 6);
    }
  );

  // Regresión del error más caro posible: el cociente entre puntas.
  it("no calcula el interés como cociente de índices entre las puntas", () => {
    // Given el período completo del caso de referencia
    const { ripte } = cargarSemillas();
    const indice = (p) => ripte.find((r) => r.periodo === p).indice;
    const cocienteEntrePuntas = indice("2026-07") / indice("2021-06");

    // When se calcula el coeficiente
    const r = calc.coeficiente(fecha("2021-06-16"), fecha("2026-09-21"));

    // Then no se parece al cociente entre puntas, que daría más de 23
    expect(cocienteEntrePuntas).toBeGreaterThan(20);
    expect(r.coef).toBeLessThan(5);
  });

  it("cuenta el día del siniestro y excluye el de liquidación", () => {
    // Given un período de un solo día dentro de junio de 2021
    // When se calcula el coeficiente
    const r = calc.coeficiente(fecha("2021-06-16"), fecha("2021-06-17"));

    // Then aporta exactamente una tasa diaria de ese mes
    expect(r.dias).toBe(1);
    expect(r.acum * 100).toBeCloseTo(0.162106, 6);
  });

  it("no devuelve interés cuando la liquidación no es posterior al siniestro", () => {
    // Given una fecha de corte igual a la del siniestro
    // When se calcula el coeficiente
    const r = calc.coeficiente(fecha("2021-06-16"), fecha("2021-06-16"));

    // Then el coeficiente es neutro
    expect(r.coef).toBe(1);
    expect(r.dias).toBe(0);
  });

  // AC-8 — sin índice no hay tasa: no se extrapola.
  it("no entrega resultado si falta un índice del período", () => {
    // Given una serie cargada hasta julio de 2026
    // When la liquidación es del 15/11/2026
    const r = calc.coeficiente(fecha("2021-06-16"), fecha("2026-11-15"));

    // Then el cálculo se marca incompleto e informa qué mes falta
    expect(r.ok).toBe(false);
    expect(r.faltantes).toContain("2026-11");
  });

  // AC-8 — el rezago de tres meses permite liquidar aunque el índice del mes
  // de corte todavía no esté publicado.
  it("liquida aunque el índice del mes de corte no esté publicado", () => {
    // Given una serie cargada hasta julio de 2026
    // When la liquidación es del 21/09/2026
    const r = calc.coeficiente(fecha("2021-06-16"), fecha("2026-09-21"));

    // Then el cálculo se completa sin faltantes
    expect(r.ok).toBe(true);
    expect(r.faltantes).toEqual([]);
  });
});
