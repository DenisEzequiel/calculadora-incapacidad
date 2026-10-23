# Escribir el work item en el tracker — qué va dónde

Leer este archivo **solo cuando el analista pidió escribir** (en el tracker o en el `spec.md`). Para
redactar sin escribir no hace falta.

**La mecánica de conexión y los comandos son de `sdd-tracker`** (MCP del tracker → CLI → API REST,
según lo que haya disponible y lo que declare §8 del perfil). Este archivo define **qué contenido**
se le pasa y **a qué campo** va; `sdd-tracker` define **cómo** se escribe. No reimplementar acá la
conexión a ningún tracker.

Cubre las operaciones:

- **Crear** — el requerimiento llegó como texto libre y el work item no existe → [Paso A](#paso-a--crear-el-work-item).
- **Actualizar** — el requerimiento llegó como ID/URL de un work item existente →
  [Paso U](#paso-u--actualizar-un-work-item-existente). **No crear uno nuevo:** dejaría duplicados.
- **Local** — §8 declara `tracker: local` → [Paso L](#paso-l--tracker-local).

**Regla común a todos:** mostrar el contenido final y esperar un **sí explícito** antes de escribir.
Si hay preguntas abiertas **bloqueantes**, no escribir: resolverlas primero.

---

## Parámetros

Dependen del tracker; `sdd-tracker` sabe cuáles son obligatorios en cada uno. Como mínimo:

| Tracker | Obligatorios (preguntar si faltan, no inventar) | Opcionales |
|---|---|---|
| Azure DevOps | `area`, `iteration` (sprint) | `assignedTo`, tags |
| GitHub / GitLab | `owner/repo` o proyecto (de §8) | labels (`feature`/`bug` o los de §8), milestone, assignee |
| Jira | proyecto (de §8), tipo de issue | sprint, componente, assignee, labels |
| Linear | team (de §8) | proyecto, cycle, assignee, labels |

Si un obligatorio no se indicó ni está en §8, **no crear todavía** — preguntar con un ejemplo del
formato esperado (p. ej. *"¿En qué área y sprint de Azure DevOps lo creo? Ejemplo: `Proyecto\Equipo
Web` y `Proyecto\2026\Sprint 42`"*). `assignedTo` se aplica a todos los ítems creados (el padre y la
tarea hija).

---

## Qué campo recibe cada cosa

| Tracker | Tipo | Cuerpo | Criterios de aceptación |
|---|---|---|---|
| Azure DevOps | User Story | `System.Description` | `Microsoft.VSTS.Common.AcceptanceCriteria` |
| Azure DevOps | Bug | **`Microsoft.VSTS.TCM.ReproSteps`** | `Microsoft.VSTS.Common.AcceptanceCriteria` |
| Jira | Story / Bug | Description | Campo de criterios de aceptación si el proyecto lo tiene; si no, sección `Criterios de Aceptación` al final de la Description |
| GitHub / GitLab / Linear | Issue | Cuerpo del issue | Sección `## Criterios de Aceptación` dentro del mismo cuerpo, como checklist `- [ ]` |

**Azure DevOps, Bug:** el cuerpo NO va a `System.Description` — en el formulario de Bug ese campo
está oculto y el contenido queda invisible para el analista y el desarrollador. Dejar
`System.Description` sin tocar.

**Trackers con un solo campo de texto** (issues de GitHub/GitLab/Linear, o Jira sin campo de
criterios): el cuerpo y los criterios van en el mismo texto, pero como **secciones separadas**, con
los criterios después del cuerpo y sin repetirse.

**Qué del análisis va al work item:**

- **Sí:** Como/Quiero/Para (o comportamiento actual/esperado/pasos e impacto en un bug), descripción
  funcional, **fuera de alcance**, **definiciones acordadas**, reglas de negocio detectadas, impacto
  en funcionalidades existentes, requisitos no funcionales.
  - Las **definiciones acordadas** van en el **cuerpo**, no en el campo de criterios: son el *por
    qué* de las decisiones, no condiciones a verificar. Van al final, después de "Fuera de alcance",
    y los criterios que existen por una de ellas la citan (`CA-3 — ver D-2`).
- **No:** las **preguntas abiertas** (son un artefacto del análisis, no parte de la historia) ni la
  **nota de encuadre de implementación** (es para el analista; si hay que registrarla, como
  comentario aparte y con confirmación).
- Los criterios de aceptación **nunca** se duplican: si el tracker tiene campo propio, no van además
  en el cuerpo.

---

## Formato: HTML o Markdown — respetar el del campo

Cada tracker (y en algunos, cada campo) guarda el texto en un formato distinto, y se escribe **en el
formato que el campo ya tiene**. La regla detallada por tracker está en `sdd-tracker`. En corto:

| Tracker | Formato habitual |
|---|---|
| Azure DevOps | Por campo: HTML (por defecto histórico) o Markdown. Se lee del work item (`formats` por MCP, `multilineFieldsFormat` por REST) |
| GitHub / GitLab / Linear | Markdown |
| Jira | Según la API/herramienta: ADF/wiki markup o Markdown convertido — lo resuelve `sdd-tracker` |

- **Crear:** los campos nacen vacíos, así que van en el **formato para lo nuevo** que declare
  `sdd-tracker` para ese tracker (o §8 del perfil, si lo fija).
- **Actualizar:** leer el work item justo antes y escribir **cada campo en el formato que tiene**. Un
  campo vacío va en el formato para lo nuevo.
- **Nunca convertir** un campo HTML a Markdown (ni al revés) salvo pedido explícito del analista,
  avisándole que puede ser irreversible.
- Si la herramienta devuelve un error de formato (p. ej. `FORMAT_MISMATCH`), no reintentar
  convirtiendo: mostrar el mensaje y que el analista decida.

Cómo se arma cada uno:

- **HTML:** `<h3>`, `<strong>`, `<ul>`, `<li>`, `<table>`. Si va dentro de un JSON por REST, escapar
  las comillas. En Azure DevOps las **tablas** necesitan `style` inline en cada `<th>` y `<td>`
  (ignora `border` y `cellpadding`, y la tabla se renderiza sin líneas).
- **Markdown:** `###`, `**negrita**`, listas con `-`, checklists `- [ ]`, tablas con `|`.

Los **comentarios** siguen la misma regla de formato para lo nuevo — y ahí el error pasa
desapercibido, porque las APIs suelen aceptar cualquier texto sin fallar.

---

## Paso A — Crear el work item

1. Confirmar parámetros obligatorios (tabla de arriba).
2. Armar título, cuerpo y criterios en el formato para lo nuevo.
3. Mostrar el contenido final y esperar el sí.
4. Delegar la creación en `sdd-tracker` (tipo `User Story` / `Bug`, o issue con el label que
   corresponda según §8).
5. Guardar el ID devuelto: lo necesita la tarea hija (Paso B) y el `spec.md`, si se genera.

---

## Paso U — Actualizar un work item existente

Cuando el requerimiento llegó como ID/URL (Opción B de la Fase 1). **No se crea nada nuevo.**

1. **Leer el work item justo antes de escribir** (vía `sdd-tracker`) para saber en qué formato está
   cada campo y si cambió desde que se leyó en la Fase 1. Si cambió, mostrar la diferencia y
   preguntar antes de pisar.
2. **Listarle al analista qué campos se van a sobrescribir.** Está reemplazando el contenido, no
   agregándolo — el texto anterior se pierde.
3. Escribir solo título, cuerpo (o pasos de reproducción en un Bug de Azure DevOps) y criterios.
   **No tocar** área, iteración/sprint, asignado, estado, tags/labels ni milestone: son del ciclo de
   vida del work item, no del análisis funcional.
4. Si el tracker devuelve campos con formatos distintos, una escritura por formato.

Si el work item ya tenía una tarea hija "Análisis Técnico", **no crear otra**: avisar que existe y
preguntar si hay que actualizarla.

---

## Paso L — Tracker `local`

Sin tracker, **el `spec.md` es la única copia de la US**. Ofrecer escribirla en:

```
<ruta_specs del perfil>/<id>-<slug-corto>/spec.md     (por defecto docs/specs/…; sin ID → <slug>)
```

- Usar la plantilla de spec del orquestador `sdd` (`assets/spec.template.md`): frontmatter (`id`,
  `tipo`, eje de §6, `keywords`) + Contexto con el Como/Quiero/Para (o actual/esperado/pasos en un
  bug), criterios, fuera de alcance y definiciones acordadas. Los criterios se dejan en lenguaje
  natural; su formalización en Gherkin es de `sdd-refinar-us`.
- `artefactos` queda vacío o `[A CONFIRMAR]`: es lenguaje funcional, los artefactos los completa el
  análisis técnico.
- Verificar primero que la carpeta no exista; si existe, mostrar qué se pisaría y pedir confirmación.
- Si el analista prefiere no generar archivo, la salida queda **solo en pantalla** y se le avisa que
  no quedó registrada en ningún lado.
- La tarea hija "Análisis Técnico" no aplica: en local, el análisis técnico se agrega como sección o
  archivo `plan.md` junto al `spec.md` cuando corra `sdd-analisis-tecnico`.

---

## Paso B — Tarea hija "Análisis Técnico" (solo si fue solicitada)

- Tipo: la tarea hija que use el proyecto según §8 (en Azure DevOps suele ser `Task` o un tipo propio
  del proceso — **usar el que declare §8; si no lo declara, preguntar**, no adivinar). En GitHub /
  GitLab: un issue enlazado como sub-issue o con referencia al padre; en Jira: sub-task; en Linear:
  sub-issue. También cuando el padre es un Bug.
- Mismos parámetros opcionales que el padre, más el vínculo padre-hijo (lo arma `sdd-tracker`).
- La descripción va en el formato para lo nuevo. El contenido de abajo está en Markdown: si el
  formato es HTML, convertirlo antes de escribirlo.
- Mostrar el contenido y esperar el sí, igual que con el padre.

### Formato del Análisis Técnico (contenido de la tarea hija)

```
## Análisis Técnico

### Componentes a modificar o crear

| Tipo | Nombre | Ruta en el repositorio | Estado | Acción |
|---|---|---|---|---|
| Módulo / servicio | [nombre] | [ruta según §4] | [EXISTE archivo:línea] / [A CREAR] / [A CONFIRMAR] | Modificar / Crear |
| Configuración | [flag / parámetro / traducción] | [ruta o mecanismo según §2] | … | Modificar / Crear |

### ADRs y documentación relevante

| Tipo | Nombre | Ruta |
|---|---|---|
| ADR | [nombre ADR] | [ruta_adr]/[archivo] |
| Flujo / módulo | [nombre] | docs/[…]/[archivo] |

> Si no se encontró contexto técnico relevante: "No se encontró documentación técnica directamente
> relacionada. Se requiere análisis manual."

### Tipo de cambio

- [ ] Código (backend / frontend / mobile / datos)
- [ ] Configuración (flag, parámetro, CMS, i18n — según §2 del perfil)
- [ ] Integración con sistema externo
- [ ] UI
- [ ] Datos / migración

### Dependencias y riesgos

[Dependencias entre componentes, zonas vedadas de §3 que se tocarían, riesgos identificados o puntos
de extensión que deben respetarse según los ADRs encontrados. Si no se identificaron riesgos,
indicarlo.]
```

**Solo referenciar lo que exista** en el repositorio (rutas de §4 y §7 verificadas con Glob/Grep).
Lo que no se encontró no se menciona; lo dudoso va `[A CONFIRMAR]`.

---

## Si falla

1. Mostrar el error recibido.
2. Entregar el contenido en Markdown en consola para copiar/pegar a mano.
3. **No reintentar** sin que el analista corrija el problema. Con un error de formato tampoco: no
   reintentar convirtiendo el campo sin que el analista lo pida.

## Al finalizar

- Tipo, ID y URL del work item creado/actualizado (o ruta del `spec.md` en local).
- Tarea "Análisis Técnico" (si aplica) — ID y URL.
- Si fue un Bug en Azure DevOps: aclarar que el cuerpo quedó en **Repro Steps**, para que el
  analista lo busque ahí y no en Descripción.
- Siguiente paso sugerido: `sdd-refinar-us` (Gherkin + DoR) o, si ya está refinada,
  `sdd-analisis-tecnico`.
