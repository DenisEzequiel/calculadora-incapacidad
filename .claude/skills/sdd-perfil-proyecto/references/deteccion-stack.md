# Detección de stack y convenciones de test

Se usa en el **PASO 0** (generar el perfil por evidencia) y en la **Fase 4** (escribir tests con la
convención correcta). **Regla:** todo lo que va al perfil sale de un archivo que abriste, citado como
`archivo:línea`. Lo que no se encuentra queda `<A CONFIRMAR>`.

## 1. Orden de lectura (barato → caro)

1. `CLAUDE.md`, `AGENTS.md`, `README*`, `CONTRIBUTING.md` — suelen declarar comandos y convenciones.
2. Manifiestos y lockfiles en la raíz (tabla 2). En monorepos, también el del workspace y los de cada
   paquete (`pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `lerna.json`, `go.work`, `*.sln`).
3. Config de tests (tabla 3) y un **test existente real** para copiar estilo, ubicación y naming.
4. CI: `.github/workflows/*.yml`, `azure-pipelines*.yml`, `.gitlab-ci.yml`, `Jenkinsfile`,
   `bitbucket-pipelines.yml` — **el comando que corre CI es el comando de test real**.
5. Linters/formatters: `eslint.config.*`, `.eslintrc*`, `.prettierrc*`, `biome.json`, `ruff.toml`,
   `pyproject.toml [tool.ruff]`, `.editorconfig`, `checkstyle.xml`, `.golangci.yml`, `.rubocop.yml`.
6. Estructura: `ls` de la raíz y de `src/` (o equivalente), 1-2 niveles. No recorrer el árbol entero.
7. Docs: `Glob` sobre `docs/**/*.md` (solo nombres) para llenar §7.

**No leer** `node_modules/`, `vendor/`, `dist/`, `build/`, `.venv/`, `target/`, `bin/`, `obj/`.

## 2. Manifiestos → lenguaje / framework

| Archivo | Ecosistema | Dónde mirar el framework y los comandos |
|---|---|---|
| `package.json` | JS/TS (Node) | `dependencies` (react, next, vue, nuxt, svelte, @angular/core, express, @nestjs/core, fastify), `scripts.test/lint/build/typecheck`; gestor por lockfile: `pnpm-lock.yaml`→pnpm, `yarn.lock`→yarn, `bun.lockb`→bun, `package-lock.json`→npm |
| `tsconfig.json` | TypeScript | `strict` → hace falta stub para el rojo legítimo |
| `pyproject.toml`, `requirements*.txt`, `setup.cfg`, `Pipfile`, `uv.lock`, `poetry.lock` | Python | django, fastapi, flask, pandas, airflow, dbt |
| `pom.xml`, `build.gradle(.kts)` | Java/Kotlin | spring-boot, quarkus, micronaut; `mvn test` / `./gradlew test` |
| `*.csproj`, `*.sln`, `global.json` | .NET | ASP.NET Core, Blazor; `dotnet test` |
| `go.mod` | Go | gin, echo, chi; `go test ./...` |
| `Cargo.toml` | Rust | axum, actix; `cargo test` |
| `composer.json` | PHP | laravel, symfony; `vendor/bin/phpunit` / `php artisan test` |
| `Gemfile` | Ruby | rails; `bundle exec rspec` / `bin/rails test` |
| `pubspec.yaml` | Dart/Flutter | `flutter test` |
| `*.tf`, `terragrunt.hcl` | Terraform | `terraform validate`, `terratest`, `tflint` |
| `Chart.yaml`, `kustomization.yaml` | Kubernetes | `helm lint`, `kubeconform` |
| `dbt_project.yml` | dbt | `dbt test` |

**Tipo de proyecto** (§1 `tipo`): inferirlo de la combinación (framework de UI → `web-frontend`;
framework HTTP sin UI → `api`/`web-backend`; ambos → `web-fullstack`; react-native/flutter/
android/ios → `mobile`; dbt/airflow/notebooks → `data`; `bin` en package.json o entrypoint CLI →
`cli`; solo IaC → `infra`; múltiples paquetes → `monorepo`). Ante duda, preguntar.

## 3. Config de tests → framework

| Evidencia | Framework |
|---|---|
| `vitest.config.*` o `vitest` en devDependencies | Vitest |
| `jest.config.*` o `"jest"` en package.json | Jest |
| `playwright.config.*` | Playwright (E2E) |
| `cypress.config.*`, `cypress/` | Cypress (E2E) |
| `@testing-library/*` | Testing Library (componentes) |
| `pytest.ini`, `conftest.py`, `[tool.pytest]` | pytest |
| `junit-jupiter` en pom/gradle | JUnit 5 |
| `xunit`, `nunit`, `MSTest` en csproj | xUnit / NUnit / MSTest |
| `*_test.go` | go test (+ testify si aparece) |
| `spec/`, `.rspec` | RSpec |
| `phpunit.xml*` | PHPUnit (Pest si `pestphp/pest`) |

**Política de tests** (`politica_tests`): la decide el equipo, no el código. Pero la evidencia
orienta la pregunta: ¿CI corre tests? ¿hay umbral de cobertura? ¿cuántos tests hay vs. archivos
fuente? Si casi no hay tests, **preguntar** si se escriben, no asumir `obligatorios`.

## 4. Señales para §2 y §3

- **§2 (no es código):** carpetas `locales/`, `i18n/`, `messages/`; SDKs de feature flags
  (launchdarkly, unleash, flagsmith, growthbook); SDKs de CMS (contentful, sanity, strapi);
  `.env.example` (parámetros por entorno); tablas de parámetros en migraciones.
- **§3 (vedado):** carpetas `generated/`, `__generated__/`, `gen/`, archivos con encabezado
  "DO NOT EDIT" / "auto-generated"; `vendor/`, `third_party/`; `migrations/` existentes; `openapi.*`
  / `*.proto` / `schema.graphql` publicados; `CODEOWNERS` con dueños de seguridad/plataforma.

## 5. Convenciones de test por ecosistema (Fase 4)

Usar **siempre** la del test vecino si difiere de esta tabla: el repo manda.

| Ecosistema | Ubicación habitual | Nombre de test | Stub para rojo legítimo |
|---|---|---|---|
| Vitest / Jest (TS/JS) | `*.test.ts(x)` junto al archivo, o `__tests__/` | `describe('<Sujeto>', () => it('<escenario> → <resultado>'))` | Exportar la función con `throw new Error('not implemented')` |
| Testing Library | junto al componente | `it('muestra <x> cuando <y>')`; consultar por rol/texto (`getByRole`), no por clase CSS | Componente que renderiza `null` |
| Playwright / Cypress | `e2e/`, `tests/e2e/`, `cypress/e2e/` | `test('<usuario> puede <acción>')`; selectores por rol/`data-testid` | Ruta/página vacía |
| pytest | `tests/` espejo de `src/`, `test_*.py` | `test_<sujeto>_<escenario>_<resultado>`; `@pytest.mark.parametrize` para tablas de ejemplos Gherkin | `raise NotImplementedError` |
| JUnit 5 | `src/test/java/...` espejo | `@DisplayName("<escenario> → <resultado>")` + método `<escenario>_<resultado>()` | Método que lanza `UnsupportedOperationException` |
| xUnit / NUnit | proyecto `*.Tests` | `<Metodo>_<Escenario>_<Resultado>` | `throw new NotImplementedException()` |
| go test | `<archivo>_test.go` mismo paquete | `Test<Sujeto>_<Escenario>`; table-driven con `t.Run` | `panic("not implemented")` |
| RSpec | `spec/` espejo | `describe <Clase> / context 'cuando …' / it '…'` | `raise NotImplementedError` |
| PHPUnit / Pest | `tests/Unit`, `tests/Feature` | `test_<escenario>_<resultado>` / `it('…')` | `throw new \LogicException('not implemented')` |
| Terraform | `tests/*.tftest.hcl` o terratest | `run "<escenario>"` con `assert` | N/A (validar plan) |

### Mapeo Gherkin → test

- `Given` → arrange (fixtures, factories, mocks, reloj fijo).
- `When` → act (una sola acción: llamada, request, click).
- `Then` → assert (sobre lo observable: retorno, response, texto en pantalla, fila en DB de test).
- `Scenario Outline` + `Examples` → test parametrizado / table-driven.
- El comentario o el `describe` referencia el AC: `// AC-3 — ver spec docs/specs/123-alta-usuario/spec.md`.

## 6. Auditoría — contradicciones perfil vs. repo

Checklist del modo auditoría. Cada fila es una contradicción **verificable**: se reporta con la
evidencia de los dos lados (`perfil §N` vs. `archivo:línea`).

| Qué declara el perfil | Contra qué se contrasta | Contradicción típica |
|---|---|---|
| `lenguajes` / `frameworks` (§1) | Manifiestos (tabla 2) | Declara `express` y `package.json` tiene `@nestjs/core`; declara Python 3.9 y `pyproject.toml` exige `>=3.12` |
| `rama_base` (§1) | `git symbolic-ref refs/remotes/origin/HEAD`, triggers de CI | Declara `develop` y CI solo dispara en `main` |
| `framework_tests_*` (§5) | Config de tests (tabla 3) + tests reales | Declara Jest y hay `vitest.config.ts`; declara Cypress y solo existe `playwright.config.ts` |
| `comando_test` / `comando_lint` / `comando_build` | `scripts` del manifiesto, `Makefile`, CI | El script no existe o CI corre otro comando (CI manda) |
| Ubicación / naming de tests (§5) | 2-3 tests reales recientes | Declara `tests/` espejo y los tests nuevos están junto al archivo |
| `politica_tests: obligatorios` | CI y conteo de tests | CI no corre tests, o no se agregó ningún test en meses → **señal**, se pregunta, no se corrige solo |
| Rutas de §4 y §7 | `Glob` hoy | Ruta declarada que no existe, o carpeta relevante nueva no declarada |
| Zonas vedadas (§3) | Señales de la sección 4 | Hay `src/generated/` o encabezados "DO NOT EDIT" no listados en §3 |
| Mecanismos de §2 | Dependencias | Declara flags en LaunchDarkly y el SDK no está en las dependencias (o al revés) |
| `tracker` (§8) | `.github/`, `azure-pipelines*.yml`, `.gitlab-ci.yml`, referencias `AB#`/`#123`/`PROJ-123` en commits | Declara Jira y todos los commits referencian `AB#…` |
| `paquetes` (monorepo) | Config del workspace | Paquete nuevo en el workspace no declarado, o declarado y borrado |

**Contaminación de plantilla:** valores que son los ejemplos literales de la plantilla
(`LaunchDarkly`, `Contentful`, `Zustand`, `msw`, `feature/<id>-<slug>`…) sin evidencia en el repo.
Probablemente se copiaron sin verificar: tratarlos como `<A CONFIRMAR>`.

**Contaminación de otro repo:** vocabulario de dominio (§9), rutas o comandos que no aparecen en
ningún archivo de este repo (`Grep` sin resultados). Un perfil copiado de un proyecto hermano es un
caso frecuente.

## 7. Monorepos

- **Detectar:** `pnpm-workspace.yaml`, `workspaces` en `package.json`, `turbo.json`, `nx.json`,
  `lerna.json`, `go.work`, `*.sln` con varios proyectos, `settings.gradle` con `include`, varios
  `pyproject.toml`, carpetas `apps/` + `packages/` o `services/`.
- **Decidir la forma del perfil** (se propone, el usuario elige):
  - **Un perfil con sección por paquete** — cuando comparten tracker, rama, política de tests y CI.
    §1/§2/§3/§6-§9 comunes; §4, §5 y §10 con subsección `### §5.<paquete>` por cada uno que difiera.
  - **Un perfil por paquete** (`<paquete>/docs/standards/perfil-proyecto.md`) + uno raíz mínimo que
    los liste — cuando son equipos, stacks o ciclos de release distintos.
- **Comandos:** preferir el comando filtrado que usa CI (`pnpm --filter <pkg> test`,
  `nx test <pkg>`, `turbo run test --filter=<pkg>`, `dotnet test <proyecto>`, `go test ./<pkg>/...`).
