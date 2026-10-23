// Datos de referencia — zona vedada §3 del perfil, confirmada por el usuario
// el 2026-10-07 (D-6).
//
// Estos tests no verifican lógica: fijan la serie de índices y la tabla de
// pisos como referencia. Un cambio accidental en un índice altera el monto de
// una indemnización sin que nada más lo delate.

const { cargarSemillas } = require("./semillas.js");

describe("serie de índices RIPTE", () => {
  it("cubre de 2016-01 a 2026-07 sin huecos", () => {
    // Given la serie semilla
    const { ripte } = cargarSemillas();
    const periodos = new Set(ripte.map((r) => r.periodo));

    // When se recorre mes a mes el rango completo
    const faltantes = [];
    const cursor = new Date(Date.UTC(2016, 0, 1));
    const fin = new Date(Date.UTC(2026, 6, 1));
    while (cursor <= fin) {
      const ym = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
      if (!periodos.has(ym)) faltantes.push(ym);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    // Then no falta ningún mes
    expect(faltantes).toEqual([]);
    expect(ripte).toHaveLength(127);
  });

  it("no tiene períodos duplicados", () => {
    const { ripte } = cargarSemillas();
    const periodos = ripte.map((r) => r.periodo);
    expect(new Set(periodos).size).toBe(periodos.length);
  });

  it("es no decreciente, como exige la serie de Riesgos del Trabajo", () => {
    // Given la serie semilla
    const { ripte } = cargarSemillas();
    const ordenada = [...ripte].sort((a, b) => a.periodo.localeCompare(b.periodo));

    // When se comparan meses consecutivos
    const caidas = ordenada.filter((r, i) => i > 0 && r.indice < ordenada[i - 1].indice);

    // Then ningún mes baja respecto del anterior
    expect(caidas).toEqual([]);
  });

  it("fija los índices usados por los casos de referencia", () => {
    const { ripte } = cargarSemillas();
    const indice = (p) => ripte.find((r) => r.periodo === p).indice;

    expect(indice("2021-06")).toBe(9660.13);
    expect(indice("2026-07")).toBe(222436.26);
  });
});

describe("tabla de pisos mínimos", () => {
  it("tiene los 12 semestres cargados, de 2021-03 a 2027-02", () => {
    const { pisos } = cargarSemillas();
    expect(pisos).toHaveLength(12);
    expect(pisos[0].desde).toBe("2021-03-01");
    expect(pisos[pisos.length - 1].hasta).toBe("2027-02-28");
  });

  it("no deja huecos ni solapamientos entre semestres", () => {
    // Given la tabla ordenada por fecha de inicio
    const { pisos } = cargarSemillas();
    const ordenada = [...pisos].sort((a, b) => a.desde.localeCompare(b.desde));

    // When se compara el fin de cada semestre con el inicio del siguiente
    const saltos = [];
    for (let i = 1; i < ordenada.length; i++) {
      const finAnterior = new Date(`${ordenada[i - 1].hasta}T00:00:00Z`);
      const inicio = new Date(`${ordenada[i].desde}T00:00:00Z`);
      const dias = (inicio - finAnterior) / 86400000;
      if (dias !== 1) saltos.push(`${ordenada[i - 1].hasta} → ${ordenada[i].desde}`);
    }

    // Then cada semestre empieza el día siguiente al fin del anterior
    expect(saltos).toEqual([]);
  });

  it("fija los importes de las resoluciones usadas en los casos de referencia", () => {
    const { pisos } = cargarSemillas();
    const porNorma = (n) => pisos.find((p) => p.norma === n);

    expect(porNorma("Res. SRT 7/2021").monto).toBe(3991300);
    expect(porNorma("Res. SRT 15/2026").monto).toBe(97502420);
    expect(porNorma("Res. SRT 39/2026").monto).toBe(114354110);
  });
});
