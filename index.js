console.log("Bot sedang berjalan...");

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { google } = require("googleapis");

// Inisialisasi bot Telegram
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Konfigurasi autentikasi Google API
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

// Fungsi untuk mengambil data dari baris tertentu
async function getRowData(rowNumber) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "Sheet1", // Ganti sesuai nama Sheet kamu
  });

  const rows = res.data.values;

  if (!rows || rowNumber <= 0 || rowNumber >= rows.length) {
    return `Baris ${rowNumber} tidak ditemukan atau kosong.`;
  }

  const headers = rows[0];
  const dataRow = rows[rowNumber];

  let message = `📄 *Data Baris ${rowNumber}*:\n`;
  headers.forEach((head, i) => {
    message += `*${head}*: ${dataRow[i] || "-"}\n`;
  });

  return message;
}

// Handler untuk perintah "/row"
bot.onText(/\/row (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const rowNumber = parseInt(match[1]);

  bot.sendMessage(chatId, "🔄 sik yo, lagi mundut data...", { parse_mode: "Markdown" });

  try {
    const response = await getRowData(rowNumber);
    bot.sendMessage(chatId, response, { parse_mode: "Markdown" });
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "❌ Gagal, mundut data.");
  }
});

// Handler untuk /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Halo mas Yus! Gunakan perintah:\n`/row <nomor>` untuk melihat data dari spreadsheet.\nContoh: `/row 2`",
    { parse_mode: "Markdown" }
  );
});
