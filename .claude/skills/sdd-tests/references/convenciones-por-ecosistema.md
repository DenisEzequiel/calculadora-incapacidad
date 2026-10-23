# Convenciones de test por ecosistema (Fase 4)

Usar **siempre** la del test vecino y la de §5 del perfil si difieren de esta guía: el repo manda.
Los ejemplos son ilustrativos (nombres de dominio inventados para mostrar la forma); nunca copiar
nombres de funciones, factories o rutas de acá sin verificar que existen en el proyecto.

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

## Mapeo Gherkin → test

- `Given` → arrange (fixtures, factories, mocks, reloj fijo).
- `When` → act (una sola acción: llamada, request, click).
- `Then` → assert (sobre lo observable: retorno, response, texto en pantalla, fila en DB de test).
- `Scenario Outline` + `Examples` → test parametrizado / table-driven.
- El comentario o el `describe` referencia el AC: `// AC-3 — ver spec docs/specs/123-alta-usuario/spec.md`.

---

## Ejemplos cortos por framework

### Vitest / Jest

```ts
// src/pedidos/calcularTotal.ts — stub del contrato (modo SDD)
export function calcularTotal(items: Item[], cupon?: string): number {
  throw new Error('not implemented');
}
```

```ts
// src/pedidos/calcularTotal.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'; // Jest: globals / @jest/globals
import { calcularTotal } from './calcularTotal';
import { unItem } from '../../test/factories'; // factory existente del proyecto

// AC-2 — docs/specs/123-descuentos/spec.md
describe('calcularTotal', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-03-01T10:00:00Z')); });
  afterEach(() => vi.useRealTimers());                       // Jest: jest.useFakeTimers / setSystemTime

  it('aplica 10% cuando el cupón está vigente', () => {
    // Given
    const items = [unItem({ precio: 100 })];
    // When
    const total = calcularTotal(items, 'OTONO10');
    // Then
    expect(total).toBe(90);
  });

  // Scenario Outline → parametrizado
  it.each([
    { cantidad: 0, esperado: 0 },
    { cantidad: 3, esperado: 300 },
  ])('con $cantidad unidades devuelve $esperado', ({ cantidad, esperado }) => {
    expect(calcularTotal([unItem({ precio: 100, cantidad })])).toBe(esperado);
  });
});
```

Dobles: `vi.fn()` / `jest.fn()`, `vi.mock('./modulo')`; HTTP con msw. Comando de un archivo:
`pnpm vitest run src/pedidos/calcularTotal.test.ts` · `npx jest src/pedidos/calcularTotal.test.ts -t "cupón"`.

### Testing Library (React)

```tsx
// src/auth/LoginForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

// AC-1 — docs/specs/88-login/spec.md
it('muestra error cuando el email es inválido', async () => {
  // Given
  const user = userEvent.setup();
  render(<LoginForm onSubmit={vi.fn()} />);
  // When
  await user.type(screen.getByRole('textbox', { name: /email/i }), 'no-es-email');
  await user.click(screen.getByRole('button', { name: /ingresar/i }));
  // Then
  expect(await screen.findByRole('alert')).toHaveTextContent(/email inválido/i);
});
```

Stub: `export function LoginForm(_: Props) { return null; }`. Consultar por rol/label/texto;
`findBy*` en vez de esperas fijas.

### Playwright

```ts
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

// AC-4 — docs/specs/150-checkout/spec.md
test('cliente puede pagar un pedido con tarjeta de prueba', async ({ page }) => {
  // Given — datos sembrados por el test / red mockeada
  await page.route('**/api/pagos', r => r.fulfill({ status: 200, json: { estado: 'aprobado' } }));
  await page.goto('/checkout');
  // When
  await page.getByRole('button', { name: 'Pagar' }).click();
  // Then
  await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
});
```

Auto-wait de los locators; nunca `waitForTimeout`. Un archivo: `npx playwright test e2e/checkout.spec.ts`.
Cypress: `cy.intercept`, `cy.findByRole` (si el repo usa `@testing-library/cypress`) o `data-testid`.

### pytest

```python
# src/pedidos/total.py — stub
def calcular_total(items, cupon=None):
    raise NotImplementedError
```

```python
# tests/pedidos/test_total.py
import pytest
from pedidos.total import calcular_total

# AC-2 — docs/specs/123-descuentos/spec.md
@pytest.mark.freeze_time("2026-03-01")   # pytest-freezegun / time-machine, si el repo lo usa
def test_calcular_total_con_cupon_vigente_aplica_descuento(item_factory):
    # Given
    items = [item_factory(precio=100)]
    # When
    total = calcular_total(items, cupon="OTONO10")
    # Then
    assert total == 90

@pytest.mark.parametrize("cantidad, esperado", [(0, 0), (3, 300)])
def test_calcular_total_por_cantidad_devuelve_producto(item_factory, cantidad, esperado):
    assert calcular_total([item_factory(precio=100, cantidad=cantidad)]) == esperado

def test_calcular_total_con_cupon_inexistente_lanza_error(item_factory):
    with pytest.raises(ValueError, match="cupón"):
        calcular_total([item_factory()], cupon="NOEXISTE")
```

Dobles: `monkeypatch`, `unittest.mock`, `responses`/`respx` para HTTP. Un test:
`pytest tests/pedidos/test_total.py::test_calcular_total_con_cupon_vigente_aplica_descuento`.

### JUnit 5

```java
// src/main/java/com/acme/pedidos/CalculadoraTotal.java — stub
public BigDecimal calcular(List<Item> items, String cupon) {
    throw new UnsupportedOperationException("not implemented");
}
```

```java
// src/test/java/com/acme/pedidos/CalculadoraTotalTest.java
class CalculadoraTotalTest {
    private final Clock reloj = Clock.fixed(Instant.parse("2026-03-01T10:00:00Z"), ZoneOffset.UTC);
    private final CalculadoraTotal calculadora = new CalculadoraTotal(reloj);

    // AC-2 — docs/specs/123-descuentos/spec.md
    @Test
    @DisplayName("cupón vigente → aplica 10% de descuento")
    void cuponVigente_aplicaDescuento() {
        // Given
        var items = List.of(ItemMother.conPrecio("100"));
        // When
        var total = calculadora.calcular(items, "OTONO10");
        // Then
        assertThat(total).isEqualByComparingTo("90");   // AssertJ si el repo lo usa; si no, Assertions
    }

    @ParameterizedTest(name = "{0} unidades → {1}")
    @CsvSource({ "0, 0", "3, 300" })
    void porCantidad_devuelveProducto(int cantidad, String esperado) { /* … */ }
}
```

Mocks: Mockito (`@ExtendWith(MockitoExtension.class)`, `@Mock`). Un test:
`./mvnw test -Dtest=CalculadoraTotalTest` · `./gradlew test --tests "*CalculadoraTotalTest"`.

### xUnit (.NET)

```csharp
// stub
public decimal Calcular(IEnumerable<Item> items, string? cupon) => throw new NotImplementedException();
```

```csharp
// tests/Pedidos.Tests/CalculadoraTotalTests.cs
public class CalculadoraTotalTests
{
    // AC-2 — docs/specs/123-descuentos/spec.md
    [Fact]
    public void Calcular_CuponVigente_AplicaDescuento()
    {
        // Arrange
        var tiempo = new FakeTimeProvider(new DateTimeOffset(2026, 3, 1, 10, 0, 0, TimeSpan.Zero));
        var sut = new CalculadoraTotal(tiempo);
        // Act
        var total = sut.Calcular(new[] { new Item(100m) }, "OTONO10");
        // Assert
        Assert.Equal(90m, total);   // FluentAssertions / Shouldly si el repo los usa
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(3, 300)]
    public void Calcular_PorCantidad_DevuelveProducto(int cantidad, decimal esperado) { /* … */ }
}
```

NUnit: `[Test]`, `[TestCase(0, 0)]`. Mocks: Moq / NSubstitute. Un test:
`dotnet test --filter "FullyQualifiedName~CalculadoraTotalTests"`.

### go test

```go
// total.go — stub
func CalcularTotal(items []Item, cupon string) (int, error) { panic("not implemented") }
```

```go
// total_test.go
// AC-2 — docs/specs/123-descuentos/spec.md
func TestCalcularTotal_Cupones(t *testing.T) {
	casos := []struct {
		nombre   string
		cupon    string
		esperado int
	}{
		{"cupón vigente aplica descuento", "OTONO10", 90},
		{"sin cupón cobra precio lleno", "", 100},
	}
	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			// Given
			items := []Item{{Precio: 100}}
			// When
			got, err := CalcularTotal(items, c.cupon)
			// Then
			if err != nil { t.Fatalf("error inesperado: %v", err) }
			if got != c.esperado { t.Errorf("got %d, want %d", got, c.esperado) }
		})
	}
}
```

Reloj: inyectar `func() time.Time` o interfaz; HTTP con `httptest.NewServer`. Un test:
`go test ./pedidos -run 'TestCalcularTotal_Cupones'`.

### RSpec

```ruby
# spec/pedidos/calculadora_total_spec.rb
RSpec.describe Pedidos::CalculadoraTotal do
  # AC-2 — docs/specs/123-descuentos/spec.md
  context 'cuando el cupón está vigente' do
    around { |ex| travel_to(Time.utc(2026, 3, 1)) { ex.run } }   # ActiveSupport / Timecop

    it 'aplica 10% de descuento' do
      # Given
      items = [build(:item, precio: 100)]                           # FactoryBot si el repo lo usa
      # When
      total = described_class.new.calcular(items, cupon: 'OTONO10')
      # Then
      expect(total).to eq(90)
    end
  end
end
```

Stub: `def calcular(items, cupon: nil) = raise NotImplementedError`. Un test:
`rspec spec/pedidos/calculadora_total_spec.rb:6` (con el prefijo de entorno que use el repo).

### PHPUnit / Pest

```php
// tests/Unit/Pedidos/CalculadoraTotalTest.php
final class CalculadoraTotalTest extends TestCase
{
    // AC-2 — docs/specs/123-descuentos/spec.md
    public function test_cupon_vigente_aplica_descuento(): void
    {
        // Given
        $calc = new CalculadoraTotal(new FrozenClock(new DateTimeImmutable('2026-03-01')));
        // When
        $total = $calc->calcular([new Item(100)], 'OTONO10');
        // Then
        $this->assertSame(90, $total);
    }

    #[DataProvider('cantidades')]
    public function test_por_cantidad_devuelve_producto(int $cantidad, int $esperado): void { /* … */ }

    public static function cantidades(): array { return [[0, 0], [3, 300]]; }
}
```

Pest: `it('aplica descuento con cupón vigente', fn () => …)->with([...])`. Stub:
`throw new \LogicException('not implemented');`. Un test:
`vendor/bin/phpunit --filter test_cupon_vigente_aplica_descuento` · `vendor/bin/pest --filter "cupón"`.
