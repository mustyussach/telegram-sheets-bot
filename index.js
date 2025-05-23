console.log("Bot sedang berjalan...");

require("dotenv").config();
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const { google } = require("googleapis");

// Inisialisasi bot Telegram (polling mode)
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// 🔽 Tambahkan bagian ini SEBELUM menggunakan GoogleAuth
// Decode isi GOOGLE_CREDENTIALS_BASE64 dari .env dan tulis ke credentials.json
if (!fs.existsSync("credentials.json")) {
  fs.writeFileSync("credentials.json", Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, "base64"));
}

// Konfigurasi autentikasi Google API
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// Ambil spreadsheetId dari env
const spreadsheetId = process.env.SPREADSHEET_ID;

// Fungsi untuk mengambil data dari baris tertentu
async function getRowData(rowNumber) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
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

// Fungsi tambah data (NIK, NAMA, NO_TELP, ALAMAT)
async function addRowData(row) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Sheet1!A:D",
    valueInputOption: "RAW",
    requestBody: {
      values: [row],
    },
  });
}

// Fungsi mencari data berdasarkan kata kunci Nama atau Alamat
async function searchByKeyword(keyword) {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1",
    });

    const rows = res.data.values;
    console.log("Rows:", rows); // Log isi spreadsheet

    if (!rows || rows.length === 0) {
      return "Spreadsheet kosong.";
    }

    const headers = rows[0];
    const results = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const nama = (row[1] || "").toLowerCase();
      const alamat = (row[3] || "").toLowerCase();
      const key = keyword.toLowerCase();

      if (nama.includes(key) || alamat.includes(key)) {
        let message = `📄 *Data Baris ${i + 1}*:\n`;
        headers.forEach((head, idx) => {
          message += `*${head}*: ${row[idx] || "-"}\n`;
        });
        results.push(message);
      }
    }

    if (results.length === 0) {
      return `❌ Tidak ditemukan data dengan kata kunci "${keyword}".`;
    }

    return results.slice(0, 5).join("\n\n");
  } catch (err) {
    console.error("searchByKeyword error:", err);
    throw err; // lempar ke blok catch utama
  }
}

// Handler /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Halo! Gunakan perintah:\n" +
      "`/row <nomor>` untuk melihat data baris tertentu.\n" +
      "`/isi NIK NAMA NO_TELP ALAMAT` untuk menambah data.\n" +
      "`/cari <kata_kunci>` untuk mencari data berdasarkan Nama atau Alamat.\n\n" +
      "Contoh:\n/row 2\n/isi 123456 Yus 08123456789 Jakarta\n/cari Jakarta",
    { parse_mode: "Markdown" }
  );
});

// Handler /row <nomor>
bot.onText(/\/row (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const rowNumber = parseInt(match[1]);

  bot.sendMessage(chatId, "🔄 Mengambil data...", { parse_mode: "Markdown" });

  try {
    const response = await getRowData(rowNumber);
    bot.sendMessage(chatId, response, { parse_mode: "Markdown" });
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "❌ Gagal mengambil data.");
  }
});

// Handler /isi NIK NAMA NO_TELP ALAMAT
bot.onText(/\/isi (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1].trim();

  // Pisahkan argumen dengan spasi
  // NIK harus angka, NO_TELP minimal 8 digit, NAMA & ALAMAT bisa spasi, ambil asumsi urutan
  const parts = text.split(/\s+/);

  if (parts.length < 4) {
    return bot.sendMessage(chatId, "Format salah. Gunakan:\n/isi NIK NAMA NO_TELP ALAMAT");
  }

  const nik = parts[0];
  const noTelp = parts[parts.length - 2];
  const alamat = parts.slice(parts.length - 1).join(" "); // ambil alamat dari kata terakhir (simple)
  const nama = parts.slice(1, parts.length - 2).join(" ");

  // Validasi NIK dan noTelp
  if (!/^\d+$/.test(nik)) {
    return bot.sendMessage(chatId, "NIK harus berupa angka.");
  }
  if (!/^08\d{6,12}$/.test(noTelp)) {
    return bot.sendMessage(chatId, "Nomor telepon tidak valid. Contoh: 08123456789");
  }

  try {
    await addRowData([nik, nama, noTelp, alamat]);
    bot.sendMessage(chatId, "✅ Data berhasil ditambahkan ke spreadsheet!");
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "❌ Gagal menambahkan data.");
  }
});

// Handler /cari <kata_kunci>
bot.onText(/\/cari (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const keyword = match[1];

  bot.sendMessage(chatId, "🔄 Mencari data...", { parse_mode: "Markdown" });

  try {
    const response = await searchByKeyword(keyword);
    bot.sendMessage(chatId, response, { parse_mode: "Markdown" });
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "❌ Gagal mencari data.");
  }
});
