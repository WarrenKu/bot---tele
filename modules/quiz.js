
const { Markup } = require("telegraf");
const { generateQuiz } = require("../lib/gemini");
const store = require("../lib/store");

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const userName = (u) => esc(u.first_name || u.username || "User");

const LETTERS = ["A", "B", "C", "D"];
const QUIZ_TTL = 5 * 60 * 1000; // kuis terbuka menerima jawaban selama 5 menit

// Soal cadangan kalau Gemini gagal (format: pilihan ganda)
const FALLBACK = [
  { type: "pilihan", question: "Berapa hasil dari 12 × 8?", options: ["84", "96", "108", "98"], answer: "B", explanation: "12 dikali 8 hasilnya 96." },
  { type: "pilihan", question: "Jumlah sudut dalam sebuah segitiga adalah...", options: ["90°", "180°", "270°", "360°"], answer: "B", explanation: "Jumlah sudut segitiga selalu 180 derajat." },
  { type: "pilihan", question: "Ibu kota Jepang adalah...", options: ["Osaka", "Kyoto", "Tokyo", "Nagoya"], answer: "C", explanation: "Ibu kota Jepang adalah Tokyo." },
  { type: "pilihan", question: "Planet terbesar di tata surya adalah...", options: ["Mars", "Saturnus", "Bumi", "Jupiter"], answer: "D", explanation: "Jupiter adalah planet paling besar." },
  { type: "pilihan", question: "Unsur kimia dengan simbol O adalah...", options: ["Oksigen", "Emas", "Osmium", "Oganesson"], answer: "A", explanation: "O adalah lambang untuk oksigen." },
  { type: "pilihan", question: "Nilai π (pi) dibulatkan 2 desimal adalah...", options: ["3,12", "3,14", "3,16", "3,41"], answer: "B", explanation: "π kira-kira 3,14." }
];

const quizzes = store.restore("quizzes", new Map()); // "chatId:messageId" -> { q, answered, at }
const openByChat = store.restore("openByChat", new Map()); // chatId -> key kuis terakhir yang belum terjawab

function quizText(q, footer) {
  const body = q.type === "pilihan"
    ? q.options.map((opt, i) => `│ ${LETTERS[i]}. ${esc(opt)}`).join("\n")
    : "│ Ketik jawabanmu di chat ya!";
  return `<blockquote><b>╭───「 QUIZ 」───
│ ${esc(q.question)}
│
${body}
│
│ ${footer}
╰──────────────────────</b></blockquote>`;
}

function keyboardFor(q) {
  if (q.type !== "pilihan") return Markup.inlineKeyboard([]);
  return Markup.inlineKeyboard([
    q.options.map((_, i) => Markup.button.callback(LETTERS[i], `quiz:opt:${i}`))
  ]);
}

function nextKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("➡️ Soal berikutnya", "quiz:next")]]);
}

function correctText(q) {
  return q.type === "pilihan"
    ? `${q.answer}. ${q.options[LETTERS.indexOf(q.answer)]}`
    : q.answer;
}

function pruneOld() {
  const now = Date.now();
  for (const [key, quiz] of quizzes) {
    if (now - quiz.at > 60 * 60 * 1000) quizzes.delete(key);
  }
}

// Ringkasan kuis untuk dibaca pemilah maksud pesan
function describe(q) {
  const opts = q.type === "pilihan"
    ? "\nPilihan: " + q.options.map((o, i) => `${LETTERS[i]}. ${o}`).join(" | ")
    : "";
  return `Jenis: ${q.type}\nPertanyaan: ${q.question}${opts}\nJawaban benar: ${correctText(q)}`;
}

// Kuis yang masih terbuka di chat ini, atau null
function openQuizFor(chatId) {
  const key = openByChat.get(chatId);
  const quiz = key && quizzes.get(key);
  if (!quiz || quiz.answered || Date.now() - quiz.at > QUIZ_TTL) {
    openByChat.delete(chatId);
    return null;
  }
  return { key, quiz };
}

async function sendQuiz(ctx) {
  const chatId = ctx.chat.id;
  ctx.sendChatAction("typing").catch(() => {});

  let q;
  try {
    q = await generateQuiz();
  } catch (error) {
    console.error("[QUIZ AI ERROR]", error.message || error);
    q = FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
  }

  const hint = q.type === "pilihan"
    ? "Pilih jawabanmu! Yang tercepat benar yang dapat poin."
    : "Jawab langsung di chat. Yang tercepat benar yang dapat poin.";

  const msg = await ctx.reply(quizText(q, hint), {
    parse_mode: "HTML",
    ...keyboardFor(q)
  });

  pruneOld();
  const key = `${chatId}:${msg.message_id}`;
  quizzes.set(key, { q, answered: false, at: Date.now() });
  openByChat.set(chatId, key);
}

// Tutup kuis dan ubah pesan kuisnya (lewat telegram, jadi bisa dipakai dari tombol maupun chat)
async function closeQuiz(ctx, key, quiz, footer) {
  quiz.answered = true;
  if (openByChat.get(ctx.chat.id) === key) openByChat.delete(ctx.chat.id);
  const [chatId, msgId] = key.split(":");
  return ctx.telegram.editMessageText(chatId, Number(msgId), undefined, quizText(quiz.q, footer), {
    parse_mode: "HTML",
    ...nextKeyboard()
  }).catch(() => {});
}

// Dipanggil dari pemilah maksud: verdict "benar", "salah", atau "menyerah"
async function resolveAnswer(ctx, open, verdict) {
  const { key, quiz } = open;
  const q = quiz.q;
  const replyTo = { reply_parameters: { message_id: ctx.message.message_id } };

  if (verdict === "benar") {
    await closeQuiz(ctx, key, quiz,
      `✅ Benar! Jawaban: ${esc(correctText(q))}\n${esc(q.explanation)}\nDijawab oleh ${userName(ctx.from)}`);
    return ctx.reply(`Hmph, benar! ${userName(ctx.from)} dapat poinnya.`, { parse_mode: "HTML", ...replyTo });
  }

  if (verdict === "menyerah") {
    return closeQuiz(ctx, key, quiz,
      `😅 Yah, menyerah ya? Jawabannya: ${esc(correctText(q))}\n${esc(q.explanation)}`);
  }

  return ctx.reply("Hmph, belum tepat! Coba lagi, Oni-chan~", replyTo);
}

module.exports = (bot) => {
  bot.command("quiz", (ctx) => {
    sendQuiz(ctx).catch((e) => console.error("[QUIZ ERROR]", e));
  });

  bot.action(/^quiz:next$/, async (ctx) => {
    await ctx.answerCbQuery();
    sendQuiz(ctx).catch((e) => console.error("[QUIZ ERROR]", e));
  });

  // Tombol pilihan A-D
  bot.action(/^quiz:opt:(\d)$/, async (ctx) => {
    const key = `${ctx.chat.id}:${ctx.callbackQuery.message.message_id}`;
    const quiz = quizzes.get(key);
    if (!quiz) return ctx.answerCbQuery("Soal ini sudah tidak aktif.");
    if (quiz.answered) return ctx.answerCbQuery("Soal ini sudah terjawab.");

    const letter = LETTERS[Number(ctx.match[1])];
    if (letter !== quiz.q.answer) {
      return ctx.answerCbQuery("Hmph, salah! Coba lagi~");
    }

    await ctx.answerCbQuery("Benar!");
    return closeQuiz(ctx, key, quiz,
      `✅ Benar! Jawaban: ${esc(correctText(quiz.q))}\n${esc(quiz.q.explanation)}\nDijawab oleh ${userName(ctx.from)}`);
  });
};

module.exports.sendQuiz = sendQuiz;
module.exports.openQuizFor = openQuizFor;
module.exports.describe = describe;
module.exports.resolveAnswer = resolveAnswer;
