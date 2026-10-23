# GitLab — referencia de `sdd-tracker`

Orden de canales: **MCP de GitLab** (si está) → **`glab` CLI** autenticado → **REST v4** con `curl` y
`GITLAB_TOKEN`. Formato de descripciones y notas: **Markdown** (GLFM).

## Autenticación

- `glab auth status` para verificar. Instancias self-hosted: el host sale de §8 del perfil
  (`GITLAB_HOST`).
- REST: `-H "PRIVATE-TOKEN: $GITLAB_TOKEN"`; token con alcance mínimo (`read_api`; `api` solo si se
  van a hacer escrituras confirmadas). El proyecto se identifica por ID o por path URL-encoded
  (`grupo%2Fproyecto`).

## Issues

| Operación | `glab` | Tipo |
|---|---|---|
| leer | `glab issue view <n> -R <grupo/proy> --comments` · `glab api projects/:id/issues/<n>` (JSON) | lectura |
| buscar | `glab issue list -R <g/p> --search "<texto>"` · `--assignee=@me` | lectura |
| crear | `glab issue create -R <g/p> --title "<t>" --description "<md>" --label <l>` | **escritura** |
| actualizar | `glab issue update <n> -R <g/p> --title … --description … --label …` | **escritura** |
| comentar | `glab issue note <n> -R <g/p> -m "<md>"` | **escritura** |

**Nunca** `glab issue delete`.

**Mapeo:** tipo por `issue_type` (`issue`, `incident`, `task`) y labels; AC como sección de la
descripción o checklist; padre/hijos con **tasks** hijas y *linked items*
(`glab api projects/:id/issues/<n>/links`) o epics (Premium); adjuntos embebidos como `![](/uploads/…)`.
Notas de sistema (`system: true`) no son comentarios humanos: separarlas.

**Crear hija:** `glab issue create … ` con tipo `task` y luego
`glab api -X POST projects/:id/issues/<padre>/links -f target_project_id=<id> -f target_issue_iid=<hija>`
(o la relación padre/tarea si la instancia la expone). Confirmar ambas juntas.

## Merge Requests (solo lectura)

```bash
glab mr view <n> -R <g/p> --comments
glab mr diff <n> -R <g/p>
glab api projects/:id/merge_requests/<n>/changes        # archivos + diff por archivo
glab api projects/:id/merge_requests/<n>/discussions    # threads inline
glab api projects/:id/merge_requests/<n>/closes_issues  # issues vinculados
glab mr list -R <g/p> --source-branch <rama>
```

**Nunca:** `glab mr create|merge|approve|close`, `git push`.

## REST equivalente

Base `https://<host>/api/v4`: `GET /projects/:id/issues/:iid`, `/issues/:iid/notes`,
`/merge_requests/:iid`, `/merge_requests/:iid/changes` (o `/diffs`);
`POST /projects/:id/issues`, `PUT /projects/:id/issues/:iid`, `POST /issues/:iid/notes` (escrituras).
