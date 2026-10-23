# GitHub — referencia de `sdd-tracker`

Orden de canales: **MCP de GitHub** (si está en la sesión) → **`gh` CLI** autenticado → **REST** con
`curl` y `GITHUB_TOKEN`. Formato de todos los cuerpos y comentarios: **Markdown** (GFM).

## Autenticación

- `gh auth status` para verificar (no muestra el token). Nunca `gh auth token` en la salida.
- REST: `-H "Authorization: Bearer $GITHUB_TOKEN"` con `GITHUB_TOKEN` (o `GH_TOKEN`) en variable de
  entorno; token fine-grained con el mínimo alcance (Issues read/write, Pull requests read, Contents
  read). Si falta, que el usuario lo configure él.
- `owner/repo` sale de §8 del perfil o de `git remote get-url origin`.

## Issues

| Operación | `gh` | Tipo |
|---|---|---|
| leer | `gh issue view <n> --repo <o/r> --json number,title,body,state,author,assignees,labels,milestone,comments,url,createdAt` | lectura |
| buscar | `gh issue list --repo <o/r> --search "<texto>" --state all` · `--assignee @me` | lectura |
| crear | `gh issue create --repo <o/r> --title "<t>" --body-file <archivo> --label <l>` | **escritura** |
| actualizar | `gh issue edit <n> --repo <o/r> --title … --body-file … --add-label … --add-assignee …` | **escritura** |
| comentar | `gh issue comment <n> --repo <o/r> --body-file <archivo>` | **escritura** |
| cambiar estado | `gh issue close|reopen <n>` (cerrar no es borrar, pero es escritura: confirmar) | **escritura** |

Usar `--body-file` con un archivo temporal en el scratchpad para no romper el Markdown con el escape
de la shell. **Nunca** `gh issue delete` ni `gh issue transfer`.

**Mapeo al modelo normalizado:**
- Tipo: issue type (si la org los usa) o labels (`bug`, `feature`, `enhancement`…) según §8.
- **AC:** no hay campo. Buscar en `body` una sección `## Criterios de aceptación` / `Acceptance
  criteria` o una checklist `- [ ]`. Informar de dónde salieron.
- Bug: actual/esperado/pasos suelen ser secciones del body (o de un issue form); mapearlas.
- Padre/hijos: **sub-issues** (`gh api repos/<o/r>/issues/<n>/sub_issues`; padre en
  `…/issues/<n>/parent` si la API lo expone) y task lists que referencian `#n`. Si no hay, "ninguno".
- Links: referencias cruzadas en la timeline (`gh api repos/<o/r>/issues/<n>/timeline`), PRs que
  dicen `Closes #n`.
- Adjuntos/imágenes: vienen embebidos en el body como `![](https://github.com/user-attachments/…)`;
  listarlos.

**Crear hija:** crear el issue y luego vincularlo como sub-issue
(`gh api -X POST repos/<o/r>/issues/<padre>/sub_issues -f sub_issue_id=<id numérico, no el número>`),
o, si la org no usa sub-issues, agregar `- [ ] #<hija>` al body del padre. Ambas escrituras se muestran
y confirman juntas.

## Pull Requests (solo lectura)

```bash
gh pr view <n> --repo <o/r> --json number,title,body,author,state,isDraft,baseRefName,headRefName,files,reviews,comments,closingIssuesReferences,url
gh pr diff <n> --repo <o/r>                 # diff completo
gh pr diff <n> --repo <o/r> --name-only     # solo archivos
gh api repos/<o/r>/pulls/<n>/comments       # comentarios de revisión inline (archivo:línea)
gh pr list --repo <o/r> --state open --head <rama>
```

**Nunca:** `gh pr create|merge|close|review --approve|--request-changes`, `gh pr ready`, `git push`.
Comentar un PR (`gh pr comment`) solo si el consumidor lo pide explícitamente y con confirmación.

## REST equivalente (si no hay `gh`)

Base `https://api.github.com`, headers `Accept: application/vnd.github+json` y
`X-GitHub-Api-Version: 2022-11-28`:
`GET /repos/{o}/{r}/issues/{n}`, `/issues/{n}/comments`, `/pulls/{n}`, `/pulls/{n}/files`,
`GET /repos/{o}/{r}/pulls/{n}` con `Accept: application/vnd.github.diff` para el diff;
`POST /repos/{o}/{r}/issues`, `PATCH /repos/{o}/{r}/issues/{n}`, `POST /issues/{n}/comments` (escrituras).

## Verificación post-escritura

Releer con `gh issue view` y confirmar que el body se renderiza como Markdown (sin `\n` literales ni
HTML escapado).
