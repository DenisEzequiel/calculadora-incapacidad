# Tracker `local` — referencia de `sdd-tracker`

Con `tracker: local` en §8 del perfil, **no hay sistema externo**: la User Story o el Bug vive en
`<ruta_specs>/<id>-<slug>/spec.md` (`ruta_specs` del frontmatter del perfil; por defecto
`docs/specs`), con la forma de la plantilla del orquestador `sdd` (`assets/spec.template.md`).

## Identificación

- `<id>`: correlativo o el que defina §8 (p. ej. `US-012`); si no hay convención, solo `<slug>`.
- Buscar por id, slug o keywords: `docs/specs/*/spec.md` y su frontmatter (`id`, `tipo`, eje de §6,
  `keywords`).

## Mapeo al modelo normalizado

| Modelo | En el `spec.md` |
|---|---|
| id, tipo | frontmatter `id`, `tipo` |
| título | `# Spec: <título>` |
| estado | `- **Estado:**` (Draft / En implementación / Verificado) |
| descripción | `## Contexto (por qué)` (incluye Como/Quiero/Para, o actual/esperado/pasos en un bug) |
| AC | `## Criterios de aceptación (contrato)` — bloques `AC-n` en Gherkin |
| autor / fecha | `git log --follow --format='%an %ad' --date=short -- <spec.md>` (primer commit = autor) |
| asignado, iteración | `N/A (local)` salvo que el spec lo declare |
| hijos / tareas | archivos hermanos en la carpeta (`plan.md`, `tasks.md`) o sección de tareas |
| comentarios | `## Definiciones acordadas y preguntas abiertas` |
| adjuntos | archivos en la carpeta del spec (imágenes, anexos) |
| formato | Markdown |

## Escritura

Crear o editar el `spec.md` es la escritura: se muestra el contenido o el diff exacto y se espera el
sí explícito, igual que en un tracker externo. Nunca borrar specs ni carpetas.

## PRs y diffs

Con tracker local el host del repo puede igual existir (GitHub, GitLab, Bitbucket, Azure Repos): se
resuelve por §8 o `git remote`. Sin host remoto, `diff-rama` es `git diff <base>...<rama>` y no hay
`leer-pr`.
