# Linear — referencia de `sdd-tracker`

Orden de canales: **MCP de Linear** (si está en la sesión; tools tipo `get_issue`, `list_issues`,
`create_issue`, `update_issue`, `create_comment`) → **API GraphQL** con `curl`. No hay CLI oficial que
asumir.

Linear es solo tracker: el host del repo (normalmente GitHub o GitLab) se resuelve aparte con §8.

## Autenticación (GraphQL)

`POST https://api.linear.app/graphql` con `-H "Authorization: $LINEAR_API_KEY"` (API key personal,
sin `Bearer`) y `Content-Type: application/json`. Nunca imprimir la key.

## Formato

Descripciones y comentarios en **Markdown**. Imágenes como `![](https://uploads.linear.app/…)`.

## Lectura

```graphql
query($id: String!) {
  issue(id: $id) {               # acepta el identificador "TEAM-123"
    identifier title description url priority
    state { name } creator { name } assignee { name }
    cycle { number name } labels { nodes { name } }
    parent { identifier title }
    children { nodes { identifier title state { name } } }
    relations { nodes { type relatedIssue { identifier title } } }
    attachments { nodes { title url } }     # incluye PRs vinculados de GitHub/GitLab
    comments { nodes { body createdAt user { name } } }
  }
}
```

Búsqueda: `issues(filter: {…})` o `searchIssues(term: "…")`. **AC:** no hay campo; sección de la
descripción o checklist.

## Escritura (con confirmación)

- Crear: `issueCreate(input: {teamId, title, description, parentId?, labelIds?})`.
- Actualizar: `issueUpdate(id, input: {…})`.
- Comentar: `commentCreate(input: {issueId, body})`.
- Relacionar: `issueRelationCreate(input: {issueId, relatedIssueId, type})`.
- **Crear hija:** `issueCreate` con `parentId` del padre (una sola escritura).

**Nunca** `issueDelete`, `issueArchive`, `commentDelete`.

## PRs

Linear no aloja código: los PRs vinculados aparecen en `attachments`; leerlos con la referencia del
host (`github.md`, `gitlab.md`).
