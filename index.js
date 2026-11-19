
require("dotenv").config();

const { Telegraf } = require("telegraf");

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("[ERROR] BOT_TOKEN tidak ditemukan!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN, {
  handlerTimeout: 180_000
});

// Load AI module
require("./modules/menu")(bot);
require("./modules/quiz")(bot);
require("./modules/games")(bot);
require("./modules/ai")(bot);

// Global error handler
bot.catch((error, ctx) => {
  console.error("[BOT ERROR]", error);

  if (ctx) {
    console.error("[BOT ERROR] Update:", ctx.updateType);
  }
});

// Start bot (coba ulang kalau gagal, misal 409 karena instance lama masih jalan)
// bot.launch() baru selesai saat polling berhenti, jadi "online" dicetak lewat callback onLaunch
function launchWithRetry(attempt = 1) {
  console.log(`[LAUNCH] Menyambung ke Telegram (percobaan ${attempt})...`);
  bot.launch({}, () => console.log("Yuki-chan AI is online!"))
    .catch((error) => {
      console.error("[LAUNCH ERROR]", error.message || error);
      if (attempt < 10) {
        setTimeout(() => launchWithRetry(attempt + 1), 5000);
      }
    });
}

launchWithRetry();

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
