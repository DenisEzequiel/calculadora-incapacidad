---
id: <BR-<EJE>-<nnn>, p. ej. BR-FACT-001 — último ID obtenido con Grep "^id: BR-<EJE>-">
eje: <valor del eje primario de §6 del perfil (modulo | dominio | servicio | feature), o "transversal">
dominio: <facturacion, autenticacion, inventario, ... (coma-separado)>
entidades: [<entidades/modelos involucrados, nombres reales del repo>]
artefactos: [<módulo/clase/endpoint/config que la implementa, nombres o rutas reales>]
keywords: [<términos de negocio (§9 del perfil) con que alguien buscaría esta regla>]
---

# Regla de negocio: <Título>

Origen: <WI id> — <link al tracker (§8) si aplica>
Fecha: <AAAA-MM-DD>
Módulo/Dominio: <valor del eje de §6>

---

## Regla

<Enunciado de la regla en UNA línea, en lenguaje de negocio: qué debe cumplirse, no cómo se implementa.>

Detalle adicional si hace falta.

---

## Condiciones / excepciones

- ...

---

## Dónde se aplica

Componente(s) técnico(s) que la implementan (módulo/clase/endpoint/config), solo para
trazabilidad — no repetir acá la lógica de negocio ni el código.

---

## Notas

Casos borde, vigencia, o diferencias por segmento/región/canal si corresponde.
