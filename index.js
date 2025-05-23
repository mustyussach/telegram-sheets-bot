console.log("Bot sedang berjalan...");

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { google } = require("googleapis");

// Inisialisasi bot Telegram
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Konfigurasi autentikasi Google API
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// Fungsi untuk mengambil data dari baris tertentu
async function getRowData(rowNumber) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "Sheet1",
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
    "👋 Halo mas Yus! Gunakan perintah:\n`/row <nomor>` untuk melihat data dari spreadsheet.\nContoh: `/row 2`\nAtau: `/isi <NIK> <NAMA> <NO_TELP> <ALAMAT>` untuk menambah data.",
    { parse_mode: "Markdown" }
  );
});

// Handler untuk perintah /isi
bot.onText(/^\/isi (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1].trim();
  const args = input.split(/\s+/);

  if (args.length < 4) {
    return bot.sendMessage(chatId, "❗ Format salah. Gunakan: /isi NIK NAMA NO_TELP ALAMAT");
  }

  const [nik, nama, noTelp, ...alamatParts] = args;
  const alamat = alamatParts.join(" ");

  if (!/^\d+$/.test(nik)) {
    return bot.sendMessage(chatId, "❗ NIK harus berupa angka.");
  }

  if (!/^08\d{8,11}$/.test(noTelp)) {
    return bot.sendMessage(chatId, "❗ Nomor telepon tidak valid. Harus dimulai dengan 08 dan 10-13 digit.");
  }

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const row = [nik, nama, noTelp, alamat];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Sheet1!A:D",
      valueInputOption: "RAW",
      requestBody: {
        values: [row],
      },
    });

    bot.sendMessage(chatId, "✅ Data berhasil ditambahkan ke spreadsheet!");
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "❌ Gagal menambahkan data.");
  }
});
