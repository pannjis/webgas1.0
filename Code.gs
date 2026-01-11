function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('SiGAS PRO - Sistem Agen Gas')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- SETUP DATABASE OTOMATIS ---
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = [
    {name: 'USERS', header: ['Username', 'Password', 'Role', 'Nama']},
    {name: 'PRODUK', header: ['ID', 'Nama_Produk', 'Harga_Jual', 'Harga_Beli', 'Stok_Isi', 'Stok_Kosong']},
    {name: 'PELANGGAN', header: ['ID', 'Nama', 'NoHP', 'Alamat']},
    {name: 'SUPPLIER', header: ['ID', 'Nama_Supplier', 'NoHP', 'Alamat']},
    {name: 'TRANSAKSI', header: ['ID_Trans', 'Waktu', 'Pelanggan', 'Produk', 'Qty', 'Total', 'Tipe', 'Kasir']},
    {name: 'PEMBELIAN', header: ['ID_Beli', 'Waktu', 'Supplier', 'Produk', 'Qty', 'Total', 'Metode']},
    {name: 'KEUANGAN', header: ['ID', 'Tanggal', 'Jenis', 'Kategori', 'Nominal', 'Keterangan']},
    {name: 'KATEGORI', header: ['Nama_Kategori']},
    {name: 'KARYAWAN', header: ['ID', 'Nama', 'NoHP', 'Gaji_Pokok', 'Bonus_Per_Pcs', 'Status']}, 
    {name: 'KASBON', header: ['ID_Kasbon', 'Tanggal', 'Nama_Karyawan', 'Nominal', 'Keterangan', 'Status_Lunas']}
  ];

  sheets.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      sheet.appendRow(s.header);
      // Data Dummy Awal
      if(s.name === 'USERS') sheet.appendRow(['admin', 'admin123', 'Admin', 'Super Admin']);
      if(s.name === 'KATEGORI') {
        sheet.appendRow(['Listrik & Air']);
        sheet.appendRow(['Operasional Toko']);
        sheet.appendRow(['Konsumsi']);
      }
    }
  });
}

// --- HELPER DATA ---
function getData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1);
}

// --- LOGIN ---
function loginUser(username, password) {
  const data = getData('USERS');
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] == username && data[i][1] == password) {
      return { status: 'success', role: data[i][2], nama: data[i][3] };
    }
  }
  return { status: 'failed' };
}

// --- DASHBOARD ---
function getDashboardStats() {
  const keu = getData('KEUANGAN');
  let income = 0, expense = 0;
  
  keu.forEach(r => {
    if(r[2] === 'Pemasukan') income += Number(r[4]);
    if(r[2] === 'Pengeluaran') expense += Number(r[4]);
  });
  
  return { income, expense, net: income - expense };
}

// --- PRODUK ---
function tambahProduk(form) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PRODUK');
  sheet.appendRow(['P-' + Date.now(), form.nama, form.hargaJual, form.hargaBeli, form.stokIsi, form.stokKosong]);
}

function hapusProduk(nama) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PRODUK');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == nama) { sheet.deleteRow(i + 1); break; }
  }
}

// [Ganti fungsi simpanTransaksi yang lama dengan ini]

function simpanTransaksi(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prodSheet = ss.getSheetByName('PRODUK');
  const prodData = prodSheet.getDataRange().getValues();
  let status = "Gagal";
  
  // 1. Validasi Stok & Update (Atomic Check)
  for (let i = 1; i < prodData.length; i++) {
    if (prodData[i][1] == data.produkNama) { 
      let curIsi = Number(prodData[i][4]);
      let curKosong = Number(prodData[i][5]);
      
      // VALIDASI STOK ISI (Server Side)
      if (curIsi < data.qty) {
        throw new Error("Stok Habis! Sisa stok di sistem: " + curIsi);
      }

      // Update Stok Berdasarkan Tipe
      if (data.tipe === 'Tukar (Refill)') {
        // Alur: Stok Isi Berkurang, Stok Kosong Bertambah (Dapat dari User)
        prodSheet.getRange(i + 1, 5).setValue(curIsi - data.qty); // Update Isi
        prodSheet.getRange(i + 1, 6).setValue(curKosong + Number(data.qty)); // Update Kosong
      } else {
        // Alur: Beli Tabung Baru (Stok Isi/Unit Fisik Berkurang)
        prodSheet.getRange(i + 1, 5).setValue(curIsi - data.qty);
        // Stok kosong tidak berubah karena tabung keluar fisik selamanya
      }
      
      status = "Sukses";
      break;
    }
  }
  
  if (status === "Sukses") {
    // 2. Catat Transaksi (Laporan Harian)
    ss.getSheetByName('TRANSAKSI').appendRow([
      'TRX-' + Date.now(), 
      new Date(), 
      data.pelanggan, 
      data.produkNama, 
      data.qty, 
      data.total, 
      data.tipe, 
      data.kasir
    ]);

    // 3. Auto Keuangan (Masuk Laporan Arus Kas)
    ss.getSheetByName('KEUANGAN').appendRow([
      'AUTO-' + Date.now(), 
      new Date(), 
      'Pemasukan', 
      'Penjualan Gas', 
      data.total, 
      `Jual (${data.tipe}): ${data.produkNama}`
    ]);
    
    return "Transaksi Berhasil Disimpan";
  } else {
    throw new Error("Produk tidak ditemukan");
  }
}

// --- PEMBELIAN (BELI) ---
function tambahSupplier(form) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SUPPLIER').appendRow(['SUP-' + Date.now(), form.nama, form.hp, form.alamat]);
}

function simpanPembelian(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prodSheet = ss.getSheetByName('PRODUK');
  
  // 1. Catat Beli
  ss.getSheetByName('PEMBELIAN').appendRow(['BELI-' + Date.now(), new Date(), data.supplier, data.produk, data.qty, data.total, data.metode]);
  
  // 2. Update Stok
  const prodData = prodSheet.getDataRange().getValues();
  for (let i = 1; i < prodData.length; i++) {
    if (prodData[i][1] == data.produk) {
      let curIsi = Number(prodData[i][4]);
      let curKosong = Number(prodData[i][5]);
      
      prodSheet.getRange(i + 1, 5).setValue(curIsi + Number(data.qty)); // Stok Isi Nambah
      if(data.isTukar) {
        prodSheet.getRange(i + 1, 6).setValue(curKosong - Number(data.qty)); // Stok Kosong Berkurang
      }
      break;
    }
  }
  
  // 3. Catat Pengeluaran
  ss.getSheetByName('KEUANGAN').appendRow(['OUT-' + Date.now(), new Date(), 'Pengeluaran', 'Pembelian Stok', data.total, `Beli ${data.produk}`]);
}

// --- KEUANGAN ---
function getKategori() {
  return getData('KATEGORI').map(r => r[0]);
}

function tambahKategori(nama) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('KATEGORI').appendRow([nama]);
}

function simpanKeuangan(form) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('KEUANGAN')
    .appendRow(['MANUAL-' + Date.now(), new Date(), form.jenis, form.kategori, form.nominal, form.keterangan]);
}

// --- SDM: KARYAWAN ---
function simpanKaryawan(form) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('KARYAWAN');
  
  if(form.id) { // Edit Mode
    const data = sheet.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
      if(data[i][0] == form.id) {
        sheet.getRange(i+1, 2, 1, 4).setValues([[form.nama, form.hp, form.gaji, form.bonus]]);
        return "Data Updated";
      }
    }
  } 
  // New Mode
  sheet.appendRow(['KRY-' + Date.now(), form.nama, form.hp, form.gaji, form.bonus, 'Aktif']);
  return "Karyawan Baru Disimpan";
}

function hapusKaryawan(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('KARYAWAN');
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] == id) { sheet.deleteRow(i+1); return; }
  }
}

// --- SDM: KASBON ---
function simpanKasbon(form) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('KASBON')
    .appendRow(['KSB-' + Date.now(), new Date(), form.nama, form.nominal, form.ket, 'Belum Lunas']);
  return "Kasbon Dicatat";
}

// --- SDM: PAYROLL LOGIC ---
function getDataPayroll() {
  const karyawan = getData('KARYAWAN');
  const kasbonData = getData('KASBON');
  
  let result = karyawan.map(k => {
    let nama = k[1];
    let gaji = Number(k[3]);
    let bonusSet = Number(k[4]);
    
    // Hitung Kasbon Belum Lunas
    let totalKasbon = 0;
    kasbonData.forEach(ksb => {
      if(ksb[2] === nama && ksb[5] === 'Belum Lunas') {
        totalKasbon += Number(ksb[3]);
      }
    });
    
    // Bonus Sementara (Dummy: 0), nanti bisa dikembangkan hitung jumlah penjualan kasir
    let totalBonus = 0; 

    return {
      id: k[0],
      nama: nama,
      gaji: gaji,
      bonus: totalBonus,
      kasbon: totalKasbon,
      total: gaji + totalBonus - totalKasbon
    };
  });
  return result;
}

function prosesPayrollFinal(listGaji) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const keuSheet = ss.getSheetByName('KEUANGAN');
  const kasbonSheet = ss.getSheetByName('KASBON');
  const kasbonData = kasbonSheet.getDataRange().getValues();
  
  let totalKeluar = 0;
  
  listGaji.forEach(g => {
    totalKeluar += Number(g.total);
    // Lunaskan Kasbon
    if(g.kasbon > 0) {
      for(let i=1; i<kasbonData.length; i++) {
        if(kasbonData[i][2] == g.nama && kasbonData[i][5] == 'Belum Lunas') {
          kasbonSheet.getRange(i+1, 6).setValue('Lunas (Potong Gaji)');
        }
      }
    }
  });
  
  keuSheet.appendRow(['PAY-' + Date.now(), new Date(), 'Pengeluaran', 'Gaji Karyawan', totalKeluar, 'Payroll Periode Ini']);
  return "Gaji Dicairkan & Kasbon Terpotong.";
}
