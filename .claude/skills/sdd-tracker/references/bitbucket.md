# Bitbucket — referencia de `sdd-tracker`

Bitbucket se usa como **host del repo** (PRs, ramas, archivos); el tracker suele ser Jira (ver
`jira.md`). Hay dos variantes con APIs distintas — §8 del perfil declara cuál y la URL base:

| Variante | Base | Auth |
|---|---|---|
| **Cloud** | `https://api.bitbucket.org/2.0` · workspace + repo slug | `-H "Authorization: Bearer $BITBUCKET_TOKEN"` (access token) o `-u "$BITBUCKET_USER:$BITBUCKET_APP_PASSWORD"` |
| **Data Center / Server** | `https://<host>/rest/api/1.0` · project key + repo slug | `-H "Authorization: Bearer $BITBUCKET_TOKEN"` (HTTP access token) |

`BITBUCKET_BASE_URL`, proyecto/workspace y repo salen de §8 o de `git remote get-url origin`; nunca
hardcodearlos. El token se lee de variable de entorno de usuario (no hace falta `.env`); si falta, que
el usuario la configure (p. ej. `setx BITBUCKET_TOKEN <token>` en Windows) — nunca pegarlo en el chat.

## Convenciones

- Canal: MCP de Bitbucket si está en la sesión → CLI oficial ya instalado → `curl`. Con `curl`:
  `--fail --silent --show-error`; no armar scripts Python/Node ni pipear a `json.tool`.
- Si el repo ya está clonado, **preferir `git` local** para archivos, ramas, commits y diffs
  (`git fetch` es lectura). La API solo para lo que no está local (metadata y comentarios del PR).

## Lectura — Data Center (`/rest/api/1.0/projects/{P}/repos/{r}`)

| Qué | Endpoint |
|---|---|
| Ramas | `GET …/branches?limit=25` |
| Commits | `GET …/commits?limit=10` (`&until=<rama>`) |
| Archivo | `GET …/raw/{ruta}?at=refs/heads/{rama}` |
| PRs | `GET …/pull-requests?state=OPEN` |
| PR | `GET …/pull-requests/{id}` |
| Archivos del PR | `GET …/pull-requests/{id}/changes` |
| Diff del PR | `GET …/pull-requests/{id}.diff` (o `…/diff` en JSON) |
| Comentarios / actividad | `GET …/pull-requests/{id}/activities` |
| Issues de Jira vinculados | `GET /rest/jira/1.0/projects/{P}/repos/{r}/pull-requests/{id}/issues` |

## Lectura — Cloud (`/2.0/repositories/{ws}/{r}`)

| Qué | Endpoint |
|---|---|
| Ramas | `GET …/refs/branches` |
| Commits | `GET …/commits/{rama}` |
| Archivo | `GET …/src/{rama}/{ruta}` |
| PRs | `GET …/pullrequests?state=OPEN` |
| PR | `GET …/pullrequests/{id}` |
| Archivos del PR | `GET …/pullrequests/{id}/diffstat` |
| Diff del PR | `GET …/pullrequests/{id}/diff` |
| Comentarios | `GET …/pullrequests/{id}/comments` |

Bitbucket Cloud también tiene *issues* propios (`…/issues/{id}`, Markdown): si §8 los declara como
tracker, se leen ahí con el mismo modelo normalizado.

## Escritura

Comentar un PR (`POST …/pull-requests/{id}/comments` / `…/pullrequests/{id}/comments`, Markdown) solo
si el consumidor lo pide y con confirmación. **Nunca:** crear PR, mergear (`…/merge`), aprobar
(`…/approve`), declinar, borrar ramas, `git push`. Si el usuario lo pide, dejarle el link o el comando.
