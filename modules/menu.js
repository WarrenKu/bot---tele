const { Markup } = require("telegraf");

const CONFIG = {
  name: process.env.BOT_NAME || "BOT System",
  version: process.env.BOT_VERSION || "1.0.0",
  developer: process.env.DEVELOPER || "Azee",
  via: process.env.VIA || "Telegram API",
  github: process.env.GITHUB_URL || "https://github.com/",
};

// GIF ANIMASI MENU
const MENU_GIF =
  "https://raw.githubusercontent.com/WarrenKu/bot-tele-matic/main/26490-nopulse.gif";

const startedAt = Date.now();
const seenUsers = new Set();
const seenChats = new Set();

function log(type, message) {
  console.log(
    `[${new Date().toLocaleString("id-ID")}] [${type}] ${message}`
  );
}

function getRuntime() {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return `${h}h ${m}m ${s}s`;
}

function getTotalUsers() {
  return seenUsers.size;
}

function getTotalChats() {
  return seenChats.size;
}

function getMenu() {
  return `
<blockquote><b>
╔══════════════════════╗
║      BOT SYSTEM      ║
╚══════════════════════╝

▣ Name    : ${CONFIG.name}
▣ Developer: ${CONFIG.developer}
▣ Version : ${CONFIG.version}
▣ Via     : ${CONFIG.via}
▣ Status  : ONLINE
▣ Runtime : ${getRuntime()}
▣ Language: Auto Detect

━━━━━━━━━━━━━━━━━━━
   SELECT BUTTON TO SHOW MENU
━━━━━━━━━━━━━━━━━━━
</b></blockquote>`;
}

const mainKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback("👤 Owner Menu", "owner_menu"),
    Markup.button.callback("🧰 Tools", "tools"),
  ],
  [
    Markup.button.callback("📜 Rules", "rules"),
    Markup.button.callback("💻 Source", "source"),
  ],
  [
    Markup.button.url("🌐 GitHub", CONFIG.github),
    Markup.button.callback("🗑 Trash Menu", "trashmenu"),
  ],
  [
    Markup.button.callback("🔄 Refresh", "home"),
  ],
]);

// Kirim menu utama
async function sendMenu(ctx) {
  await ctx.replyWithAnimation(MENU_GIF, {
    caption: getMenu(),
    parse_mode: "HTML",
    ...mainKeyboard,
  });
}

module.exports = (bot) => {
  // Catat user dan chat untuk statistik di Owner Menu
  bot.use((ctx, next) => {
    if (ctx.from) seenUsers.add(ctx.from.id);
    if (ctx.chat) seenChats.add(ctx.chat.id);
    return next();
  });

  // Perintah /start dan /menu
  bot.start(async (ctx) => {
    log("START", `${ctx.from.first_name} membuka bot`);
    await sendMenu(ctx);
  });

  bot.command("menu", async (ctx) => {
    await sendMenu(ctx);
  });

  // Handler semua tombol inline
  bot.action("home", async (ctx) => {
    await ctx.answerCbQuery("Menu diperbarui");
    await ctx.editMessageText(getMenu(), {
      parse_mode: "HTML",
      ...mainKeyboard,
    }).catch(() => sendMenu(ctx));
  });

  bot.action("owner_menu", async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.reply(
      `<blockquote><b>
╭───「 OWNER MENU 」───
│ Developer : ${CONFIG.developer}
│ Bot       : ${CONFIG.name}
│ Version   : ${CONFIG.version}
│ Runtime   : ${getRuntime()}
│ Status    : ONLINE
│ Total Users : ${getTotalUsers()}
│ Total Chats : ${getTotalChats()}
╰────────────────────
Owner commands:
 /menu   - Main menu
 /status - System status
</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  });

  bot.action("tools", async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.reply(
      `<blockquote><b>
╭────「 TOOLS 」────
│ /id      - Chat information
│ /time    - Server time
│ /status  - Bot status
│ /menu    - Main menu
│ /ttt     - Tic Tac Toe
│ /quiz    - Quiz
╰──────────────────
</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  });

  bot.action("rules", async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.reply(
      `<blockquote><b>
╭────「 BOT RULES 」────
│ 1. Gunakan bot dengan baik.
│ 2. Jangan spam pesan.
│ 3. Hormati pengguna lain.
│ 4. Jangan bagikan token bot.
╰──────────────────────
</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  });

  bot.action("source", async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.reply(
      `<b>Source Code</b>\nRepository:\n<a href="${CONFIG.github}">GitHub</a>`,
      { parse_mode: "HTML" }
    );
  });

  bot.action("trashmenu", async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.reply(
      `<blockquote><b>
╭───「 TRASH MENU 」───
│ Tidak ada pesan yang
│ dihapus secara otomatis.
│
│ Menu ini masih placeholder.
╰─────────────────────
</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  });
};
