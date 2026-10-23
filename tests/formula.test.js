// Evaluador de fórmulas — zona vedada §3 del perfil, confirmada por el
// usuario el 2026-10-07 (D-7).
//
// La fórmula de cálculo es editable desde el panel de administración y se
// evalúa en tiempo de ejecución. La allowlist de identificadores es lo único
// que impide que una fórmula alcance cualquier cosa del entorno.

const { compilarFormula } = require("../calculo.js");

const VARIABLES = {
  VIB: 1000,
  TASA: 200,
  INC: 0.1,
  EDAD: 50,
  FACTOR_EDAD: 1.3,
  EN_ITINERE: false,
  BASE: 5000,
  PISO: 8000,
};

describe("compilarFormula", () => {
  it("evalúa la fórmula por defecto con las variables del dominio", () => {
    // Given la fórmula que compara con el piso y aplica el adicional
    const fn = compilarFormula("IF(EN_ITINERE, MAX(BASE, PISO), MAX(BASE, PISO) * 1.2)");

    // When se evalúa con una contingencia que no es in itinere
    const resultado = fn(VARIABLES);

    // Then rige el piso y se le aplica el 20 %
    expect(resultado).toBeCloseTo(9600, 6);
  });

  it("acepta los identificadores agregados por esta historia", () => {
    // Given fórmulas que usan cada identificador nuevo
    // When se compilan
    // Then ninguna es rechazada
    expect(() => compilarFormula("MAX(BASE, PISO)")).not.toThrow();
    expect(() => compilarFormula("MIN(BASE, PISO)")).not.toThrow();
  });

  it.each([
    ["fetch", "fetch('http://ejemplo')"],
    ["window", "window.location"],
    ["globalThis", "globalThis.VIB"],
    ["localStorage", "localStorage.getItem('x')"],
    ["constructor", "VIB.constructor"],
    ["require", "require('fs')"],
    ["process", "process.env"],
  ])("rechaza una fórmula que usa %s", (_nombre, expr) => {
    // Given una fórmula con un identificador fuera de la allowlist
    // When se intenta compilar
    // Then se rechaza antes de evaluar
    expect(() => compilarFormula(expr)).toThrow(/no permitido/i);
  });

  it("rechaza caracteres que permitirían encadenar sentencias", () => {
    // El matcher afirma el motivo: con un `toThrow()` sin mensaje, el test
    // pasaría también contra una implementación ausente.
    expect(() => compilarFormula("BASE; PISO")).toThrow(/no permitido/i);
    expect(() => compilarFormula("BASE[0]")).toThrow(/no permitido/i);
  });
});
