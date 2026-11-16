
require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("[ERROR] BOT_TOKEN belum diisi di file .env");
  process.exit(1);
}

const bot = new Telegraf(token);
const startedAt = Date.now();


const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const USER_FILE = path.join(DATA_DIR, "user.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(USER_FILE)) {
  fs.writeFileSync(
    USER_FILE,
    JSON.stringify({ users: [] }, null, 2)
  );
}

function loadUsers() {
  try {
    const data = JSON.parse(fs.readFileSync(USER_FILE, "utf8"));
    return Array.isArray(data.users) ? data.users : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(
    USER_FILE,
    JSON.stringify({ users }, null, 2)
  );
}

function trackUser(ctx) {
  if (!ctx.from || ctx.from.is_bot || !ctx.chat) return;

  const users = loadUsers();
  const userId = String(ctx.from.id);
  const chatId = String(ctx.chat.id);

  let user = users.find(user => user.id === userId);

  if (!user) {
    user = {
      id: userId,
      username: ctx.from.username || null,
      first_name: ctx.from.first_name || null,
      first_seen: new Date().toISOString(),
      chat_ids: []
    };

    users.push(user);
  }

  // Simpan setiap chat unik yang pernah digunakan user.
  if (!Array.isArray(user.chat_ids)) {
    user.chat_ids = [];
  }

  if (!user.chat_ids.includes(chatId)) {
    user.chat_ids.push(chatId);
  }

  user.username = ctx.from.username || user.username;
  user.first_name = ctx.from.first_name || user.first_name;

  saveUsers(users);
}

function getTotalUsers() {
  return loadUsers().length;
}

function getTotalChats() {
  const chats = new Set();

  for (const user of loadUsers()) {
    for (const chatId of user.chat_ids || []) {
      chats.add(chatId);
    }
  }

  return chats.size;
}

function getTotalChats() {
  const users = loadUsers();
  return new Set(users.map(user => user.chat_id).filter(Boolean)).size;
}

function getTotalUsers() {
  return loadUsers().length;
}
 
bot.use(async (ctx, next) => {
  trackUser(ctx);
  return next();
});

// Aktifkan Downloader
require("./modules/tiktok")(bot);
require("./modules/instagram")(bot);
require("./modules/douyin")(bot);
require("./modules/youtube")(bot);
require("./modules/scribdl")(bot);
require("./modules/preset")(bot);
require("./modules/ngl-s")(bot);
require("./modules/pdf")(bot);
// require("./modules/twitter")(bot);

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

function detectLanguage(text = "") {
  const value = text.toLowerCase();

  if (/\b(hai|halo|apa|kamu|saya|tolong|makasih)\b/.test(value)) {
    return "Indonesia";
  }

  if (/\b(hello|hi|please|thanks|what|you|how)\b/.test(value)) {
    return "English";
  }

  return "Unknown / Auto";
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
│ /downloader - Downloader Menu
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

// Perintah informasi

bot.command("downloader", async (ctx) => {
  await ctx.reply(
    `<blockquote><b>
╔══════════════════════╗
║   DOWNLOADER SYSTEM  ║
╚══════════════════════╝

▣ Status   : ONLINE
▣ User     : ${ctx.from.first_name}
▣ Platform : Social Media

Select a platform to download:

➳  Instagram
   /instagram or /ig
➳  TikTok
   /tiktok or /tt
➳  YouTube
   /youtube
➳  Douyin
   /douyin

━━━━━━━━━━━━━━━━━━━
Use the commands above
to start downloading.

Type /menu to return to
the main menu.
</b></blockquote>`,
    { parse_mode: "HTML" }
  );
});


bot.command("status", async (ctx) => {
  await ctx.reply(
    `<b>BOT STATUS</b>\n` +
    `Status: ONLINE\n` +
    `Runtime: ${getRuntime()}\n` +
    `Version: ${CONFIG.version}`,
    { parse_mode: "HTML" }
  );
});

bot.command("time", async (ctx) => {
  await ctx.reply(new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "medium",
  }));
});

bot.command("id", async (ctx) => {
  await ctx.reply(
    `Chat ID: ${ctx.chat.id}\n` +
    `User ID: ${ctx.from.id}\n` +
    `Chat type: ${ctx.chat.type}`
  );
});

// Auto-reply semua pesan teks tanpa filter user ID.
// Abaikan command agar tidak bentrok dengan handler command.
bot.on("text", async (ctx) => {
  const text = ctx.message.text;

  if (text.startsWith("/")) return;

  const language = detectLanguage(text);

  log(
    "MESSAGE",
    `Chat=${ctx.chat.id} | User=${ctx.from.id} | Language=${language}`
  );

  await ctx.reply(
    `<blockquote><b>
╔══════════════════════╗
║   AUTO REPLY SYSTEM  ║
╚══════════════════════╝

▣ Status   : RECEIVED
▣ Language : ${language}
▣ Runtime  : ${getRuntime()}

Pesan kamu sudah diterima
oleh ${CONFIG.name}.

Ketik /menu untuk membuka
menu utama.
</b></blockquote>`,
    { parse_mode: "HTML" }
  );

  log("REPLY", `Auto-reply dikirim ke chat ${ctx.chat.id}`);
});

// Log error
bot.catch((err, ctx) => {
  log("ERROR", `Update ${ctx.update.update_id}: ${err.message}`);
});

// Mulai bot
bot.launch()
  .then(() => log("SYSTEM", `${CONFIG.name} berhasil online`))
  .catch((err) => log("FATAL", err.message));

// Penanganan shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));