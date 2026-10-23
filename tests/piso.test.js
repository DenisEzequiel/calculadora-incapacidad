// Piso mínimo prestacional — resoluciones semestrales de la SRT.
// AC-4 y AC-5 de la US.
//
// El error que estos tests existen para impedir: tomar la resolución vigente
// a la fecha de liquidación en lugar de la vigente a la PMI. En el caso de
// referencia eso multiplica el piso por veinticuatro.

const { crearCalculadora } = require("../calculo.js");
const { cargarSemillas, fecha } = require("./semillas.js");

describe("piso mínimo", () => {
  let calc;

  beforeEach(() => {
    calc = crearCalculadora(cargarSemillas());
  });

  // AC-4 — el piso es el de la norma vigente al siniestro.
  it("toma la resolución vigente a la fecha del siniestro", () => {
    // Given un siniestro del 16/06/2021
    // When se determina la resolución aplicable
    const fila = calc.pisoVigente(fecha("2021-06-16"));

    // Then es la del semestre que contiene esa fecha
    expect(fila.norma).toBe("Res. SRT 7/2021");
    expect(fila.monto).toBe(3991300);
  });

  it("calcula el piso sin actualizar como el importe por el grado de ILP", () => {
    // Given un siniestro del 16/06/2021 con 3,63 % de incapacidad
    // When se calcula el piso sin aplicar el coeficiente
    const p = calc.piso(0.0363, fecha("2021-06-16"), 1, false);

    // Then el piso resultante es el importe base por el grado
    expect(p.base).toBe(3991300);
    expect(p.monto).toBeCloseTo(144884.19, 2);
  });

  // AC-4 — regresión: no se usa la resolución de la fecha de liquidación.
  it("no toma la resolución vigente a la fecha de liquidación", () => {
    // Given un siniestro de 2021 que se liquida en 2026
    const alSiniestro = calc.pisoVigente(fecha("2021-06-16"));
    const aLaLiquidacion = calc.pisoVigente(fecha("2026-09-21"));

    // When se comparan ambas resoluciones
    // Then son distintas, y la aplicable es la del siniestro
    expect(aLaLiquidacion.norma).toBe("Res. SRT 39/2026");
    expect(alSiniestro.norma).toBe("Res. SRT 7/2021");
    expect(aLaLiquidacion.monto).toBeGreaterThan(alSiniestro.monto * 20);
  });

  // AC-5 — el piso se expresa a la fecha de liquidación con el mismo
  // coeficiente que actualiza el ingreso base (ver D-2).
  it("expresa el piso a la fecha de liquidación con el coeficiente del período", () => {
    // Given el coeficiente real del período, sin redondear: tomarlo a 6
    // decimales desplaza el resultado unos siete centavos.
    const { coef } = calc.coeficiente(fecha("2021-06-16"), fecha("2026-09-21"));

    // When se actualiza el piso con ese coeficiente
    const p = calc.piso(0.0363, fecha("2021-06-16"), coef, true);

    // Then el piso actualizado es el del caso de referencia
    expect(p.coef).toBeCloseTo(4.359204, 6);
    expect(p.monto).toBeCloseTo(631579.81, 2);
  });

  // AC-4 — camino infeliz: siniestro anterior a la primera resolución cargada.
  it("avisa y no aplica piso cuando no hay resolución para la fecha", () => {
    // Given un siniestro del 10/06/2019, anterior a la serie cargada
    // When se calcula el piso
    const p = calc.piso(0.0363, fecha("2019-06-10"), 4.359204, true);

    // Then no hay piso aplicable y se informa
    expect(p.fila).toBeNull();
    expect(p.monto).toBe(0);
    expect(p.aviso).toBeTruthy();
  });

  it("respeta los límites del semestre en ambos extremos", () => {
    // Given el primer y el último día del semestre de la Res. SRT 7/2021
    // When se resuelve la resolución aplicable
    // Then ambos extremos caen dentro, y el día siguiente ya no
    expect(calc.pisoVigente(fecha("2021-03-01")).norma).toBe("Res. SRT 7/2021");
    expect(calc.pisoVigente(fecha("2021-08-31")).norma).toBe("Res. SRT 7/2021");
    expect(calc.pisoVigente(fecha("2021-09-01")).norma).toBe("Res. SRT 49/2021");
  });
});
