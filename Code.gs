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

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = [
    {name: 'USERS', header: ['Username', 'Password', 'Role', 'Nama']},
    {name: 'PRODUK', header: ['ID', 'Nama_Produk', 'Harga_Jual', 'Harga_Beli', 'Stok_Isi', 'Stok_Kosong', 'SKU', 'Kode', 'Link_Gambar']},
    {name: 'PELANGGAN', header: ['ID', 'Nama', 'Nama_Perusahan', 'NoHP', 'Alamat']},
    {name: 'SUPPLIER', header: ['ID', 'Nama_Supplier', 'NoHP', 'Alamat']},
    {name: 'TRANSAKSI', header: ['ID_Trans', 'Waktu', 'Pelanggan', 'Produk', 'Qty', 'Total', 'Tipe', 'Kasir', 'Metode_Bayar', 'Jatuh_Tempo', 'Status']},
    {name: 'PEMBELIAN', header: ['ID_Beli', 'Waktu', 'Supplier', 'Produk', 'Qty', 'Total', 'Metode']},
    // [UPDATE] Header Keuangan ditambah kolom 'Akun'
    {name: 'KEUANGAN', header: ['ID', 'Tanggal', 'Jenis', 'Kategori', 'Nominal', 'Keterangan', 'Akun']}, 
    {name: 'KATEGORI', header: ['Nama_Kategori']},
    {name: 'KARYAWAN', header: ['ID', 'Nama_Lengkap', 'Tempat_Lahir', 'Tanggal_Lahir', 'Jenis_Kelamin', 
    'No_Identitas', 'Tipe_Identitas', 'Email', 'Alamat_KTP', 'Alamat_Domisili',
    'Nama_Darurat', 'Telp_Darurat', 'Gaji_Pokok', 'Bonus', 'Foto_Url', 'Status', 'Tanggal_Masuk'
    ]}, 
    {name: 'RIWAYAT_GAJI', header: ['ID_Gaji', 'Periode', 'Tanggal_Generate', 'Nama_Karyawan', 'Gaji_Pokok', 'Bonus', 'Potongan_Kasbon', 'Total_THP', 'Status']}, 
    {name: 'KASBON', header: ['ID_Kasbon', 'Tanggal', 'Nama_Karyawan', 'Nominal', 'Keterangan', 'Status_Lunas', 'Sudah_Bayar', 'Tenor', 'Angsuran_Per_Bulan']},
    {name: 'RIWAYAT_BAYAR_KASBON', header: ['ID_Bayar', 'ID_Kasbon', 'Tanggal_Bayar', 'Nominal_Bayar', 'Tipe_Bayar', 'Keterangan']},
    {name: 'PENGATURAN', header: ['Key', 'Value']},
    {name: 'AKUN_KAS', header: ['ID_Akun', 'Nama_Akun', 'No_Rekening', 'Tipe', 'Saldo_Awal']} 
  ];

  sheets.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      sheet.appendRow(s.header);
      // Data Default User
      if(s.name === 'USERS') sheet.appendRow(['admin', 'admin123', 'Admin', 'Super Admin']);
      // [BARU] Data Default Akun Kas
      if(s.name === 'AKUN_KAS') {
         // Urutan: ID, Nama, No_Rekening, Tipe, Saldo
         sheet.appendRow(['ACC-1', 'Kas Tunai (Laci)', '-', 'Tunai', 0]); 
         sheet.appendRow(['ACC-2', 'Bank BCA', '1234567890', 'Bank', 0]);
         sheet.appendRow(['ACC-3', 'Bank BRI', '0987654321', 'Bank', 0]);
      }
    }
  });
}

// 3. Update Baca Data Akun (Sesuaikan Index Kolom)
function getDaftarAkun() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetAkun = ss.getSheetByName('AKUN_KAS');
  const sheetKeu = ss.getSheetByName('KEUANGAN');
  
  if(!sheetAkun || !sheetKeu) return [];

  const dataAkun = sheetAkun.getDataRange().getValues().slice(1);
  const dataKeu = sheetKeu.getDataRange().getValues().slice(1);

  let listAkun = dataAkun.map(r => {
      // [UPDATE INDEX KARENA ADA KOLOM BARU]
      let id = r[0];
      let nama = r[1];
      let norek = r[2]; // Kolom C (Index 2)
      let tipe = r[3];  // Kolom D (Index 3)
      let saldo = Number(r[4]); // Kolom E (Index 4) - Saldo Awal

      // Loop Transaksi Keuangan
      dataKeu.forEach(k => {
          let akunTrx = k[6]; 
          let jenis = k[2];
          let nominal = Number(k[4]);

          if(akunTrx === nama) {
              if(jenis === 'Pemasukan') saldo += nominal;
              if(jenis === 'Pengeluaran') saldo -= nominal;
          }
      });

      // Kembalikan objek lengkap
      return { id: id, nama: nama, norek: norek, tipe: tipe, saldo: saldo };
  });

  return listAkun;
}

// --- UPDATE 2: PERBAIKI LOGIN (Agar me-return Username) ---
function loginUser(username, password) {
  const data = getData('USERS');
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] == username && data[i][1] == password) {
      // Tambahkan username ke return object
      return { status: 'success', role: data[i][2], nama: data[i][3], username: data[i][0] }; 
    }
  }
  return { status: 'failed' };
}

// --- BARU: MANAJEMEN USER ---

function getAllUsers() {
  return getData('USERS');
}

function simpanUserBaru(form) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('USERS');
  const data = sheet.getDataRange().getValues();

  // Cek Duplicate Username (kecuali edit diri sendiri, tapi disini kita asumsikan username key)
  // Mode Edit (Jika password kosong, berarti update data lain saja, tapi disini simple overwrite)
  
  let userExists = false;
  let rowIndex = -1;

  for(let i=1; i<data.length; i++) {
     if(data[i][0] === form.username) {
        userExists = true;
        rowIndex = i + 1;
        break;
     }
  }

  if(form.isEdit && userExists) {
     // Update Data
     // Jika password diisi, update password. Jika tidak, pakai password lama.
     let oldPass = sheet.getRange(rowIndex, 2).getValue();
     let newPass = form.password ? form.password : oldPass;
     
     sheet.getRange(rowIndex, 1, 1, 4).setValues([[form.username, newPass, form.role, form.nama]]);
     return "Data User Berhasil Diupdate";
  } else if (!form.isEdit && userExists) {
     return "Error: Username sudah terpakai!";
  } else {
     // Buat Baru
     sheet.appendRow([form.username, form.password, form.role, form.nama]);
     return "User Baru Berhasil Ditambahkan";
  }
}

function hapusUser(username) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('USERS');
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] == username) {
       sheet.deleteRow(i+1);
       return "User dihapus.";
    }
  }
}

function gantiPasswordSendiri(username, oldPass, newPass) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('USERS');
  const data = sheet.getDataRange().getValues();
  
  for(let i=1; i<data.length; i++) {
    if(data[i][0] == username) {
       if(data[i][1] != oldPass) return "Password Lama Salah!";
       
       sheet.getRange(i+1, 2).setValue(newPass);
       return "Password Berhasil Diganti";
    }
  }
  return "User tidak ditemukan";
}

// --- BARU: PENGATURAN PERUSAHAAN ---

function getProfilPerusahaan() {
  const data = getData('PENGATURAN');
  // Convert Array [Key, Value] menjadi Object {key: value}
  let config = {};
  data.forEach(row => {
     config[row[0]] = row[1];
  });
  return config;
}

// [UPDATE] Fungsi Simpan Profil dengan Fitur Upload Logo
function simpanProfilPerusahaan(form) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('PENGATURAN');
  const data = sheet.getDataRange().getValues();
  
  // Gunakan ID Folder yang sama dengan Produk (atau ganti jika punya folder khusus logo)
  const FOLDER_ID = '15hiLtvusofF2OJpXVq8lJkePbmqVIuPM'; 

  // Helper function update/insert
    const updateOrInsert = (key, val) => {
     let found = false;
     
     // [PERBAIKAN] Paksa jadi String dengan menambahkan tanda petik satu (') di depan
     // Ini trik agar Google Sheet tidak menghapus angka 0 di depan
     let finalVal = val;
     if (key === 'no_perusahaan' || key === 'no_pemilik') {
         finalVal = "'" + val; 
     }

     for(let i=1; i<data.length; i++) {
        if(data[i][0] === key) {
           sheet.getRange(i+1, 2).setValue(finalVal); // Gunakan finalVal
           found = true;
           break;
        }
     }
     if(!found) sheet.appendRow([key, finalVal]); // Gunakan finalVal
  };

  // 1. PROSES UPLOAD LOGO (Jika ada file baru dipilih)
  if (form.logo && form.logo.data) {
    try {
       const decoded = Utilities.base64Decode(form.logo.data);
       const blob = Utilities.newBlob(decoded, form.logo.mimeType, 'LOGO-' + Date.now());
       
       const folder = DriveApp.getFolderById(FOLDER_ID);
       const file = folder.createFile(blob);
       
       // Set Permission agar bisa dilihat publik
       file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
       
       const logoUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
       
       // Simpan URL Logo ke Database
       updateOrInsert('logo_perusahaan', logoUrl);

    } catch (e) {
       throw new Error("Gagal Upload Logo: " + e.message);
    }
  }

  // 2. Simpan Data Teks Lainnya
  updateOrInsert('nama_perusahaan', form.nama_perusahaan);
  updateOrInsert('nama_pemilik', form.nama_pemilik);
  updateOrInsert('alamat', form.alamat);
  updateOrInsert('no_perusahaan', form.no_perusahaan);
  updateOrInsert('no_pemilik', form.no_pemilik);

  return "Profil & Logo Berhasil Disimpan!";
}

// [FIX TOTAL] Fungsi Baca Data yang Aman dari Error Timezone
function getData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  // 1. Cek Apakah Sheet Ada?
  if (!sheet) return [];

  // 2. Ambil Range Data
  const range = sheet.getDataRange();
  const values = range.getValues();
  
  // 3. Cek Apakah Data Kosong?
  if (!values || values.length <= 1) return [];

  // 4. Ambil Timezone Spreadsheet (Biar sinkron sama settingan Google Sheet Bapak)
  const timeZone = ss.getSpreadsheetTimeZone();

  // 5. Filter baris kosong & Format Tanggal Jadi String Mati (ISO tanpa Z)
  const data = values.slice(1);
  return data.filter(r => r[0] !== "").map(r => {
      return r.map(cell => {
          if (cell instanceof Date) {
              // UBAHAN UTAMA DISINI:
              // Kita format jadi "YYYY-MM-DDTHH:mm:ss" (Tanpa huruf 'Z' di belakang)
              // Ini memaksa browser menganggap "Ini adalah waktu lokal", jangan ditambah jam lagi.
              return Utilities.formatDate(cell, timeZone, "yyyy-MM-dd'T'HH:mm:ss");
          }
          return cell;
      });
  });
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

// GANTI function getDashboardStats() yang lama dengan ini:

// [CODE.GS] Update Fungsi ini
function getDashboardRealtime(startStr, endStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. TENTUKAN RANGE TANGGAL
  let startDate, endDate;
  const now = new Date();
  
  if (startStr && endStr) {
    startDate = new Date(startStr);
    startDate.setHours(0,0,0,0);
    endDate = new Date(endStr);
    endDate.setHours(23,59,59,999);
  } else {
    // Default: Tanggal 1 bulan ini s/d Hari ini
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }
  
  // 2. SETUP DATA STRUKTUR (MAPPING CHART)
  // Kita buat peta index tanggal agar chart sesuai urutan hari
  let mapDateIndex = {}; 
  let chartLabels = [];
  let chartSales = [];
  let chartExpense = [];
  
  let loopDate = new Date(startDate);
  let idx = 0;
  
  // Loop dari start s/d end untuk bikin kerangka Chart
  while(loopDate <= endDate) {
    let key = Utilities.formatDate(loopDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    let label = Utilities.formatDate(loopDate, Session.getScriptTimeZone(), "dd/MM");
    
    mapDateIndex[key] = idx; // Contoh: '2026-01-01' => index 0
    chartLabels.push(label);
    chartSales.push(0);
    chartExpense.push(0);
    
    loopDate.setDate(loopDate.getDate() + 1);
    idx++;
  }

  // 3. VARIABLE STATS UTAMA
  let stats = {
    totalPelanggan: 0, // Nanti diisi
    pesanan: 0,
    pendapatan: 0,
    pengeluaran: 0,
    retur: 0,
    qtyRefill: 0,
    produkTerjual: {},
    rataRataTransaksi: 0,
    chartLabels: chartLabels,
    chartSales: chartSales,
    chartExpense: chartExpense
  };

  // 4. AMBIL DATA DARI SHEET
  const rawTrx = getData('TRANSAKSI');
  const rawKeu = getData('KEUANGAN');
  const rawPel = getData('PELANGGAN');
  const rawAkun = getDaftarAkun();

  stats.totalPelanggan = rawPel.length;

  // A. LOOP TRANSAKSI
  rawTrx.forEach(row => {
     let tgl = new Date(row[1]); // Kolom Tanggal
     if(tgl >= startDate && tgl <= endDate) {
         let produk = row[3];
         let qty = Number(row[4]);
         let total = Number(row[5]);
         let tipe = row[6];
         let status = row[10];

         if(!String(status).includes('Retur')) {
             stats.pesanan++;
             stats.pendapatan += total;
             
             // Hitung Produk
             if(!stats.produkTerjual[produk]) stats.produkTerjual[produk] = 0;
             stats.produkTerjual[produk] += qty;

             // Hitung Refill
             if(tipe && tipe.toLowerCase().includes('refill')) {
                stats.qtyRefill += qty;
             }
             
             // Isi Data Chart
             let key = Utilities.formatDate(tgl, Session.getScriptTimeZone(), "yyyy-MM-dd");
             if (mapDateIndex.hasOwnProperty(key)) {
                let i = mapDateIndex[key];
                stats.chartSales[i] += total;
             }
         }
     }
  });

  // B. LOOP KEUANGAN
  rawKeu.forEach(row => {
     let tgl = new Date(row[1]);
     if(tgl >= startDate && tgl <= endDate) {
        let jenis = row[2];
        let kategori = row[3];
        let nominal = Number(row[4]);
        let key = Utilities.formatDate(tgl, Session.getScriptTimeZone(), "yyyy-MM-dd");

        if(jenis === 'Pengeluaran') {
           stats.pengeluaran += nominal;
           
           if(kategori && kategori.toLowerCase().includes('retur')) {
              stats.retur += nominal;
           }

           // Isi Data Chart
           if (mapDateIndex.hasOwnProperty(key)) {
              let i = mapDateIndex[key];
              stats.chartExpense[i] += nominal;
           }
        }
     }
  });

  // C. ITUNG RATA-RATA
  if(stats.pesanan > 0) {
     stats.rataRataTransaksi = stats.pendapatan / stats.pesanan;
  }

  return {
     stats: stats,
     accounts: rawAkun,
     periode: `${Utilities.formatDate(startDate, Session.getScriptTimeZone(), "dd MMM")} - ${Utilities.formatDate(endDate, Session.getScriptTimeZone(), "dd MMM yyyy")}`
  };
}

// [UPDATE] Fungsi Tambah Produk (Versi Debugging)
// [UPDATE] Fungsi Tambah Produk (Upload ke Folder Khusus)
function tambahProduk(form) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('PRODUK');
  
  // ID Folder Google Drive Anda
  const FOLDER_ID = '15hiLtvusofF2OJpXVq8lJkePbmqVIuPM'; 
  
  let imageUrl = '';

  // PROSES UPLOAD
  if (form.gambar && form.gambar.data) {
    try {
      const decoded = Utilities.base64Decode(form.gambar.data);
      const blob = Utilities.newBlob(decoded, form.gambar.mimeType, form.gambar.fileName);
      
      // 1. Ambil Folder Tujuan
      const folder = DriveApp.getFolderById(FOLDER_ID);
      
      // 2. Simpan File di Folder Tersebut
      const file = folder.createFile(blob); 
      
      // 3. Set Permission (Coba Publik -> Domain -> Private)
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e1) {
        try {
           file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (e2) {
           console.log("Gagal set permission: " + e1.message); 
        }
      }

      // 4. Ambil Link
      // Ganti format link jadi Thumbnail (agar tidak crash/broken di browser)
      imageUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";

    } catch (e) {
      // Tampilkan error detail jika gagal
      throw new Error("Gagal Upload: " + e.message); 
    }
  } else {
    // Jika manual link
    imageUrl = (typeof form.gambar === 'string') ? form.gambar : '';
  }

  // Simpan ke Spreadsheet
  sheet.appendRow([
    'P-' + Date.now(), 
    form.nama, 
    form.hargaJual, 
    form.hargaBeli, 
    form.stokIsi, 
    form.stokKosong,
    form.sku,     
    form.kode,    
    imageUrl 
  ]);
}

// [BARU] Fungsi Update Produk (Edit Mode)
function updateProduk(form) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('PRODUK');
  const data = sheet.getDataRange().getValues();
  
  // ID Folder Google Drive (Sama seperti tambah produk)
  const FOLDER_ID = '15hiLtvusofF2OJpXVq8lJkePbmqVIuPM'; 

  let rowTarget = -1;
  let oldImage = '';

  // 1. Cari Baris Produk Berdasarkan ID (Kolom A / Index 0)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == form.id) {
      rowTarget = i + 1;
      oldImage = data[i][8]; // Simpan gambar lama
      break;
    }
  }

  if (rowTarget === -1) throw new Error("Produk tidak ditemukan/ID salah.");

  // 2. Cek Apakah Ada Gambar Baru Diupload?
  let finalImageUrl = oldImage;

  if (form.gambar && form.gambar.data) {
    try {
      const decoded = Utilities.base64Decode(form.gambar.data);
      const blob = Utilities.newBlob(decoded, form.gambar.mimeType, 'UPD-' + form.gambar.fileName);
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      finalImageUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
    } catch (e) {
      // Jika gagal upload, tetap lanjut simpan data teks, gambar pakai yang lama
      console.log("Gagal update gambar: " + e.message);
    }
  } else if (typeof form.gambar === 'string' && form.gambar !== '') {
      // Jika user memasukkan link manual baru
      finalImageUrl = form.gambar;
  }

  // 3. Update Baris (KECUALI STOK ISI & KOSONG)
  // Urutan Kolom: [0]ID, [1]Nama, [2]Jual, [3]Beli, [4]Isi(SKIP), [5]Kosong(SKIP), [6]SKU, [7]Kode, [8]Gambar
  
  sheet.getRange(rowTarget, 2).setValue(form.nama);       // Update Nama
  sheet.getRange(rowTarget, 3).setValue(form.hargaJual);  // Update Harga Jual
  sheet.getRange(rowTarget, 4).setValue(form.hargaBeli);  // Update Harga Beli
  // Kolom 5 & 6 (Stok) TIDAK DISENTUH
  sheet.getRange(rowTarget, 7).setValue(form.sku);        // Update SKU
  sheet.getRange(rowTarget, 8).setValue(form.kode);       // Update Kode Barcode
  sheet.getRange(rowTarget, 9).setValue(finalImageUrl);   // Update Gambar

  return "Produk Berhasil Diupdate!";
}

function hapusProduk(nama) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PRODUK');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == nama) { sheet.deleteRow(i + 1); break; }
  }
}

// --- MODIFIKASI: TRANSAKSI & KASIR ---

// GANTI function simpanTransaksiBulk(dataTransaksi) dengan ini:

function simpanTransaksiBulk(dataTransaksi) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prodSheet = ss.getSheetByName('PRODUK');
  const trxSheet = ss.getSheetByName('TRANSAKSI');
  const keuSheet = ss.getSheetByName('KEUANGAN');
  
  const prodData = prodSheet.getDataRange().getValues();
  const idTrxMaster = 'KBA-' + Date.now();
  const waktu = new Date();
  
  let totalBelanja = 0;
  let summaryProduk = [];
  
  // Status Transaksi
  let statusTrx = (dataTransaksi.metode === 'Hutang') ? 'Belum Lunas' : 'Lunas';

  // 1. LOOP BARANG (Stok)
  dataTransaksi.items.forEach(item => {
    let itemFound = false;
    for (let i = 1; i < prodData.length; i++) {
      if (prodData[i][1] == item.produkNama) {
        let curIsi = Number(prodData[i][4]);
        let curKosong = Number(prodData[i][5]);
        
        if (curIsi < item.qty) throw new Error(`Stok ${item.produkNama} Habis! Sisa: ${curIsi}`);

        let newIsi = curIsi - item.qty;
        let newKosong = curKosong;
        if (item.tipe === 'Tukar (Refill)') {
           newKosong = curKosong + Number(item.qty); 
        }
        
        prodSheet.getRange(i + 1, 5).setValue(newIsi);
        prodSheet.getRange(i + 1, 6).setValue(newKosong);
        itemFound = true;
        break;
      }
    }
    
    if(!itemFound) throw new Error(`Produk ${item.produkNama} tidak ditemukan.`);

    // Catat Transaksi
    trxSheet.appendRow([
      idTrxMaster, waktu, dataTransaksi.pelanggan, item.produkNama, item.qty, 
      item.total, item.tipe, dataTransaksi.kasir, dataTransaksi.metode, 
      dataTransaksi.jatuhTempo, statusTrx 
    ]);

    totalBelanja += Number(item.total);
    summaryProduk.push(`${item.produkNama} (${item.qty})`);
  });

  // LOGIKA KEUANGAN
  if (dataTransaksi.metode !== 'Hutang') {
      keuSheet.appendRow([
        'FIN-' + idTrxMaster, 
        waktu, 
        'Pemasukan', 
        'Penjualan Gas', 
        totalBelanja, 
        `Penjualan: ${summaryProduk.join(', ')}`,
        dataTransaksi.metode 
      ]);
  }
  
  // [TAMBAHAN WAJIB] Paksa simpan detik ini juga
  SpreadsheetApp.flush(); 
  
  return "Transaksi Berhasil Disimpan!";
}

function getDataPiutang() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TRANSAKSI');
  if (!sheet) return [];
  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) return [];

  // Index Kolom (Sesuai Header):
  // 0:ID, 1:Waktu, 2:Pelanggan, ... 8:Metode_Bayar, 9:Jatuh_Tempo, 10:Status
  const idxMetode = 8;
  const idxJatuhTempo = 9;
  const idxStatus = 10;

  let grouped = {};

  for (let i = 1; i < allData.length; i++) {
    let row = allData[i];
    
    // 1. Cek Metode Bayar (Ambil semua yg 'Hutang', mau lunas atau belum)
    let metode = String(row[idxMetode]).trim();
    
    if (metode === 'Hutang') {
       let id = row[0];
       let status = String(row[idxStatus]).trim(); // Ambil status (Lunas/Belum)

       if(!grouped[id]) {
          let tglWaktu = (row[1] instanceof Date) ? row[1].toISOString() : String(row[1]);
          let tglTempo = (row[idxJatuhTempo] instanceof Date) ? row[idxJatuhTempo].toISOString() : String(row[idxJatuhTempo]);
          
          grouped[id] = {
             id: id,
             waktu: tglWaktu,      
             pelanggan: row[2],
             total: 0,
             jatuhTempo: tglTempo,
             status: status // Simpan statusnya
          };
       }
       grouped[id].total += Number(row[5]);
    }
  }
  
  // Return Array: [0]ID, [1]Waktu, [2]Pelanggan, [3]Total, [4]JatuhTempo, [5]Status
  // Kita urutkan: Yang "Belum Lunas" di atas, baru yang "Lunas" di bawah
  return Object.values(grouped).sort((a, b) => {
      if (a.status === b.status) {
          return new Date(b.waktu) - new Date(a.waktu); // Urut tanggal desc
      }
      return a.status === 'Belum Lunas' ? -1 : 1; // Prioritaskan Belum Lunas
  }).map(x => [x.id, x.waktu, x.pelanggan, x.total, x.jatuhTempo, x.status]);
}

// 2. Proses Pelunasan
function lunasiHutang(idTrx, totalBayar, namaPelanggan) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetTrx = ss.getSheetByName('TRANSAKSI');
  const sheetKeu = ss.getSheetByName('KEUANGAN');
  
  const dataTrx = sheetTrx.getDataRange().getValues();
  
  // A. Update Status di TRANSAKSI jadi 'Lunas'
  for(let i=1; i<dataTrx.length; i++) {
     if(dataTrx[i][0] == idTrx) {
        // Kolom K (Index 11, karena start dari 1 di sheet) -> Kolom ke-11
        sheetTrx.getRange(i+1, 11).setValue('Lunas'); 
     }
  }

  // B. Masukkan Uang ke KEUANGAN (Karena baru terima duit sekarang)
  sheetKeu.appendRow([
      'LUNAS-' + Date.now(), 
      new Date(), 
      'Pemasukan', 
      'Pelunasan Piutang', 
      totalBayar, 
      `Pelunasan Bon: ${namaPelanggan} (${idTrx})`
  ]);

  return "Hutang Berhasil Dilunasi & Masuk Kas!";
}

function getJumlahJatuhTempo() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TRANSAKSI');
  const data = sheet.getDataRange().getValues();
  const today = new Date();
  let count = 0;
  let uniqueIDs = []; // Supaya tidak double hitung item dalam 1 struk

  // Loop data transaksi
  for (let i = 1; i < data.length; i++) {
    let idTrx = data[i][0];
    let status = data[i][10]; // Kolom K (Status)
    let tglTempo = new Date(data[i][9]); // Kolom J (Jatuh Tempo)

    // Logika: Status Belum Lunas DAN Tanggal Tempo < Hari Ini (Sudah lewat)
    if (status === 'Belum Lunas' && tglTempo <= today && !uniqueIDs.includes(idTrx)) {
       count++;
       uniqueIDs.push(idTrx);
    }
  }
  return count;
}

function getRiwayatTransaksi() {
  const data = getData('TRANSAKSI');
  
  let grouped = {};
  data.forEach(row => {
    let id = row[0];
    let waktuStr = row[1] instanceof Date ? row[1].toISOString() : row[1];

    if (!grouped[id]) {
      grouped[id] = {
        id: id,
        waktu: waktuStr,
        pelanggan: row[2],
        kasir: row[7],
        // [PERBAIKAN DISINI] Tambahkan pembacaan kolom Metode & Jatuh Tempo
        metode: row[8],        // Kolom I (Index 8) -> Metode Bayar
        jatuhTempo: row[9],    // Kolom J (Index 9) -> Jatuh Tempo
        totalBayar: 0,  
        items: []       
      };
    }
    
    // ... (kode bawahnya tetap sama) ...
    grouped[id].items.push({
      produk: row[3],
      qty: row[4],
      hargaTotal: row[5],
      tipe: row[6],
      status: row[10]
    });

    grouped[id].totalBayar += Number(row[5]);
  });
  
  return Object.values(grouped).sort((a, b) => new Date(b.waktu) - new Date(a.waktu)).slice(0, 50);
}

// --- Code.gs ---

// 1. GET RIWAYAT PEMBELIAN (Grouping per ID)
function getRiwayatPembelian() {
  const data = getData('PEMBELIAN');
  let grouped = {};

  data.forEach(row => {
    let id = row[0];
    let waktuStr = row[1] instanceof Date ? row[1].toISOString() : row[1];

    if (!grouped[id]) {
      grouped[id] = {
        id: id,
        waktu: waktuStr,
        pelanggan: row[2], // Di sheet PEMBELIAN kolom ini adalah Supplier
        totalBayar: 0,
        items: []
      };
    }

    // Sheet PEMBELIAN: ID, Waktu, Supplier, Produk, Qty, Total, Metode
    grouped[id].items.push({
      produk: row[3],
      qty: row[4],
      hargaTotal: row[5],
      tipe: 'Stok Masuk', // Default tipe
      status: 'Sukses' 
    });
    
    grouped[id].totalBayar += Number(row[5]);
  });

  return Object.values(grouped).sort((a, b) => new Date(b.waktu) - new Date(a.waktu)).slice(0, 50);
}

// 2. FUNGSI RETUR BARU (Support Partial & Jenis Transaksi)
function prosesReturBaru(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prodSheet = ss.getSheetByName('PRODUK');
  const keuSheet = ss.getSheetByName('KEUANGAN');
  
  // Tentukan Sheet Target berdasarkan jenis
  const targetSheetName = payload.jenis === 'JUAL' ? 'TRANSAKSI' : 'PEMBELIAN';
  const trxSheet = ss.getSheetByName(targetSheetName);
  const trxData = trxSheet.getDataRange().getValues();
  const prodData = prodSheet.getDataRange().getValues();

  let totalRefund = 0;
  let logItem = [];

  // Loop item yang diretur
  payload.items.forEach(returItem => {
    if(returItem.qtyRetur > 0) {
      
      // A. UPDATE STOK PRODUK
      for (let i = 1; i < prodData.length; i++) {
        if (prodData[i][1] == returItem.produk) {
           let curIsi = Number(prodData[i][4]);
           let curKosong = Number(prodData[i][5]);
           
           if(payload.jenis === 'JUAL') {
              // Retur Penjualan: Stok Isi KEMBALI (+), Stok Kosong BERKURANG (karena sebelumnya tukar)
              prodSheet.getRange(i+1, 5).setValue(curIsi + returItem.qtyRetur);
              // Cek jika itu refill, tabung kosong dikembalikan ke pelanggan (stok kita berkurang)
              if(returItem.tipe && returItem.tipe.includes('Refill')) {
                 prodSheet.getRange(i+1, 6).setValue(curKosong - returItem.qtyRetur);
              }
           } else {
              // Retur Pembelian: Stok Isi BERKURANG (-) (Balikin ke supplier)
              prodSheet.getRange(i+1, 5).setValue(curIsi - returItem.qtyRetur);
              // Jika beli tukar tabung, stok kosong kita bertambah lagi (dibalikin supplier)
               // (Sederhananya kita kurangi stok isi saja dulu untuk keamanan)
           }
           break;
        }
      }

      // B. UPDATE STATUS TRANSAKSI (Tandai Retur)
      // Cari baris transaksi spesifik
      for(let i=1; i<trxData.length; i++) {
         if(trxData[i][0] == payload.idTrx && trxData[i][3] == returItem.produk) {
             // Opsional: Bisa update kolom qty atau tambah catatan "Retur Partial"
             // Disini kita biarkan record asli, tapi catat di Keuangan sebagai pengurang
         }
      }
      
      totalRefund += (returItem.hargaSatuan * returItem.qtyRetur);
      logItem.push(`${returItem.produk} (x${returItem.qtyRetur})`);
    }
  });

  // C. CATAT DI KEUANGAN (Balance)
  if(totalRefund > 0) {
     if(payload.jenis === 'JUAL') {
        // Retur Jual = Uang Keluar (Refund ke Pelanggan)
        keuSheet.appendRow(['RET-' + Date.now(), new Date(), 'Pengeluaran', 'Retur Penjualan', totalRefund, `Retur TRX: ${payload.idTrx}. ${payload.alasan}`]);
     } else {
        // Retur Beli = Uang Masuk (Refund dari Supplier)
        keuSheet.appendRow(['RET-' + Date.now(), new Date(), 'Pemasukan', 'Retur Pembelian', totalRefund, `Retur BELI: ${payload.idTrx}. ${payload.alasan}`]);
     }
  }

  return "Retur Berhasil Diproses!";
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

// --- TAMBAHAN: SIMPAN PEMBELIAN BULK (KERANJANG) ---
function simpanPembelianBulk(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetBeli = ss.getSheetByName('PEMBELIAN');
  const sheetProd = ss.getSheetByName('PRODUK');
  const sheetKeu = ss.getSheetByName('KEUANGAN');
  
  const idBeliMaster = 'BELI-' + Date.now();
  const waktu = new Date();
  const prodData = sheetProd.getDataRange().getValues();
  
  let summaryItem = [];

  // Loop setiap item di keranjang beli
  data.items.forEach(item => {
    // 1. Catat di Sheet PEMBELIAN
    // Format: ID, Waktu, Supplier, Produk, Qty, Total, Metode
    sheetBeli.appendRow([
      idBeliMaster, 
      waktu, 
      data.supplier, 
      item.produk, 
      item.qty, 
      item.total, 
      'Tunai'
    ]);

    // 2. Update Stok di Sheet PRODUK
    for (let i = 1; i < prodData.length; i++) {
      if (prodData[i][1] == item.produk) {
        let curIsi = Number(prodData[i][4]);
        let curKosong = Number(prodData[i][5]);
        
        // Stok Isi Bertambah (+)
        sheetProd.getRange(i + 1, 5).setValue(curIsi + Number(item.qty));
        
        // Jika Tukar Tabung, Stok Kosong Berkurang (-)
        if(item.isTukar) {
           sheetProd.getRange(i + 1, 6).setValue(curKosong - Number(item.qty));
        }
        break;
      }
    }
    summaryItem.push(`${item.produk} (x${item.qty})`);
  });

  // 3. Catat di KEUANGAN (Satu baris total pengeluaran)
  sheetKeu.appendRow([
    'OUT-' + Date.now(), 
    waktu, 
    'Pengeluaran', 
    'Pembelian Stok', 
    data.grandTotal, 
    `Beli Stok: ${summaryItem.join(', ')}`
  ]);

  return "Stok Berhasil Ditambahkan!";
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

// --- [UPDATE] Simpan Keuangan dengan Kolom AKUN ---
function simpanKeuangan(form) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('KEUANGAN');
  const tglInput = new Date(form.tanggal);

  // Tambahkan Header jika belum ada (Update Header Lama)
  if(sheet.getLastColumn() < 7) {
     sheet.getRange(1, 7).setValue('Akun');
  }

  // LOGIKA EDIT
  if (form.id && !form.id.includes('MANUAL')) { 
     // ... (Kode edit lama disesuaikan jika perlu, disini kita fokus Input Baru dulu)
  }

  // LOGIKA BARU
  const newId = 'MANUAL-' + Date.now();
  sheet.appendRow([
      newId, 
      tglInput, 
      form.jenis, 
      form.kategori, 
      form.nominal, 
      form.keterangan,
      form.akun // [BARU] Simpan Nama Akun
  ]);
  
  return { status: 'success', data: { id: newId, ...form } };
}

// 2. Update Simpan Akun Baru (Tambah parameter norek)
function simpanAkunBaru(form) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AKUN_KAS');
  const id = 'ACC-' + Date.now();
  
  // [UPDATE] Urutan simpan: ID, Nama, NoRek, Tipe, Saldo
  sheet.appendRow([id, form.nama, "'" + form.norek, form.tipe, form.saldo]); 
  // Note: Ditambah tanda petik satu (') di depan norek agar angka 0 tidak hilang
  
  return "Akun Berhasil Ditambahkan!";
}

function hapusAkun(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AKUN_KAS');
  const data = sheet.getDataRange().getValues();
  
  // Mulai loop dari 1 (skip header)
  for(let i=1; i<data.length; i++) {
     if(data[i][0] == id) {
        sheet.deleteRow(i+1);
        return "Akun Dihapus.";
     }
  }
}

// --- [BARU] Fitur Transfer Saldo Antar Akun ---
function prosesTransferSaldo(form) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('KEUANGAN');
  const waktu = new Date();
  const idTrx = 'TRF-' + Date.now();

  // Konsep Transfer:
  // 1. Catat PENGELUARAN di Akun Asal
  sheet.appendRow([
     idTrx + '-OUT', waktu, 'Pengeluaran', 'Transfer Keluar', form.nominal, 
     `Transfer ke ${form.akunTujuan} (${form.ket})`, form.akunAsal
  ]);

  // 2. Catat PEMASUKAN di Akun Tujuan
  sheet.appendRow([
     idTrx + '-IN', waktu, 'Pemasukan', 'Transfer Masuk', form.nominal, 
     `Terima dari ${form.akunAsal} (${form.ket})`, form.akunTujuan
  ]);

  return "Transfer Berhasil!";
}

// --- BARU: HAPUS KEUANGAN ---
function hapusKeuangan(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('KEUANGAN');
  const data = sheet.getDataRange().getValues();
  
  // Safety: Cek lagi di server, hanya boleh hapus yang MANUAL
  if(!String(id).includes('MANUAL')) {
     throw new Error("Data sistem (Otomatis) tidak boleh dihapus dari sini!");
  }

  for(let i = 1; i < data.length; i++) {
    if(data[i][0] == id) {
       sheet.deleteRow(i+1);
       return "Data Dihapus";
    }
  }
  throw new Error("ID tidak ditemukan");
}

// [GANTI FUNCTION simpanKaryawan DENGAN INI]
function simpanKaryawan(form) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('KARYAWAN');
  const data = sheet.getDataRange().getValues();
  
  // ID Folder untuk Foto Karyawan (Samakan dengan produk atau buat baru)
  const FOLDER_ID = '15hiLtvusofF2OJpXVq8lJkePbmqVIuPM'; 

  // 1. Handle Upload Foto
  let fotoUrl = form.fotoLama || ''; // Default foto lama
  
  if (form.foto && form.foto.data) {
    try {
      const decoded = Utilities.base64Decode(form.foto.data);
      const blob = Utilities.newBlob(decoded, form.foto.mimeType, 'KRY-' + Date.now());
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fotoUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
    } catch (e) {
      // Jika gagal upload, biarkan kosong/lama
      console.log("Upload Error: " + e.message);
    }
  }

  // 2. Siapkan Data Baris
    const rowData = [
    form.nama, form.tmpLahir, form.tglLahir, form.gender, 
    "'" + form.noId, form.tipeId, form.email, form.alamatKtp, form.alamatDom, // <-- Fix NIK
    form.daruratNama, "'" + form.daruratTelp, form.gaji, form.bonus, fotoUrl, 'Aktif', // <-- Fix No HP
    form.tglMasuk // (Pastikan ini ada jika Bapak sudah menambahkan fitur tanggal masuk sebelumnya)
  ];
  
  if(form.id) { 
    // --- EDIT MODE ---
    for(let i=1; i<data.length; i++) {
      if(data[i][0] == form.id) {
        // Update kolom ke-2 sampai 17 (Index 1 s/d 16)
        const range = sheet.getRange(i+1, 2, 1, 16); // Diperlebar jadi 16 kolom
        range.setValues([rowData]);
        return "Data Karyawan Berhasil Diperbarui";
      }
    }
  }
  
  // --- BARU MODE ---
  const newId = 'KRY-' + Date.now();
  sheet.appendRow([newId, ...rowData]); // ID ditaruh di depan
  return "Karyawan Baru Berhasil Disimpan";
}
function hapusKaryawan(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('KARYAWAN');
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] == id) { sheet.deleteRow(i+1); return; }
  }
}

// [UPDATE] Bayar Cicilan Manual (Support Multi Akun)
function bayarCicilanManual(form) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetKasbon = ss.getSheetByName('KASBON');
  const sheetRiwayat = ss.getSheetByName('RIWAYAT_BAYAR_KASBON');
  const sheetKeu = ss.getSheetByName('KEUANGAN');
  
  const dataKasbon = sheetKasbon.getDataRange().getValues();
  const idKasbon = form.idKasbon;
  const nominalBayar = Number(form.nominal);
  const akunBayar = form.akun || 'Kas Tunai (Laci)'; // Ambil akun dari form
  
  // A. Cari Data Kasbon
  let rowTarget = -1;
  let sisaHutang = 0;
  let namaKaryawan = '';

  for(let i=1; i<dataKasbon.length; i++) {
     if(dataKasbon[i][0] == idKasbon) {
        rowTarget = i+1;
        namaKaryawan = dataKasbon[i][2];
        let totalHutang = Number(dataKasbon[i][3]);
        let sudahBayar = Number(dataKasbon[i][6]) || 0;
        sisaHutang = totalHutang - sudahBayar;
        
        if(nominalBayar > sisaHutang) throw new Error("Nominal pembayaran melebihi sisa hutang!");
        
        let newSudahBayar = sudahBayar + nominalBayar;
        sheetKasbon.getRange(rowTarget, 7).setValue(newSudahBayar);
        
        if(newSudahBayar >= totalHutang) {
            sheetKasbon.getRange(rowTarget, 6).setValue('Lunas');
        }
        break;
     }
  }

  if(rowTarget == -1) throw new Error("Data Kasbon tidak ditemukan.");

  // B. Catat History Pembayaran
  sheetRiwayat.appendRow([
     'PAY-' + Date.now(),
     idKasbon,
     new Date(),
     nominalBayar,
     `Manual (${akunBayar})`, // Simpan info akun di history
     form.keterangan || 'Pembayaran Cicilan Manual'
  ]);

  // C. Catat Pemasukan Keuangan (SESUAI AKUN YANG DIPILIH)
  sheetKeu.appendRow([
     'INC-' + Date.now(), 
     new Date(), 
     'Pemasukan', 
     'Cicilan Kasbon', 
     nominalBayar, 
     `Cicilan ${namaKaryawan}`, 
     akunBayar // <--- INI KUNCINYA (Masuk ke kolom Akun di sheet Keuangan)
  ]);

  SpreadsheetApp.flush(); 

  return "Pembayaran berhasil dicatat!";
}

// [UPDATE FINAL] Ambil Detail Riwayat Pembayaran Kasbon
// Menggunakan Direct Access agar tidak kena filter tanggal otomatis getData()
function getDetailHistoryKasbon(idKasbon) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('RIWAYAT_BAYAR_KASBON');
  
  // Jika sheet belum ada/kosong
  if (!sheet) return [];
  
  // Ambil semua data (termasuk header)
  const data = sheet.getDataRange().getValues();
  
  // Pastikan ID yang dicari bersih dari spasi
  const targetID = String(idKasbon).trim();
  let history = [];

  // Loop mulai dari baris ke-2 (Index 1) untuk lewati Header
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Struktur Kolom Sheet 'RIWAYAT_BAYAR_KASBON':
    // [0]ID_Bayar, [1]ID_Kasbon, [2]Tanggal_Bayar, [3]Nominal, [4]Tipe, [5]Ket
    
    // Ambil ID Kasbon dari Kolom B (Index 1)
    let rowID = String(row[1]).trim();

    if (rowID === targetID) {
       // Format Tanggal (Kolom C / Index 2)
       let tglRaw = row[2];
       let tglDisplay = tglRaw;
       
       // Jika formatnya Date object, kita rapikan
       if (tglRaw instanceof Date) {
          tglDisplay = Utilities.formatDate(tglRaw, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm");
       } else {
          // Jika string, biarkan atau ubah jadi string aman
          tglDisplay = String(tglRaw);
       }

       history.push({
          tanggal: tglDisplay,
          nominal: Number(row[3]), // Pastikan angka
          tipe: row[4],
          ket: row[5]
       });
    }
  }

  // Urutkan dari tanggal terbaru ke terlama
  return history.sort((a,b) => {
     if (a.tanggal < b.tanggal) return 1;
     if (a.tanggal > b.tanggal) return -1;
     return 0;
  });
}

// 2. UPDATE: SIMPAN KASBON (Dengan Tenor)
function simpanKasbon(form) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('KASBON');
  
  // Hitung Angsuran (Bulatkan ke atas biar rapi)
  const tenor = Number(form.tenor) || 1;
  const nominal = Number(form.nominal);
  const angsuran = Math.ceil(nominal / tenor);

  // Kolom: ID, Tgl, Nama, Nominal, Ket, Status, Sudah_Bayar, Tenor, Angsuran
  sheet.appendRow([
      'KSB-' + Date.now(), 
      new Date(), 
      form.nama, 
      nominal, 
      form.ket, 
      'Belum Lunas', 
      0,       // Sudah Bayar (Awal 0)
      tenor,   // Tenor
      angsuran // Angsuran per Bulan
  ]);
  
  return `Kasbon Rp ${Number(nominal).toLocaleString('id-ID')} (Cicil ${tenor}x) berhasil disimpan!`;
}

// [PERBAIKAN] Ambil Data Payroll dengan Index Kolom Baru (16 Kolom)
function getDataPayroll() {
  const karyawan = getData('KARYAWAN');
  const kasbonData = getData('KASBON');
  
  // Safety Check: Jika data karyawan kosong/null, kembalikan array kosong
  if (!karyawan || karyawan.length === 0) return [];

  let result = karyawan.map(k => {
    // --- PENYESUAIAN INDEX BARU ---
    // Struktur Baru: [0]ID, [1]Nama, ... [12]Gaji, [13]Bonus, ...
    
    let nama = k[1]; 
    let gaji = Number(k[12]) || 0; // Kolom M (Index 12)
    let bonusSet = Number(k[13]) || 0; // Kolom N (Index 13)
    
    // --- LOGIKA HUTANG (TETAP SAMA) ---
    let totalHutang = 0;
    let tagihanBulanIni = 0;
    let infoTenorList = [];

    // Cek apakah kasbonData ada isinya
    if (kasbonData && kasbonData.length > 0) {
        kasbonData.forEach(ksb => {
          if(ksb[2] === nama && String(ksb[5]).includes('Belum Lunas')) {
            let nominalUtang = Number(ksb[3]);
            let sudahBayar = Number(ksb[6]) || 0;
            let sisa = nominalUtang - sudahBayar;
            
            totalHutang += sisa;

            let tenorTotal = Number(ksb[7]) || 1; 
            let angsuran = Number(ksb[8]); 
            if(!angsuran || angsuran === 0) angsuran = sisa;

            let cicilanKe = Math.floor(sudahBayar / angsuran) + 1;
            if(cicilanKe > tenorTotal) cicilanKe = tenorTotal;

            infoTenorList.push(`(${cicilanKe}/${tenorTotal})`);
            
            let harusBayar = Math.min(angsuran, sisa);
            tagihanBulanIni += harusBayar;
          }
        });
    }

    return {
      id: k[0],
      nama: nama,
      gaji: gaji,
      bonus: bonusSet,
      sisaHutang: totalHutang, 
      kasbonPotongan: tagihanBulanIni,
      infoTenor: infoTenorList.join(', '),
      total: gaji + bonusSet - tagihanBulanIni
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

// AMBIL DATA KASBON (LENGKAP: LUNAS & BELUM)
function getDataKasbonFull() {
  return getData('KASBON');
}

function getRiwayatGajiByPeriode(periode) { 
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetRiwayat = ss.getSheetByName('RIWAYAT_GAJI');
  
  // 1. Ambil Data Karyawan Aktif (Update getDataPayroll agar bawa Tgl Masuk)
  // Kita update logika manual disini biar aman
  const sheetKaryawan = ss.getSheetByName('KARYAWAN');
  const rawKaryawan = sheetKaryawan.getDataRange().getValues().slice(1); // Skip header
  
  // Ambil Data Kasbon untuk hitung potongan
  const kasbonData = getData('KASBON'); 

  // Setup Tanggal Periode (Misal: 2026-01)
  let year = parseInt(periode.split('-')[0]);
  let month = parseInt(periode.split('-')[1]) - 1; // JS Month 0-11
  
  let startMonth = new Date(year, month, 1);
  let endMonth = new Date(year, month + 1, 0); // Tgl terakhir bulan itu
  
  // Hitung Total Hari Kerja Efektif Bulan Ini (Senin-Sabtu)
  let totalHariKerjaSebulan = hitungHariKerja(startMonth, endMonth);

  // 2. Ambil Data Riwayat yang SUDAH Disimpan
  const riwayatRaw = sheetRiwayat ? sheetRiwayat.getDataRange().getDisplayValues() : [];
  let dataSavedMap = {};
  let targetPeriode = String(periode).trim();

  for(let i=1; i<riwayatRaw.length; i++) {
     let rowP = String(riwayatRaw[i][1]).trim();
     if(rowP === targetPeriode) {
        dataSavedMap[riwayatRaw[i][3]] = {
           id: riwayatRaw[i][0],
           periode: rowP,
           nama: riwayatRaw[i][3],
           gaji: parseDuit(riwayatRaw[i][4]), // Ini gaji yang sudah tersimpan (fix)
           bonus: parseDuit(riwayatRaw[i][5]),
           kasbon: parseDuit(riwayatRaw[i][6]),
           total: parseDuit(riwayatRaw[i][7]),
           status: riwayatRaw[i][8]
        };
     }
  }

  // 3. MERGE & HITUNG PRO-RATA
  let hasilFinal = rawKaryawan.map(k => {
      let nama = k[1];
      
      // Jika sudah ada di riwayat, pakai data riwayat (jangan dihitung ulang)
      if (dataSavedMap[nama]) {
          return dataSavedMap[nama];
      } 
      
      // JIKA BELUM DIGAJI -> HITUNG BARU
      let gajiPokokDB = Number(k[12]) || 0;
      let bonusDB = Number(k[13]) || 0;
      let tglMasukDB = k[16]; // Kolom Q (Index 16) - Tanggal Masuk
      
      let gajiFinal = gajiPokokDB;
      
      // --- LOGIKA PRO-RATA ---
      if (tglMasukDB instanceof Date) {
          // Cek apakah masuk di bulan yang sama dengan periode gaji?
          if (tglMasukDB > startMonth && tglMasukDB <= endMonth) {
              
              // Hitung hari kerja dia masuk sampai akhir bulan
              let hariKerjaDia = hitungHariKerja(tglMasukDB, endMonth);
              
              // Rumus: (Hari Kerja Dia / Total Hari Kerja Bulan Ini) * Gaji Pokok
              let rasio = hariKerjaDia / totalHariKerjaSebulan;
              gajiFinal = Math.floor(gajiPokokDB * rasio); 
              
              // Pembulatan ke ratusan terdekat biar rapi (opsional)
              gajiFinal = Math.floor(gajiFinal / 100) * 100;
          }
      }
      
      // Hitung Potongan Kasbon (Logic lama)
      let tagihanKasbon = 0;
      kasbonData.forEach(ksb => {
          if(ksb[2] === nama && String(ksb[5]).includes('Belum')) {
             let sisa = Number(ksb[3]) - (Number(ksb[6]) || 0);
             let angsuran = Number(ksb[8]) || sisa;
             tagihanKasbon += Math.min(angsuran, sisa);
          }
      });

      return {
         id: 'DRAFT-' + Date.now(),
         periode: targetPeriode,
         nama: nama,
         gaji: gajiFinal, // <--- Gaji ini sudah Pro-rata Otomatis
         bonus: bonusDB,
         kasbon: tagihanKasbon,
         total: gajiFinal + bonusDB - tagihanKasbon,
         status: 'Belum Digaji'
      };
  });

  return hasilFinal;
}

// Helper untuk membersihkan "Rp 3.000.000" jadi angka 3000000
function parseDuit(val) {
   if(!val) return 0;
   let bersih = String(val).replace(/[^0-9,-]+/g,""); 
   return Number(bersih) || 0;
}

// [FIX TOTAL] Simpan Gaji Partial (Potongan Kasbon & Saldo Terupdate)
function simpanGajiBulanan(periode, listGaji) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetRiwayat = ss.getSheetByName('RIWAYAT_GAJI');
  const sheetKasbonHistory = ss.getSheetByName('RIWAYAT_BAYAR_KASBON'); 
  const keuSheet = ss.getSheetByName('KEUANGAN');
  const kasbonSheet = ss.getSheetByName('KASBON');
  const kasbonData = kasbonSheet.getDataRange().getValues();
  const waktu = new Date();
  
  const periodeClean = String(periode).trim();

  // --- 1. HAPUS DATA LAMA (Agar tidak duplikat saat update) ---
  const dataLama = sheetRiwayat.getDataRange().getDisplayValues();
  const namaYangDiproses = listGaji.map(x => x.nama);

  for (let i = dataLama.length - 1; i >= 1; i--) {
      let rowPeriode = String(dataLama[i][1]).trim();
      let rowNama = String(dataLama[i][3]).trim();
      if (rowPeriode === periodeClean && namaYangDiproses.includes(rowNama)) {
          sheetRiwayat.deleteRow(i + 1);
      }
  }

  // --- 2. SIMPAN DATA BARU ---
  let totalKeluarSesiIni = 0;

  listGaji.forEach(k => {
      // A. Handle Kasbon Baru (Uang Cair Tambahan)
      let nominalKasbonBaru = Number(k.kasbonBaru) || 0;
      if (nominalKasbonBaru > 0) {
          kasbonSheet.appendRow(['KSB-' + Date.now(), waktu, k.nama, nominalKasbonBaru, k.ketKasbonBaru || 'Kasbon via Payroll', 'Belum Lunas', 0, 1, nominalKasbonBaru]);
      }

      // B. Handle Potongan Kasbon (Bayar Hutang) - [PERBAIKAN DISINI]
      // Kita panggil 'kasbonPotongan' (sesuai JS), bukan 'potonganManual'
      let bayarBulanIni = Number(k.kasbonPotongan) || 0; 

      if(bayarBulanIni > 0) {
          for(let i=1; i<kasbonData.length; i++) {
            // Cari karyawan yang punya hutang 'Belum Lunas'
            if(kasbonData[i][2] == k.nama && String(kasbonData[i][5]).includes('Belum') && bayarBulanIni > 0) {
               let sisaHutangDb = Number(kasbonData[i][3]) - (Number(kasbonData[i][6]) || 0);
               
               // Alokasikan pembayaran
               let alokasi = Math.min(sisaHutangDb, bayarBulanIni);
               
               let newSudah = (Number(kasbonData[i][6]) || 0) + alokasi;
               
               // Update Sheet KASBON
               kasbonSheet.getRange(i+1, 7).setValue(newSudah); // Update Kolom G (Sudah Bayar)
               
               // Cek Lunas?
               if(newSudah >= Number(kasbonData[i][3])) {
                   kasbonSheet.getRange(i+1, 6).setValue('Lunas');
               }

               // Catat History Pembayaran
               sheetKasbonHistory.appendRow(['AUTO-' + Date.now(), kasbonData[i][0], waktu, alokasi, 'Potong Gaji', 'Payroll ' + periode]);
               
               // Kurangi jatah bayar (jika punya multiple hutang)
               bayarBulanIni -= alokasi;
            }
          }
      }

      // C. Simpan ke RIWAYAT GAJI
      // Total Potongan = Cicilan Kasbon + Potongan Lain-lain
      let potonganLain = Number(k.potonganLain) || 0;
      let totalPotonganDicatat = (Number(k.kasbonPotongan) || 0) + potonganLain;

      sheetRiwayat.appendRow([
          'PAY-' + Date.now(), 
          periodeClean, 
          waktu, 
          k.nama, 
          k.gaji, 
          Number(k.bonus) + nominalKasbonBaru, 
          totalPotonganDicatat, // Kolom G (Potongan) sekarang sudah benar
          k.total, 
          'Sukses'
      ]);
      
      totalKeluarSesiIni += Number(k.total);
  });

  // --- 3. KEUANGAN (CATAT PENGELUARAN UANG REAL) ---
  if(totalKeluarSesiIni > 0) {
     keuSheet.appendRow([
         'PAYROLL-' + Date.now(), 
         waktu, 
         'Pengeluaran', 
         'Gaji Karyawan', 
         totalKeluarSesiIni, 
         `Payroll ${periodeClean} (${listGaji.length} Org)`, 
         'Kas Tunai (Laci)'
     ]);
  }
  
  SpreadsheetApp.flush(); 
  return "Gaji berhasil dicairkan! Kasbon & Saldo terupdate.";
}

// --- HELPER: HITUNG HARI KERJA (SENIN - SABTU) ---
function hitungHariKerja(tglMulai, tglSelesai) {
  let count = 0;
  let curDate = new Date(tglMulai.getTime());
  
  while (curDate <= tglSelesai) {
    let dayOfWeek = curDate.getDay();
    // 0 = Minggu. Hitung jika BUKAN Minggu (1-6)
    if(dayOfWeek !== 0) { 
       count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
}

// --- MODUL LAPORAN TERPUSAT ---

function getLaporanDetail(startStr, endStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Parsing Tanggal Filter (Set Jam ke 00:00 dan 23:59)
  const startDate = new Date(startStr); startDate.setHours(0,0,0,0);
  const endDate = new Date(endStr); endDate.setHours(23,59,59,999);

  // 2. Ambil Semua Data Mentah
  const prodData = getData('PRODUK');
  const trxData = getData('TRANSAKSI');
  const keuData = getData('KEUANGAN');
  
  // 3. Inisialisasi Variabel Laporan
  let laporan = {
    pendapatan: 0,
    hpp: 0,           // Harga Pokok Penjualan
    pengeluaran: 0,   // Beban Operasional
    pembelian: 0,     // Belanja Stok
    nilaiStok: 0,     // Aset Stok Saat Ini
    labaKotor: 0,
    labaBersih: 0,
    metodeBayar: {},  // Ringkasan Metode Bayar
    listPengeluaran: [] // Detail Tabel Pengeluaran
  };

  // A. HITUNG NILAI STOK SAAT INI (Snapshot)
  // Rumus: Stok Isi * Harga Beli
  prodData.forEach(p => {
    let hargaBeli = Number(p[3]) || 0;
    let stok = Number(p[4]) || 0;
    laporan.nilaiStok += (stok * hargaBeli);
  });

  // B. HITUNG TRANSAKSI (Pendapatan, HPP, Metode Bayar)
  // Map Harga Beli Produk untuk lookup HPP
  let mapHargaBeli = {}; 
  prodData.forEach(p => mapHargaBeli[p[1]] = Number(p[3]) || 0);

  trxData.forEach(row => {
    let tgl = new Date(row[1]);
    if (tgl >= startDate && tgl <= endDate) {
        
        let produk = row[3];
        let qty = Number(row[4]);
        let totalJual = Number(row[5]);
        let metode = row[8]; // Kolom I
        let status = row[10];

        // Hanya hitung jika tidak dibatalkan (Opsional: sesuaikan logika status)
        // Disini kita anggap semua transaksi yg tercatat adalah valid penjualan
        
        // 1. Pendapatan
        laporan.pendapatan += totalJual;

        // 2. HPP (Estimasi: Qty * Harga Beli Terakhir di Master)
        let modalSatuan = mapHargaBeli[produk] || 0;
        laporan.hpp += (qty * modalSatuan);

        // 3. Ringkasan Metode Bayar
        if(!laporan.metodeBayar[metode]) laporan.metodeBayar[metode] = 0;
        laporan.metodeBayar[metode] += totalJual;
    }
  });

  // C. HITUNG KEUANGAN (Pengeluaran & Pembelian Stok)
  keuData.forEach(row => {
    let tgl = new Date(row[1]);
    if (tgl >= startDate && tgl <= endDate) {
        let jenis = row[2]; // Pemasukan / Pengeluaran
        let kategori = row[3];
        let nominal = Number(row[4]);
        
        if (jenis === 'Pengeluaran') {
           // Pisahkan antara "Beli Stok" dan "Beban Operasional"
           if (kategori === 'Pembelian Stok') {
              laporan.pembelian += nominal;
           } else if (kategori !== 'Retur Penjualan') { 
              // Retur biasanya mengurangi pendapatan, tapi disini kita masukkan ke Pengeluaran Operasional atau abaikan jika sudah handle di struk.
              // Kita anggap semua pengeluaran selain beli stok adalah Beban.
              laporan.pengeluaran += nominal;
              
              // Masukkan ke List Detail Pengeluaran
              laporan.listPengeluaran.push({
                 id: row[0],
                 tanggal: row[1],
                 kategori: kategori,
                 ket: row[5],
                 jumlah: nominal
              });
           }
        }
    }
  });

  // D. FINALISASI (Laba Rugi)
  laporan.labaKotor = laporan.pendapatan - laporan.hpp;
  laporan.labaBersih = laporan.labaKotor - laporan.pengeluaran;

  return laporan;
}
