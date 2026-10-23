// Helper compartido de los tests.
//
// seed-data.js es un script de navegador: publica las tablas en `window`.
// Para usarlo desde Node se simula ese objeto, se carga el archivo y se
// restaura el estado anterior, de modo que ningún test contamine a otro.

const path = require("path");

function cargarSemillas() {
  const rutaSemilla = require.resolve(path.join(__dirname, "..", "seed-data.js"));
  const teniaWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const windowPrevio = globalThis.window;

  globalThis.window = {};
  delete require.cache[rutaSemilla];
  try {
    require(rutaSemilla);
    return {
      ripte: globalThis.window.SEED_RIPTE,
      pisos: globalThis.window.SEED_PISOS,
    };
  } finally {
    if (teniaWindow) globalThis.window = windowPrevio;
    else delete globalThis.window;
  }
}

// Fecha UTC a partir de "AAAA-MM-DD", para que los tests no dependan de la
// zona horaria de la máquina.
function fecha(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

module.exports = { cargarSemillas, fecha };
