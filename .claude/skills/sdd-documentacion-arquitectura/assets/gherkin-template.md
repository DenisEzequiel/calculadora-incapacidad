# language: es

# Plantilla Gherkin para documentar comportamiento existente
#
# Convención de archivo: docs/conceptos/<concepto>/<concepto>.feature
#   (si el proyecto ya tiene una carpeta de features ejecutables —§5 del perfil—, respetar esa)
#
# Reglas de redacción:
# - Nombrar escenarios desde el negocio, no desde el código
#   ("Pago aprobado de un pedido pendiente" en vez de "processPayment devuelve true")
# - Dado     = estado previo de las entidades del dominio (estado, monto, rol del usuario, flags)
# - Cuando   = la acción de negocio (confirmar el pedido, recibir el webhook, correr el job nocturno)
# - Entonces = el estado resultante, la respuesta observable o el mensaje emitido
# - No incluir nombres de funciones, clases ni rutas en el texto de los pasos
# - Usar "Esquema del escenario" cuando la misma regla aplica a varios estados o tipos
# - Vocabulario de §9 del perfil
# - Acompañar el .feature con la sección de implementación de abajo (archivo:línea por escenario)

Característica: <Nombre del módulo o comportamiento>
  Como <rol de negocio: cliente / operador / sistema externo>
  Quiero <acción>
  Para <objetivo de negocio>

  Antecedentes:
    Dado <precondición común a todos los escenarios>
    Y <otra precondición>

  Escenario: <nombre descriptivo del caso feliz>
    Dado un pedido en estado "pendiente" con total 1000
    Y un medio de pago válido asociado al cliente
    Cuando el cliente confirma el pago
    Entonces el pedido queda en estado "pagado"
    Y se emite la notificación de pago confirmado

  Escenario: <nombre del caso alternativo>
    Dado un pedido en estado "pendiente"
    Y el medio de pago está vencido
    Cuando el cliente confirma el pago
    Entonces el pedido sigue en estado "pendiente"
    Y el cliente ve el mensaje "El medio de pago está vencido"

  Esquema del escenario: <casos parametrizados por estado>
    Dado un pedido en estado "<estado>" con total <total>
    Cuando el cliente confirma el pago
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | estado    | total | resultado  |
      | pendiente | 1000  | pagado     |
      | cancelado | 1000  | rechazado  |
      | pagado    | 1000  | sin cambio |

# ---------------------------------------------------------------------------
# Implementación de cada escenario
#
# Ligar cada escenario al código que lo implementa (y al test que lo cubre, si existe):
#
# - "Pago aprobado de un pedido pendiente" →
#     src/<ruta>/<archivo>.<ext>:NN  (función que aplica la regla)
#     test: tests/<ruta>/<archivo>.<ext>:NN  |  sin test
#
# - "Medio de pago vencido" →
#     src/<ruta>/<archivo>.<ext>:NN
#     test: sin test  ← candidato para sdd-tests
