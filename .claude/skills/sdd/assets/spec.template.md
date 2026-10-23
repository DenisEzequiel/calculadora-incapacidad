---
id: <id-del-work-item>-<slug>   # o solo <slug> si no hay tracker
tipo: <feature | bug | config | no-funcional | refactor | spike>
<eje_descubrimiento>: <valor real según §6 del perfil>   # p. ej. modulo: checkout
paquetes: [<apps/web, apps/api — si es monorepo>]
artefactos: [<rutas, endpoints, componentes, tablas reales tocados>]
keywords: [<términos de negocio con que alguien buscaría esto>]
---

# Spec: <título de la feature>

- **Work item:** <id + link | "solo local">
- **Estado:** Draft | En implementación | Verificado
- **ADR relacionado:** <ruta o N/A>
- **Fecha:** <YYYY-MM-DD>

## Contexto (por qué)

<Problema de negocio que resuelve, en lenguaje funcional con el vocabulario de §9 del perfil.>

<!-- Si el tracker es `local`, este archivo ES la US: incluir acá Como/Quiero/Para (o, en un bug,
     actual / esperado / pasos para reproducir). -->

## Criterios de aceptación (contrato)

### AC-1: <título>

```gherkin
Given ...
When ...
Then ...
```

## Fuera de alcance

- <…>

## Definiciones acordadas y preguntas abiertas

- **D-1:** <decisión> — motivo: <…> — confirmó: <quién>, <YYYY-MM-DD>
- **Preguntas abiertas PENDIENTES (bloquean el DoR):** <lista; mientras existan, el DoR es FAIL>

## Diseño técnico

- **Clasificación:** código | configuración/contenido (§2 del perfil) | mixto
- **Componentes impactados:** <rutas reales, etiquetadas [EXISTE] archivo:línea / [A CREAR] / [A CONFIRMAR]>
- **Contrato de interfaz:** <firmas / endpoints (verbo, ruta, request, response, errores) / props / eventos>
- **Datos:** <migraciones, backfill, compatibilidad hacia atrás — o N/A>
- **Dependencias nuevas:** <paquete@versión + motivo (confirmado por …) — o ninguna>
- **Patrones a aplicar:** <caso análogo del repo a seguir: archivo:línea>
- **Riesgos y edge cases:** <…>
- **Estrategia de testing:** <niveles por AC, dobles de prueba, datos>

## Plan de tareas

- [ ] <tarea 1>

## Trazabilidad AC → test → código (se completa en Fases 4–6)

| AC | Test | Nivel | Código | Estado |
|----|------|-------|--------|--------|
| AC-1 | `<archivo de test> › <nombre del test>` | unit | <archivo:línea> | pendiente |
