---
titulo: Cálculo administrativo de incapacidad permanente parcial
tipo: feature
estado: implementada
feature: calculo-ilp
artefactos: [calculo.js, app.js, seed-data.js, index.html]
keywords: [ILP, PMI, RIPTE, ingreso base, piso mínimo, in itinere, liquidación, Res. SRT, Res. SSN]
tracker: local
creada: 2026-10-07
---

# Cálculo administrativo de incapacidad permanente parcial

> Régimen **administrativo** (circuito ART / Comisión Médica). No contempla liquidaciones
> judiciales: una sentencia puede fijar criterios distintos.

**Como** Usuario de la calculadora de incapacidad *(actor genérico — ver preguntas abiertas)*
**Quiero** obtener el monto de la indemnización por incapacidad laboral permanente parcial de hasta
50 %, actualizado a la fecha de liquidación
**Para** liquidar lo que corresponde según la normativa vigente sin rehacer el cálculo a mano y sin
depender de planillas sueltas

## Descripción funcional

El monto surge de comparar dos valores y pagar el mayor: el que arroja la fórmula del régimen y el
piso mínimo que fijó la resolución vigente a la fecha de la primera manifestación invalidante. Ambos
se expresan a la fecha de liquidación aplicando el mismo coeficiente, porque comparar valores de
fechas distintas da un resultado incorrecto.

El cálculo involucra dos actualizaciones por RIPTE con mecánicas distintas, y confundirlas es el
error más caro: la primera lleva cada sueldo al mes del siniestro por cociente de índices, y la
segunda calcula el interés que devenga el ingreso base hasta la liquidación sumando variaciones
diarias. Usar el mecanismo de la primera en la segunda multiplica el resultado por unas seis veces.

## Fuentes normativas

| Norma | Qué aporta |
|---|---|
| Ley 24.557 art. 12 | Ingreso base y sus dos actualizaciones (inc. 1 y inc. 2) |
| Ley 24.557 art. 14 ap. 2 inc. a | Fórmula de la prestación para ILP parcial ≤ 50 % |
| DNU 669/2019 | Sustituye la tasa activa por RIPTE en el art. 12 inc. 2 |
| Res. SSN 1039/2019 art. 3 | Interés "en forma simple, sumando las variaciones diarias del RIPTE" |
| Res. SSN 332/2023 Anexo I | Metodología vigente: índice, rezago de 3 meses y tasa diaria |
| Ley 26.773 art. 3 | Adicional del 20 %, excluido para accidentes in itinere |
| Resoluciones SRT semestrales | Pisos mínimos prestacionales |
| [SRT — ILP Parcial ≤ 50 %](https://www.argentina.gob.ar/srt/art/pagos-art/incapacidad-laboral-permanente-50) | Presentación consolidada de la fórmula y sus notas |

## Criterios de aceptación

- **AC-1** — Dado un siniestro con sus 12 sueldos previos, la edad del trabajador a la fecha del
  siniestro y el grado de incapacidad, el sistema entrega el monto a pagar y muestra por separado el
  ingreso base, el interés del período, el piso mínimo aplicable y el adicional.
- **AC-2** — Cada uno de los 12 sueldos previos se expresa en valores del mes del siniestro según la
  variación del RIPTE entre su mes y ese mes, y el promedio resulta de dividir la suma por la
  cantidad de meses incluidos — 12 por defecto —, aunque haya meses incluidos sin sueldo o en cero.
  *(ver D-3 y D-8)*
- **AC-3** — El interés que devenga el ingreso base entre el siniestro y la liquidación se obtiene
  sumando las variaciones diarias del RIPTE del período, sin capitalizar, y la variación que se
  aplica a cada mes es la ocurrida tres meses antes. Para un siniestro del 16/06/2021 liquidado el
  21/09/2026, el interés acumulado es 335,9204 %.
- **AC-4** — El piso mínimo es el importe que fijó la resolución vigente **a la fecha del siniestro**
  —nunca la vigente a la fecha de liquidación— multiplicado por el grado de incapacidad. Para un
  siniestro del 16/06/2021 con 3,63 % de incapacidad, el piso es $144.884,19.
- **AC-5** — El piso mínimo se expresa a la fecha de liquidación con el mismo coeficiente que
  actualiza el ingreso base. *(ver D-2)*
- **AC-6** — Se paga el mayor entre el resultado de la fórmula y el piso mínimo, nunca la suma de
  ambos, y el sistema indica cuál de los dos rigió.
- **AC-7** — Cuando la contingencia **no** es in itinere, al mayor de los dos se le adiciona un 20 %.
  Cuando es in itinere, no se adiciona nada.
- **AC-8** — Si para algún mes del período falta el índice RIPTE necesario, el sistema **no entrega
  un resultado**: informa qué meses faltan y no estima ni extrapola el valor ausente.
- **AC-9** — Si el grado de incapacidad informado supera el 50 %, el sistema advierte que esta
  variante no corresponde y entrega el cálculo igual. *(ver D-4)*
- **AC-10** — El resultado puede descargarse como informe, con el detalle de los sueldos
  actualizados, los componentes del cálculo y las resoluciones aplicadas.
- **AC-11** — Cada uno de los 12 meses puede marcarse o no como incluido (por defecto, todos lo
  están). Un mes no incluido no suma al ingreso base ni cuenta en el divisor, lo que permite
  promediar menos de 12 meses. Los informes PDF y Excel indican qué meses se incluyeron y por
  cuánto se dividió. *(ver D-8)*

Los escenarios en Gherkin de cada AC están implementados uno a uno en `tests/`; la tabla de
trazabilidad de abajo los enlaza.

## Fuera de alcance

- Incapacidad superior al 50 %, incapacidad total, gran invalidez y fallecimiento.
- Incapacidad laboral temporaria.
- Liquidaciones judiciales. La tarjeta de interés por tasa anual existe para ese escenario y queda
  fuera de la validación normativa de esta historia *(ver D-1)*.
- Resguardo compartido de los parámetros cargados por panel.

## Definiciones acordadas

| # | Definición | Motivo | Quién / cuándo |
|---|---|---|---|
| D-1 | El interés por RIPTE (2) y el interés por tasa anual de sentencia **conviven y se suman**. | Son conceptos distintos; se mantiene el comportamiento actual. | Usuario — 2026-10-07 |
| D-2 | El coeficiente del RIPTE (2) se aplica **también sobre el piso mínimo**. | Comparar un piso sin actualizar contra una fórmula actualizada mezcla fechas. Alternativa descartada: $144.884 en vez de $631.579 en el caso de referencia. | Usuario — 2026-10-07 |
| D-3 | ~~El promedio del ingreso base se divide **siempre por 12**.~~ Reemplazada por D-8. | Lo fija la especificación de referencia. Alternativa descartada: dividir por meses trabajados. | Usuario — 2026-10-07 |
| D-4 | Con incapacidad mayor al 50 % el sistema **advierte y calcula igual**. | Sirve para estimaciones rápidas. Alternativa descartada: bloquear. | Usuario — 2026-10-07 |
| D-5 | El período de cómputo del interés **incluye el día del siniestro y excluye el de liquidación**. | Con esa convención se reproducen los cuatro acumulados publicados a 4 decimales. No verificado contra el texto del Anexo I. | Analista — 2026-10-07 |
| D-6 | Se confirman los 10 índices RIPTE derivados (2025-10 a 2026-07) y la tabla de 12 pisos. | Zona vedada §3. Los índices se derivaron de los montos oficiales (÷ 8,7487) y se cruzaron contra dos fuentes que publican el índice, con coincidencia al centavo. No salieron del CSV oficial. | Usuario — 2026-10-07 |
| D-8 | El promedio se divide por los **meses incluidos** (12 por defecto). Un mes incluido sin sueldo cuenta como cero; un mes excluido no suma ni cuenta. | Permitir promedios con menos de 12 meses sin perder el criterio de D-3 cuando están los 12 incluidos. | Usuario — 2026-10-23 |
| D-7 | Se confirma la ampliación de la allowlist del evaluador con `BASE`, `PISO`, `MAX`, `MIN`. | Zona vedada §3. Son valores numéricos y funciones matemáticas; no amplían el alcance del sandbox. | Usuario — 2026-10-07 |

## Diseño

Ver `docs/adr/0001-nucleo-de-calculo-separado-y-vitest.md`.

El núcleo de cálculo vive en `calculo.js` como módulo UMD con las tablas inyectadas; `app.js` es la
capa de presentación y delega toda la liquidación en `crearCalculadora(...).liquidar(...)`.

### Contrato

| Firma | Retorno | Bordes |
|---|---|---|
| `crearCalculadora({ripte, pisos})` | API | tablas vacías → `null` / avisos |
| `indice(periodo)` | `number \| null` | período inexistente → `null` |
| `tasaMensual(ym)` | `{tasa, desde, hasta} \| null` | falta `m-3` o `m-4` → `null`, nunca extrapola |
| `coeficiente(fechaPmi, fechaCorte)` | `{coef, acum, dias, tramos, faltantes, ok}` | corte ≤ PMI → `coef: 1` |
| `ingresoBase(sueldos, periodoPmi)` | `{vib, suma, filas, mesesCargados, mesesIncluidos, faltantes, sinIndice}` | divide por `12 − meses con incluido: false`; ninguno incluido → `vib: 0` |
| `piso(incDec, fechaPmi, coef, actualizar)` | `{monto, base, coef, norma, fila, aplicaCoef, aviso}` | sin resolución → `monto: 0` |
| `liquidar(entrada)` | `{ok, ingresoBase, ripte2, piso, formulaSinPiso, aplicada, rige, resultado, edad, factorEdad, avisos}` | `ok: false` si falta un índice → `resultado: null` |

## Trazabilidad AC → test → código

| AC | Test | Código | Estado |
|---|---|---|---|
| AC-1 | `tests/liquidacion.test.js` — desglose, edad y factor | `calculo.js` → `liquidar` | CUMPLE (ejecutado) |
| AC-2 | `tests/ripte1.test.js` — 4 períodos + divisor 12 + meses vacíos | `calculo.js` → `ingresoBase` | CUMPLE (ejecutado) |
| AC-3 | `tests/ripte2.test.js` — rezago, 4 acumulados, convención de días, regresión del cociente | `calculo.js` → `tasaMensual`, `coeficiente` | CUMPLE (ejecutado) |
| AC-4 | `tests/piso.test.js` — semestre de la PMI, regresión del error de 24×, sin piso, bordes | `calculo.js` → `pisoVigente`, `piso` | CUMPLE (ejecutado) |
| AC-5 | `tests/piso.test.js` — actualización con el coeficiente del período | `calculo.js` → `piso` | CUMPLE (ejecutado) |
| AC-6 | `tests/liquidacion.test.js` — rige piso / rige fórmula | `calculo.js` → `liquidar` | CUMPLE (ejecutado) |
| AC-7 | `tests/liquidacion.test.js` — in itinere / de trabajo | `calculo.js` → `liquidar` + fórmula editable | CUMPLE (ejecutado) |
| AC-8 | `tests/ripte2.test.js` + `tests/liquidacion.test.js` | `calculo.js` → `coeficiente`; `app.js` → `abortarCalculo` | CUMPLE (ejecutado) |
| AC-9 | `tests/liquidacion.test.js` — advierte y calcula | `calculo.js` → `liquidar` | CUMPLE (ejecutado) |
| AC-10 | — | `app.js` → `descargarPdf`, `descargarExcel` | VERIFICACIÓN MANUAL PENDIENTE |
| AC-11 | `tests/ripte1.test.js` — divisor por meses incluidos, incluido vacío, ninguno incluido | `calculo.js` → `ingresoBase`; `app.js` → tabla de sueldos, `descargarPdf`, `descargarExcel` | CUMPLE (ejecutado) en el núcleo; PDF/Excel verificación manual |
| D-6 | `tests/datos.test.js` — serie sin huecos, no decreciente, importes | `seed-data.js` | CUMPLE (ejecutado) |
| D-7 | `tests/formula.test.js` — allowlist | `calculo.js` → `compilarFormula` | CUMPLE (ejecutado) |

Comando: `npm test` → 58 passed (6 archivos).

## Preguntas abiertas

1. **Actor** — no está definido quién usa la calculadora. No afecta ningún AC.
2. **Los 8 sueldos restantes del caso de referencia** — con los 12 completos se podría agregar un
   test del monto final de punta a punta contra un resultado verificado en producción. Hoy se
   verifican los componentes por separado y el monto con 4 sueldos y el resto en cero.
3. **Convención de conteo de días (D-5)** — reproduce los valores publicados, pero no está
   contrastada contra el texto del Anexo I de la Res. SSN 332/2023.
