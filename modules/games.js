
const { Markup } = require("telegraf");
const { generate } = require("../lib/gemini");
const store = require("../lib/store");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const userName = (u) => esc(u.first_name || u.username || "User");

// ================= TIC TAC TOE =================
const games = store.restore("games", new Map()); // chatId -> game

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const sym = (v) => (v === "X" ? "❌" : v === "O" ? "⭕" : "⬜");

function tttText(g, info) {
  return `<blockquote><b>╭───「 TIC TAC TOE 」───
│ ❌ X : ${userName(g.X)}
│ ⭕ O : ${g.O ? userName(g.O) : "(belum ada, tekan Gabung)"}
│
│ ${info}
╰──────────────────────</b></blockquote>`;
}

function tttKeyboard(g) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    rows.push([0, 1, 2].map((c) => {
      const i = r * 3 + c;
      return Markup.button.callback(g.board[i] ? sym(g.board[i]) : String(i + 1), `t:${i}`);
    }));
  }
  if (!g.O && !g.over) {
    rows.push([Markup.button.callback("➕ Gabung sebagai O", "t:join")]);
  }
  if (g.over) {
    rows.push([Markup.button.callback("🔁 Main lagi", "t:again")]);
  }
  return Markup.inlineKeyboard(rows);
}

const BOT = { id: "bot", first_name: "Yuki-chan" };

function startTTT(ctx, vsBot = false) {
  const chatId = ctx.chat.id;
  const old = games.get(chatId);
  if (old && !old.over) {
    return ctx.reply("Hmph, masih ada game berjalan di chat ini. Selesaikan dulu ya!");
  }

  const g = {
    X: ctx.from,
    O: vsBot ? BOT : null,
    bot: vsBot,
    board: Array(9).fill(null),
    turn: "X",
    over: false
  };
  games.set(chatId, g);

  const info = vsBot
    ? "Lawanmu Yuki-chan. Kamu jalan duluan!"
    : "Menunggu lawan. Tekan Gabung untuk jadi O.";
  return ctx.reply(tttText(g, info), {
    parse_mode: "HTML",
    ...tttKeyboard(g)
  });
}

function applyMove(g, p, i) {
  g.board[i] = p;
  const win = WIN_LINES.find(([a, b, c]) =>
    g.board[a] && g.board[a] === g.board[b] && g.board[a] === g.board[c]
  );
  if (win) {
    g.over = true;
    const winner = p === "X" ? g.X : g.O;
    g.result = `${winner.first_name || winner.username || "pemain"} menang`;
    return `🏆 Pemenang: ${sym(p)} ${userName(winner)}`;
  }
  if (g.board.every(Boolean)) {
    g.over = true;
    g.result = "seri";
    return "🤝 Seri! Tidak ada yang menang.";
  }
  g.turn = p === "X" ? "O" : "X";
  return `Giliran: ${sym(g.turn)} ${userName(g.turn === "X" ? g.X : g.O)}`;
}

// Bot lawan: menang kalau bisa, halangi lawan, lalu tengah atau pojok
function botPick(g) {
  const empty = [];
  g.board.forEach((v, i) => { if (!v) empty.push(i); });
  const wins = (p, i) => {
    const b = g.board.slice();
    b[i] = p;
    return WIN_LINES.some(([a, c, d]) => b[a] && b[a] === b[c] && b[a] === b[d]);
  };
  const win = empty.find((i) => wins("O", i));
  if (win !== undefined) return win;
  const block = empty.find((i) => wins("X", i));
  if (block !== undefined) return block;
  if (!g.board[4]) return 4;
  const corners = [0, 2, 6, 8].filter((i) => !g.board[i]);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  return empty[Math.floor(Math.random() * empty.length)];
}

async function handleTTT(ctx) {
  const chatId = ctx.chat.id;
  const g = games.get(chatId);
  const data = ctx.callbackQuery.data;
  const uid = ctx.from.id;

  if (data === "t:again") {
    if (g && !g.over) return ctx.answerCbQuery("Masih ada game berjalan di chat ini.");
    await ctx.answerCbQuery();
    return startTTT(ctx, Boolean(g && g.bot));
  }

  if (!g || g.over) {
    return ctx.answerCbQuery("Game sudah selesai. Tekan Main lagi untuk main baru.");
  }
  if (g.thinking) return ctx.answerCbQuery("Yuki lagi mikir, tunggu sebentar ya.");

  if (data === "t:join") {
    if (g.O) return ctx.answerCbQuery("Pemain O sudah ada.");
    if (uid === g.X.id) return ctx.answerCbQuery("Kamu sudah jadi X, tunggu lawan.");
    g.O = ctx.from;
    await ctx.answerCbQuery("Kamu jadi O!");
    return ctx.editMessageText(tttText(g, `Giliran: ❌ ${userName(g.X)}`), {
      parse_mode: "HTML",
      ...tttKeyboard(g)
    }).catch(() => {});
  }

  if (!g.O) return ctx.answerCbQuery("Tunggu lawan gabung dulu.");

  const player = uid === g.X.id ? "X" : uid === g.O.id ? "O" : null;
  if (!player) return ctx.answerCbQuery("Kamu bukan pemain di game ini.");
  if (player !== g.turn) return ctx.answerCbQuery("Belum giliranmu, sabar ya.");

  const i = Number(data.slice(2));
  if (g.board[i]) return ctx.answerCbQuery("Kotak itu sudah terisi.");

  let info = applyMove(g, player, i);
  await ctx.answerCbQuery();

  // Yuki "mikir" dulu sebelum jalan
  if (!g.over && g.bot && g.turn === "O") {
    g.thinking = true;
    await ctx.editMessageText(tttText(g, "Yuki-chan lagi mikir... 🤔"), {
      parse_mode: "HTML",
      ...tttKeyboard(g)
    }).catch(() => {});
    await sleep(1200 + Math.floor(Math.random() * 800));
    info = applyMove(g, "O", botPick(g));
    g.thinking = false;
  }

  await ctx.editMessageText(tttText(g, info), {
    parse_mode: "HTML",
    ...tttKeyboard(g)
  }).catch(() => {});

  if (g.over) {
    announceEnd(ctx, g).catch((e) => console.error("[TTT END ERROR]", e));
  }
}

// Yuki kirim pesan sendiri setelah game selesai dan tanya mau lanjut
async function announceEnd(ctx, g) {
  const who = g.bot ? "kamu lawan Yuki" : "dua pemain manusia";
  const prompt = `Game Tic Tac Toe baru selesai. Hasil: ${g.result}. Yang main: ${who}. ` +
    "Tulis 1-2 kalimat singkat gaya Yuki yang menyebut hasilnya, lalu tanya mau lanjut main lagi atau tidak. Jangan pakai tanda bintang atau format.";
  let text;
  try {
    text = await generate([], prompt);
  } catch (error) {
    text = `Hasilnya ${g.result}. Mau lanjut main lagi, Oni-chan?`;
  }
  return ctx.reply(text || `Hasilnya ${g.result}. Mau lanjut main lagi?`);
}

// ================= REGISTER =================
module.exports = (bot) => {
  bot.command(["ttt", "tictactoe"], (ctx) => startTTT(ctx));

  bot.action(/^t:/, (ctx) => handleTTT(ctx));
};

// Ringkasan game untuk pemilah maksud pesan
function describeTTT(chatId) {
  const g = games.get(chatId);
  if (!g) return null;
  const mode = g.bot ? "lawan Yuki" : "lawan pemain lain";
  if (!g.over) return `Game Tic Tac Toe sedang BERJALAN (${mode}). Jangan mulai game baru.`;
  return `Game Tic Tac Toe terakhir (${mode}) sudah selesai, hasil: ${g.result}.`;
}

module.exports.startTTT = startTTT;
module.exports.describeTTT = describeTTT;
