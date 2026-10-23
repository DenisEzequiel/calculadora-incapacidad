# ADR 0001 — Separar el núcleo de cálculo y adoptar Vitest

- **Estado:** aceptada
- **Fecha:** 2026-10-07
- **Decidida por:** usuario, en el ciclo SDD de la US "Cálculo administrativo de incapacidad
  permanente parcial"

---

## Contexto

La aplicación es una página estática sin build: `index.html` carga `seed-data.js` y `app.js` como
scripts clásicos. Toda la lógica vive en `app.js`, que a la fecha de esta decisión tiene 1363 líneas
y 174 referencias al DOM.

El cálculo de la indemnización tiene consecuencia económica directa y una mecánica contraintuitiva:
el interés del ingreso base se obtiene sumando variaciones diarias del RIPTE con un rezago de tres
meses, y no por cociente de índices entre las dos puntas del período. Calcularlo de la forma
intuitiva sobreestima el resultado unas seis veces. La tabla de pisos mínimos tiene una trampa
análoga: tomar la resolución vigente a la fecha de liquidación en lugar de la vigente a la primera
manifestación invalidante multiplica el piso por veinticuatro en un caso real.

Dos errores de ese tamaño, en código sin ninguna prueba automatizada, son indistinguibles de un
resultado correcto hasta que alguien los encuentra en una liquidación.

Al adoptar el ciclo SDD se fijó `politica_tests: obligatorios` (§5 del perfil). El repositorio no
tenía `package.json`, ni framework de tests, ni un solo test.

El obstáculo para empezar a testear no era la falta de framework sino el acoplamiento: las funciones
de cálculo leían variables de módulo mutables (`ripteIndex` leía el global `RIPTE`, `pisoVigente`
leía `PISOS`) y una de ellas leía el DOM directamente (`calcularRipte2` consultaba el estado de una
casilla de verificación). Importar cualquiera de ellas arrastraba un navegador entero.

## Decisión

**1. Extraer el núcleo de cálculo a `calculo.js`, con los datos inyectados.**

El módulo no conoce el DOM, ni `localStorage`, ni de dónde vienen las tablas. Expone una fábrica
`crearCalculadora({ ripte, pisos })` que devuelve las operaciones del dominio. `app.js` queda como
capa de presentación: lee el DOM, arma la entrada, llama al núcleo y pinta el resultado.

Esto formaliza la separación que §4 del perfil ya declaraba como patrón del repositorio
(`calcularX` puro / `refrescarX` toca el DOM) y que estaba rota en tres puntos.

**2. Empaquetar `calculo.js` con un envoltorio UMD, no con ES modules.**

El módulo se publica en `globalThis.Calculo` cuando se carga por `<script>` y en `module.exports`
cuando lo importa un runner de Node.

**3. Adoptar Vitest `^0.34` como framework de tests.**

Con `package.json` mínimo y el script `npm test`.

## Alternativas consideradas

**ES modules nativos** en lugar del envoltorio UMD. Es la opción más limpia y no necesita
envoltorio. Se descartó porque `<script type="module">` activa las reglas de CORS: la aplicación
dejaría de abrirse haciendo doble clic en `index.html`, algo que hoy funciona. El envoltorio cuesta
cinco líneas y preserva esa capacidad.

**Vitest 1.x o el runner incorporado de Node** (`node --test`). Ambos exigen Node 18 o superior y el
entorno de desarrollo tiene Node 16.15.0. Vitest 0.34 es la última línea compatible.

**Un runner propio sobre el módulo `assert`** de Node, sin dependencias. Se descartó porque equivale
a escribir un framework de tests: sin modo watch, sin reporte, sin filtrado, y con el mantenimiento
a cargo del equipo. El repositorio pasaba de cero dependencias a una dependencia de desarrollo; ese
era el costo real a evaluar, y se consideró aceptable frente a mantener infraestructura propia.

**No testear y seguir verificando a mano.** Era el estado previo. Se descartó al fijar
`politica_tests: obligatorios`: la verificación manual no deja evidencia reproducible y no detecta
una regresión introducida meses después.

## Consecuencias

**A favor**

- El núcleo de cálculo es verificable sin navegador. Los vectores publicados en la especificación
  normativa pasan a ser tests de regresión ejecutables.
- Los dos errores caros descritos en el contexto quedan cubiertos por tests que fallan si alguien
  vuelve a introducirlos.
- La separación entre cálculo y presentación deja de depender de la disciplina de quien edita.

**En contra**

- El repositorio pasa de cero dependencias a tener `node_modules/`, con alrededor de doscientos
  paquetes transitivos. Para un proyecto cuyo valor era abrirse con doble clic, es un costo real.
- Hay dos lugares donde mirar en vez de uno.
- El envoltorio UMD es una concesión a la compatibilidad con `file://`. Si esa compatibilidad deja
  de importar, conviene migrar a ES modules y quitarlo.

**Neutras**

- `npm test` no corre en ninguna integración continua: el repositorio no tiene. Los tests se ejecutan
  localmente hasta que exista.

## Notas

Esta decisión se tomó sobre código ya escrito y sin commitear. Como mitigación, el núcleo se
construyó en paralelo y se probó en verde antes de modificar `app.js`.
