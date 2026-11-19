
// Penyimpanan data game ke file supaya tidak hilang saat bot restart.
// Sesi chat AI sengaja TIDAK disimpan (privasi).
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "games.json");
const registered = new Map(); // nama -> Map yang disimpan

let saved = {};
try {
  saved = JSON.parse(fs.readFileSync(FILE, "utf8")) || {};
} catch (_) {
  saved = {};
}

// Ambil data lama ke Map, lalu daftarkan Map itu untuk disimpan berkala
function restore(name, map) {
  for (const [k, v] of saved[name] || []) map.set(k, v);
  registered.set(name, map);
  return map;
}

function flush() {
  const out = {};
  for (const [name, map] of registered) out[name] = [...map.entries()];
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(out));
  } catch (e) {
    console.error("[STORE ERROR]", e.message || e);
  }
}

setInterval(flush, 3000).unref();

module.exports = { restore, flush };
