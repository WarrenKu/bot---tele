
const os = require("os");
const { generate, routeMessage } = require("../lib/gemini");
const games = require("./games");
const quiz = require("./quiz");

const sessions = new Map();
const MAX_HISTORY = 100;

const formatMB = (bytes) =>
  (bytes / 1024 / 1024).toFixed(2) + " MB";

module.exports = (bot) => {

  // START
  bot.start(async (ctx) => {
    await ctx.reply(
      `╭───「 YUKI-CHAN AI 」───
│
│ Hai, Oni-chan~! 💗
│
│ Namaku Yuki-chan.
│ AI assistant berbasis Gemini.
│
│ Hmph! Mau ngobrol denganku?
│
╰────────────────────

Gunakan /help untuk melihat perintah.`,
      {
        reply_markup: {
          keyboard: [
            [{ text: "💬 Chat AI" }, { text: "📊 Status" }],
            [{ text: "🧠 Memory" }, { text: "🔄 Reset" }]
          ],
          resize_keyboard: true
        }
      }
    );
  });

  // HELP
  bot.command("help", async (ctx) => {
    await ctx.reply(
      `「 YUKI-CHAN HELP 」

/start - Mulai bot
/help - Bantuan
/ai - Chat AI
/status - Informasi RAM
/memory - Informasi memory
/reset - Reset percakapan
/whoami - Identitas Yuki
/id - Lihat ID kamu dan chat
/time - Lihat waktu sekarang`
    );
  });

  // IDENTITAS
  bot.command("whoami", async (ctx) => {
    await ctx.reply(
      "Namaku Yuki-chan! AI assistant berbasis Gemini. Hmph, jangan lupa lagi, Oni-chan~!"
    );
  });

  // STATUS
  bot.command("status", async (ctx) => {
    const mem = process.memoryUsage();

    const total = os.totalmem();
    const free = os.freemem();

    await ctx.reply(
      `╭──「 YUKI STATUS 」──
│
│ Bot: Online
│ AI: Gemini
│ Node: ${process.version}
│
│ NODE MEMORY
│ RSS: ${formatMB(mem.rss)}
│ Heap Used: ${formatMB(mem.heapUsed)}
│ Heap Total: ${formatMB(mem.heapTotal)}
│ External: ${formatMB(mem.external)}
│
│ SYSTEM MEMORY
│ Total: ${formatMB(total)}
│ Used: ${formatMB(total - free)}
│ Free: ${formatMB(free)}
│
│ Uptime: ${Math.floor(process.uptime())} sec
│ Users: ${sessions.size}
│
╰──────────────────`
    );
  });

  // MEMORY
  bot.command("memory", async (ctx) => {
    const history = sessions.get(ctx.from.id) || [];

    await ctx.reply(
      `🧠 Yuki Memory

Percakapan: ${history.length} pesan
Maksimum: ${MAX_HISTORY} pesan

Hmph! Aku masih mengingatmu, Oni-chan~`
    );
  });

  // RESET
  bot.command("reset", async (ctx) => {
    sessions.delete(ctx.from.id);

    await ctx.reply(
      "H-huh?! Memory-ku direset?! Baiklah, mulai dari awal lagi!"
    );
  });

  // AI COMMAND
  bot.command("ai", async (ctx) => {
    await ctx.reply(
      "Yuki-chan siap mendengarkan, Oni-chan~! 💗"
    );
  });

  // ID: lihat ID user dan chat
  bot.command("id", (ctx) => {
    ctx.reply(
      `ID kamu: ${ctx.from.id}\nID chat ini: ${ctx.chat.id}\nJenis chat: ${ctx.chat.type}`
    );
  });

  // TIME: waktu sekarang (WIB dan UTC)
  bot.command("time", (ctx) => {
    const now = new Date();
    const wib = now.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "full",
      timeStyle: "medium"
    });
    ctx.reply(`Sekarang: ${wib} WIB\nUTC: ${now.toISOString()}`);
  });

  // TEXT HANDLER
  bot.on("text", async (ctx) => {
    const message = ctx.message.text;

    if (message.startsWith("/")) return;

    if (message === "💬 Chat AI") {
      return ctx.reply("Hmph! Katakan saja, Oni-chan~");
    }

    if (message === "📊 Status") {
      return ctx.telegram.sendMessage(
        ctx.chat.id,
        `Node.js RSS: ${formatMB(process.memoryUsage().rss)}`
      );
    }

    if (message === "🧠 Memory") {
      const history = sessions.get(ctx.from.id) || [];
      return ctx.reply(`Memory: ${history.length} pesan`);
    }

    if (message === "🔄 Reset") {
      sessions.delete(ctx.from.id);
      return ctx.reply("Memory direset! Hmph!");
    }

    // Jalan di background supaya polling Telegram tidak menunggu AI (user lain tidak ikut macet)
    handleText(ctx, message).catch((e) => console.error("[YUKI ROUTE ERROR]", e));
  });

  // FOTO (misal soal dikirim sebagai gambar)
  bot.on("photo", async (ctx) => {
    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    const caption = ctx.message.caption ||
      "Tolong bantu jelaskan isi gambar ini. Kalau ini soal, jawab beserta langkah singkatnya.";

    try {
      const link = await ctx.telegram.getFileLink(best.file_id);
      const res = await fetch(String(link));
      if (!res.ok) throw new Error("Gagal ambil gambar dari Telegram");
      const data = Buffer.from(await res.arrayBuffer()).toString("base64");

      replyWithAI(ctx, caption, { data, mimeType: "image/jpeg" })
        .catch((e) => console.error("[YUKI AI ERROR]", e));
    } catch (error) {
      console.error("[YUKI PHOTO ERROR]", error);
      await ctx.reply("Hmph! Gambarnya gagal kubuka, coba kirim lagi ya.");
    }
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const unwrapJob = (job) => job.then((r) => { if (!r.ok) throw r.e; return r.v; });

  // Ringkasan konteks chat untuk AI: game berjalan, kuis, dan pesan yang dibalas
  function buildContext(ctx, open) {
    const lines = [];
    const ttt = games.describeTTT(ctx.chat.id);
    if (ttt) lines.push(ttt);
    lines.push(open
      ? `Kuis berjalan (jawaban rahasia): ${quiz.describe(open.quiz.q)}`
      : "Tidak ada kuis berjalan.");
    const replied = ctx.message.reply_to_message;
    if (replied) {
      const txt = String(replied.text || replied.caption || "").slice(0, 300);
      const who = replied.from && replied.from.is_bot ? "bot" : "pengguna";
      lines.push(`Pengguna membalas pesan ${who} ini: """${txt}"""`);
    }
    return lines.join("\n");
  }

  // AI membaca maksud pesan: main tictactoe, minta soal, jawab kuis, menyerah, atau ngobrol biasa
  async function handleText(ctx, message) {
    const open = quiz.openQuizFor(ctx.chat.id);
    const context = buildContext(ctx, open);
    // Jawaban chat mulai bersamaan dengan pemilah maksud, supaya tidak menunggu dua kali
    const history = sessions.get(ctx.from.id) || [];
    const prompt = `${message}\n\n(Info chat untuk kamu, jangan dibacakan mentah-mentah: ${context})`;
    const chatJob = generate(history, prompt, null).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }));
    ctx.sendChatAction("typing").catch(() => {});
    let route;
    try {
      route = await routeMessage(message, context);
    } catch (error) {
      console.error("[YUKI ROUTE AI ERROR]", error.message || error);
      route = { intent: "chat" };
    }

    if (route.intent === "ttt") return games.startTTT(ctx, true);
    if (route.intent === "quiz") return quiz.sendQuiz(ctx);
    if (open && route.intent === "answer") {
      return quiz.resolveAnswer(ctx, open, route.verdict || "salah");
    }
    if (open && route.intent === "give_up") {
      return quiz.resolveAnswer(ctx, open, "menyerah");
    }
    return replyWithAI(ctx, message, null, context, chatJob);
  }

  async function replyWithAI(ctx, message, image, extra, prefetch) {
    const userId = ctx.from.id;
    const history = sessions.get(userId) || [];

    ctx.sendChatAction("typing").catch(() => {});

    // Info konteks hanya untuk AI, tidak disimpan di riwayat
    const prompt = extra
      ? `${message}\n\n(Info chat untuk kamu, jangan dibacakan mentah-mentah: ${extra})`
      : message;

    try {
      const raw = prefetch ? await unwrapJob(prefetch) : await generate(history, prompt, image);
      // Jawaban bisa dipecah jadi beberapa pesan pendek lewat |||
      const parts = String(raw).split("|||").map((s) => s.trim()).filter(Boolean).slice(0, 2);
      const answer = parts.join("\n") || String(raw).replace(/\|\|\|/g, " ");

      const updated = [
        ...history,
        { role: "user", parts: [{ text: message }] },
        { role: "model", parts: [{ text: answer }] }
      ];

      sessions.set(
        userId,
        updated.slice(-MAX_HISTORY)
      );

      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          await sleep(800 + Math.random() * 900);
          ctx.sendChatAction("typing").catch(() => {});
          await sleep(600 + Math.random() * 600);
        }
        await ctx.reply(parts[i]);
      }

    } catch (error) {
      console.error("[YUKI AI ERROR]", error);

      const status = error.status || error.code;
      const busy = status === 503 || status === 429;

      await ctx.reply(
        busy
          ? `Hmph! Server AI lagi penuh, Oni-chan. Coba lagi sebentar ya~ 😭`
          : `Ehh?! Otakku sedang bermasalah, Oni-chan! 😭\n\n` +
            `Error: ${error.message || "Unknown error"}`
      );
    }
  }

};
