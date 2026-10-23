# Jira — referencia de `sdd-tracker`

Orden de canales: **MCP de Atlassian/Jira** (si está en la sesión) → **CLI** ya instalado (`acli jira`,
`jira` de ankitpokhrel) → **REST** con `curl`.

Jira es solo tracker: el host del repo (Bitbucket, GitHub, GitLab) se resuelve aparte con §8 del
perfil y su referencia.

## Autenticación

- **Cloud:** Basic con email + API token: `-u "$JIRA_EMAIL:$JIRA_API_TOKEN"`. Base
  `https://<sitio>.atlassian.net` (`JIRA_BASE_URL`, desde §8 o env).
- **Server / Data Center:** `-H "Authorization: Bearer $JIRA_PAT"`.
- Nunca imprimir las variables; si faltan, que el usuario las configure.

## Formato de los campos

- **Cloud, API v3:** descripción y comentarios en **ADF** (JSON de Atlassian Document Format). Al
  leer, convertir ADF a texto/Markdown legible (párrafos, listas, tablas, `mediaSingle` → `[imagen: …]`).
  Al escribir, armar ADF válido (`{"type":"doc","version":1,"content":[…]}`); el MCP suele aceptar
  Markdown y convertirlo — verificarlo releyendo.
- **API v2 / Server-DC:** **wiki markup** (`h3.`, `*negrita*`, `* item`, `||enc||` / `|celda|`,
  `{code}`). No mandar Markdown a un campo wiki: se ve con los símbolos a la vista.
- Regla general del `SKILL.md`: escribir en el formato que usa la instancia/campo; nunca mezclar.

## Issues

| Operación | REST (Cloud v3; v2 análogo) | Tipo |
|---|---|---|
| leer | `GET /rest/api/3/issue/<KEY>?expand=renderedFields,names` (+ `fields=*all`) | lectura |
| comentarios | `GET /rest/api/3/issue/<KEY>/comment` | lectura |
| buscar | `POST /rest/api/3/search/jql` con `{"jql":"…","fields":[…]}` (en instancias viejas `GET /rest/api/2/search?jql=…`) | lectura |
| campos | `GET /rest/api/3/field` (para encontrar el custom field de AC) | lectura |
| crear | `POST /rest/api/3/issue` | **escritura** |
| actualizar | `PUT /rest/api/3/issue/<KEY>` | **escritura** |
| transición | `GET` y luego `POST /rest/api/3/issue/<KEY>/transitions` | **escritura** |
| comentar | `POST /rest/api/3/issue/<KEY>/comment` | **escritura** |
| enlazar | `POST /rest/api/3/issueLink` | **escritura** |

**Nunca** `DELETE /issue/…`, ni borrar comentarios, links o adjuntos.

**Mapeo:**
- Tipo `issuetype.name`, estado `status.name`, autor `reporter` (o `creator`), asignado `assignee`,
  sprint en el custom field de Sprint, etiquetas `labels` + `components`.
- **AC:** muchos proyectos usan un custom field ("Acceptance Criteria"): buscar su `customfield_XXXXX`
  con `names` o `/field`; §8 puede declararlo. Si no existe, sección de la descripción.
- Padre `parent` (o "Epic Link" en instancias viejas); hijos = subtareas (`subtasks`) y, para epics,
  `jql=parent=<KEY>`.
- Links `issuelinks`; PRs/commits del panel de desarrollo: `GET /rest/dev-status/latest/issue/detail?issueId=<id>&applicationType=<bitbucket|github|gitlab>&dataType=pullrequest` (no oficial: si falla, "N/A").
- Adjuntos `attachment[]`; imágenes embebidas en ADF (`media`) o wiki (`!imagen.png!`).
- `renderedFields` trae HTML ya renderizado: útil para mostrar, no para reescribir.

**Crear hija:** `POST /issue` con `issuetype` = Sub-task (o Task) y `"parent":{"key":"<PADRE>"}`; es
una sola escritura que ya enlaza. Confirmar mostrando el payload.
