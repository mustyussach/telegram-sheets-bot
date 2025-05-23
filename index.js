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

// Tambahan

bot.startPolling(); // untuk polling mode (Railway tidak support webhook tanpa upgrade)

bot.command('isi', async (ctx) => {
  try {
    const message = ctx.message.text;
    const args = message.replace('/isi', '').trim().split(/\s+/);

    // Pastikan jumlah minimum field ada
    if (args.length < 4) {
      return ctx.reply('Format salah. Gunakan: /isi NIK NAMA NO_TELP ALAMAT');
    }

    // Gabung nama dan alamat jika mengandung spasi
    const [nik, namaPart1, ...rest] = args;
    const noTelp = rest[0];
    const alamat = rest.slice(1).join(' ');
    const nama = namaPart1;

    // Atur nilai yang mau ditambahkan ke spreadsheet
    const row = [nik, nama, noTelp, alamat];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:D', // Asumsikan kolom A:D = NIK, NAMA, TELP, ALAMAT
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    });

    ctx.reply('✅ Data berhasil ditambahkan ke spreadsheet!');
  } catch (error) {
    console.error(error);
    ctx.reply('❌ Gagal menambahkan data.');
  }
});

if (!/^\d+$/.test(nik)) return ctx.reply('NIK harus berupa angka.');
if (!/^08\d{8,11}$/.test(noTelp)) return ctx.reply('Nomor telepon tidak valid.');
