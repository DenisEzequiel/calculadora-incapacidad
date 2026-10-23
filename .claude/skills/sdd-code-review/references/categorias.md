# Catálogo de categorías de review (agnóstico de stack)

Checklist de **qué mirar** en cada categoría del Step 3 de `sdd-code-review`. No es un estándar del
equipo: todo lo que sale de acá se reporta con `rule_source: general`, salvo que una fuente de §7 del
perfil lo respalde (entonces se cita esa fuente y `rule_source: team`).

**Reglas de uso**

- Si el linter/formatter/typecheck del repo ya cubre el ítem (regla activa en su config), **no se
  reporta a mano**.
- Los ejemplos por stack son orientativos. Solo se aplican los del stack declarado en §1 del perfil.
- La severidad por defecto se ajusta con el criterio de severidad del SKILL.md (regla escrita →
  BLOQUEANTE; criterio propio → WARNING). Los marcados **(SB)** son "siempre bloqueantes" cuando hay
  evidencia completa en el diff.
- Si la evidencia es parcial, bajar `confidence` a MEDIUM/LOW; no subir la severidad por sospecha.

---

## [CORR] Correctitud

| Qué buscar | Ejemplos | Severidad por defecto |
|---|---|---|
| Condición invertida o incompleta | `if (!isValid) save()`; `>` en vez de `>=` en un límite | **(SB)** si el diff lo demuestra |
| Null/undefined/None no contemplado | acceso a `user.address.city` con `address` opcional; `Optional.get()` sin chequeo | (SB) si el null es garantizado en algún camino visible; si no, WARNING |
| Off-by-one, rangos, paginación | `for i in range(len(x)+1)`; `slice(0, n-1)` | según evidencia |
| Casos borde | colección vacía, cero, negativos, strings vacíos, zonas horarias, DST, redondeo de dinero con float | WARNING (BLOQUEANTE si hay pérdida de dinero/datos) |
| Comparaciones incorrectas | `==` vs `===`; comparar objetos por referencia; `is` vs `==` en Python | según impacto |
| Mutación inesperada | mutar argumentos o estado compartido; `sort()` in-place sobre props | WARNING |
| Pérdida de datos | `DELETE`/`UPDATE` sin `WHERE`; sobrescribir sin merge | **(SB)** |
| Código muerto / inalcanzable | ramas tras `return`; flags siempre `true` | WARNING |
| Contrato roto | cambiar firma/tipo de retorno de una función exportada sin actualizar llamadores del diff | BLOQUEANTE si rompe compilación/uso visible |

## [ERR] Manejo de errores

| Qué buscar | Ejemplos |
|---|---|
| Error silenciado | `catch (e) {}`; `except: pass`; `_ = err` en Go; `rescue nil` |
| Promesa flotante | llamada async sin `await` ni `.catch`; `forEach(async …)` |
| Error que devuelve éxito | `catch { return true }`; HTTP 200 con cuerpo de error |
| Excepción genérica | `catch (Exception e)` / `except Exception` que oculta errores de programación |
| Filtración de internos | stack trace o mensaje de DB devuelto al cliente |
| Recursos sin liberar | archivos/conexiones sin `finally`/`using`/`with`/`defer`/try-with-resources |
| Reintentos sin límite ni backoff | loops `while(true)` de retry |
| Errores sin contexto | relanzar sin causa (`throw new Error("fail")` perdiendo `cause`) |

## [SEC] Seguridad (OWASP Top 10 como guía)

| Qué buscar | Ejemplos | Severidad |
|---|---|---|
| **A03 Inyección** | SQL concatenado (`"… WHERE id=" + id`, f-strings en `execute`), `exec`/`child_process` con input, `eval`, plantillas con input sin escapar, NoSQL con objetos del request (`{ $where: … }`) | **(SB)** |
| **XSS** | `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, `{{{ }}}`, `|safe`, `Html.Raw` con datos del usuario | **(SB)** |
| **Secretos** | API keys, passwords, tokens, connection strings, claves privadas en código, tests, config versionada, `.env` commiteado | **(SB)** |
| **A01 Autorización** | endpoint nuevo sin chequeo de permisos; IDOR (buscar por id sin validar dueño); chequeo solo en el frontend | **(SB)** si el bypass es visible; si no, WARNING con confidence MEDIUM |
| **A07 Autenticación** | comparación de secretos no constante; sesiones sin expiración; JWT sin verificar firma/`alg` | (SB) |
| **Validación de entrada** | input del request usado sin validar tipo/rango/longitud en la frontera (sin schema: zod, pydantic, Bean Validation, FluentValidation…) | WARNING; BLOQUEANTE si alimenta una operación sensible |
| **A10 SSRF** | `fetch(req.query.url)`, webhooks/URLs configurables por el usuario sin allowlist | (SB) |
| **A08 Deserialización insegura** | `pickle.loads`, `yaml.load` sin SafeLoader, `BinaryFormatter`, `ObjectInputStream` con datos externos | (SB) |
| **Path traversal** | rutas de archivo armadas con input (`path.join(base, req.params.name)` sin normalizar/validar) | (SB) |
| **A02 Criptografía** | MD5/SHA1 para passwords, cifrado casero, IV fijo, `Math.random()` para tokens | BLOQUEANTE |
| **A05 Configuración** | CORS `*` con credenciales, CSP desactivada, debug activado en prod, cookies sin `HttpOnly`/`Secure`/`SameSite` | WARNING / BLOQUEANTE según estándar |
| **A06 Componentes vulnerables** | dependencia nueva con CVE conocido declarado en el advisory del ecosistema | ver [DEP] |
| **CI/CD** | `pull_request_target` con checkout del código del PR, permisos `write-all`, secretos impresos | (SB) |

## [PERF] Performance

| Qué buscar | Ejemplos |
|---|---|
| N+1 | query dentro de un loop; lazy loading en serialización de listas; resolver GraphQL sin dataloader |
| Query sin índice | filtro/orden por columna sin índice en el esquema visible; `LIKE '%x'` sobre tablas grandes |
| Carga sin paginar | `findAll()`, `SELECT *` sin `LIMIT` en endpoints de listado |
| Trabajo pesado en el hilo equivocado | I/O sincrónico en el event loop; cómputo pesado en el hilo de UI mobile |
| Renders innecesarios (UI) | objetos/funciones nuevas como props en cada render, dependencias de `useEffect`/`useMemo` incorrectas, listas sin `key` estable o con índice como key en listas reordenables, suscripción a todo el store |
| I/O en loops | requests HTTP secuenciales que podrían ir en lote |
| Algoritmos | O(n²) sobre colecciones potencialmente grandes; `includes` dentro de `filter` |
| Recursos | listeners/timers/suscripciones sin limpiar (leaks) |

Sin evidencia de volumen, los hallazgos de performance son WARNING con confidence MEDIUM.

## [CONC] Concurrencia

| Qué buscar | Ejemplos |
|---|---|
| Race condition | check-then-act (`if (!exists) create()`) sin lock/constraint único |
| Estado compartido mutable | variables de módulo/singletons mutados por requests concurrentes |
| Transacciones | alcance demasiado amplio (I/O externo dentro de la transacción) o inexistente donde hay varias escrituras |
| Idempotencia | handlers de colas/webhooks/reintentos que duplican efectos |
| Deadlocks | locks tomados en distinto orden; `await` dentro de un lock no reentrante |
| Primitivas no thread-safe | colecciones no concurrentes compartidas; `SimpleDateFormat` compartido |

## [TEST] Tests

- Política de §5 manda (`obligatorios` → falta de test es BLOQUEANTE con fuente §5; `opcional` →
  WARNING; `no_se_escriben` → N/A).
- Ubicación y naming según §5.
- Asserts reales (no tests que solo invocan sin verificar; no `expect(true).toBe(true)`).
- Sin `skip`/`only`/`xit`/`@Disabled`/`pytest.mark.skip` nuevos sin justificación.
- Sin dependencia de red real, reloj real, orden de ejecución o datos compartidos entre tests.
- Dobles de prueba según §5 (no mockear lo que el equipo decidió no mockear).
- Snapshots gigantes que nadie revisa → WARNING.

## [NAME] Legibilidad y naming

- Convenciones de §4/§7 y del código vecino (casing, prefijos/sufijos, estructura de carpetas).
- Nombres que expresan intención; sin abreviaturas crípticas; booleanos como predicados.
- Funciones largas o con demasiados parámetros (umbral: el del linter si existe; si no, solo DEUDA).
- Valores mágicos → constante o config (si es parámetro de negocio, ver [CLASIF]).
- Comentarios que contradicen el código; código comentado.
- TODO/FIXME nuevos sin ticket si el estándar lo exige.

## [LOG] Logging

- Logger del proyecto (el declarado en §4/§7), no `print`, `console.log`, `System.out.println`,
  `fmt.Println`, `var_dump`, `puts`, `debugger` de debug olvidados.
- **Datos sensibles en logs (SB):** passwords, tokens, API keys, headers `Authorization`, cookies de
  sesión, números de tarjeta, documentos de identidad, PII completa (email, teléfono, dirección)
  salvo que el estándar permita enmascarado.
- Nivel adecuado (no `error` para flujo normal; no `debug` para fallos).
- Contexto suficiente (ids de correlación/entidad) y logs estructurados si el estándar lo exige.
- Errores logueados **y** relanzados en cada capa (ruido) → WARNING.

## [DEP] Dependencias nuevas

- Listar toda dependencia agregada, removida o con salto de versión mayor.
- ¿Se usa en el diff? ¿Duplica una existente para lo mismo?
- ¿El lockfile acompaña el cambio del manifiesto?
- ¿Dev vs prod correctamente declarada?
- Licencia / mantenimiento / advisories si el estándar lo pide (citar la fuente que se consultó; no
  inventar CVEs).
- Nunca instalar ni actualizar para verificar.

## [MIG] Migraciones y esquemas

- Reversible (`down`/rollback) o justificación explícita de por qué no.
- Compatible con la versión desplegada (expand/contract): no borrar/renombrar columnas usadas por el
  código actual en el mismo release.
- `NOT NULL` sin default sobre tabla con datos; cambios de tipo con pérdida.
- Índices sobre tablas grandes sin opción no bloqueante cuando el motor la tiene.
- Data migrations idempotentes y por lotes.
- Editar una migración ya aplicada → [ZONA-VEDADA] (SB).
- Esquema y modelo/ORM consistentes en el mismo diff.

## [ZONA-VEDADA] Zonas vedadas (§3)

- Código generado, vendorizado, migraciones aplicadas, contratos públicos, auth/seguridad/pagos y lo
  que §3 agregue. BLOQUEANTE salvo confirmación del usuario en la conversación, registrada con fecha
  absoluta.
- Contratos públicos: además, compatibilidad hacia atrás (campos removidos, tipos cambiados, enums
  reducidos, endpoints renombrados sin versionar).

## [CLASIF] Clasificación (§2)

- Algo que §2 declara como feature flag, config/env, CMS, parámetro de negocio, i18n o IaC de otro
  equipo, implementado en código → BLOQUEANTE.
- Valores por ambiente hardcodeados (URLs, hosts, buckets, IDs de cuenta).

## [A11Y] Accesibilidad (solo si hay UI)

- Semántica: `button`/`a` en vez de `div`/`span` clickeables; headings en orden.
- Teclado: foco alcanzable y visible; sin trampas de foco; modales que devuelven el foco.
- Nombres accesibles: `alt` en imágenes informativas (vacío en decorativas), `label` en inputs,
  `aria-label` en botones de solo ícono.
- ARIA correcto y no redundante; `aria-live` para contenido dinámico relevante.
- Contraste y estados (`:focus-visible`, disabled) si el diff toca estilos.
- Mobile: `accessibilityLabel`/`accessibilityRole` (React Native), `contentDescription` (Android),
  `accessibilityLabel` (iOS); tamaños táctiles mínimos.

## [I18N] Internacionalización (solo si el proyecto declara i18n)

- Textos visibles hardcodeados en vez de claves.
- Claves nuevas presentes en todos los idiomas declarados.
- Sin concatenar fragmentos traducidos; usar interpolación/plurales del framework de i18n.
- Fechas, números y monedas con el formateador de locale, no a mano.
- Layout que no asume longitud de texto ni dirección LTR si se soporta RTL.

## [STANDARDS-CONFLICT] Conflicto entre fuentes

- Dos fuentes del equipo que dicen cosas incompatibles sobre lo que toca el diff → WARNING citando
  ambas; el reviewer no elige en silencio. Candidato para `sdd-retrospectiva`.
