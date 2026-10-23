---
perfil_actualizado: 2026-10-07

proyecto: calculadora-incapacidad
tipo: web-frontend
lenguajes: [javascript, html, css]
frameworks: []
rama_base: main
paquetes: []

politica_tests: obligatorios

framework_tests_unit: vitest       # PROPUESTA (ver §5) — no hay tests hoy
framework_tests_e2e: N/A

comando_test: npm test
comando_test_un_archivo: npx vitest run <ruta>
comando_lint: N/A
comando_typecheck: N/A
comando_build: N/A

ejecucion_comandos: agente

tracker: local
formato_nuevo: markdown

eje_descubrimiento: feature

ruta_specs: docs/specs
ruta_adr: docs/adr
---

# Perfil de proyecto — calculadora-incapacidad

> Este archivo es la **única fuente de verdad específica del proyecto** para el ciclo SDD. El skill
> es agnóstico: todo lo propio de este repo se declara acá. **Regla de oro:** si el skill necesita
> saber algo del proyecto que no está en este perfil, eso es un hueco del perfil — no una licencia
> para asumir.

---

## §1 — Identidad y alcance

- **Proyecto:** calculadora-incapacidad
- **Tipo:** web frontend — app estática, sin bundler ni build
- **Stack principal:** JavaScript vanilla (DOM API directa) — evidencia: `index.html:276-277`
  carga `seed-data.js` y `app.js` con `<script src>`; no existe `package.json`
- **Librerías de terceros (por CDN):** SheetJS 0.20.2 y jsPDF 2.5.1 — `index.html:274-275`
- **Repositorio:** github.com/DenisEzequiel/calculadora-incapacidad
- **Rama base:** main — `git branch -r` → `origin/HEAD -> origin/main`
- **CI:** ninguno — no existe `.github/`
- **Qué hace en el negocio:** calcula la indemnización por Incapacidad Laboral Permanente
  Parcial ≤ 50 % del régimen de Riesgos del Trabajo (Ley 24.557 art. 14 ap. 2 inc. a),
  con actualización por RIPTE y piso mínimo, y exporta el cálculo a PDF y Excel.

---

## §2 — Clasificación del cambio: qué **NO** es cambio de código

La Fase 3 lo consulta **antes de proponer código**. Si el requerimiento cae acá, el plan es un
cambio en ese mecanismo, no en el código.

| Si el requerimiento es sobre… | El mecanismo correcto es… | ¿Es código? |
|---|---|---|
| Cargar o corregir índices RIPTE | Panel Administración → RIPTE (persiste en `localStorage`) | **No** |
| Cargar o corregir pisos mínimos de una Res. SRT | Panel Administración → Pisos mínimos | **No** |
| Ajustar la fórmula de cálculo de una liquidación | Panel Administración → Fórmula de cálculo | **No** |
| Cambiar el **motor** de cálculo o la fórmula **por defecto** | `app.js` (`DEFAULT_FORMULA`, funciones `calcular*`) | Sí |
| Cambiar los valores **semilla** que ve un usuario nuevo | `seed-data.js` (archivo versionado) | Sí |
| Textos de la UI | `index.html` (no hay i18n) | Sí |

Confirmado por el usuario, 2026-10-07. Evidencia del mecanismo: `app.js:33-38`
(`STORAGE.ripte`, `STORAGE.pisos`, `STORAGE.formula`), secciones de Administración en
`index.html:208,227,249`.

**Nota de riesgo (ver §11):** lo cargado por panel vive en el `localStorage` del navegador —
no se versiona, no pasa por review y no es auditable entre máquinas.

---

## §3 — Zonas vedadas (detenerse y confirmar)

| Zona | Por qué | Ruta / ejemplo |
|---|---|---|
| Datos con consecuencia legal | Un índice o piso mal cargado cambia una indemnización en silencio | `seed-data.js`, `data/ripte.json` |
| Evaluador de fórmulas | `new Function` con allowlist de identificadores: superficie de seguridad | `app.js` → `compileFormula`, `ALLOWED_IDENTS` |
| Librerías de terceros | No son nuestras; se cargan por CDN | SheetJS y jsPDF (`index.html:274-275`) |
| Código generado | N/A (verificado: no hay) | N/A |
| Migraciones | N/A (verificado: no hay base de datos) | N/A |
| Contratos públicos | N/A (verificado: no expone API) | N/A |
| Seguridad / auth / pagos | N/A (verificado: la app no autentica ni cobra) | N/A |

---

## §4 — Estructura del código

| Qué | Dónde | Nota |
|---|---|---|
| Código fuente | `app.js` (1 archivo, 1363 líneas) | Monolito: cálculo + UI + exportación PDF/Excel |
| UI | `index.html` (1) | Dos vistas: `#view-calc` y `#view-admin` |
| Estilos | `styles.css` (1) | Tokens en `:root` + `body.theme-dark` |
| Datos semilla | `seed-data.js` (1) | `window.SEED_RIPTE` y `window.SEED_PISOS` |
| Dataset exportado | `data/ripte.json` (1) | Snapshot. **La app no lo lee** (`app.js:963` solo nombra así el archivo exportado) |
| Tests | N/A | No existen hoy |
| Configuración | N/A | No hay `package.json`, `.env` ni `config/` |

**Convención de nombres:** funciones y variables en `camelCase` con vocabulario de dominio en
español (`calcularPiso`, `coefRipte2`, `refrescarRipte2`); IDs del DOM en `camelCase` con prefijo
por rol (`kpi…`, `btn…`, `tbl…`).

**Patrones del repo a respetar:**

- Separación ya establecida entre **cálculo puro** (`calcularX` / `coefX`: reciben datos, devuelven
  un objeto con el resultado más `aviso` / `nota` / `ok`) y **presentación** (`refrescarX`: tocan el
  DOM). Lo nuevo sigue esa división.
- Selección de DOM solo por los helpers `$` / `$$`.
- Persistencia solo por `loadStore` / `saveStore` sobre `localStorage`.
- Dos niveles de mensaje al usuario: `.warn` (falta un dato, el número puede estar mal) y
  `.note` (informativo, el cálculo es correcto).
- Nunca extrapolar índices RIPTE: si falta un dato, se avisa y se corta.

---

## §5 — Tests

- **Política:** obligatorios — confirmado por el usuario, 2026-10-07. Se arranca desde cero.
- **Estado actual:** no hay ningún test, ni framework, ni `package.json`.
- **Framework unitario:** **vitest `^0.34`** — *propuesta, a confirmar*. Motivo de la versión:
  Node local es v16.15.0 (`node --version`) y Vitest 1.x exige Node ≥ 18; `node --test` tampoco
  está disponible en 16. Alternativa equivalente: Jest 29.
- **Framework de componentes UI:** N/A por ahora.
- **Framework E2E:** N/A por ahora.
- **Ubicación propuesta:** `tests/` espejo del código (`tests/calculo.test.js`).
- **Naming propuesto:** `describe` por función, `it` con escenario y resultado esperado.
- **Helpers / fixtures / factories:** ninguno todavía.
- **Dobles de prueba:** ninguno todavía. El cálculo es determinístico y no depende del reloj salvo
  por el valor por defecto de la fecha de liquidación, que se pasa como parámetro.
- **Comandos:** suite `npm test` · un archivo `npx vitest run <ruta>`
- **Cobertura mínima exigida por CI:** N/A (no hay CI).
- **Excepciones por zona:** ninguna.
- **Restricción conocida:** `app.js` es un script de navegador sin exports y toca `document` y
  `localStorage` al cargar. Para testear el núcleo de cálculo hay que **extraerlo a un módulo
  importable** por el navegador y por los tests. Ese refactor es parte del plan de la Fase 3,
  no una decisión de este perfil.

---

## §6 — Ejes de descubrimiento

- **Eje primario (`eje_descubrimiento`):** `feature`
- **Valores válidos del eje primario:** `calculo-ilp`, `ripte`, `piso-minimo`, `exportacion`,
  `administracion`
- **Otros términos útiles:** PMI, VIB, ILP, coeficiente, in itinere, liquidación, Res. SRT, Res. SSN

---

## §7 — Estándares y documentación existentes

| Documento / herramienta | Ruta | ¿Existe? | Quién la lee |
|---|---|---|---|
| Guía para agentes | CLAUDE.md | no | Todas |
| Contribución | CONTRIBUTING.md | no | Fases 5, 6 |
| Estándares de código | docs/standards/ | no | Fases 5, 6, code review |
| Límites arquitectónicos | docs/standards/limites-arquitectonicos.md | no | Fases 3, 5 |
| ADRs | docs/adr/ | sí (1) | Fases 3, 5, 6 |
| Patrones | docs/patterns/ | no | Fases 3, 5 |
| Reglas de negocio | docs/business-rules/ | no | Fases 2, 3, 6 |
| Specs | docs/specs/ | no (se crea con la primera) | Fases 1-3, 6 |
| Lecciones aprendidas | docs/lessons-learned.md | no | Fase 5 |
| Linter / formatter | — | no | — |

**Fuente normativa externa** (manda sobre cualquier criterio de implementación):

- SRT — Incapacidad Laboral Permanente Parcial ≤ 50 %:
  `https://www.argentina.gob.ar/srt/art/pagos-art/incapacidad-laboral-permanente-50`
- Res. SSN 1039/2019, art. 3 — interés simple sumando variaciones diarias del RIPTE.
- Res. SSN 332/2023, Anexo I — metodología vigente: índice, rezago y tasa diaria.
- Resoluciones SRT semestrales — pisos mínimos prestacionales.

**Prioridad ante conflicto entre estándares** (de mayor a menor):

1. Normativa citada arriba
2. Este perfil (§2 clasificación y §3 zonas vedadas)
3. Patrones del repo (§4)
4. Código existente

---

## §8 — Tracker y repositorio

- **Tracker:** `local` — confirmado por el usuario, 2026-10-07. La US vive en
  `docs/specs/<slug>/spec.md`. Evidencia: ningún commit referencia issues
  (`git log --oneline -30`), no hay plantillas de issue.
- **Cómo se lee/escribe:** archivo en el repo.
- **Tipos de work item:** feature / bug / config, declarados en el frontmatter del `spec.md`.
- **Convención de rama:** `<A CONFIRMAR>` — los 5 commits del historial son directos a `main`.
- **Convención de commit:** `<A CONFIRMAR>` — mensajes libres en español, minúscula
  ("calculadora de sentencia", "modo oscuro y pdf").
- **Quién es el autor/analista de una US:** el autor del `spec.md`.

---

## §9 — Vocabulario de dominio

| Término | Significado | No confundir con |
|---|---|---|
| PMI | Primera Manifestación Invalidante: fecha del siniestro | Fecha de liquidación |
| ILP | Incapacidad Laboral Permanente; acá siempre parcial ≤ 50 % | ILT (temporaria), ILP total |
| Ingreso Base / VIB | Promedio de los 12 sueldos previos actualizados al mes de la PMI | Sueldo nominal |
| RIPTE (1) | Actualización de cada sueldo al mes de la PMI, por cociente de índices | RIPTE (2) |
| RIPTE (2) | Interés del ingreso base entre PMI y liquidación, por suma simple de variaciones diarias | Cociente de índices entre puntas (error de ~6×) |
| Índice RIPTE No Decreciente | La serie que usa Riesgos del Trabajo | El RIPTE en pesos que publican los medios (difieren por un factor 8,7487) |
| Piso mínimo | Importe de la Res. SRT vigente a la PMI, por el grado de ILP | Tope (no existe en este régimen) |
| In itinere | Accidente camino al trabajo: excluye el adicional del 20 % | Accidente de trabajo |
| Fecha de liquidación | Puesta a disposición / determinación de ILP definitiva / homologación | PMI |
| Grado de ILP | Porcentaje de incapacidad | Factor de edad |

---

## §10 — Ejecución de comandos por el agente

- **`ejecucion_comandos`:** `agente` — confirmado por el usuario, 2026-10-07
- **Comandos permitidos al agente:** levantar un server estático local para previsualizar, correr
  la suite de tests, lint y typecheck locales.
- **Comandos NUNCA permitidos:** deploy, push, publicar paquetes, cualquier cosa contra ambientes
  compartidos.
- **Instalar dependencias:** requiere confirmación puntual (hoy no hay `package.json`).
- **Requisitos para correr la suite:** Node 16.15.0 y npm 8.5.5 ya instalados.
- **Decidido por / fecha:** usuario — 2026-10-07

---

## §11 — Notas y excepciones de este repo

- **Los parámetros cargados por panel no se versionan.** §2 define que RIPTE, pisos y fórmula se
  cargan por Administración, pero eso vive en el `localStorage` de cada navegador: dos personas
  pueden liquidar distinto el mismo caso y no queda rastro. Es una decisión tomada, no un defecto
  a corregir sin pedido — pero cualquier spec que dependa de esos valores debe declarar cuáles usó.
- **`app.js` es un monolito de 1363 líneas** sin exports. Hoy impide testear el cálculo sin extraer
  el núcleo a un módulo (ver §5).
- **La serie RIPTE arranca en 2016-01**, lo que fija el PMI liquidable más antiguo en 2017-01
  (RIPTE 1 necesita 12 meses previos).
- **El panel incluye una "Fórmula de sentencia"** (interés por tasa anual) que está **fuera del
  régimen administrativo**: una sentencia puede fijar criterios propios. No validar esa tarjeta
  contra la normativa de §7.
