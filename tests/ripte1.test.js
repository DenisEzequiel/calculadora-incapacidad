// RIPTE (1) — ingreso base del art. 12 inc. 1.
// AC-2 de la US "Cálculo administrativo de incapacidad permanente parcial".

const { crearCalculadora } = require("../calculo.js");
const { cargarSemillas } = require("./semillas.js");

describe("ingresoBase", () => {
  let calc;

  beforeEach(() => {
    const { ripte, pisos } = cargarSemillas();
    calc = crearCalculadora({ ripte, pisos });
  });

  // AC-2 — cada sueldo se expresa en valores del mes de la PMI por cociente
  // de índices. Valores verificados contra un sistema de liquidación real.
  it.each([
    { periodo: "2020-06", monto: 26678.25, esperado: 38632.60 },
    { periodo: "2020-12", monto: 29346.75, esperado: 37089.91 },
    { periodo: "2021-01", monto: 19564.50, esperado: 24279.70 },
    { periodo: "2021-05", monto: 22765.50, esperado: 23617.58 },
  ])(
    "lleva el sueldo de $periodo al mes de la PMI y da $esperado",
    ({ periodo, monto, esperado }) => {
      // Given un siniestro ocurrido en junio de 2021
      const sueldos = [{ periodo, monto }];

      // When se actualiza ese sueldo
      const { filas } = calc.ingresoBase(sueldos, "2021-06");

      // Then su valor expresado a junio de 2021 es el esperado
      expect(filas[0].actualizado).toBeCloseTo(esperado, 2);
    }
  );

  // AC-2 — con los 12 meses incluidos el divisor es 12, aunque falten sueldos.
  it("divide la suma por 12 aunque solo haya 4 meses cargados", () => {
    // Given solo 4 de los 12 meses anteriores con sueldo informado
    const sueldos = [
      { periodo: "2020-06", monto: 26678.25 },
      { periodo: "2020-12", monto: 29346.75 },
      { periodo: "2021-01", monto: 19564.50 },
      { periodo: "2021-05", monto: 22765.50 },
    ];

    // When se calcula el ingreso base
    const { vib, mesesCargados } = calc.ingresoBase(sueldos, "2021-06");

    // Then la suma de los actualizados se divide por 12, no por 4
    const sumaActualizada = 38632.60 + 37089.91 + 24279.70 + 23617.58;
    expect(mesesCargados).toBe(4);
    expect(vib).toBeCloseTo(sumaActualizada / 12, 2);
  });

  it("no cuenta los meses sin sueldo informado", () => {
    // Given un mes con sueldo y otro vacío
    const sueldos = [
      { periodo: "2020-06", monto: 26678.25 },
      { periodo: "2020-07", monto: null },
    ];

    // When se calcula el ingreso base
    const { mesesCargados, faltantes } = calc.ingresoBase(sueldos, "2021-06");

    // Then solo se cuenta el que tiene valor
    expect(mesesCargados).toBe(1);
    expect(faltantes).toContain("2020-07");
  });

  // AC-11 — los meses excluidos no suman ni cuentan en el divisor (ver D-8).
  it("divide por los meses incluidos cuando se excluyen meses", () => {
    // Given 4 meses con sueldo y 8 meses marcados como no incluidos
    const conSueldo = [
      { periodo: "2020-06", monto: 26678.25 },
      { periodo: "2020-12", monto: 29346.75 },
      { periodo: "2021-01", monto: 19564.50 },
      { periodo: "2021-05", monto: 22765.50 },
    ];
    const excluidos = ["2020-07", "2020-08", "2020-09", "2020-10", "2020-11", "2021-02", "2021-03", "2021-04"]
      .map((periodo) => ({ periodo, monto: 50000, incluido: false }));

    // When se calcula el ingreso base
    const { vib, mesesIncluidos, mesesCargados, faltantes, filas } =
      calc.ingresoBase([...conSueldo, ...excluidos], "2021-06");

    // Then la suma de los 4 actualizados se divide por 4 y los excluidos no suman
    const sumaActualizada = 38632.60 + 37089.91 + 24279.70 + 23617.58;
    expect(mesesIncluidos).toBe(4);
    expect(mesesCargados).toBe(4);
    expect(vib).toBeCloseTo(sumaActualizada / 4, 2);
    expect(faltantes).toHaveLength(0);
    expect(filas.filter((f) => !f.incluido).every((f) => f.actualizado === null)).toBe(true);
  });

  it("un mes incluido sin sueldo sigue contando como cero en el divisor", () => {
    // Given un mes con sueldo, uno incluido vacío y 10 excluidos
    const sueldos = [
      { periodo: "2021-05", monto: 22765.50 },
      { periodo: "2021-04", monto: "", incluido: true },
      ...["2020-06", "2020-07", "2020-08", "2020-09", "2020-10", "2020-11",
        "2020-12", "2021-01", "2021-02", "2021-03"].map((periodo) => ({ periodo, monto: "", incluido: false })),
    ];

    // When se calcula el ingreso base
    const { vib, mesesIncluidos, faltantes } = calc.ingresoBase(sueldos, "2021-06");

    // Then se divide por 2 y el vacío figura como faltante
    expect(mesesIncluidos).toBe(2);
    expect(vib).toBeCloseTo(23617.58 / 2, 2);
    expect(faltantes).toEqual(["2021-04"]);
  });

  it("sin meses incluidos el ingreso base es cero", () => {
    // Given los 12 meses excluidos
    const sueldos = Array.from({ length: 12 }, (_, i) => ({
      periodo: `2020-${String(i + 1).padStart(2, "0")}`, monto: 1000, incluido: false,
    }));

    // When se calcula el ingreso base
    const { vib, mesesIncluidos } = calc.ingresoBase(sueldos, "2021-06");

    // Then no hay promedio posible
    expect(mesesIncluidos).toBe(0);
    expect(vib).toBe(0);
  });
});
