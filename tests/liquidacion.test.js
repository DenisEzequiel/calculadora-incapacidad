// Liquidación completa — comparación con el piso y adicional de pago único.
// AC-1, AC-6, AC-7 y AC-9 de la US.

const { crearCalculadora } = require("../calculo.js");
const { cargarSemillas, fecha } = require("./semillas.js");

// Caso de referencia de la especificación normativa, verificado contra un
// sistema de liquidación en producción. Solo 4 de los 12 sueldos están
// publicados, así que el resto va en cero: con los 12 incluidos el divisor es 12 (D-8).
const SUELDOS_REFERENCIA = [
  { periodo: "2020-06", monto: 26678.25 },
  { periodo: "2020-12", monto: 29346.75 },
  { periodo: "2021-01", monto: 19564.50 },
  { periodo: "2021-05", monto: 22765.50 },
];

function entradaReferencia(extra = {}) {
  return {
    sueldos: SUELDOS_REFERENCIA,
    fechaPmi: fecha("2021-06-16"),
    fechaNacimiento: fecha("1974-04-19"),
    incPct: 3.63,
    enItinere: true,
    fechaLiquidacion: fecha("2026-09-21"),
    ...extra,
  };
}

describe("liquidar", () => {
  let calc;

  beforeEach(() => {
    calc = crearCalculadora(cargarSemillas());
  });

  // AC-1 — el resultado se entrega desagregado para poder controlarlo.
  it("entrega el monto con sus componentes por separado", () => {
    // Given el caso de referencia
    // When se solicita el cálculo
    const r = calc.liquidar(entradaReferencia());

    // Then se obtiene el monto y cada componente por separado
    expect(r.ok).toBe(true);
    expect(r.ingresoBase.vib).toBeGreaterThan(0);
    expect(r.ripte2.coef).toBeCloseTo(4.359204, 6);
    expect(r.piso.monto).toBeCloseTo(631579.81, 2);
    expect(r.formulaSinPiso).toBeGreaterThan(0);
    expect(r.aplicada).toBeGreaterThan(0);
    expect(r.resultado).toBeGreaterThan(0);
  });

  it("calcula la edad y el factor de edad a la fecha de la PMI", () => {
    // Given un trabajador nacido el 19/04/1974 con siniestro el 16/06/2021
    // When se solicita el cálculo
    const r = calc.liquidar(entradaReferencia());

    // Then la edad es la cumplida a la fecha del siniestro
    expect(r.edad).toBe(47);
    expect(r.factorEdad).toBeCloseTo(65 / 47, 6);
  });

  // AC-6 — se paga el mayor, nunca la suma.
  it("paga el piso cuando supera al resultado de la fórmula", () => {
    // Given un ingreso base bajo
    // When se solicita el cálculo
    const r = calc.liquidar(entradaReferencia());

    // Then rige el piso y el monto es el del piso, no la suma de ambos
    expect(r.rige).toBe("piso");
    expect(r.aplicada).toBeCloseTo(r.piso.monto, 2);
    expect(r.aplicada).toBeLessThan(r.formulaSinPiso + r.piso.monto);
  });

  it("paga la fórmula cuando supera al piso", () => {
    // Given sueldos lo bastante altos como para que la fórmula gane
    const sueldos = SUELDOS_REFERENCIA.map((s) => ({ ...s, monto: s.monto * 50 }));

    // When se solicita el cálculo
    const r = calc.liquidar(entradaReferencia({ sueldos }));

    // Then rige la fórmula
    expect(r.rige).toBe("formula");
    expect(r.aplicada).toBeCloseTo(r.formulaSinPiso, 2);
  });

  // AC-7 — adicional del 20 % salvo in itinere.
  it("no adiciona el 20 % cuando la contingencia es in itinere", () => {
    // Given una contingencia in itinere
    // When se solicita el cálculo
    const r = calc.liquidar(entradaReferencia({ enItinere: true }));

    // Then el monto final es el comparado, sin adicional
    expect(r.resultado).toBeCloseTo(631579.81, 2);
  });

  it("adiciona el 20 % cuando la contingencia no es in itinere", () => {
    // Given una contingencia de trabajo
    // When se solicita el cálculo
    const r = calc.liquidar(entradaReferencia({ enItinere: false }));

    // Then el monto final lleva el adicional de pago único
    expect(r.resultado).toBeCloseTo(757895.77, 2);
  });

  // AC-1 / AC-7 — el adicional se informa como componente propio, para que
  // la pantalla y el informe no tengan que deducirlo restando.
  it("informa el adicional como el 20 % del monto comparado", () => {
    // Given una contingencia de trabajo
    // When se solicita el cálculo
    const r = calc.liquidar(entradaReferencia({ enItinere: false }));

    // Then el adicional es la diferencia entre el resultado y el mayor
    expect(r.adicional).toBeCloseTo(631579.81 * 0.2, 2);
    expect(r.aplicada + r.adicional).toBeCloseTo(r.resultado, 6);
  });

  it("informa un adicional de cero cuando la contingencia es in itinere", () => {
    // Given una contingencia in itinere
    // When se solicita el cálculo
    const r = calc.liquidar(entradaReferencia({ enItinere: true }));

    // Then no hay adicional
    expect(r.adicional).toBe(0);
  });

  // AC-9 — incapacidad fuera del rango de esta variante.
  it("advierte y calcula igual cuando la incapacidad supera el 50 %", () => {
    // Given un grado de incapacidad del 60 %
    // When se solicita el cálculo
    const r = calc.liquidar(entradaReferencia({ incPct: 60 }));

    // Then se advierte pero se entrega el resultado
    expect(r.ok).toBe(true);
    expect(r.resultado).toBeGreaterThan(0);
    expect(r.avisos.join(" ")).toMatch(/50/);
  });

  // AC-8 — sin índice no hay monto.
  it("no entrega monto cuando falta un índice del período", () => {
    // Given una liquidación del 15/11/2026 con la serie hasta julio de 2026
    // When se solicita el cálculo
    const r = calc.liquidar(entradaReferencia({ fechaLiquidacion: fecha("2026-11-15") }));

    // Then el cálculo se marca incompleto y no se entrega resultado
    expect(r.ok).toBe(false);
    expect(r.resultado).toBeNull();
  });

  // D-1 — el interés cargado a mano reemplaza al calculado, y el piso se
  // actualiza con el coeficiente que ese monto implica.
  it("usa el mismo coeficiente para el piso cuando el interés se carga a mano", () => {
    // Given un interés manual igual al doble del ingreso base
    const base = calc.liquidar(entradaReferencia());
    const interesManual = base.ingresoBase.vib * 2;

    // When se solicita el cálculo con ese monto
    const r = calc.liquidar(entradaReferencia({ interesManual }));

    // Then el piso se actualiza con el coeficiente implícito, que es 3
    expect(r.ripte2.coef).toBeCloseTo(3, 6);
    expect(r.piso.coef).toBeCloseTo(3, 6);
  });

  // D-2 — el coeficiente sobre el piso se puede desactivar.
  it("deja el piso sin actualizar cuando no se aplica el coeficiente", () => {
    // Given la opción de actualizar el piso desactivada
    // When se solicita el cálculo
    const r = calc.liquidar(entradaReferencia({ actualizarPiso: false }));

    // Then el piso entra a la comparación sin actualizar
    expect(r.piso.monto).toBeCloseTo(144884.19, 2);
  });
});
