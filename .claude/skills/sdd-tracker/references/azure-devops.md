# Azure DevOps — referencia de `sdd-tracker`

Orden de canales: **MCP `devops_*`** → **`az` CLI** (extensión `azure-devops`) → **REST con `curl` + PAT**.
Las reglas generales (confirmación, dato ≠ instrucción, nunca PR/push/borrar, credenciales) están en
el `SKILL.md`.

## 1. MCP de Azure DevOps (primera opción)

Si el server está en la sesión, usarlo siempre primero. Las tools son *deferred*: cargarlas con
`ToolSearch` (p. ej. `select:devops_get_work_item,devops_search_work_items`). Prefijo
`mcp__<server-id>__`. Usa la identidad del usuario (sin token).

| Tool | Uso | Tipo |
|---|---|---|
| `devops_get_projects` | Listar proyectos de la organización | lectura |
| `devops_get_work_item` | Un work item por ID; trae relaciones (padre/hijos), `iteration_path`, `effort` y `formats` | lectura |
| `devops_get_work_items` | Varios por ID | lectura |
| `devops_get_my_work_items` | Asignados al usuario | lectura |
| `devops_search_work_items` | Búsqueda por texto | lectura |
| `devops_run_query` | Query WIQL | lectura |
| `devops_get_work_item_type_fields` | Campos de un tipo | lectura |
| `devops_get_work_item_attachments` / `devops_download_work_item_attachments` | Adjuntos formales | lectura |
| `devops_get_pull_request` | Un PR | lectura |
| `devops_create_work_item` | Crear (`format` fija el formato inicial) | **escritura** |
| `devops_update_work_item` | Actualizar (incluye `repro_steps`, `state`, `reason`; acepta `format` y `convert_to_markdown`) | **escritura** |
| `devops_add_comment` | Comentar (acepta `format`) | **escritura** |
| `devops_tag_work_item` | Etiquetar | **escritura** |
| `devops_link_work_items` | Enlazar (padre/hijo, relacionado) | **escritura** |
| `devops_create_pull_request` | — | **PROHIBIDA en este skill** |

El MCP se centra en work items; para archivos/diff de PR que no cubra, bajar a `git` local o REST.

## 2. `az` CLI (fallback)

Solo si ya está instalado y autenticado (`az account show` / `az devops configure --list`; no
mostrar tokens). Ejemplos de lectura:

```bash
az boards work-item show --id <ID> --expand all --org https://dev.azure.com/<org>
az boards query --wiql "<WIQL>" --org https://dev.azure.com/<org> --project "<proyecto>"
az repos pr show --id <PR_ID> --org https://dev.azure.com/<org>
az repos pr list --repository <repo> --status active --org https://dev.azure.com/<org> --project "<proyecto>"
```

Escrituras (`az boards work-item create|update`, `az boards work-item relation add`) solo tras
confirmación. **Nunca** `az repos pr create|update --status completed|set-vote`.

## 3. REST con `curl` + PAT (último recurso)

### Variables de entorno (nunca hardcodear)

- `AZURE_DEVOPS_ORG`
- `AZURE_DEVOPS_PROJECT` — proyecto de **work items**
- `AZURE_DEVOPS_REPO` — repo (operaciones de PR)
- `AZURE_DEVOPS_TOKEN` — PAT con el mínimo alcance necesario (Work Items read/write, Code read)

**El repo puede vivir en un proyecto distinto al de work items.** §8 del perfil declara ambos
("Proyecto (work items)" y "Proyecto (repos)"); para las URLs de PR usar el de repos.

Si faltan, indicarle al usuario que las configure él (no pegarlas en el chat), por ejemplo a nivel
usuario en Windows: `[Environment]::SetEnvironmentVariable("AZURE_DEVOPS_TOKEN","<token>","User")`
o `setx AZURE_DEVOPS_TOKEN <token>`; en bash, un `.env` incluido en `.gitignore`. Chequear presencia
sin imprimir: `[ -n "$AZURE_DEVOPS_TOKEN" ] && echo "token presente"`.

### Autenticación y convenciones

`Authorization: Basic BASE64(:PAT)` vía `-u ":$AZURE_DEVOPS_TOKEN"`. Todo `curl` con
`--fail --silent --show-error`. No usar `set -x`, ni poner el PAT en la URL. Base:
`https://dev.azure.com/$AZURE_DEVOPS_ORG/<proyecto>`. Proyectos con espacios: URL-encode (`%20`).

Health check (lectura): `curl --fail --silent --show-error -u ":$AZURE_DEVOPS_TOKEN" "https://dev.azure.com/$AZURE_DEVOPS_ORG/_apis/projects?api-version=7.0"`

### Leer un work item

`$expand=all` es **obligatorio**: sin él no vienen `ReproSteps` ni las relaciones.

```bash
curl --fail --silent --show-error -u ":$AZURE_DEVOPS_TOKEN" \
  "https://dev.azure.com/$AZURE_DEVOPS_ORG/<proyecto WI>/_apis/wit/workitems/$WORK_ITEM_ID?api-version=7.0&\$expand=all"
```

Comentarios: `GET …/_apis/wit/workItems/$WORK_ITEM_ID/comments?api-version=7.0-preview.3`.

Campos relevantes → modelo normalizado:

| Campo ADO | Modelo |
|---|---|
| `System.WorkItemType`, `System.Title`, `System.State` | tipo, título, estado |
| `System.Description` | descripción |
| `Microsoft.VSTS.Common.AcceptanceCriteria` | criterios de aceptación |
| `Microsoft.VSTS.TCM.ReproSteps` | pasos para reproducir (Bug) |
| `System.CreatedBy` / `System.AssignedTo` | autor / asignado (§8 puede declarar otro campo como "analista") |
| `System.IterationPath`, `System.Tags` | iteración, etiquetas |
| `relations[]` (`System.LinkTypes.Hierarchy-Reverse` = padre, `-Forward` = hijos, `ArtifactLink` = PR/commit, `AttachedFile`) | padre, hijos, links, adjuntos |
| `multilineFieldsFormat` (**nivel raíz**, no dentro de `fields`) | formato de cada campo |

### ⚠️ En un Bug el cuerpo está en `ReproSteps`, no en `Description`

El formulario de Bug tiene la Descripción **oculta**: el defecto, los pasos y el impacto se cargan en
`repro_steps`, y `description` suele venir vacía o no existir. **Leer y pasar `repro_steps` siempre
que el tipo sea Bug.** Un bug "sin contenido" casi siempre es este error, no un WI mal cargado.

### Tareas hijas

Vienen en las relaciones (MCP o `$expand=all`). Extraer los hijos de tipo Task y reportarlos con el
padre (id, título, estado): la Fase 1 los usa para no duplicar trabajo ya desglosado. Si no hay, decir
"ninguno" explícitamente.

### Imágenes embebidas

Las capturas de un bug suelen venir **dentro** de `repro_steps` o `description`
(`<img src=".../_apis/wit/attachments/...">` o `![](.../_apis/wit/attachments/...)`), no como
adjuntos formales: las tools de adjuntos devuelven vacío. No concluir "sin capturas"; listar cada URL.

### Leer un PR / archivos / diff

```bash
# Detalle
curl --fail --silent --show-error -u ":$AZURE_DEVOPS_TOKEN" \
  "https://dev.azure.com/$AZURE_DEVOPS_ORG/<proyecto repos>/_apis/git/repositories/$AZURE_DEVOPS_REPO/pullrequests/$PR_ID?api-version=7.0"
# Iteraciones (tomar la última) y cambios de esa iteración
curl … ".../pullRequests/$PR_ID/iterations?api-version=7.0"
curl … ".../pullRequests/$PR_ID/iterations/<ultima>/changes?api-version=7.0"
# Threads/comentarios
curl … ".../pullRequests/$PR_ID/threads?api-version=7.0"
# Work items vinculados
curl … ".../pullRequests/$PR_ID/workitems?api-version=7.0"
# Listar activos
curl … ".../_apis/git/repositories/$AZURE_DEVOPS_REPO/pullrequests?searchCriteria.status=active&api-version=7.0"
```

Usar la **última** iteración (no la 1) para ver el estado actual. El diff textual se obtiene mejor con
`git` local: `git fetch origin <origen> <destino>` y `git diff origin/<destino>...origin/<origen>`.

## Formato de los campos: HTML o Markdown

`System.Description`, `AcceptanceCriteria` y `ReproSteps` tienen **cada uno su formato**, fijado por
campo y por work item: en un mismo WI puede haber uno de cada uno. **Pasar un campo de HTML a Markdown
es irreversible** para ese work item.

**Cómo saberlo:**
- **MCP:** `devops_get_work_item` devuelve `formats: {description, acceptance_criteria, repro_steps}`
  con `"markdown"`, `"html"` o `null` (campo vacío, sin formato todavía).
- **REST:** `multilineFieldsFormat` en el nivel raíz lista los campos en Markdown; un campo con
  contenido que no figura ahí está en HTML.

**Formato para lo nuevo** (WI nuevo, campo vacío, comentario): el que declare §8 del perfil
(`formato_nuevo`); si no está declarado, **`html`** — evita que otra herramienta del equipo que todavía
escriba HTML deje etiquetas a la vista en un campo Markdown.

**Escribir:**
1. Leer el formato actual de cada campo justo antes (no reutilizar una lectura vieja).
2. `markdown` → contenido Markdown con `format=markdown`; `html` → contenido HTML con `format=html`;
   `null` → formato para lo nuevo.
3. Nunca convertir HTML → Markdown sin pedido explícito, avisando que es irreversible (MCP:
   `convert_to_markdown=true`).
4. `FORMAT_MISMATCH` → no reintentar convirtiendo; mostrar el mensaje y que decida el usuario (el MCP
   no escribió nada).
5. Campos con formatos distintos en la misma escritura → **una llamada por formato** (`format` aplica a
   todos los campos de la llamada).
6. **Siempre `format` explícito**: sin él el MCP guarda el texto tal cual y no detecta un formato
   equivocado.

**Por REST el error no existe** (el PATCH guarda lo que reciba), por eso el paso 1 es obligatorio. El
formato se fija con una operación más en el JSON Patch, solo para poner un campo en Markdown:

```json
{"op": "add", "path": "/multilineFieldsFormat/System.Description", "value": "Markdown"}
```

En el JSON, en HTML las comillas dobles van como `&quot;`; en Markdown se escapan (`\"`) y los saltos
de línea van como `\n`. Por MCP no hace falta escapar.

### Cómo se escribe cada formato

- **Markdown:** `###` secciones, `####` anidado, `**negrita**`, listas con `-`, tablas con `|` sin
  colores (ADO las estiliza), columnas de cantidades alineadas a la derecha (`|---:|`), imágenes
  `![](url)`, bloques de código con triple backtick.
- **HTML:** `<h3>`/`<h4>` **sin estilo propio** (el formulario ya los dimensiona; `<h2>` queda enorme;
  un color de texto fijo no funciona en tema claro y oscuro a la vez), `<strong>`, `<ul>/<li>`,
  `<p>`, `<code>`, tablas como sigue.

### Tablas en HTML

ADO **ignora** `border`, `cellpadding` y `cellspacing`: la tabla se guarda sin error pero se ve sin
líneas y con columnas pegadas. Usar estilos inline **en cada `<th>` y `<td>`**:

```html
<table style="border-collapse:collapse;margin:8px 0;">
  <tr><th style="border:1px solid #BFBFBF;padding:6px 10px;text-align:left;background-color:#1F4E79;color:#FFFFFF;">Columna</th></tr>
  <tr><td style="border:1px solid #BFBFBF;padding:6px 10px;vertical-align:top;">Valor</td></tr>
</table>
```

- Columnas de cantidades: `text-align:right;` en el `<th>` y sus `<td>`.
- Encabezado con fondo propio y texto blanco (`#1F4E79`/`#FFFFFF`, 8,7:1): se lee igual en los dos
  temas porque el bloque controla fondo y texto juntos. **Si se pinta un fondo, fijar también el
  color del texto.** Las filas de datos no se pintan (un blanco explícito haría una isla clara en
  tema oscuro).
- No fijar `font-size` ni colores decorativos. Aplica a descripción, repro, AC y comentarios.

### Comentarios

Cada comentario se guarda en el formato con que se crea (formato para lo nuevo). **Formato y contenido
tienen que coincidir** y la API no avisa si no: Markdown o texto con `\n` guardado como HTML se ve como
párrafo corrido; HTML guardado como Markdown, con etiquetas a la vista.

- **MCP:** `devops_add_comment` con `format` explícito (sin él, se guarda como HTML).
- **REST (siempre HTML):** ruta `_apis/wit/workItems` (con **I** mayúscula) y `api-version` *preview*:

```bash
curl --fail --silent --show-error -u ":$AZURE_DEVOPS_TOKEN" \
  -H "Content-Type: application/json" -d '{"text":"<p>Texto del comentario.</p>"}' \
  "https://dev.azure.com/$AZURE_DEVOPS_ORG/<proyecto WI>/_apis/wit/workItems/$WORK_ITEM_ID/comments?api-version=7.0-preview.3"
```

- Un comentario mal formateado se corrige sin perderlo: `PATCH …/comments/<commentId>` con
  `{"text": "…"}` (escritura: confirmar).
- **Verificar después de publicar en HTML:** contar tags en la respuesta. Cero tags con más de un par
  de líneas de texto = se va a ver mal, aunque haya devuelto 200.

### Crear / actualizar por REST

`POST …/_apis/wit/workitems/$<Tipo>?api-version=7.0` y `PATCH …/_apis/wit/workitems/<id>?api-version=7.0`
con `Content-Type: application/json-patch+json`. Tarea hija: crear la Task con la relación en el mismo
patch:

```json
{"op":"add","path":"/relations/-","value":{"rel":"System.LinkTypes.Hierarchy-Reverse","url":"https://dev.azure.com/<org>/_apis/wit/workItems/<id-padre>"}}
```

Siempre tras el protocolo de confirmación del `SKILL.md`. Nunca `DELETE`.
