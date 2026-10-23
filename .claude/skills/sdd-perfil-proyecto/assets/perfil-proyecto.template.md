---
# ─────────────────────────────────────────────────────────────────────────────
# PERFIL DE PROYECTO — contrato que parametriza el skill `sdd-core:sdd`
# Ubicación canónica: docs/standards/perfil-proyecto.md (en el repo del proyecto)
# ─────────────────────────────────────────────────────────────────────────────
# El frontmatter es la parte MÁQUINA (el skill lo lee sin interpretar prosa).
# Las secciones numeradas de abajo son la parte HUMANA y se citan como "§N del perfil".
# Lo que no se pudo inferir del repo queda como <A CONFIRMAR> — nunca inventado.
# Secciones BLOQUEANTES para el ciclo SDD (no se arranca con placeholders en ellas):
#   §2, §3, §5 (incluye politica_tests), §6 y §10 (ejecucion_comandos).

perfil_actualizado: <AAAA-MM-DD>   # fecha absoluta de la última verificación contra el repo

proyecto: <nombre corto>
tipo: <web-frontend | web-backend | web-fullstack | api | mobile | data | libreria | cli | infra | monorepo | otro>
lenguajes: [<p. ej. typescript, python>]
frameworks: [<p. ej. nextjs, fastapi, spring-boot, django, react-native>]
rama_base: <main | develop | ...>

# Monorepo: listar los paquetes/apps y su stack si difieren. Si difieren en tests/comandos, cada
# paquete lleva su propia subsección en §4/§5/§10 (o su propio perfil en <paquete>/docs/standards/).
paquetes: [<p. ej. apps/web (nextjs), apps/api (nestjs), packages/ui>]   # o [] si no es monorepo

# ¿Se escriben tests automatizados nuevos? Gate de la Fase 4.
# obligatorios | opcional (a criterio, no es gate de PR) | no_se_escriben (decisión de equipo)
politica_tests: <obligatorios | opcional | no_se_escriben>

framework_tests_unit: <p. ej. vitest | jest | pytest | junit5 | xunit | go test | rspec | phpunit>
framework_tests_e2e: <p. ej. playwright | cypress | detox | N/A>

# Comandos. El skill solo los EJECUTA si ejecucion_comandos = agente (ver §10).
comando_test: <p. ej. pnpm test>
comando_test_un_archivo: <p. ej. pnpm vitest run <ruta>  |  pytest <ruta>::<test>>
comando_lint: <p. ej. pnpm lint | ruff check . | N/A>
comando_typecheck: <p. ej. pnpm tsc --noEmit | mypy . | N/A>
comando_build: <p. ej. pnpm build | N/A>

# agente  = el agente puede correr test/lint/typecheck/build locales (nunca deploy, ni bases compartidas)
# usuario = el agente nunca ejecuta: deja los comandos listos (suite costosa, requiere infra, política)
ejecucion_comandos: <agente | usuario>

# Dónde viven las US/bugs (ver §8).
tracker: <azure-devops | github | gitlab | jira | linear | bitbucket | local>
# Formato con que sdd-tracker escribe un campo de texto vacío/nuevo cuando el tracker admite varios
# (Azure DevOps: html | markdown). Un campo con contenido conserva siempre su formato actual.
formato_nuevo: <html | markdown>

# Eje primario por el que se descubren las specs (ver §6).
eje_descubrimiento: <modulo | dominio | servicio | feature>

ruta_specs: docs/specs
ruta_adr: <docs/adr | N/A>
---

# Perfil de proyecto — <proyecto>

> Este archivo es la **única fuente de verdad específica del proyecto** para el ciclo SDD. El skill
> es agnóstico: todo lo propio de este repo se declara acá. **Regla de oro:** si el skill necesita
> saber algo del proyecto que no está en este perfil, eso es un hueco del perfil — no una licencia
> para asumir.

---

## §1 — Identidad y alcance

- **Proyecto:** <nombre>
- **Tipo:** <web frontend / API / …>
- **Stack principal:** <lenguaje + framework + runtime/versión>  — evidencia: <archivo:línea>
- **Repositorio:** <URL o nombre>
- **Rama base:** <main>
- **Qué hace en el negocio:** <1-3 líneas en lenguaje funcional: quién lo usa y para qué>

---

## §2 — Clasificación del cambio: qué **NO** es cambio de código

La Fase 3 lo consulta **antes de proponer código**. Si el requerimiento cae acá, el plan es un cambio
en ese mecanismo, no en el código.

| Si el requerimiento es sobre… | El mecanismo correcto es… | ¿Es código? |
|---|---|---|
| <Textos/traducciones de la UI> | <archivos `locales/*.json` / CMS / plataforma de i18n> | <Sí (archivo versionado) / No (lo carga negocio)> |
| <Activar/desactivar una funcionalidad> | <feature flag en LaunchDarkly / Unleash / tabla `flags`> | <No> |
| <Contenido editorial, imágenes, banners> | <CMS (Contentful, Strapi…)> | <No> |
| <Parámetros de negocio (montos, límites, plazos)> | <variables de entorno / tabla de parámetros / config remota> | <…> |
| <Infraestructura, DNS, secretos> | <repo de IaC de plataforma / gestor de secretos> | <No — otro equipo> |

Cada fila lleva evidencia (`archivo:línea`) o la confirmación del equipo con fecha; una fila de ejemplo
de la plantilla que no aplica se borra o se marca `N/A`. **Ante duda sobre la clasificación de un
requerimiento → preguntar, no asumir.**

---

## §3 — Zonas vedadas (detenerse y confirmar)

Tocar cualquiera de estas requiere confirmación explícita antes de seguir: si el diseño de la Fase 3
parece requerirlo, el ciclo **se detiene y pregunta**. Las filas de ejemplo que no apliquen a este repo
quedan como `N/A` (verificado), no se borran.

| Zona | Por qué | Ruta / ejemplo |
|---|---|---|
| Código generado | Se pisa al regenerar | <p. ej. `src/generated/**`, clientes OpenAPI, `*.pb.go`> |
| Código vendorizado / de terceros | No es nuestro | <`vendor/**`, `third_party/**`> |
| Migraciones ya aplicadas | Romperían ambientes existentes | <`migrations/**` con fecha anterior al último release> |
| Contratos públicos | Rompen consumidores | <API pública versionada, esquemas de eventos, paquetes publicados> |
| Seguridad / auth / pagos | Riesgo alto, requiere revisión especial | <`src/auth/**`, integración con pasarela> |
| <otra> | <…> | <…> |

---

## §4 — Estructura del código

Las Fases 3 y 5 lo usan para ubicar componentes y decidir dónde crear archivos. **Cada ruta se
verifica contra el repo antes de escribirla** y lleva entre paréntesis la cantidad de archivos
encontrados (prueba de que se verificó). Una ruta inexistente hace que una búsqueda devuelva cero y que
el análisis concluya que el repo "no tiene" ese artefacto. Si un artefacto no existe, la fila queda con
`N/A` en vez de borrarse: así se sabe que se verificó y no es un dato faltante.

| Qué | Dónde | Nota |
|---|---|---|
| Código fuente | <src/> | <organización: por feature / por capa / hexagonal / …> |
| Rutas / endpoints | <src/routes/, app/api/> | |
| Componentes de UI | <src/components/> | <design system: packages/ui> |
| Lógica de dominio | <src/domain/, services/> | |
| Acceso a datos | <src/repositories/, prisma/> | <ORM: …> |
| Configuración | <config/, .env.example> | |
| Migraciones | <migrations/> | |

**Convención de nombres:** <p. ej. archivos `kebab-case`, componentes `PascalCase`, sufijo
`.service.ts`> — si conviven dos (una histórica), indicar cuál predomina y cuál usar para lo nuevo.

**Patrones del repo a respetar:** <p. ej. "los handlers no tienen lógica, delegan en servicios";
"estado global solo en Zustand"; "todo acceso a datos por repositorio">

---

## §5 — Tests

- **Política:** <obligatorios | opcional | no_se_escriben> — <motivo si no son obligatorios>
- **Framework unitario / integración:** <…> — evidencia: <config de tests:línea>
- **Framework de componentes UI:** <Testing Library / N/A>
- **Framework E2E:** <Playwright / Cypress / N/A> — <cuándo se escribe un E2E>
- **Ubicación:** <junto al archivo (`*.test.ts`) | carpeta `tests/` espejo de `src/`>
- **Naming:** <`describe('<Sujeto>') / it('<escenario> → <resultado>')` | `test_<sujeto>_<escenario>_<resultado>`>
- **Helpers / fixtures / factories:** <rutas>
- **Dobles de prueba:** <msw para HTTP, testcontainers para DB, freezegun / vi.useFakeTimers para tiempo>
- **Comandos:** suite `<comando_test>` · un archivo `<comando_test_un_archivo>`
- **Cobertura mínima exigida por CI:** <% o N/A>
- **Excepciones por zona:** si una carpeta/paquete ya tiene un patrón de test propio establecido, se
  sigue el de los tests vecinos de esa zona. <listar las conocidas o "ninguna">

> Monorepo con stacks distintos: repetir este bloque por paquete (`### §5.<paquete>`).

---

## §6 — Ejes de descubrimiento

Valores que se usan en el frontmatter del `spec.md` y como términos de búsqueda.

- **Eje primario (`eje_descubrimiento`):** <modulo | dominio | servicio | feature>
- **Valores válidos del eje primario:** <p. ej. checkout, catalogo, usuarios, notificaciones>
- **Otros términos útiles:** <nombres de entidades, servicios, pantallas clave>

---

## §7 — Estándares y documentación existentes

Las fases leen estas rutas. Marcar con honestidad cuáles **existen hoy** (verificado con `Glob`): una
ruta marcada "sí" que no existe hace fallar a la fase que la busca; una marcada "no" evita buscarla en
vano.

| Documento / herramienta | Ruta | ¿Existe? | Quién la lee |
|---|---|---|---|
| Guía para agentes | <CLAUDE.md / AGENTS.md> | <sí/no> | Todas |
| Contribución | <CONTRIBUTING.md> | <sí/no> | Fases 5, 6 |
| Estándares de código | <docs/standards/…> | <sí/no> | Fases 5, 6, code review |
| Límites arquitectónicos | <docs/standards/limites-arquitectonicos.md> | <sí/no> | Fases 3, 5 |
| ADRs | <docs/adr/> | <sí/no> | Fases 3, 5, 6 |
| Patrones | <docs/patterns/> | <sí/no> | Fases 3, 5 |
| Reglas de negocio | <docs/business-rules/> | <sí/no> | Fases 2, 3, 6 — se descubren con Grep/Glob, sin índice |
| Specs | <docs/specs/> | <sí/no> | Fases 1-3, 6 — se descubren con Grep/Glob, sin índice |
| Lecciones aprendidas | <docs/lessons-learned.md> | <sí/no> | Fase 5 |
| Linter / formatter | <eslint.config.js, .prettierrc, ruff.toml> | <sí/no> | se respeta, no se discute |

**Prioridad ante conflicto entre estándares** (de mayor a menor):

1. Requisitos regulatorios / de seguridad / de compliance que declare el equipo <ruta o N/A>
2. Este perfil (§2 clasificación y §3 zonas vedadas)
3. Estándares de código del repo y guía para agentes
4. Linter / formatter configurado
5. ADRs
6. Código existente

---

## §8 — Tracker y repositorio

- **Tracker:** <Azure DevOps (org/proyecto) | GitHub Issues (owner/repo) | Jira (proyecto) | local>
- **Cómo se lee/escribe:** <MCP disponible / CLI `gh` / `az boards` / manual>
- **Tipos de work item:** <User Story, Bug, Task / issue con labels feature, bug>
- **Convención de rama:** <feature/<id>-<slug> | …>
- **Convención de commit:** <Conventional Commits | …>
- **Quién es el autor/analista de una US:** <campo `Created By` / autor del issue>

---

## §9 — Vocabulario de dominio

Términos de negocio con que se escriben las US (y los que **no** se usan en este proyecto).

| Término | Significado | No confundir con |
|---|---|---|
| <Pedido> | <…> | <Orden de compra (otro sistema)> |

---

## §10 — Ejecución de comandos por el agente

- **`ejecucion_comandos`:** <agente | usuario>
- **Comandos permitidos al agente (si es `agente`):** <test, lint, typecheck, build local>
- **Comandos NUNCA permitidos:** deploy, migraciones contra bases no efímeras, publicar paquetes,
  push, cualquier cosa contra ambientes compartidos. <agregar otros>
- **Requisitos para correr la suite:** <Docker levantado, `.env.test`, base local…>
- **Decidido por / fecha:** <quién lo confirmó> — <AAAA-MM-DD>

---

## §11 — Notas y excepciones de este repo

<Particularidades que el ciclo debe respetar y que no encajan arriba: módulos legacy, áreas congeladas,
integraciones frágiles, deuda conocida, decisiones de equipo con su fecha.>
