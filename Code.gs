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

// --- MODIFIKASI: TRANSAKSI & KASIR ---

// 1. Simpan Transaksi (BULK / BANYAK ITEM SEKALIGUS)
function simpanTransaksiBulk(dataTransaksi) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prodSheet = ss.getSheetByName('PRODUK');
  const trxSheet = ss.getSheetByName('TRANSAKSI');
  const keuSheet = ss.getSheetByName('KEUANGAN');
  
  const prodData = prodSheet.getDataRange().getValues();
  const idTrxMaster = 'TRX-' + Date.now(); // Satu ID untuk satu keranjang belanja
  const waktu = new Date();
  let totalBelanja = 0;
  let summaryProduk = [];

  // Loop setiap item di keranjang
  dataTransaksi.items.forEach(item => {
    let itemFound = false;
    
    // Update Stok
    for (let i = 1; i < prodData.length; i++) {
      if (prodData[i][1] == item.produkNama) {
        let curIsi = Number(prodData[i][4]);
        let curKosong = Number(prodData[i][5]);
        
        // Validasi Stok (Server Side)
        if (curIsi < item.qty) throw new Error(`Stok ${item.produkNama} Habis! Sisa: ${curIsi}`);

        // Update logic
        let newIsi = curIsi - item.qty;
        let newKosong = curKosong;
        
        if (item.tipe === 'Tukar (Refill)') {
           newKosong = curKosong + Number(item.qty); // Terima tabung kosong
        }
        
        prodSheet.getRange(i + 1, 5).setValue(newIsi);
        prodSheet.getRange(i + 1, 6).setValue(newKosong);
        itemFound = true;
        break;
      }
    }
    
    if(!itemFound) throw new Error(`Produk ${item.produkNama} tidak ditemukan di database.`);

    // Catat ke Sheet TRANSAKSI (Per Item)
    // Format: ID_Trans, Waktu, Pelanggan, Produk, Qty, Total_Item, Tipe, Kasir, STATUS
    trxSheet.appendRow([
      idTrxMaster, waktu, dataTransaksi.pelanggan, item.produkNama, 
      item.qty, item.total, item.tipe, dataTransaksi.kasir, 'Sukses'
    ]);

    totalBelanja += Number(item.total);
    summaryProduk.push(`${item.produkNama} (${item.qty})`);
  });

  // Catat ke KEUANGAN (Satu baris per struk)
  keuSheet.appendRow([
    'FIN-' + idTrxMaster, waktu, 'Pemasukan', 'Penjualan Gas', 
    totalBelanja, `Penjualan: ${summaryProduk.join(', ')}`
  ]);

  return "Transaksi Berhasil Disimpan!";
}

// 2. Ambil Riwayat Transaksi
function getRiwayatTransaksi() {
  // Mengambil 50 transaksi terakhir
  const data = getData('TRANSAKSI').reverse().slice(0, 50);
  return data;
}

function simpanPelanggan(form) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PELANGGAN');
  
  // EDIT MODE
  if(form.id) { 
    const data = sheet.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
      if(data[i][0] == form.id) {
        // Update: Nama, Perusahaan, HP, Alamat
        sheet.getRange(i+1, 2, 1, 4).setValues([[form.nama, form.pt, form.hp, form.alamat]]);
        return "Data Pelanggan Diupdate";
      }
    }
  }
  
  // BARU MODE
  sheet.appendRow(['CUST-' + Date.now(), form.nama, form.pt, form.hp, form.alamat]);
  return "Pelanggan Baru Disimpan";
}

function hapusPelanggan(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PELANGGAN');
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] == id) { 
      sheet.deleteRow(i+1); 
      return "Pelanggan Dihapus";
    }
  }
}

// Fungsi bantu untuk mengambil List Pelanggan di Kasir
function getListPelanggan() {
  return getData('PELANGGAN'); // <--- WAJIB ADA 'return'
}

// 3. Hapus / Retur Transaksi
function prosesRetur(idTrx, produkNama, qty, tipe, mode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prodSheet = ss.getSheetByName('PRODUK');
  const trxSheet = ss.getSheetByName('TRANSAKSI');
  const keuSheet = ss.getSheetByName('KEUANGAN');
  
  // A. KEMBALIKAN STOK
  const prodData = prodSheet.getDataRange().getValues();
  for (let i = 1; i < prodData.length; i++) {
    if (prodData[i][1] == produkNama) {
       let curIsi = Number(prodData[i][4]);
       let curKosong = Number(prodData[i][5]);
       
       // Logic Retur: Kembalikan Stok Isi, Kurangi Stok Kosong (jika refill)
       prodSheet.getRange(i + 1, 5).setValue(curIsi + Number(qty));
       
       if(tipe === 'Tukar (Refill)') {
          prodSheet.getRange(i + 1, 6).setValue(curKosong - Number(qty));
       }
       break;
    }
  }

  // B. UPDATE STATUS TRANSAKSI & KEUANGAN
  // Cari baris transaksi
  const trxData = trxSheet.getDataRange().getValues();
  let nominalRefund = 0;

  for(let i=1; i<trxData.length; i++) {
    // Mencocokkan ID, Produk, dan memastikan belum diretur
    if(trxData[i][0] == idTrx && trxData[i][3] == produkNama && trxData[i][8] != 'Retur') {
       if(mode === 'FULL') {
         trxSheet.deleteRow(i+1); // Hapus baris permanen jika mau bersih
         // Atau tandai: trxSheet.getRange(i+1, 9).setValue('Retur');
       } else {
         trxSheet.getRange(i+1, 9).setValue('Retur Item');
       }
       nominalRefund = trxData[i][5]; // Ambil total harga item tsb
       break;
    }
  }

  // C. CATAT PENGELUARAN REFUND DI KEUANGAN (Agar Balance)
  keuSheet.appendRow([
      'REFUND-' + Date.now(), new Date(), 
      'Pengeluaran', 'Retur Penjualan', 
      nominalRefund, `Retur: ${produkNama} (${idTrx})`
  ]);

  return "Berhasil Retur/Hapus";
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
