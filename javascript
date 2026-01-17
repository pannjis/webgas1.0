<script>
  let salesChartInstance = null;
  let pieChartInstance = null;
  let currentUser = {};
  let globalCompanyProfile = {};
  let globalListPelanggan = [];
  let globalListSupplier = [];
  let globalListKaryawan = [];
  let globalKeuanganData = [];
  let sessionPayrollData = [];
  let globalListAkun = [];
  let dataGajiPreview = [];
  let payrollDataTemp = [];
  let keranjangBelanja = [];
  let globalRiwayatData = [];
  let dataJualTemp = [];
  let dataBeliTemp = [];
  let keranjangBeli = [];
  let globalProdukList = [];
  let tempProductPOS = {};
  let globalModalObj;
  let onConfirmAction = null;
  const rupiah = (n) => new Intl.NumberFormat('id-ID', {style: 'currency', currency: 'IDR', minimumFractionDigits:0}).format(n);

window.onload = function() { 
      // 1. Setup Database
      google.script.run.setupDatabase(); 

      // 2. Pindahkan Modal
      const modals = document.querySelectorAll('.modal');
      modals.forEach(m => document.body.appendChild(m));

      // 3. Init Modal Global
      initModal();
      
      // 4. Aktifkan Tanggal (Sekaligus isi default value)
      initTanggal(); 
      
      // (Baris setAutoDate DIBUANG saja karena sudah di-handle initTanggal)

      loadNotifHutang();
};

// --- LOGIKA PENCARIAN PELANGGAN ALA GOOGLE (UPDATE) ---

// 1. Fungsi Helper: Tampilkan Menu Default (Umum + 5 Pelanggan)
function tampilkanMenuDefault() {
    const container = document.getElementById('hasil-cari-container');
    container.innerHTML = ''; 

    // A. Opsi "Umum" (Paling Atas)
    const btnUmum = document.createElement('button');
    btnUmum.className = 'list-group-item list-group-item-action fw-bold text-primary py-2';
    btnUmum.innerHTML = 'Umum (Default)';
    btnUmum.onclick = function() {
            document.getElementById('kasir-pelanggan').value = 'Umum';
            container.classList.add('d-none');
    };
    container.appendChild(btnUmum);

    // B. Tambahkan 5 Pelanggan Teratas dari Database
    if(globalListPelanggan && globalListPelanggan.length > 0) {
        globalListPelanggan.slice(0, 5).forEach(r => {
            let label = r[1]; // Nama Kontak
            let subLabel = r[2] ? r[2] : ''; // Nama Perusahaan

            let display = `
                <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-bold text-dark text-truncate" style="font-size:13px; max-width: 65%;">${label}</span>
                    ${subLabel ? `<small class="text-muted text-end text-truncate" style="font-size:10px; max-width: 30%;">${subLabel}</small>` : ''}
                </div>
            `;

            const btn = document.createElement('button');
            btn.className = 'list-group-item list-group-item-action text-start py-1 px-2';
            btn.innerHTML = display;
            
            btn.onclick = function() {
                let finalVal = r[1];
                if(r[2]) finalVal = `${r[2]} (${r[1]})`;
                document.getElementById('kasir-pelanggan').value = finalVal;
                container.classList.add('d-none');
            };
            container.appendChild(btn);
        });
    }
    container.classList.remove('d-none'); // Pastikan muncul
}

// Panggil fungsi ini saat halaman dimuat, misal gabungkan di loadSemuaDataAwal()
function loadMetodeBayarKasir() {
    const sel = document.getElementById('pos-metode-bayar');
    
    google.script.run.withSuccessHandler(akunList => {
        sel.innerHTML = ''; // Bersihkan dulu

        // 1. Masukkan Akun-Akun Keuangan (Tunai, BCA, BRI, dll)
        akunList.forEach(akun => {
            // Value kita isi dengan Nama Akun agar nyambung ke sheet KEUANGAN
            sel.innerHTML += `<option value="${akun.nama}">${akun.nama}</option>`;
        });

        // 2. Tambahkan Garis Pemisah (Opsional, agar rapi)
        sel.innerHTML += `<option disabled>------------------</option>`;

        // 3. Tambahkan Opsi HUTANG (Wajib ada)
        sel.innerHTML += `<option value="Hutang">⚠️ Hutang / Bon</option>`;
        
    }).getDaftarAkun(); // Fungsi ini sudah kita buat di langkah sebelumnya
}

// [PENTING] Update Event Listener agar Hutang tetap memunculkan tanggal jatuh tempo
// Ganti event listener lama 'pos-metode-bayar' dengan yang ini:
document.getElementById('pos-metode-bayar')?.addEventListener('change', function() {
    const val = this.value;
    const box = document.getElementById('box-jatuh-tempo');
    
    // Logic: Jika pilih Hutang, munculkan tanggal. Jika Akun Bank/Tunai, sembunyikan.
    if(val === 'Hutang') {
        box.classList.remove('d-none');
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        // Cek apakah flatpickr aktif
        if(document.getElementById('pos-jatuh-tempo')._flatpickr) {
             document.getElementById('pos-jatuh-tempo')._flatpickr.setDate(nextWeek);
        } else {
             document.getElementById('pos-jatuh-tempo').value = nextWeek.toISOString().split('T')[0];
        }
    } else {
        box.classList.add('d-none');
    }
});

// 2. Saat Mengetik / Hapus Teks (Input Event)
document.getElementById('kasir-pelanggan')?.addEventListener('input', function() {
    const keyword = this.value.toLowerCase();
    const container = document.getElementById('hasil-cari-container');
    
    // --- [PERUBAHAN UTAMA DI SINI] ---
    // Jika input jadi kosong (dihapus), panggil menu default lagi
    if(keyword.length < 1) {
        tampilkanMenuDefault(); 
        return; 
    }
    // ---------------------------------

    // Jika ada teks, lakukan pencarian seperti biasa
    container.innerHTML = ''; // Bersihkan default

    const hasil = globalListPelanggan.filter(r => {
        const nama = r[1].toLowerCase();
        const pt = r[2] ? r[2].toLowerCase() : '';
        return nama.includes(keyword) || pt.includes(keyword);
    });

    if(hasil.length === 0) {
         container.innerHTML = '<div class="list-group-item text-muted small">Data tidak ditemukan.</div>';
         container.classList.remove('d-none');
         return;
    }
    
    // Render Hasil Pencarian (Maks 7)
    hasil.slice(0, 7).forEach(r => {
        let label = r[1];
        let subLabel = r[2] ? r[2] : '';
        
        let display = `
            <div class="d-flex justify-content-between align-items-center">
                <span class="fw-bold text-dark text-truncate" style="font-size:13px; max-width: 65%;">${label}</span>
                ${subLabel ? `<small class="text-muted text-end text-truncate" style="font-size:10px; max-width: 30%;">${subLabel}</small>` : ''}
            </div>
        `;
        
        const btn = document.createElement('button');
        btn.className = 'list-group-item list-group-item-action text-start py-1 px-2';
        btn.innerHTML = display;
        
        btn.onclick = function() {
            let finalVal = r[1];
            if(r[2]) finalVal = `${r[2]} (${r[1]})`;
            document.getElementById('kasir-pelanggan').value = finalVal;
            container.classList.add('d-none');
        };
        container.appendChild(btn);
    });
    
    container.classList.remove('d-none');
});

// 3. Saat Field Diklik (Focus) - Tampilkan Default
document.getElementById('kasir-pelanggan')?.addEventListener('focus', function() {
    if(this.value === '') {
        tampilkanMenuDefault();
    }
});

// 4. Sembunyikan Dropdown jika klik di luar
document.addEventListener('click', function(e) {
    if (e.target.id !== 'kasir-pelanggan') {
        document.getElementById('hasil-cari-container').classList.add('d-none');
    }
});

  function initModal() {
     if(!globalModalObj) globalModalObj = new bootstrap.Modal(document.getElementById('globalModal'));
  }

  // 1. PENGGANTI ALERT (Hanya Tombol OK)
  function myAlert(title, message, type = 'info') {
     initModal();
     document.getElementById('globalModalTitle').innerText = title;
     document.getElementById('globalModalBody').innerText = message;
     document.getElementById('btn-cancel').classList.add('d-none'); // Sembunyikan tombol Batal
     
     const btnOk = document.getElementById('btn-confirm');
     btnOk.innerText = "OK";
     btnOk.onclick = () => globalModalObj.hide();

     // Styling Warna Header & Icon
     const header = document.getElementById('globalModalHeader');
     const icon = document.getElementById('globalModalIcon');
     header.className = 'modal-header text-white'; // Reset
     
     if(type === 'error') {
        header.classList.add('bg-danger');
        icon.innerText = 'error_outline';
        icon.style.color = '#dc3545';
        btnOk.className = 'btn btn-danger px-4';
     } else if (type === 'success') {
        header.classList.add('bg-success');
        icon.innerText = 'check_circle';
        icon.style.color = '#198754';
        btnOk.className = 'btn btn-success px-4';
     } else {
        header.classList.add('bg-primary');
        icon.innerText = 'info';
        icon.style.color = '#0d6efd';
        btnOk.className = 'btn btn-primary px-4';
     }

     globalModalObj.show();
  }

  // 2. PENGGANTI CONFIRM (Tombol Ya & Batal)
  function myConfirm(title, message, callback) {
     initModal();
     document.getElementById('globalModalTitle').innerText = title;
     document.getElementById('globalModalBody').innerText = message;
     document.getElementById('btn-cancel').classList.remove('d-none'); // Munculkan tombol Batal
     
     // Styling
     const header = document.getElementById('globalModalHeader');
     const icon = document.getElementById('globalModalIcon');
     header.className = 'modal-header text-white bg-warning'; // Warna kuning untuk warning
     icon.innerText = 'help_outline';
     icon.style.color = '#ffc107';

     const btnYes = document.getElementById('btn-confirm');
     btnYes.innerText = "YA, LANJUTKAN";
     btnYes.className = 'btn btn-warning fw-bold px-4';
     
     // Set Action saat klik YA
     btnYes.onclick = () => {
        globalModalObj.hide();
        if(callback) callback(); // Jalankan fungsi yang dikirim
     };

     globalModalObj.show();
  }
  
  // --- FUNGSI LOADING (ANIMASI) ---
  function loading(status) {
    const el = document.getElementById('loading-overlay');
    if(el) { // Cek jika elemen ada agar tidak error
        if(status) {
            el.classList.remove('d-none');
        } else {
            el.classList.add('d-none');
        }
    }
  }

function showPage(pageId) {
    // 1. Ganti Halaman (UI Saja)
    document.querySelectorAll('.page-section').forEach(el => el.classList.add('d-none'));
    const targetPage = document.getElementById('page-' + pageId);
    if(targetPage) targetPage.classList.remove('d-none');
    
    // 2. Update Navigasi Aktif (RESET SEMUA DULU)
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    
    // 3. Set Aktif pada Tombol yang Diklik (JIKA ADA ID-NYA)
    const navEl = document.getElementById('nav-' + pageId);
    if(navEl) {
        navEl.classList.add('active');
    }
    
    // 4. Khusus Menu Riwayat: Pastikan Submenu Terbuka
    if(pageId === 'riwayat-jual' || pageId === 'riwayat-beli' || pageId === 'riwayat-piutang') {
        const collapseRiwayat = document.getElementById('submenu-riwayat');
        // Jika tertutup, buka secara manual
        if(collapseRiwayat && !collapseRiwayat.classList.contains('show')) {
            new bootstrap.Collapse(collapseRiwayat, { show: true });
        }
    }
    
    // --- LOAD DATA (Sama seperti sebelumnya) ---
    if(pageId === 'riwayat-jual') {
        setAutoDate('jual'); 
        loadRiwayatJual(); 
    }
    if(pageId === 'riwayat-beli') {
        setAutoDate('beli'); 
        loadRiwayatBeli(); 
    }
    if(pageId === 'riwayat-piutang') loadPiutang();
    if(pageId === 'pembelian') loadPembelianData();
    if(pageId === 'edit-produk') {
       // Opsional: Jika user refresh saat di halaman edit, kembalikan ke produk
       // showPage('produk'); 
    }

    // --- PERBAIKAN: Load data karyawan saat menu Payroll dibuka ---
    if(pageId === 'payroll') {
        loadKaryawan(); 
        loadKasbon(); // Opsional: sekalian load kasbon biar siap
    }

    if (pageId === 'laporan') {
    // 1. [FIX] Paksa Reset ke Tab Pertama (Laba) setiap kali menu dibuka
    // Ini akan memperbaiki tampilan yang berantakan/tumpang tindih
    const triggerFirstTab = document.querySelector('#laporanTabs button[data-bs-target="#tab-laba"]');
    if(triggerFirstTab) {
        bootstrap.Tab.getOrCreateInstance(triggerFirstTab).show();
    }

    // 2. Load Data (Logic Lama)
    // Cek apakah tanggal sudah terisi? Jika belum, set default bulan ini
    // (Pastikan mengecek _flatpickr dulu agar tanggal muncul)
    const elStart = document.getElementById('lap-start');
    if (!elStart.value) {
        setFilterLaporan('bulan_ini');
    } else {
        loadLaporanUtama();
    }
    }
}

function handleLogin() {
  const u = document.getElementById('username').value;
  const p = document.getElementById('password').value;
  
  if(!u || !p) return myAlert('Isian Kosong', 'Harap isi username & password!', 'warning');

  loading(true); // Layar Putih Nyala

    google.script.run
        .withSuccessHandler(function(res) {
            
            if(res.status === 'success') {
                currentUser = res;
                document.getElementById('display-user').innerText = res.nama;
                
                // 1. PANGGIL SEMUA DATA DI SINI
                loadSemuaDataAwal(); 

                // 2. Beri waktu 1.5 detik agar data sempat terambil, baru buka aplikasi
                // User akan melihat loading selama 1.5 detik, tapi setelah itu aplikasi NGEBUT.
                setTimeout(function() {
                  loading(false); // Matikan loading
                  document.getElementById('login-section').classList.add('d-none');
                  document.getElementById('main-app').classList.remove('d-none');
                  showPage('dashboard');
                }, 1500); 

            } else {
                loading(false);
                myAlert('Gagal Masuk', 'Username atau Password salah!', 'error');
            }
        })
        .withFailureHandler(function(e) {
            loading(false);
            myAlert('Error Server', 'Gagal terhubung: ' + e, 'error');
        })
        .loginUser(u, p);
}
  
  function logout() {
    // 1. Tampilkan Loading sebentar agar transisi halus
    loading(true);

    setTimeout(() => {
        // 2. Reset Variabel User (Hapus sesi di memori browser)
        currentUser = {};
        
        // 3. Reset Tampilan: Sembunyikan Dashboard, Munculkan Login
        document.getElementById('main-app').classList.add('d-none'); // Tutup Dashboard
        document.getElementById('login-section').classList.remove('d-none'); // Buka Login

        // 4. Bersihkan Form Input Login
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        
        // 5. Matikan Loading
        loading(false);
    }, 500); // Beri jeda 0.5 detik
}

function loadSemuaDataAwal() {
    // Kita panggil semua fungsi data di sini secara paralel
    console.log("Memulai preload data...");
    
    loadDashboard();   // Update angka dashboard
    loadProduk();      // Update stok & harga
    loadPelanggan();   // Update list pelanggan
    loadKeuangan();    // Update tabel kas
    loadNotifHutang(); // Cek notifikasi hutang
    
    // Khusus Dropdown Pelanggan (untuk Kasir)
    loadPelangganDropdown();
    loadCompanyProfile(); 
    loadMetodeBayarKasir();
}

// Tambahkan di fungsi switchSettingTab yang sudah ada
function switchSettingTab(tab, btn) {
   // Reset UI (Sembunyikan semua konten)
   document.querySelectorAll('.setting-content').forEach(el => el.classList.add('d-none'));
   document.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active'));
   
   // Aktifkan Target
   document.getElementById('set-content-' + tab).classList.remove('d-none');
   btn.classList.add('active');

   if(tab === 'users') loadUsers();
   if(tab === 'akun') loadSettingAkun(); // <--- TAMBAHAN: Load Akun saat tab diklik
}

// UPDATE 1: Fungsi Load Tabel Setting (Menampilkan No Rek)
function loadSettingAkun() {
    const tbody = document.querySelector('#tabel-setting-akun tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';

    google.script.run.withSuccessHandler(data => {
        tbody.innerHTML = '';
        if(data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Belum ada akun.</td></tr>';
            return;
        }

        data.forEach(acc => {
            // acc.norek sekarang sudah tersedia dari backend
            let displayNorek = acc.norek ? acc.norek : '-';

            tbody.innerHTML += `
            <tr>
                <td class="fw-bold text-dark">${acc.nama}</td>
                <td class="text-primary fw-bold" style="font-family:monospace; font-size:1.1em;">${displayNorek}</td>
                <td><span class="badge bg-light text-dark border">${acc.tipe}</span></td>
                <td>${rupiah(acc.saldo)}</td>
                <td>
                    <button class="btn btn-sm btn-light text-danger border" onclick="hapusAkunJS('${acc.id}')">
                        <i class="material-icons" style="font-size:14px">delete</i>
                    </button>
                </td>
            </tr>
            `;
        });
    }).getDaftarAkun();
}

// UPDATE 2: Fungsi Modal (Reset Input Baru)
function modalTambahAkun() {
    document.getElementById('input-akun-nama').value = '';
    document.getElementById('input-akun-norek').value = ''; // Reset Norek
    document.getElementById('input-akun-tipe').value = 'Bank';
    document.getElementById('input-akun-saldo').value = '0';
    new bootstrap.Modal(document.getElementById('modalAkunBaru')).show();
}

// UPDATE 3: Fungsi Simpan (Kirim Norek)
function simpanAkunBaruJS() {
    const nama = document.getElementById('input-akun-nama').value;
    const norek = document.getElementById('input-akun-norek').value || '-'; // Ambil Norek
    const tipe = document.getElementById('input-akun-tipe').value;
    const saldo = document.getElementById('input-akun-saldo').value;

    if(!nama) return myAlert('Error', 'Nama akun wajib diisi', 'warning');

    const payload = {
        nama: nama,
        norek: norek, // Masukkan ke payload
        tipe: tipe,
        saldo: saldo
    };

    loading(true);
    google.script.run.withSuccessHandler(res => {
        loading(false);
        bootstrap.Modal.getInstance(document.getElementById('modalAkunBaru')).hide();
        myAlert('Sukses', res, 'success');
        
        loadSettingAkun(); 
        loadMetodeBayarKasir(); 

    }).simpanAkunBaru(payload);
}

function hapusAkunJS(id) {
    myConfirm('Hapus Akun', 'Yakin ingin menghapus akun ini? Data transaksi lama tetap ada, tapi akun hilang dari pilihan.', () => {
        loading(true);
        google.script.run.withSuccessHandler(res => {
            loading(false);
            
            // Refresh Tabel Pengaturan
            loadSettingAkun();
            
            // [TAMBAHAN PENTING] Refresh Dropdown Kasir
            loadMetodeBayarKasir(); 
            
            myAlert('Info', res, 'success');
        }).hapusAkun(id);
    });
}

// 1. FUNGSI PREVIEW LOGO (Baru)
function previewLogo(input) {
    const preview = document.getElementById('img-preview-logo');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.classList.remove('d-none');
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// 2. UPDATE FUNGSI LOAD (Agar menampilkan logo yang sudah tersimpan)
// Ganti fungsi loadCompanyProfile() yang lama dengan ini:
function loadCompanyProfile() {
   google.script.run.withSuccessHandler(config => {
      globalCompanyProfile = config; 
      
      document.getElementById('set-comp-nama').value = config.nama_perusahaan || '';
      document.getElementById('set-comp-owner').value = config.nama_pemilik || '';
      document.getElementById('set-comp-alamat').value = config.alamat || '';
      document.getElementById('set-comp-no-pt').value = config.no_perusahaan || '';
      document.getElementById('set-comp-no-owner').value = config.no_pemilik || '';

      // Tampilkan Logo jika ada
      const imgPrev = document.getElementById('img-preview-logo');
      if(config.logo_perusahaan) {
          imgPrev.src = config.logo_perusahaan;
          imgPrev.classList.remove('d-none');
      }

   }).getProfilPerusahaan();
}

// 3. UPDATE FUNGSI SIMPAN (Agar mengirim file gambar ke backend)
// Ganti fungsi simpanProfilPerusahaanJS() yang lama dengan ini:
function simpanProfilPerusahaanJS() {
   const fileInput = document.getElementById('set-comp-logo');
   const file = fileInput.files[0];

   const payload = {
      nama_perusahaan: document.getElementById('set-comp-nama').value,
      nama_pemilik: document.getElementById('set-comp-owner').value,
      alamat: document.getElementById('set-comp-alamat').value,
      no_perusahaan: document.getElementById('set-comp-no-pt').value,
      no_pemilik: document.getElementById('set-comp-no-owner').value,
      logo: null // Default null
   };
   
   // Fungsi Kirim Data (Sub-function agar rapi)
   const kirim = (data) => {
       loading(true);
       google.script.run.withSuccessHandler(res => {
          loading(false);
          // Update global profile agar Invoice langsung berubah tanpa refresh
          globalCompanyProfile = data; 
          // Jika ada logo baru di response (biasanya URL), update juga (tapi disini kita reload aja biar aman)
          loadCompanyProfile(); 
          
          myAlert('Sukses', res, 'success');
       }).simpanProfilPerusahaan(data);
   };

   // Cek apakah ada file logo yang dipilih?
   if (file) {
       // Validasi Ukuran (Maks 2MB)
       if(file.size > 2 * 1024 * 1024) return myAlert('File Besar', 'Maksimal ukuran logo 2MB', 'warning');

       const reader = new FileReader();
       reader.onload = function(e) {
           payload.logo = {
               data: e.target.result.split(',')[1], // Ambil base64
               mimeType: file.type
           };
           kirim(payload); // Kirim dengan logo
       };
       reader.readAsDataURL(file);
   } else {
       kirim(payload); // Kirim tanpa update logo (data teks saja)
   }
}

// 3. LOGIKA MANAJEMEN USER
function loadUsers() {
   google.script.run.withSuccessHandler(users => {
      const tb = document.querySelector('#tabel-users tbody');
      tb.innerHTML = '';
      
      users.forEach(u => {
         // u[0]:Username, u[2]:Role, u[3]:Nama
         let badge = u[2] === 'Admin' ? '<span class="badge bg-danger">ADMIN</span>' : '<span class="badge bg-secondary">USER</span>';
         
         tb.innerHTML += `
            <tr>
               <td>${u[3]}</td>
               <td class="fw-bold">${u[0]}</td>
               <td>${badge}</td>
               <td>
                  <button class="btn btn-sm btn-warning" onclick="editUser('${u[0]}','${u[3]}','${u[2]}')"><i class="material-icons" style="font-size:14px">edit</i></button>
                  ${u[0] !== 'admin' && u[0] !== currentUser.username ? `<button class="btn btn-sm btn-light text-danger border" onclick="hapusUserJS('${u[0]}')"><i class="material-icons" style="font-size:14px">delete</i></button>` : ''}
               </td>
            </tr>
         `;
      });
   }).getAllUsers();
}

function modalUserBaru() {
   document.getElementById('modalUserTitle').innerText = 'User Baru';
   document.getElementById('user-is-edit').value = 'false';
   document.getElementById('user-username').value = '';
   document.getElementById('user-username').removeAttribute('readonly');
   document.getElementById('user-nama').value = '';
   document.getElementById('user-pass').value = '';
   document.getElementById('note-pass-edit').classList.add('d-none');
   document.getElementById('role-admin').checked = false;
   
   new bootstrap.Modal(document.getElementById('modalUser')).show();
}

function editUser(username, nama, role) {
   document.getElementById('modalUserTitle').innerText = 'Edit User';
   document.getElementById('user-is-edit').value = 'true';
   
   document.getElementById('user-username').value = username;
   document.getElementById('user-username').setAttribute('readonly', true); // Username gak boleh ganti
   
   document.getElementById('user-nama').value = nama;
   document.getElementById('user-pass').value = '';
   document.getElementById('note-pass-edit').classList.remove('d-none');
   
   // Set Checkbox berdasarkan Role
   document.getElementById('role-admin').checked = (role === 'Admin');
   
   new bootstrap.Modal(document.getElementById('modalUser')).show();
}

// Cari fungsi ini di javascript.html dan GANTI isinya:

function simpanUserDB() {
   const isEdit = document.getElementById('user-is-edit').value === 'true';
   const username = document.getElementById('user-username').value.trim();
   const nama = document.getElementById('user-nama').value;
   const pass = document.getElementById('user-pass').value;
   const isAdmin = document.getElementById('role-admin').checked;
   
   if(!username || !nama) return myAlert('Error', 'Username dan Nama wajib diisi', 'error');
   if(!isEdit && !pass) return myAlert('Error', 'Password wajib diisi untuk user baru', 'error');

   const payload = {
      isEdit: isEdit,
      username: username,
      nama: nama,
      password: pass, 
      role: isAdmin ? 'Admin' : 'User' 
   };
   
   loading(true);
   google.script.run.withSuccessHandler(res => {
      loading(false);
      if(res.includes('Error')) {
         myAlert('Gagal', res, 'error');
      } else {
         myAlert('Sukses', res, 'success');
         bootstrap.Modal.getInstance(document.getElementById('modalUser')).hide();
         loadUsers();

         // --- [TAMBAHAN BARU] ---
         // Jika user yang diedit adalah user yang sedang login, update tampilan langsung
         if (currentUser.username === username) {
             currentUser.nama = nama; // Update memori
             currentUser.role = payload.role;
             
             // Update Teks di Pojok Kanan Atas
             const displayUser = document.getElementById('display-user');
             if(displayUser) displayUser.innerText = nama;
         }
         // -----------------------
      }
   }).simpanUserBaru(payload);
}

function hapusUserJS(username) {
   myConfirm('Hapus User', `Yakin hapus user ${username}?`, () => {
      loading(true);
      google.script.run.withSuccessHandler(res => {
         loading(false);
         loadUsers();
         myAlert('Info', res, 'success');
      }).hapusUser(username);
   });
}

// 4. GANTI PASSWORD SENDIRI
function modalGantiPassword() {
   document.getElementById('gp-old').value = '';
   document.getElementById('gp-new').value = '';
   new bootstrap.Modal(document.getElementById('modalGantiPass')).show();
}

function prosesGantiPassword() {
   const oldP = document.getElementById('gp-old').value;
   const newP = document.getElementById('gp-new').value;
   
   if(!oldP || !newP) return myAlert('Error', 'Isi semua field', 'warning');
   
   loading(true);
   // currentUser.username didapat dari loginResult yang sudah diupdate di Code.gs
   google.script.run.withSuccessHandler(res => {
      loading(false);
      if(res.includes('Berhasil')) {
          myAlert('Sukses', res, 'success');
          bootstrap.Modal.getInstance(document.getElementById('modalGantiPass')).hide();
      } else {
          myAlert('Gagal', res, 'error');
      }
   }).gantiPasswordSendiri(currentUser.username, oldP, newP);
}


function loadDashboard(startDate = null, endDate = null) {
  // Loading state
  const incomeEl = document.getElementById('dash-main-income');
  if(incomeEl) incomeEl.innerText = 'Loading...';
  
  google.script.run.withSuccessHandler(res => {
    const stats = res.stats;
    const accounts = res.accounts;

    // 1. UPDATE INFO PERIODE
    document.getElementById('dash-periode-info').innerText = `Periode: ${res.periode}`;
    
    // 2. UPDATE NILAI KARTU
    document.getElementById('dash-main-income').innerText = rupiah(stats.pendapatan);
    document.getElementById('dash-avg-trx').innerText = `Rata-rata: ${rupiah(stats.rataRataTransaksi)} / trx`;
    
    document.getElementById('dash-main-expense').innerText = rupiah(stats.pengeluaran);
    document.getElementById('dash-retur').innerText = `Retur: ${rupiah(stats.retur)}`;
    
    document.getElementById('dash-count-order').innerText = stats.pesanan;
    document.getElementById('dash-count-pel').innerText = `${stats.totalPelanggan} Pelanggan`;
    
    document.getElementById('dash-count-refill').innerText = stats.qtyRefill + " Pcs";

    // 3. RENDER TABEL PRODUK
    const prodTable = document.getElementById('tabel-top-produk');
    if(prodTable) {
        prodTable.innerHTML = '';
        const sortedProduk = Object.entries(stats.produkTerjual).sort(([,a],[,b]) => b - a);
        if(sortedProduk.length === 0) {
            prodTable.innerHTML = '<tr><td class="text-center text-muted">Tidak ada data.</td></tr>';
        } else {
            sortedProduk.forEach(([nama, qty]) => {
                prodTable.innerHTML += `
                <tr>
                    <td class="ps-3"><span class="fw-bold text-dark" style="font-size:13px">${nama}</span></td>
                    <td class="text-end pe-3"><span class="badge bg-light text-dark border fw-bold">${qty}</span></td>
                </tr>`;
            });
        }
    }

    // 4. RENDER CHART
    renderCharts(stats); // Panggil fungsi renderCharts yg sudah dibuat sebelumnya

  }).getDashboardRealtime(startDate, endDate);
}

// --- FUNGSI BARU UNTUK TOMBOL FILTER ---

function applyDashboardFilter() {
    const start = document.getElementById('dash-date-start').value;
    const end = document.getElementById('dash-date-end').value;
    
    if(!start || !end) {
        Swal.fire('Error', 'Harap pilih tanggal awal dan akhir', 'warning');
        return;
    }
    
    loadDashboard(start, end);
}

function resetDashboardFilter() {
    // Reset input tanggal
    document.getElementById('dash-date-start').value = '';
    document.getElementById('dash-date-end').value = '';
    
    // Load default (Bulan Ini)
    loadDashboard(); 
}

// Inisialisasi awal saat halaman dibuka
document.addEventListener('DOMContentLoaded', function() {
    // ... init lainnya ...
    // loadDashboard(); // Pastikan dipanggil di init utama
});

// FUNGSI RENDER CHART (BARU)
function renderCharts(stats) {
    // 1. HAPUS CHART LAMA JIKA ADA (Agar tidak numpuk saat refresh)
    if(salesChartInstance) salesChartInstance.destroy();
    if(pieChartInstance) pieChartInstance.destroy();

    // 2. CHART PENJUALAN HARIAN (Line Chart)
    const ctxSales = document.getElementById('chartSales').getContext('2d');
    
    // Bikin Gradient Warna Merah
    let gradient = ctxSales.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(255, 59, 48, 0.5)');   
    gradient.addColorStop(1, 'rgba(255, 59, 48, 0.0)');

    salesChartInstance = new Chart(ctxSales, {
        type: 'line',
        data: {
            labels: stats.chartLabels, // Tanggal 1, 2, 3...
            datasets: [
                {
                    label: 'Pemasukan (Omzet)',
                    data: stats.chartSales,
                    borderColor: '#ff3b30', // Merah Primary
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#ff3b30',
                    fill: true,
                    tension: 0.4 // Garis lengkung halus
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { borderDash: [2, 4] }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    // 3. CHART PIE (PEMASUKAN vs PENGELUARAN)
    // Atau bisa juga Laba Bersih vs Beban
    const ctxPie = document.getElementById('chartPie').getContext('2d');
    
    let profit = stats.pendapatanBulanIni - stats.pengeluaranBulanIni;
    if(profit < 0) profit = 0; // Biar chart ga error

    pieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Pengeluaran', 'Laba Bersih'],
            datasets: [{
                data: [stats.pengeluaranBulanIni, profit],
                backgroundColor: [
                    '#dc3545', // Merah (Expense)
                    '#198754'  // Hijau (Profit)
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%', // Bolong tengah
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

  // --- PRODUK & KASIR ---
function loadProduk() {
    loading(true);
    google.script.run.withSuccessHandler(data => {
      loading(false);
      globalProdukList = data; // Simpan ke global
      
      // 1. Render Grid Kasir (POS)
      renderProdukGrid(data);  
      
      // 2. Render Tabel Admin (YANG HILANG SEBELUMNYA)
      const tb = document.querySelector('#tabel-produk tbody');
      if(tb) {
         tb.innerHTML = ''; // Kosongkan tabel dulu
            data.forEach(r => {
            // r[0]: ID (PENTING UNTUK EDIT), r[1]: Nama, dll
            tb.innerHTML += `
              <tr>
                <td class="fw-bold">${r[1]}</td>
                <td>${rupiah(r[2])}</td>
                <td>${rupiah(r[3])}</td>
                <td class="text-center">${r[4]}</td>
                <td class="text-center">${r[5]}</td>
                <td>
                   <button class="btn btn-sm btn-warning text-dark border me-1" onclick="bukaHalamanEdit('${r[0]}')">
                     <i class="material-icons" style="font-size:14px">edit</i>
                   </button>
                   
                   <button class="btn btn-sm btn-light text-danger border" onclick="hapusProduk('${r[1]}')">
                     <i class="material-icons" style="font-size:14px">delete</i>
                   </button>
                </td>
              </tr>
            `;
         });
      }

      // 3. Update Dropdown di halaman Stok Masuk (Beli)
      const selB = document.getElementById('beli-produk');
      if(selB) {
         selB.innerHTML = '<option value="">--Pilih--</option>';
         data.forEach(p => selB.innerHTML += `<option value="${p[1]}" data-buy="${p[3]}">${p[1]}</option>`);
      }

    }).getData('PRODUK');
}

// 1. Fungsi Membuka Halaman Edit & Isi Data
function bukaHalamanEdit(id) {
    // Cari data produk di variabel global berdasarkan ID (Kolom 0)
    const produk = globalProdukList.find(row => row[0] == id);
    
    if (!produk) return myAlert('Error', 'Data produk tidak ditemukan.', 'error');

    // Isi Form Edit dengan Data Lama
    document.getElementById('edit-prod-id').value = produk[0]; // ID
    document.getElementById('edit-prod-nama').value = produk[1];
    document.getElementById('edit-prod-jual').value = produk[2];
    document.getElementById('edit-prod-beli').value = produk[3];
    
    // Stok (Read Only)
    document.getElementById('edit-prod-isi').value = produk[4];
    document.getElementById('edit-prod-kosong').value = produk[5];

    // Info Tambahan
    document.getElementById('edit-prod-sku').value = produk[6] || '';
    document.getElementById('edit-prod-kode').value = produk[7] || '';

    // Preview Gambar Lama
    const imgUrl = produk[8];
    const imgPrev = document.getElementById('edit-img-preview');
    if(imgUrl && imgUrl.includes('http')) {
        imgPrev.src = imgUrl;
        imgPrev.classList.remove('d-none');
    } else {
        imgPrev.src = ''; 
        imgPrev.classList.add('d-none');
    }

    // Reset Input File
    document.getElementById('edit-prod-file').value = '';

    // Pindah Tampilan ke Halaman Edit
    showPage('edit-produk');
}

// 2. Helper Preview Image di Halaman Edit
function previewEditImage(input) {
    const preview = document.getElementById('edit-img-preview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.classList.remove('d-none');
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// 3. Proses Simpan ke Server
function prosesSimpanEdit() {
    const fileInput = document.getElementById('edit-prod-file');
    const file = fileInput.files[0];

    // Ambil Data Form
    const payload = {
        id: document.getElementById('edit-prod-id').value,
        nama: document.getElementById('edit-prod-nama').value,
        hargaJual: document.getElementById('edit-prod-jual').value,
        hargaBeli: document.getElementById('edit-prod-beli').value,
        sku: document.getElementById('edit-prod-sku').value,
        kode: document.getElementById('edit-prod-kode').value,
        gambar: null // Default null (tidak ganti)
    };

    if(!payload.nama) return myAlert('Error', 'Nama produk tidak boleh kosong', 'warning');

    // Fungsi Pengirim
    const kirimUpdate = (data) => {
        loading(true);
        google.script.run
            .withSuccessHandler(res => {
                loading(false);
                myAlert('Sukses', res, 'success');
                showPage('produk'); // Kembali ke tabel
                loadProduk();       // Refresh data tabel
            })
            .withFailureHandler(err => {
                loading(false);
                myAlert('Gagal', err.message, 'error');
            })
            .updateProduk(data);
    };

    // Cek Upload Gambar Baru
    if (file) {
        if (file.size > 2 * 1024 * 1024) return myAlert('File Besar', 'Maksimal 2MB', 'warning');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            payload.gambar = {
                data: e.target.result.split(',')[1],
                mimeType: file.type,
                fileName: file.name
            };
            kirimUpdate(payload);
        };
        reader.readAsDataURL(file);
    } else {
        kirimUpdate(payload);
    }
}

// Fungsi Render Grid
function renderProdukGrid(data) {
   const container = document.getElementById('pos-grid-container');
   if(!container) return;
   
   container.innerHTML = '';

   data.forEach(p => {
      // Index Data: 
      // 0:ID, 1:Nama, 2:Jual, 3:Beli, 4:Isi, 5:Kosong, 6:SKU, 7:Kode, 8:Gambar
      
      let nama = p[1];
      let harga = p[2];
      let stok = Number(p[4]);
      let linkGambar = p[8]; // Ambil link gambar dari kolom index 8

      // Logika Tampilan Gambar
      let gambarHtml = '';
      if(linkGambar && linkGambar.length > 5) {
          // Jika ada link gambar, pakai tag IMG
          gambarHtml = `<img src="${linkGambar}" class="mb-2 rounded" style="width: 100%; height: 100px; object-fit: contain;">`;
      } else {
          // Jika tidak ada, pakai Icon default
          gambarHtml = `
           <div class="product-icon mx-auto mb-2">
              <i class="material-icons">propane</i> 
           </div>`;
      }

      let disabledClass = stok <= 0 ? 'opacity-50 grayscale' : '';
      let badgeStok = stok > 0 
          ? `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill" style="font-size:10px;">Stok: ${stok}</span>` 
          : `<span class="badge bg-danger text-white rounded-pill">Habis</span>`;
      
      // Tampilkan SKU/Kode kecil di atas nama (Opsional)
      let kodeHtml = p[6] ? `<small class="text-muted d-block mb-1" style="font-size:10px;">${p[6]}</small>` : '';

      container.innerHTML += `
      <div class="col-6 col-md-4 col-lg-3">
         <div class="card h-100 product-card border-0 shadow-sm ${disabledClass}" 
              onclick="klikProdukPOS('${nama}', ${harga}, ${stok})">
            <div class="card-body text-center p-2">
               ${gambarHtml}
               ${kodeHtml}
               <h6 class="fw-bold text-dark mb-1 text-truncate" title="${nama}" style="font-size: 0.9rem;">${nama}</h6>
               <div class="text-primary fw-bold mb-2 small">${rupiah(harga)}</div>
               ${badgeStok}
            </div>
         </div>
      </div>
      `;
   });
}

// 1. FUNGSI SAAT KARTU PRODUK DIKLIK (GANTI FUNGSI LAMA DENGAN INI)
function klikProdukPOS(nama, harga, stok) {
    if(stok <= 0) return myAlert('Stok Habis', 'Produk ini sedang kosong.', 'error');

    // Simpan data produk ke variabel sementara
    tempProductPOS = { nama, harga, stok };

    // Siapkan Tampilan Modal
    document.getElementById('qty-modal-title').innerText = nama;
    const inputQty = document.getElementById('input-qty-pos');
    inputQty.value = 1; // Default angka 1
    document.getElementById('qty-msg-error').classList.add('d-none'); // Sembunyikan error

    // Buka Modal
    const myModal = new bootstrap.Modal(document.getElementById('modalInputQty'));
    myModal.show();

    // Auto Focus: Supaya user bisa langsung ketik angka tanpa klik inputnya dulu
    setTimeout(() => {
        inputQty.focus();
        inputQty.select(); 
    }, 500);
}

// 2. FUNGSI TOMBOL "ENTER" DI MODAL
function submitQtyPOS() {
    const qtyInput = document.getElementById('input-qty-pos');
    const qty = Number(qtyInput.value);
    const stok = tempProductPOS.stok;
    const nama = tempProductPOS.nama;
    const harga = tempProductPOS.harga;

    // Validasi Input
    if(qty <= 0) {
        qtyInput.focus();
        return;
    }

    // Cek Mode Transaksi (Refill / Baru)
    let mode = document.querySelector('input[name="posMode"]:checked').value;
    
    // Cek apakah barang sudah ada di keranjang untuk menghitung total stok yg dibutuhkan
    let index = keranjangBelanja.findIndex(item => item.produkNama === nama && item.tipe === mode);
    let currentQtyInCart = (index !== -1) ? keranjangBelanja[index].qty : 0;

    // Validasi Stok (Input Baru + Yang Sudah Ada di Keranjang > Stok Tersedia?)
    if((currentQtyInCart + qty) > stok) {
        document.getElementById('qty-msg-error').innerText = `Sisa stok hanya ${stok - currentQtyInCart}`;
        document.getElementById('qty-msg-error').classList.remove('d-none');
        return;
    }

    // PROSES MASUK KERANJANG
    if(index !== -1) {
       // Update Qty jika sudah ada
       keranjangBelanja[index].qty += qty;
       keranjangBelanja[index].total = keranjangBelanja[index].qty * harga;
    } else {
       // Item Baru
       keranjangBelanja.push({
          produkNama: nama,
          qty: qty,
          tipe: mode,
          hargaSatuan: harga,
          total: qty * harga
       });
    }
    
    // Tutup Modal & Refresh Tampilan
    bootstrap.Modal.getInstance(document.getElementById('modalInputQty')).hide();
    renderKeranjangPOS();
}

// 3. TAMBAHAN: Agar bisa tekan tombol "ENTER" di keyboard saat input qty
document.getElementById('input-qty-pos')?.addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    submitQtyPOS();
  }
});

// --- UPDATE FUNGSI RENDER KERANJANG (ADA TOMBOL UBAH QTY) ---
function renderKeranjangPOS() {
   const tbody = document.getElementById('pos-cart-body');
   const emptyMsg = document.getElementById('empty-cart-msg');
   
   if(keranjangBelanja.length === 0) {
      tbody.innerHTML = '';
      emptyMsg.classList.remove('d-none');
      document.getElementById('pos-subtotal').innerText = 'Rp 0';
      document.getElementById('pos-grand-total').innerText = 'Rp 0';
      document.getElementById('cart-count-badge').innerText = '0 Item';
      return;
   }

   emptyMsg.classList.add('d-none');
   tbody.innerHTML = '';
   let grandTotal = 0;
   let totalItem = 0;

   keranjangBelanja.forEach((item, index) => {
      grandTotal += item.total;
      totalItem += item.qty;
      
      let badgeTipe = item.tipe.includes('Refill') ? '<span class="text-warning fw-bold" style="font-size:10px">● Refill</span>' : '<span class="text-success fw-bold" style="font-size:10px">● Baru</span>';

      tbody.innerHTML += `
      <tr>
         <td class="ps-3 py-3" style="width: 65%;">
            <div class="fw-bold text-dark mb-1 text-truncate" style="max-width:150px; font-size: 13px;">${item.produkNama}</div>
            <div class="d-flex align-items-center justify-content-between mb-2">
                ${badgeTipe}
                <small class="text-muted" style="font-size:10px;">@${rupiah(item.hargaSatuan)}</small>
            </div>
            
            <div class="input-group input-group-sm" style="width: 100px;">
                <button class="btn btn-outline-secondary px-2 py-0 d-flex align-items-center justify-content-center" type="button" onclick="ubahQty(${index}, -1)" style="height:26px;">
                    <i class="material-icons" style="font-size:14px">remove</i>
                </button>
                <input type="text" class="form-control text-center px-0 py-0 fw-bold bg-white border-secondary" value="${item.qty}" readonly style="font-size:13px; height: 26px; border-left:0; border-right:0;">
                <button class="btn btn-outline-primary px-2 py-0 d-flex align-items-center justify-content-center" type="button" onclick="ubahQty(${index}, 1)" style="height:26px;">
                    <i class="material-icons" style="font-size:14px">add</i>
                </button>
            </div>
         </td>
         <td class="text-end pe-3 py-3 align-top">
            <div class="fw-bold text-dark mb-2" style="font-size:13px;">${rupiah(item.total)}</div>
            
            <button class="btn btn-sm btn-light text-danger border-0 p-1 rounded-circle shadow-sm" onclick="hapusItemKeranjang(${index}); renderKeranjangPOS();" title="Hapus Item">
               <i class="material-icons" style="font-size:18px">delete</i>
            </button>
         </td>
      </tr>
      `;
   });

   document.getElementById('pos-subtotal').innerText = rupiah(grandTotal);
   document.getElementById('pos-grand-total').innerText = rupiah(grandTotal);
   document.getElementById('cart-count-badge').innerText = totalItem + ' Item';
}

// --- FUNGSI BARU: LOGIKA TAMBAH/KURANG QTY ---
function ubahQty(index, delta) {
    const item = keranjangBelanja[index];
    
    // 1. Logika Pengurangan (Jika 1 dikurang -> Konfirmasi Hapus)
    if(delta < 0 && item.qty === 1) {
        // Hapus langsung atau tanya dulu (opsional), di sini kita hapus langsung biar cepat
        keranjangBelanja.splice(index, 1);
        renderKeranjangPOS();
        return; 
    }

    // 2. Logika Penambahan (Cek Stok Dulu)
    if(delta > 0) {
        // Cari data produk asli di database lokal
        const produkDb = globalProdukList.find(p => p[1] === item.produkNama);
        if(produkDb) {
             const stokMax = Number(produkDb[4]); // Index 4 = Stok Isi
             
             // Hitung total qty item ini di keranjang 
             if(item.qty + delta > stokMax) {
                 return myAlert('Stok Terbatas', `Sisa stok gudang hanya ${stokMax}`, 'warning');
             }
        }
    }

    // 3. Update Angka
    item.qty += delta;
    item.total = item.qty * item.hargaSatuan; // Hitung ulang total harga
    
    // 4. Render Ulang Tampilan
    renderKeranjangPOS(); 
}

// Fungsi Pencarian Grid
function filterProdukGrid() {
   const keyword = document.getElementById('cari-produk-pos').value.toLowerCase();
   const filtered = globalProdukList.filter(p => p[1].toLowerCase().includes(keyword));
   renderProdukGrid(filtered);
}

// Override fungsi resetKeranjang agar compatible dengan POS
let originalReset = resetKeranjang;
resetKeranjang = function() {
    keranjangBelanja = [];
    renderKeranjangPOS();
}

function simpanProduk() {
    const fileInput = document.getElementById('prod-file-gambar');
    const file = fileInput.files[0];
    
    // Ambil data form lainnya
    const dataForm = {
        sku: document.getElementById('prod-sku').value,
        kode: document.getElementById('prod-kode').value,
        nama: document.getElementById('prod-nama').value, 
        hargaJual: document.getElementById('prod-jual').value, 
        hargaBeli: document.getElementById('prod-beli').value, 
        stokIsi: document.getElementById('prod-isi').value, 
        stokKosong: document.getElementById('prod-kosong').value,
        gambar: '' // Nanti diisi
    };

    // Fungsi untuk mengirim data ke Google Script
        const kirimData = (finalData) => {
            loading(true); // Nyalakan loading
            google.script.run.withSuccessHandler(() => { 
                loading(false); // Matikan loading
                document.getElementById('loading-upload')?.classList.add('d-none');
                
                // Reset Preview & Input File
                document.getElementById('img-preview').classList.add('d-none');
                document.getElementById('img-preview').src = '';
                
                // Tutup Modal
                bootstrap.Modal.getInstance(document.getElementById('modalProduk')).hide(); 
                
                // Refresh Tabel
                loadProduk(); 
                
                // Reset Form
                document.querySelectorAll('#modalProduk input').forEach(i => i.value = '');

                // --- TAMBAHKAN INI AGAR MUNCUL POPUP ---
                myAlert('Sukses', 'Produk berhasil disimpan ke database!', 'success');

            }).tambahProduk(finalData);
        };
        
    // LOGIKA UPLOAD GAMBAR
    if (file) {
        // Validasi ukuran (misal maks 2MB agar tidak berat)
        if (file.size > 2 * 1024 * 1024) {
            return myAlert('File Terlalu Besar', 'Maksimal ukuran gambar 2MB', 'error');
        }

        document.getElementById('loading-upload').classList.remove('d-none'); // Tampilkan loading teks
        
        const reader = new FileReader();
        reader.onload = function(e) {
            // Isi properti gambar dengan data file (base64)
            dataForm.gambar = {
                data: e.target.result.split(',')[1], // Ambil base64-nya saja
                mimeType: file.type,
                fileName: 'PROD-' + Date.now() // Nama file unik
            };
            kirimData(dataForm); // Kirim setelah file terbaca
        };
        reader.readAsDataURL(file);
    } else {
        // Jika tidak ada gambar, langsung kirim data kosong
        dataForm.gambar = null;
        kirimData(dataForm);
    }
}

// [TAMBAHAN] Fungsi untuk Preview Gambar
function tampilkanPreview(input) {
    const preview = document.getElementById('img-preview');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();

        reader.onload = function(e) {
            preview.src = e.target.result; // Isi sumber gambar dengan hasil bacaan file
            preview.classList.remove('d-none'); // Munculkan gambar
        }

        reader.readAsDataURL(input.files[0]); // Mulai membaca file
    } else {
        // Jika user batal milih file, sembunyikan lagi gambarnya
        preview.src = '';
        preview.classList.add('d-none');
    }
}

function hapusProduk(n) { 
      myConfirm('Hapus Produk', `Yakin hapus produk ${n}?`, () => {
          loading(true);
          google.script.run.withSuccessHandler(() => {
              loading(false);
              loadProduk();
              myAlert('Info', 'Produk dihapus', 'success');
          }).hapusProduk(n);
      });
  }
  function updateHargaJual() {
    const sel = document.getElementById('kasir-produk');
    const price = sel.options[sel.selectedIndex]?.getAttribute('data-price') || 0;
    const qty = document.getElementById('kasir-qty').value;
    document.getElementById('kasir-total').innerText = rupiah(price * qty);
  }

  function hapusItemKeranjang(index) {
      // 1. Hapus item dari array data
      keranjangBelanja.splice(index, 1);
      
      // 2. Render ulang tampilan menggunakan fungsi POS yang baru
      renderKeranjangPOS(); 
  }

  function resetKeranjang() {
    keranjangBelanja = [];
    renderKeranjang();
  }

function prosesBayarFinal() {
    if(keranjangBelanja.length === 0) return myAlert('Keranjang Kosong', 'Belum ada barang yang diinput.', 'error');

    // 1. Cek Apakah ada Refill?
    let butuhTabungKosong = 0;
    keranjangBelanja.forEach(k => { 
        if(k.tipe === 'Tukar (Refill)') butuhTabungKosong += k.qty; 
    });

    // 2. JIKA ADA REFILL -> BUKA MODAL CEK FISIK (GATEKEEPER)
    if(butuhTabungKosong > 0) {
        // Reset Inputan
        document.getElementById('lbl-qty-refill').innerText = butuhTabungKosong;
        document.getElementById('input-fisik-tabung').value = ''; 
        document.getElementById('msg-error-tabung').classList.add('d-none');
        
        // Buka Modal
        new bootstrap.Modal(document.getElementById('modalCekTabung')).show();
        
        // Auto Focus ke input agar kasir langsung ketik
        setTimeout(() => document.getElementById('input-fisik-tabung').focus(), 500);
        
    } else {
        // 3. JIKA TIDAK ADA REFILL (BELI BARU SEMUA) -> LANGSUNG EKSEKUSI
        eksekusiBayarUtama();
    }
}

// Fungsi dipanggil saat tombol LANJUT BAYAR di modal diklik
function validasiTabung() {
    // 1. Ambil Angka Target & Inputan
    let target = Number(document.getElementById('lbl-qty-refill').innerText);
    let input = Number(document.getElementById('input-fisik-tabung').value);
    
    // 2. VALIDASI KERAS (HARD BLOCK)
    if(input !== target) {
        // Jika angka beda, munculkan error dan JANGAN LANJUT
        const elMsg = document.getElementById('msg-error-tabung');
        elMsg.classList.remove('d-none');
        
        // Mainkan animasi getar (optional, visual feedback)
        document.getElementById('input-fisik-tabung').classList.add('is-invalid');
        return; 
    }

    // 3. Jika Cocok, Tutup Modal & Lanjut Bayar
    bootstrap.Modal.getInstance(document.getElementById('modalCekTabung')).hide();
    eksekusiBayarUtama();
}

// Tambahan: Supaya bisa Enter di input tabung
document.getElementById('input-fisik-tabung')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') validasiTabung();
});
// TAMBAHAN: Reset Error saat user mulai mengetik ulang
document.getElementById('input-fisik-tabung')?.addEventListener('input', function() {
    this.classList.remove('is-invalid'); // Hilangkan border merah
    document.getElementById('msg-error-tabung').classList.add('d-none'); // Sembunyikan pesan error
});

// --- INI LOGIKA PEMBAYARAN UTAMA (YANG TADINYA ADA DI DALAM PROSESBAYARFINAL) ---
// Kita pisahkan jadi fungsi sendiri agar bisa dipanggil dari dua tempat
function eksekusiBayarUtama() {
    const totalBayarStr = document.getElementById('pos-grand-total').innerText; 
    
    const metodeDipilih = document.getElementById('pos-metode-bayar').value;
    const pelangganDipilih = document.getElementById('kasir-pelanggan').value;
    const tglJatuhTempo = document.getElementById('pos-jatuh-tempo').value;

    // Validasi Pelanggan
    if (!pelangganDipilih || pelangganDipilih === "") {
        return myAlert('Pilih Pelanggan', 'Anda belum memilih pelanggan.\nSilakan pilih "Umum" atau nama pelanggan lain.', 'warning');
    }

    if(metodeDipilih === 'Hutang') {
        if(pelangganDipilih === 'Umum') return myAlert('Data Belum Lengkap', 'Hutang tidak boleh akun Umum.', 'warning');
        if(!tglJatuhTempo) return myAlert('Data Belum Lengkap', 'Isi tanggal jatuh tempo.', 'warning');
    }

    // Konfirmasi Akhir
    myConfirm('Konfirmasi Pembayaran', `Total Transaksi: ${totalBayarStr}\nMetode: ${metodeDipilih}\n\nSimpan data ini?`, () => {
        const payload = {
            pelanggan: pelangganDipilih,
            kasir: currentUser.nama || 'Admin',
            metode: metodeDipilih,
            jatuhTempo: (metodeDipilih === 'Hutang') ? tglJatuhTempo : '', 
            items: keranjangBelanja
        };

        loading(true);
        google.script.run.withSuccessHandler(res => {
           loading(false);
           
           // 1. Tampilkan Invoice
           const idTrxSementara = 'KBA-' + Date.now(); 
           tampilkanInvoice(payload, idTrxSementara);
           
           // 2. Reset Form
           document.getElementById('kasir-pelanggan').value = ""; 
           
           // 3. REFRESH DATA (INI YANG KEMARIN LUPA)
           loadProduk();       // Update Stok
           loadDashboard();    // Update Angka Dashboard (Realtime)
           loadKeuangan();     // Update Tabel Arus Kas (Realtime)
           
        }).withFailureHandler(err => {
           loading(false);
           myAlert('Gagal', err.message, 'error');
        }).simpanTransaksiBulk(payload);
    });
}

  function loadNotifHutang() {
    google.script.run.withSuccessHandler(jumlah => {
        const badge = document.getElementById('notif-badge');
        if(jumlah > 0) {
            badge.innerText = jumlah;
            badge.classList.remove('d-none');
        } else {
            badge.classList.add('d-none');
        }
    }).getJumlahJatuhTempo();
}

// Panggil fungsi ini di window.onload agar saat buka aplikasi langsung cek
// Tambahkan di dalam window.onload = function() { ... loadNotifHutang(); ... }

function cekNotifHutang() {
    // Nanti diarahkan ke halaman khusus hutang (Sementara alert dulu)
    myAlert('Info Tagihan', 'Silakan buka menu Riwayat > Piutang untuk melihat detail penagihan.', 'info');
}

// [UPDATE] Fungsi Update Harga Beli dengan Format Ribuan
function updateHargaBeli() {
  const sel = document.getElementById('beli-produk');
  const qtyInput = document.getElementById('beli-qty');
  const hargaInput = document.getElementById('beli-harga');
  const labelSubtotal = document.getElementById('beli-subtotal-label');

  // 1. Ambil Harga Database (Backup jika kosong)
  const priceDatabase = sel.options[sel.selectedIndex]?.getAttribute('data-buy') || 0;

  // 2. Format Tampilan Input (Hanya Angka & Titik)
  // Ambil value, buang semua karakter selain angka
  let rawValue = hargaInput.value.replace(/\D/g, ''); 
  
  // Jika kosong, pakai harga database (opsional, atau biarkan 0)
  if(rawValue === '' && priceDatabase > 0) {
      rawValue = priceDatabase.toString();
  }

  // Format jadi Ribuan (Visual)
  if(rawValue !== '') {
      hargaInput.value = Number(rawValue).toLocaleString('id-ID');
  } else {
      hargaInput.value = '';
  }

  // 3. Hitung Subtotal (Pakai Angka Murni)
  const qty = Number(qtyInput.value);
  const hargaMurni = Number(rawValue); // Gunakan rawValue yg tanpa titik

  if (labelSubtotal) {
      labelSubtotal.innerText = rupiah(qty * hargaMurni);
  }
}

// [BARU] Fungsi khusus saat Ganti Produk di Dropdown
function setHargaOtomatis() {
  const sel = document.getElementById('beli-produk');
  const hargaInput = document.getElementById('beli-harga');
  
  // 1. Ambil harga dari database (atribut data-buy)
  const hargaDatabase = sel.options[sel.selectedIndex]?.getAttribute('data-buy') || 0;
  
  // 2. Paksa Update Input Harga dengan format Ribuan
  hargaInput.value = Number(hargaDatabase).toLocaleString('id-ID');
  
  // 3. Panggil fungsi lama untuk hitung Subtotal
  updateHargaBeli(); 
}

  function tambahKeKeranjangBeli() {
      const prod = document.getElementById('beli-produk').value;
      const qty = Number(document.getElementById('beli-qty').value);
      const rawHarga = document.getElementById('beli-harga').value.replace(/\./g, '');
      const harga = Number(rawHarga);
      const isTukar = document.getElementById('beli-tukar').checked;
      
      if(!prod) return myAlert('Error', 'Pilih produk dulu!', 'error');
      if(qty <= 0) return myAlert('Error', 'Jumlah minimal 1', 'error');

      // Masukkan ke array
      keranjangBeli.push({
          produk: prod,
          qty: qty,
          hargaSatuan: harga,
          isTukar: isTukar,
          total: qty * harga
      });

      renderKeranjangBeli();
  }

  function renderKeranjangBeli() {
      const tb = document.querySelector('#tabel-keranjang-beli tbody');
      tb.innerHTML = '';
      let grandTotal = 0;

      keranjangBeli.forEach((item, index) => {
          grandTotal += item.total;
          let badgeTukar = item.isTukar ? '<span class="badge bg-warning text-dark" style="font-size:10px">Tukar Tabung</span>' : '<span class="badge bg-success" style="font-size:10px">Tabung Baru</span>';
          
          tb.innerHTML += `
            <tr>
                <td class="fw-bold">${item.produk}</td>
                <td>${badgeTukar}</td>
                <td>${item.qty}</td>
                <td>${rupiah(item.total)}</td>
                <td><button class="btn btn-sm btn-light text-danger" onclick="hapusItemBeli(${index})"><i class="material-icons" style="font-size:16px">delete</i></button></td>
            </tr>
          `;
      });

      document.getElementById('label-grand-total-beli').innerText = rupiah(grandTotal);
  }

  function hapusItemBeli(index) {
      keranjangBeli.splice(index, 1);
      renderKeranjangBeli();
  }

  function resetKeranjangBeli() {
      keranjangBeli = [];
      renderKeranjangBeli();
  }

  function prosesBeliFinal() {
      const supplier = document.getElementById('beli-supplier').value;
      
      if(!supplier) return myAlert('Error', 'Pilih Supplier dulu!', 'error');
      if(keranjangBeli.length === 0) return myAlert('Error', 'List belanja masih kosong', 'error');

      // Hitung Grand Total Angka
      let grandTotal = keranjangBeli.reduce((acc, item) => acc + item.total, 0);

      myConfirm('Simpan Pembelian', `Total Tagihan: ${rupiah(grandTotal)}\nSupplier: ${supplier}\n\nLanjutkan simpan stok?`, () => {
          
          const payload = {
              supplier: supplier,
              items: keranjangBeli,
              grandTotal: grandTotal
          };

          loading(true);
          google.script.run.withSuccessHandler(res => {
              loading(false);
              myAlert('Sukses', res, 'success');
              resetKeranjangBeli();
              loadProduk(); // Refresh stok di tabel produk
          }).simpanPembelianBulk(payload);
      });
  }

// --- javascript ---

  // --- RIWAYAT TRANSAKSI ---

function loadRiwayatData() {
    loading(true);
    google.script.run
      .withFailureHandler(err => {
         loading(false);
         myAlert('Error', err, 'error');
      })
      .withSuccessHandler(data => {
         loading(false);
         globalRiwayatData = data; // Simpan ke variabel global

         const tb = document.querySelector('#tabel-riwayat tbody');
         const thead = document.querySelector('#tabel-riwayat thead tr');
         
         // Update Header Tabel Sesuai Permintaan
         thead.innerHTML = `
            <th>ID & Waktu</th>
            <th>Pelanggan</th>
            <th>Total</th>
            <th>Aksi</th>
         `;

         tb.innerHTML = '';
         
         if (!data || data.length === 0) {
            tb.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada data transaksi.</td></tr>';
            return;
         }
  
         data.forEach((trx, index) => {
            let tgl = '-';
            try { tgl = new Date(trx.waktu).toLocaleString('id-ID'); } catch(e) {}
            
            // Render Baris (Row)
            tb.innerHTML += `
              <tr>
                 <td>
                    <span class="fw-bold text-primary">${trx.id}</span><br>
                    <small class="text-muted">${tgl}</small>
                 </td>
                 <td>${trx.pelanggan} <br> <small class="text-muted">Kasir: ${trx.kasir}</small></td>
                 <td class="fw-bold">${rupiah(trx.totalBayar)}</td>
                 <td>
                   <button class="btn btn-sm btn-info text-white" onclick="viewDetail(${index})">
                      <i class="material-icons align-middle" style="font-size:16px">visibility</i> View
                   </button>
                 </td>
              </tr>
            `;
         });
      }).getRiwayatTransaksi();
}

// Fungsi untuk Membuka Modal Detail
function viewDetail(index) {
    const trx = globalRiwayatData[index]; // Ambil data dari variabel global berdasarkan index
    if(!trx) return;

    // Isi Info Header Modal
    document.getElementById('det-id').innerText = trx.id;
    document.getElementById('det-pelanggan').innerText = trx.pelanggan;
    document.getElementById('det-waktu').innerText = new Date(trx.waktu).toLocaleString('id-ID');
    
    // Isi Tabel Detail Item
    const tb = document.querySelector('#tabel-detail-trx tbody');
    tb.innerHTML = '';
    
    trx.items.forEach(item => {
        tb.innerHTML += `
            <tr>
                <td>${item.produk} <br> <small class="text-muted">${item.tipe}</small></td>
                <td class="text-center">${item.qty}</td>
                <td class="text-end">${rupiah(item.hargaTotal)}</td>
            </tr>
        `;
    });

    // Isi Grand Total di Bawah Modal
    document.getElementById('det-total').innerText = rupiah(trx.totalBayar);

    // Tampilkan Modal
    new bootstrap.Modal(document.getElementById('modalDetailTrx')).show();
}

  function aksiRetur(id, produk, qty, tipe) {
     // Menggunakan myConfirm (Modal) agar konsisten dengan UI
     myConfirm('Retur Barang', `Yakin ingin membatalkan/retur item ini?\n\n${produk} (${qty})\n\nStok akan dikembalikan ke sistem.`, () => {
        loading(true);
        google.script.run.withSuccessHandler(res => {
           loading(false);
           myAlert('Sukses', res, 'success');
           loadRiwayatData();
           loadProduk(); // Update stok di tabel produk
        }).prosesRetur(id, produk, qty, tipe, 'PARTIAL');
     });
  }

  function filterRiwayat() {
    const k = document.getElementById('cari-trx').value.toLowerCase();
    document.querySelectorAll('#tabel-riwayat tbody tr').forEach(tr => {
       if(tr.innerText.toLowerCase().includes(k)) {
          tr.style.display = '';
       } else {
          tr.style.display = 'none';
       }
    });
  }

  function aksiRetur(id, produk, qty, tipe) {
     if(confirm(`Yakin ingin meretur/membatalkan item ini?\n\n${produk} (${qty})\n\nStok akan dikembalikan.`)) {
        loading(true);
        google.script.run.withSuccessHandler(res => {
           loading(false);
           alert(res);
           loadRiwayatData();
           loadProduk(); // Update stok
        }).prosesRetur(id, produk, qty, tipe, 'PARTIAL');
     }
  }

  function filterRiwayat() {
    const k = document.getElementById('cari-trx').value.toLowerCase();
    document.querySelectorAll('#tabel-riwayat tbody tr').forEach(tr => {
       tr.style.display = tr.innerText.toLowerCase().includes(k) ? '' : 'none';
    });
  }

  // 2. FUNGSI LOAD DATA
function loadRiwayatJual() {
   loading(true);
   google.script.run.withSuccessHandler(data => {
      loading(false);
      dataJualTemp = data; // Simpan ke global
      renderTabelRiwayat('tabel-riwayat-jual', data, 'JUAL');
   }).getRiwayatTransaksi(); // Fungsi lama (sudah diupdate grouping)
}

function loadRiwayatBeli() {
   loading(true);
   google.script.run.withSuccessHandler(data => {
      loading(false);
      dataBeliTemp = data; // Simpan ke global
      renderTabelRiwayat('tabel-riwayat-beli', data, 'BELI');
   }).getRiwayatPembelian(); // Fungsi baru di Code.gs
}

// 3. RENDER TABEL GENERIK
// --- LOGIC RENDER & FILTER RIWAYAT YANG DIPERBAIKI ---

// 1. UPDATE FUNGSI RENDER TABEL (Agar menyimpan Data Waktu)
function renderTabelRiwayat(tableId, data, tipe) {
   const tb = document.querySelector(`#${tableId} tbody`);
   tb.innerHTML = '';

   if(!data || data.length === 0) { 
      tb.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-muted">Belum ada data transaksi.</td></tr>'; 
      return;
   }

   data.forEach((trx, index) => {
      // Parsing Tanggal
      let dateObj = new Date(trx.waktu);
      let tglStr = dateObj.toLocaleString('id-ID');
      let timestamp = dateObj.getTime(); // Waktu dalam milidetik (PENTING UNTUK FILTER)

      // Kita simpan timestamp di atribut data-ts pada baris <tr>
      tb.innerHTML += `
        <tr data-ts="${timestamp}"> 
           <td>
              <span class="fw-bold text-primary" style="font-size:0.9rem">${trx.id}</span><br>
              <small class="text-muted" style="font-size:0.8rem">${tglStr}</small>
           </td>
           <td>
              <span class="fw-bold text-dark">${trx.pelanggan}</span>
              ${trx.kasir ? '<br><small class="text-muted">Kasir: '+trx.kasir+'</small>' : ''}
           </td>
           <td class="fw-bold">${rupiah(trx.totalBayar)}</td>
           <td>
             <button class="btn btn-sm btn-info text-white rounded-pill px-3" onclick="viewDetailTrx('${tipe}', ${index})">
               <i class="material-icons align-middle" style="font-size:14px">visibility</i> View
             </button>
           </td>
        </tr>`;
   });
}

// 2. FUNGSI FILTER UTAMA (Cari Text + Tanggal)
function terapkanFilter(tipe) {
    let tableId, inputStart, inputEnd, inputText;

    // Tentukan ID elemen berdasarkan Tipe (JUAL / BELI)
    if (tipe === 'JUAL') {
        tableId = 'tabel-riwayat-jual';
        inputStart = 'filter-jual-start';
        inputEnd = 'filter-jual-end';
        inputText = 'filter-jual-text';
    } else {
        tableId = 'tabel-riwayat-beli';
        inputStart = 'filter-beli-start';
        inputEnd = 'filter-beli-end';
        inputText = 'filter-beli-text';
    }

    // Ambil Nilai dari Input
    const keyword = document.getElementById(inputText).value.toLowerCase();
    const startDateVal = document.getElementById(inputStart).value;
    const endDateVal = document.getElementById(inputEnd).value;

    // Konversi tanggal filter ke Timestamp (00:00:00 dan 23:59:59)
    let startTs = startDateVal ? new Date(startDateVal).setHours(0,0,0,0) : 0;
    let endTs = endDateVal ? new Date(endDateVal).setHours(23,59,59,999) : 9999999999999; 

    // Loop semua baris di tabel
    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
    let foundCount = 0;

    rows.forEach(row => {
        // Ambil data dari baris
        const textContent = row.innerText.toLowerCase();
        const rowTs = Number(row.getAttribute('data-ts')); // Ambil timestamp tersembunyi

        // Cek Logika Filter
        const matchText = textContent.includes(keyword);
        const matchDate = rowTs >= startTs && rowTs <= endTs;

        // Tampilkan jika Text COCOK -DAN- Tanggal MASUK RANGE
        if (matchText && matchDate) {
            row.style.display = '';
            foundCount++;
        } else {
            row.style.display = 'none';
        }
    });

    if(foundCount === 0) {
       // Opsional: Tampilkan pesan jika tidak ada hasil
       // myAlert('Info', 'Data tidak ditemukan dengan filter tersebut.');
    }
}

// --- KONFIGURASI TANGGAL (FLATPICKR) ---

// --- KONFIGURASI TANGGAL (FIX ANTI BLANK) ---
function initTanggal() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1); 

    const baseConfig = {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d/m/Y",
        locale: "id",
        allowInput: true,
        disableMobile: "true"
    };

    // 1. Tambahkan #dash-filter-start
    flatpickr("#filter-jual-start, #filter-beli-start, #filter-keu-start, #lap-start, #dash-filter-start", {
        ...baseConfig,
        defaultDate: firstDay 
    });

    // 2. Tambahkan #dash-filter-end
    flatpickr("#filter-jual-end, #filter-beli-end, #filter-keu-end, #lap-end, #dash-filter-end", {
        ...baseConfig,
        defaultDate: today 
    });

    // 3. Init Kolom Jatuh Tempo (Set Default: 7 Hari lagi)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    flatpickr("#pos-jatuh-tempo", {
        ...baseConfig,
        defaultDate: nextWeek
    });

    // 4. Init Sisanya (Input tanggal lain yang mungkin ada)
    flatpickr("input[type=date]:not(.flatpickr-input)", {
        ...baseConfig
    });

        // Di dalam initTanggal()
    flatpickr("#filter-jual-start, #filter-beli-start, #filter-keu-start", { // <--- Tambah #filter-keu-start
        ...baseConfig,
        defaultDate: today
    });

    flatpickr("#filter-jual-end, #filter-beli-end, #filter-keu-end", { // <--- Tambah #filter-keu-end
        ...baseConfig,
        defaultDate: today
    });
}

// --- [BARU] LOGIKA FILTER DASHBOARD ---

// 1. Eksekusi Filter (Dipanggil tombol Filter)
function terapkanFilterDashboard() {
    const start = document.getElementById('dash-filter-start').value;
    const end = document.getElementById('dash-filter-end').value;

    if(!start || !end) {
        return myAlert('Filter Error', 'Harap isi tanggal awal dan akhir.', 'warning');
    }

    // Panggil fungsi loadDashboard yang sudah ada, tapi dengan parameter
    loadDashboard(start, end);
}

// 2. Logika Dropdown Cepat (Copy logic dari setFilterCepat tapi khusus dashboard)
function setFilterDashboard(pilihan) {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    // Helper Format YYYY-MM-DD
    const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const d_str = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${d_str}`;
    };

    if (pilihan === "bulan_ini") {
        start = new Date(now.getFullYear(), now.getMonth(), 1); // Tgl 1
    } else if (pilihan === "bulan_lalu") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0); 
    } else if (pilihan === "kemarin") {
        start.setDate(now.getDate() - 1);
        end.setDate(now.getDate() - 1);
    } else if (pilihan === "7_hari") {
        start.setDate(now.getDate() - 6);
    } else if (pilihan === "hari_ini") {
        // default now
    } else {
        return; // Custom
    }

    // Update Input Tanggal
    const elStart = document.getElementById('dash-filter-start');
    const elEnd = document.getElementById('dash-filter-end');

    if (elStart._flatpickr) elStart._flatpickr.setDate(fmt(start), true);
    else elStart.value = fmt(start);

    if (elEnd._flatpickr) elEnd._flatpickr.setDate(fmt(end), true);
    else elEnd.value = fmt(end);

    // Langsung load data tanpa tekan tombol filter lagi (Opsional, agar cepat)
    terapkanFilterDashboard();
}

// [UPDATE] Fungsi Auto Date agar support Flatpickr & Tampilan Langsung Muncul
function setAutoDate(tipe) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1); 

    const toStr = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const strStart = toStr(firstDay);
    const strEnd = toStr(now);

    const elStart = document.getElementById(`filter-${tipe}-start`);
    const elEnd = document.getElementById(`filter-${tipe}-end`);

    // LOGIKA UPDATE: Tambahkan parameter true agar UI merefresh
    if(elStart) {
        if(elStart._flatpickr) {
            // Parameter 'true' memaksa tampilan input berubah
            elStart._flatpickr.setDate(strStart, true); 
        } else {
            elStart.value = strStart;
        }
    }

    if(elEnd) {
        if(elEnd._flatpickr) {
            elEnd._flatpickr.setDate(strEnd, true);
        } else {
            elEnd.value = strEnd;
        }
    }
}

// Tambahkan Event Listener agar menekan ENTER di kolom pencarian langsung memfilter
document.getElementById('filter-jual-text')?.addEventListener('keyup', function(e) {
    if(e.key === 'Enter') terapkanFilter('JUAL');
    else terapkanFilter('JUAL'); // Live search saat mengetik
});

document.getElementById('filter-beli-text')?.addEventListener('keyup', function(e) {
    if(e.key === 'Enter') terapkanFilter('BELI');
    else terapkanFilter('BELI'); // Live search saat mengetik
});

// GANTI FUNGSI viewDetailTrx DENGAN INI

function viewDetailTrx(tipe, index) {
   // 1. Ambil Data
   const data = tipe === 'JUAL' ? dataJualTemp : dataBeliTemp;
   const trx = data[index];
   
   if(!trx) return myAlert('Error', 'Data transaksi tidak ditemukan', 'error');

   // 2. Isi Modal
   document.getElementById('det-id').innerText = trx.id;
   document.getElementById('det-pelanggan').innerText = trx.pelanggan;
   
   // Handle Tanggal agar tidak error
   try {
       document.getElementById('det-waktu').innerText = new Date(trx.waktu).toLocaleString('id-ID');
   } catch(e) {
       document.getElementById('det-waktu').innerText = '-';
   }

   document.getElementById('det-total').innerText = rupiah(trx.totalBayar);
   
   // 3. Render Tabel Barang
   const tb = document.querySelector('#tabel-detail-trx tbody');
   tb.innerHTML = '';
   trx.items.forEach(item => {
       tb.innerHTML += `
        <tr>
            <td>${item.produk} <br> <small class="text-muted">${item.tipe}</small></td>
            <td class="text-center">${item.qty}</td>
            <td class="text-end">${rupiah(item.hargaTotal)}</td>
        </tr>`;
   });

   // 4. SETUP TOMBOL (CETAK & RETUR)
   const footer = document.querySelector('#modalDetailTrx .modal-footer');
   
   // Reset isi footer
   footer.innerHTML = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>`;
   
   // A. Tombol CETAK (Hanya muncul untuk Penjualan)
   if(tipe === 'JUAL') {
       const btnCetak = document.createElement('button');
       btnCetak.className = 'btn btn-primary ms-2 fw-bold';
       btnCetak.innerHTML = '<i class="material-icons align-middle" style="font-size:16px">print</i> CETAK';
       
       btnCetak.onclick = () => {
           // Siapkan Data Invoice dari data Riwayat
           const payloadInvoice = {
               pelanggan: trx.pelanggan,
               kasir: trx.kasir || 'Admin',
               metode: trx.metode || 'Tunai', 
               jatuhTempo: trx.jatuhTempo || '',
               items: trx.items.map(i => ({
                   produkNama: i.produk,
                   qty: i.qty,
                   tipe: i.tipe,
                   // Hitung harga satuan manual (karena di history cuma simpan total)
                   hargaSatuan: (i.qty > 0) ? (i.hargaTotal / i.qty) : 0, 
                   total: i.hargaTotal
               }))
           };

           // Tutup modal detail, buka invoice
           bootstrap.Modal.getInstance(document.getElementById('modalDetailTrx')).hide();
           tampilkanInvoice(payloadInvoice, trx.id);
       };
       footer.appendChild(btnCetak);
   }

   // B. Tombol RETUR
   const btnRetur = document.createElement('button');
   btnRetur.className = 'btn btn-danger ms-2';
   btnRetur.innerText = 'RETUR / BATAL';
   btnRetur.onclick = () => {
       bootstrap.Modal.getInstance(document.getElementById('modalDetailTrx')).hide();
       bukaFormRetur(trx, tipe);
   };
   footer.appendChild(btnRetur);

   // Tampilkan Modal
   new bootstrap.Modal(document.getElementById('modalDetailTrx')).show();
}

// 5. BUKA FORM RETUR (Baru)
function bukaFormRetur(trx, tipe) {
    document.getElementById('retur-id-trx').value = trx.id;
    document.getElementById('retur-jenis-trx').value = tipe;
    document.getElementById('check-retur-semua').checked = false;
    document.getElementById('retur-alasan').value = '';
    
    const container = document.getElementById('container-retur-items');
    container.innerHTML = '';

    trx.items.forEach((item, idx) => {
        // Hitung harga satuan kasar untuk referensi refund
        let hargaSatuan = item.hargaTotal / item.qty;
        
        container.innerHTML += `
           <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2 item-retur-row">
              <div style="flex:1">
                 <small class="fw-bold">${item.produk}</small><br>
                 <small class="text-muted">Dibeli: ${item.qty} | ${item.tipe || ''}</small>
                 <input type="hidden" class="data-produk" value="${item.produk}">
                 <input type="hidden" class="data-tipe" value="${item.tipe || ''}">
                 <input type="hidden" class="data-harga" value="${hargaSatuan}">
                 <input type="hidden" class="data-qty-asal" value="${item.qty}">
              </div>
              <div style="width: 100px;">
                 <input type="number" class="form-control form-control-sm input-qty-retur" 
                        placeholder="0" min="0" max="${item.qty}">
              </div>
           </div>
        `;
    });
    
    new bootstrap.Modal(document.getElementById('modalFormRetur')).show();
}

// 6. TOGGLE RETUR SEMUA
function toggleReturSemua() {
    const isChecked = document.getElementById('check-retur-semua').checked;
    const inputs = document.querySelectorAll('.input-qty-retur');
    const rows = document.querySelectorAll('.item-retur-row');
    
    inputs.forEach((input, idx) => {
        if(isChecked) {
            // Isi dengan qty maksimal (qty beli)
            const qtyAsal = rows[idx].querySelector('.data-qty-asal').value;
            input.value = qtyAsal;
            input.setAttribute('readonly', true); // Kunci input
        } else {
            input.value = '';
            input.removeAttribute('readonly'); // Buka kunci
        }
    });
}

// 7. PROSES SIMPAN KE DATABASE
function prosesSimpanRetur() {
    const idTrx = document.getElementById('retur-id-trx').value;
    const jenis = document.getElementById('retur-jenis-trx').value;
    const alasan = document.getElementById('retur-alasan').value;
    
    let itemsToReturn = [];
    let hasInput = false;

    const rows = document.querySelectorAll('.item-retur-row');
    rows.forEach(row => {
        const prod = row.querySelector('.data-produk').value;
        const tipe = row.querySelector('.data-tipe').value;
        const harga = row.querySelector('.data-harga').value;
        const qtyInput = row.querySelector('.input-qty-retur').value;
        const qtyRetur = Number(qtyInput);

        if(qtyRetur > 0) hasInput = true;
        
        itemsToReturn.push({
            produk: prod,
            tipe: tipe,
            hargaSatuan: harga,
            qtyRetur: qtyRetur
        });
    });

    if(!hasInput) return myAlert('Error', 'Masukkan jumlah barang yang ingin diretur!', 'error');

    const payload = {
        idTrx: idTrx,
        jenis: jenis, // 'JUAL' atau 'BELI'
        alasan: alasan,
        items: itemsToReturn
    };
    
    // Kirim ke Backend
    myConfirm('Konfirmasi Retur', 'Stok akan disesuaikan. Lanjutkan?', () => {
        loading(true);
        google.script.run.withSuccessHandler(res => {
            loading(false);
            bootstrap.Modal.getInstance(document.getElementById('modalFormRetur')).hide();
            myAlert('Sukses', res, 'success');
            // Refresh tabel yang sesuai
            if(jenis === 'JUAL') loadRiwayatJual();
            else loadRiwayatBeli();
        }).prosesReturBaru(payload);
    });
}

// [UPDATE] Load Data Supplier ke Variabel Global
function loadPembelianData() {
  google.script.run.withSuccessHandler(data => {
      // 1. Simpan data ke variabel global agar bisa dicari
      globalListSupplier = data;
      
      // 2. Kosongkan inputan saat halaman dimuat ulang
      document.getElementById('beli-supplier').value = '';
  }).getData('SUPPLIER');
}

// --- LOGIKA PENCARIAN SUPPLIER (BARU) ---

// 1. Event Listener saat mengetik nama supplier
document.getElementById('beli-supplier')?.addEventListener('input', function() {
    const keyword = this.value.toLowerCase();
    const container = document.getElementById('hasil-cari-supplier');
    
    container.innerHTML = ''; // Bersihkan hasil sebelumnya

    if(keyword.length < 1) {
        container.classList.add('d-none'); // Sembunyikan jika kosong
        return;
    }

    // Filter Data Supplier
    const hasil = globalListSupplier.filter(r => {
        // r[1] adalah Nama Supplier (sesuai urutan kolom di Code.gs)
        const nama = r[1].toLowerCase(); 
        return nama.includes(keyword);
    });

    if(hasil.length === 0) {
         container.innerHTML = '<div class="list-group-item text-muted small">Supplier tidak ditemukan.</div>';
         container.classList.remove('d-none');
         return;
    }
    
    // Render Hasil Pencarian
    hasil.slice(0, 5).forEach(r => { // Tampilkan max 5 hasil
        const nama = r[1];
        
        const btn = document.createElement('button');
        btn.className = 'list-group-item list-group-item-action py-2 small fw-bold';
        btn.innerHTML = nama;
        
        // Saat diklik, isi ke input dan sembunyikan list
        btn.onclick = function() {
            document.getElementById('beli-supplier').value = nama;
            container.classList.add('d-none');
        };
        container.appendChild(btn);
    });
    
    container.classList.remove('d-none'); // Munculkan list
});

// 2. Tampilkan semua supplier jika input diklik (Focus)
document.getElementById('beli-supplier')?.addEventListener('focus', function() {
    if(this.value === '' && globalListSupplier.length > 0) {
        const container = document.getElementById('hasil-cari-supplier');
        container.innerHTML = '';
        
        // Tampilkan 5 supplier pertama sebagai saran
        globalListSupplier.slice(0, 5).forEach(r => {
            const btn = document.createElement('button');
            btn.className = 'list-group-item list-group-item-action py-2 small fw-bold';
            btn.innerHTML = r[1];
            btn.onclick = function() {
                document.getElementById('beli-supplier').value = r[1];
                container.classList.add('d-none');
            };
            container.appendChild(btn);
        });
        container.classList.remove('d-none');
    }
});

// 3. Sembunyikan dropdown jika klik di luar area
document.addEventListener('click', function(e) {
    // Jika yang diklik BUKAN input supplier, tutup dropdown
    if (e.target.id !== 'beli-supplier') {
        document.getElementById('hasil-cari-supplier')?.classList.add('d-none');
    }
});

function simpanSupplier() {
    // ... (kode validasi tetap sama) ...
    const nama = document.getElementById('sup-nama').value; // Ambil nama dulu
    // ...

    google.script.run.withSuccessHandler(() => {
        loading(false);
        const modalEl = document.getElementById('modalSupplier');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();

        myAlert('Berhasil', 'Data Supplier berhasil ditambahkan!', 'success');

        // [UBAHAN DISINI]
        loadPembelianData(); // Refresh data global
        
        // Auto-fill nama supplier yang baru dibuat ke kolom pencarian
        document.getElementById('beli-supplier').value = nama; 

        // Reset Form
        document.getElementById('sup-nama').value = '';
        document.getElementById('sup-hp').value = '';
        document.getElementById('sup-alamat').value = '';

    }).tambahSupplier(dataKirim);
}

  function prosesBeli() {
    const d = { supplier: document.getElementById('beli-supplier').value, produk: document.getElementById('beli-produk').value, qty: document.getElementById('beli-qty').value, total: document.getElementById('beli-harga').value * document.getElementById('beli-qty').value, metode:'Tunai', isTukar: document.getElementById('beli-tukar').checked };
    if(confirm('Simpan Beli?')) {
        loading(true);
        google.script.run.withSuccessHandler(()=>{ 
            loading(false);
            alert('Sukses'); 
            loadProduk(); 
        }).simpanPembelian(d);
    }
  }

function loadPelanggan() {
    loading(true);
    google.script.run.withSuccessHandler(data => {
      loading(false);

      // --- PENGAMAN ---
      if (!data) return;

      const tb = document.querySelector('#tabel-pelanggan tbody');
      tb.innerHTML = '';
      data.forEach(r => {
        tb.innerHTML += `
          <tr>
            <td class="fw-bold">${r[1]}</td>
            <td>${r[2]}</td>
            <td>${r[3]}<br><small class="text-muted">${r[4]}</small></td>
            <td>
               <button class="btn btn-sm btn-warning" onclick="editPelanggan('${r[0]}','${r[1]}','${r[2]}','${r[3]}','${r[4]}')"><i class="material-icons" style="font-size:14px">edit</i></button>
               <button class="btn btn-sm btn-danger" onclick="hapusPelanggan('${r[0]}')"><i class="material-icons" style="font-size:14px">delete</i></button>
            </td>
          </tr>`;
      });
    }).getData('PELANGGAN');
  }

  // Handle Modal (Bisa dari menu Pelanggan, bisa dari shortcut Kasir)
  let isFromKasir = false; 

  function modalPelanggan(fromKasir = false) {
    isFromKasir = fromKasir;
    document.getElementById('pel-id').value = '';
    document.getElementById('pel-nama').value = '';
    document.getElementById('pel-pt').value = '';
    document.getElementById('pel-hp').value = '';
    document.getElementById('pel-alamat').value = '';
    new bootstrap.Modal(document.getElementById('modalPelanggan')).show();
  }

  function editPelanggan(id, nama, pt, hp, alamat) {
    document.getElementById('pel-id').value = id;
    document.getElementById('pel-nama').value = nama;
    document.getElementById('pel-pt').value = pt;
    document.getElementById('pel-hp').value = hp;
    document.getElementById('pel-alamat').value = alamat;
    new bootstrap.Modal(document.getElementById('modalPelanggan')).show();
  }

function simpanPelangganDB() {
    const d = {
      id: document.getElementById('pel-id').value,
      nama: document.getElementById('pel-nama').value,
      pt: document.getElementById('pel-pt').value,
      hp: document.getElementById('pel-hp').value,
      alamat: document.getElementById('pel-alamat').value
    };

    if(!d.nama) return myAlert('Peringatan', 'Nama wajib diisi!', 'warning');

    loading(true);
    google.script.run.withSuccessHandler(res => {
       loading(false);
       
       // [1] GANTI ALERT BIASA JADI POPUP KEREN
       myAlert('Berhasil', res, 'success');
       
       bootstrap.Modal.getInstance(document.getElementById('modalPelanggan')).hide();
       
       if(isFromKasir) {
          // [2] KIRIM NAMA BARU AGAR BISA DI-AUTO SELECT
          loadPelangganDropdown(d.nama); 
       } else {
          // Jika dari menu admin, refresh tabel seperti biasa
          loadPelanggan();
       }
    }).simpanPelanggan(d);
  }
function hapusPelanggan(id) {
    myConfirm('Hapus Pelanggan', 'Apakah Anda yakin ingin menghapus data pelanggan ini?', () => {
       loading(true);
       google.script.run.withSuccessHandler(() => {
         loading(false);
         loadPelanggan();
         myAlert('Sukses', 'Data Pelanggan berhasil dihapus', 'success');
       }).hapusPelanggan(id);
    });
  }

  function filterPelanggan() {
    const k = document.getElementById('cari-pelanggan').value.toLowerCase();
    document.querySelectorAll('#tabel-pelanggan tbody tr').forEach(tr => {
       tr.style.display = tr.innerText.toLowerCase().includes(k) ? '' : 'none';
    });
  }

  // --- INTEGRASI KE KASIR ---
  
function loadPelangganDropdown(targetNama = null) {
    google.script.run.withSuccessHandler(data => {
       if (!data) return; 
       
       // 1. Simpan Data ke Global Variable
       globalListPelanggan = data; 
       
       // 2. Jika ada target (misal baru tambah pelanggan), langsung set ke input
       if(targetNama) {
           document.getElementById('kasir-pelanggan').value = targetNama;
       }
    }).getListPelanggan();
}

// 1. FUNGSI FETCH DATA DARI SERVER
function loadKeuangan() {
    loading(true);
    google.script.run.withSuccessHandler(d => {
        loading(false);
        
        // Simpan ke variabel global agar bisa difilter
        globalKeuanganData = d || []; 

        // Render tabel dengan data mentah (semua data)
        renderTabelKeuangan(globalKeuanganData);

    }).getData('KEUANGAN');
}

// [UPDATE] FUNGSI RENDER TABEL KEUANGAN (DENGAN TOMBOL CETAK)
function renderTabelKeuangan(data) {
    const tb = document.querySelector('#tabel-keuangan tbody'); 
    tb.innerHTML = '';

    if (!data || data.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Belum ada data keuangan.</td></tr>';
        return; 
    }

    data.slice(0, 100).forEach(r => {
        // r[0]: ID, r[1]: Tanggal, r[2]: Jenis, r[3]: Kategori, r[4]: Nominal, r[5]: Ket
        
        let tglDisplay = '-';
        let timestamp = 0;
        
        try { 
            if(r[1]) {
                let d = new Date(r[1]);
                timestamp = d.getTime(); 
                let dd = String(d.getDate()).padStart(2, '0');
                let mm = String(d.getMonth() + 1).padStart(2, '0');
                let yyyy = d.getFullYear();
                tglDisplay = `${dd}/${mm}/${yyyy}`;
            }
        } catch(e){ console.log(e); }

        let colorClass = r[2] === 'Pemasukan' ? 'text-success' : 'text-danger';
        let nominal = rupiah(r[4]);

        // Cek ID Manual vs Auto
        let isManual = String(r[0]).includes('MANUAL');
        let aksiTombol = '';
        
        // Bersihkan tanda petik di keterangan agar tidak merusak HTML onclick
        let safeKet = r[5] ? r[5].toString().replace(/'/g, "\\'").replace(/"/g, '&quot;') : "";
        let safeDate = r[1]; 

        // [BARU] Tombol Cetak (Re-usable string)
        let btnCetak = `
            <button class="btn btn-sm btn-info text-white py-0 px-2 me-1" 
                onclick="siapkanCetak('${r[0]}', '${safeDate}', '${r[2]}', '${r[3]}', ${r[4]}, '${safeKet}')" 
                title="Cetak Slip">
                <i class="material-icons" style="font-size:14px">print</i>
            </button>
        `;
        
        if(isManual) {
            // Jika Manual: Tombol Cetak + Edit + Hapus
            aksiTombol = `
            ${btnCetak}
            <button class="btn btn-sm btn-warning text-dark py-0 px-2" 
                onclick="editKeuangan('${r[0]}', '${safeDate}', '${r[2]}', '${r[3]}', ${r[4]}, '${safeKet}')" title="Edit">
                <i class="material-icons" style="font-size:14px">edit</i>
            </button>
            <button class="btn btn-sm btn-light text-danger border py-0 px-2 ms-1" onclick="hapusKeuangan('${r[0]}')" title="Hapus">
                <i class="material-icons" style="font-size:14px">delete</i>
            </button>
            `;
        } else {
            // Jika Auto: Tombol Cetak + Badge Auto
            aksiTombol = `
            ${btnCetak}
            <span class="badge bg-light text-muted border" title="Data Otomatis">
                <i class="material-icons align-middle" style="font-size:12px">lock</i> Auto
            </span>
            `;
        }

        tb.innerHTML += `
        <tr data-ts="${timestamp}">
            <td>${tglDisplay}</td>
            <td><span class="badge ${r[2] === 'Pemasukan' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}">${r[2]}</span></td>
            <td>${r[3]}</td>
            <td class="${colorClass} fw-bold">${nominal}</td>
            <td><small class="text-muted text-truncate d-block" style="max-width: 150px;">${r[5]}</small></td>
            <td class="text-center" style="white-space: nowrap;">${aksiTombol}</td>
        </tr>`;
    });
}

// [BARU] Helper untuk tombol cetak di tabel
function siapkanCetak(id, tgl, jenis, kat, nom, ket) {
    const dataObj = {
        id: id,
        tanggal: tgl, // Format tanggal raw dari DB
        jenis: jenis,
        kategori: kat,
        nominal: nom,
        ket: ket
    };
    // Panggil fungsi cetak nota yang sudah kita perbaiki sebelumnya
    cetakNotaKeuangan(dataObj);
}

// 3. FUNGSI FILTER KEUANGAN
function terapkanFilterKeuangan() {
    const keyword = document.getElementById('filter-keu-text').value.toLowerCase();
    const startDateVal = document.getElementById('filter-keu-start').value;
    const endDateVal = document.getElementById('filter-keu-end').value;

    // Konversi tanggal filter ke Timestamp
    let startTs = startDateVal ? new Date(startDateVal).setHours(0,0,0,0) : 0;
    let endTs = endDateVal ? new Date(endDateVal).setHours(23,59,59,999) : 9999999999999; 

    // Filter Array Global
    const hasilFilter = globalKeuanganData.filter(r => {
        // Ambil data baris
        let strData = (r[2] + " " + r[3] + " " + r[5]).toLowerCase(); // Gabung Jenis, Kategori, Ket
        let rowDate = new Date(r[1]);
        let rowTs = rowDate.getTime();

        // Cek Logika
        const matchText = strData.includes(keyword);
        const matchDate = rowTs >= startTs && rowTs <= endTs;

        return matchText && matchDate;
    });

    // Render ulang dengan data hasil filter
    renderTabelKeuangan(hasilFilter);
}

// Event Listener agar tekan Enter langsung filter
document.getElementById('filter-keu-text')?.addEventListener('keyup', function(e) {
    if(e.key === 'Enter') terapkanFilterKeuangan();
});

// [BARU] Load Data Akun dari Server
function loadDataAkun() {
    google.script.run.withSuccessHandler(data => {
        globalListAkun = data; // Simpan ke global
        
        // Render ke Dropdown Modal Keuangan
        const selKeu = document.getElementById('keu-akun');
        selKeu.innerHTML = '';
        data.forEach(a => {
            selKeu.innerHTML += `<option value="${a.nama}" data-saldo="${a.saldo}">${a.nama}</option>`;
        });
        
        // Trigger update tampilan saldo
        cekSaldoUI(); 

    }).getDaftarAkun();
}

// [BARU] Update Tampilan Saldo saat Dropdown diganti
function cekSaldoUI() {
    const sel = document.getElementById('keu-akun');
    const saldo = sel.options[sel.selectedIndex]?.getAttribute('data-saldo') || 0;
    
    // Tampilkan dengan format Rupiah
    document.getElementById('label-saldo-akun').innerText = rupiah(saldo);
    
    // Sedikit logika visual: Kalau saldo minus/nol kasih warna merah
    if(saldo <= 0) {
        document.getElementById('label-saldo-akun').className = "fw-bold text-danger";
    } else {
        document.getElementById('label-saldo-akun').className = "fw-bold text-primary";
    }
}

function bukaModalKeuangan() {
    // --- 1. SETUP TANGGAL (Flatpickr / Manual) ---
    const elTanggal = document.getElementById('keu-tanggal');
    const today = new Date();

    if (elTanggal._flatpickr) {
        elTanggal._flatpickr.setDate(today, true);
    } else {
        const offset = today.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(today - offset)).toISOString().slice(0, 10);
        elTanggal.value = localISOTime;
    }

    // --- 2. LOAD DATA BARU (Akun & Kategori) ---
    // Penting: Panggil ini agar dropdown Akun & Kategori selalu update
    loadDataAkun(); 
    refreshDropdownKategori(); 

    // --- 3. RESET FORM INPUT ---
    document.getElementById('keu-jenis').selectedIndex = 0; // Reset ke Pengeluaran
    document.getElementById('keu-nominal').value = ''; 
    document.getElementById('keu-ket').value = '';
    
    // --- 4. RESET TAMPILAN UI (PENTING UNTUK MENCEGAH BUG EDIT) ---
    // Pastikan judul dan tombol kembali ke mode "Catat Baru", bukan "Edit"
    document.getElementById('modalKeuanganTitle').innerHTML = '<i class="material-icons align-middle me-2">edit_note</i>Catat Transaksi';
    document.getElementById('modalKeuanganTitle').className = "fw-bold text-white"; // Kembalikan warna text
    
    // Reset Tombol Simpan
    const btn = document.getElementById('btn-simpan-keuangan');
    btn.removeAttribute('data-id'); // Hapus ID edit jika ada
    btn.innerText = "SIMPAN TRANSAKSI"; 
    btn.className = "btn btn-primary w-100 fw-bold rounded-pill"; // Kembalikan warna tombol

    // --- 5. TAMPILKAN MODAL ---
    new bootstrap.Modal(document.getElementById('modalKeuangan')).show();
    
    // Opsional: Fokus otomatis ke input nominal setelah modal muncul
    setTimeout(() => document.getElementById('keu-nominal').focus(), 500);
}

function editKeuangan(id, tglRaw, jenis, kategori, nominal, ket) {
    // Visual Mode Edit
    document.getElementById('modalKeuanganTitle').innerText = "Edit Data Keuangan";
    document.getElementById('modalKeuanganTitle').className = "fw-bold text-warning"; 

    const btn = document.getElementById('btn-simpan-keuangan');
    btn.setAttribute('data-id', id);
    btn.innerText = "UPDATE PERUBAHAN";
    btn.className = "btn btn-warning fw-bold text-dark"; 

    // --- ISI DATA LAMA ---
    
    // 1. UPDATE TANGGAL (FIX BUG KOSONG)
    const elTanggal = document.getElementById('keu-tanggal');
    
    // Cek apakah Flatpickr aktif di elemen ini?
    if (elTanggal._flatpickr) {
        // Jika YA: Gunakan setDate bawaan Flatpickr agar UI berubah
        elTanggal._flatpickr.setDate(tglRaw, true);
    } else {
        // Jika TIDAK: Fallback manual HTML biasa
        let dateVal = '';
        try {
            if(tglRaw) {
                dateVal = new Date(tglRaw).toISOString().split('T')[0];
            }
        } catch(e) {}
        elTanggal.value = dateVal;
    }

    // 2. Jenis & Ket
    document.getElementById('keu-jenis').value = jenis;
    document.getElementById('keu-ket').value = ket;

    // 3. Nominal (Diformat Ribuan: 100000 -> 100.000)
    document.getElementById('keu-nominal').value = new Intl.NumberFormat('id-ID').format(nominal);

    // 4. Load Kategori
    const selectEl = document.getElementById('keu-kategori');
    selectEl.innerHTML = '<option>Loading...</option>'; 

    google.script.run.withSuccessHandler(categories => {
        selectEl.innerHTML = ''; 
        if (categories) categories.forEach(cat => selectEl.innerHTML += `<option value="${cat}">${cat}</option>`);
        selectEl.value = kategori;
        // Jaga-jaga jika kategori lama sudah dihapus dari master, tetap tampilkan
        if (selectEl.value !== kategori) {
             const opt = document.createElement('option');
             opt.value = kategori; opt.innerText = kategori;
             selectEl.appendChild(opt); selectEl.value = kategori;
        }
    }).getKategori();

    new bootstrap.Modal(document.getElementById('modalKeuangan')).show();
}

// --- FUNGSI BARU: HAPUS ---
function hapusKeuangan(id) {
    myConfirm('Hapus Data', 'Yakin hapus data keuangan ini?', () => {
        loading(true);
        google.script.run.withSuccessHandler(() => {
            loading(false);
            loadKeuangan(); // Refresh tabel
            loadDashboard(); // Refresh angka dashboard
            myAlert('Sukses', 'Data berhasil dihapus', 'success');
        }).hapusKeuangan(id);
    });
}

// [UPDATE] Fungsi Simpan Keuangan (Kirim Data Akun)
function simpanKeuangan() {
    const akun = document.getElementById('keu-akun').value;
    const tgl = document.getElementById('keu-tanggal').value;
    const jenis = document.getElementById('keu-jenis').value;
    const kategori = document.getElementById('keu-kategori').value;
    const rawNominal = document.getElementById('keu-nominal').value;
    const nominal = rawNominal.replace(/\./g, ''); 
    const ket = document.getElementById('keu-ket').value;

    if(!akun) return myAlert('Error', 'Pilih akun pembayaran dulu.', 'warning');
    if(!nominal || nominal == 0) return myAlert('Error', 'Nominal wajib diisi.', 'warning');

    const dataKirim = { 
        tanggal: tgl, 
        jenis: jenis, 
        kategori: kategori, 
        nominal: nominal, 
        keterangan: ket,
        akun: akun // [BARU]
    };

    loading(true);
    google.script.run.withSuccessHandler(res => { 
        loading(false);
        bootstrap.Modal.getInstance(document.getElementById('modalKeuangan')).hide();
        loadKeuangan(); 
        loadDashboard(); 
        myAlert('Sukses', 'Transaksi berhasil disimpan!', 'success');
    }).simpanKeuangan(dataKirim);
}

function bukaModalTransfer() {
    // 1. Ambil data akun terbaru
    loading(true);
    google.script.run.withSuccessHandler(data => {
        loading(false);
        globalListAkun = data;
        
        const selAsal = document.getElementById('trf-asal');
        const selTujuan = document.getElementById('trf-tujuan');
        
        selAsal.innerHTML = '';
        selTujuan.innerHTML = '';
        
        data.forEach(a => {
            selAsal.innerHTML += `<option value="${a.nama}" data-saldo="${a.saldo}">${a.nama}</option>`;
            selTujuan.innerHTML += `<option value="${a.nama}">${a.nama}</option>`;
        });

        // Update Saldo Asal
        cekSaldoTransfer();
        
        // Reset Input
        document.getElementById('trf-nominal').value = '';
        document.getElementById('trf-ket').value = '';
        
        new bootstrap.Modal(document.getElementById('modalTransfer')).show();

    }).getDaftarAkun();
}

function cekSaldoTransfer() {
    const sel = document.getElementById('trf-asal');
    const saldo = sel.options[sel.selectedIndex]?.getAttribute('data-saldo') || 0;
    
    // Update teks saldo dengan format yang lebih rapi
    const elSaldo = document.getElementById('saldo-trf-asal');
    elSaldo.innerText = rupiah(saldo);

    // Visual feedback: Jika saldo 0, warnanya merah. Jika ada isinya, warna biru.
    if(Number(saldo) <= 0) {
        elSaldo.classList.remove('text-primary');
        elSaldo.classList.add('text-danger');
    } else {
        elSaldo.classList.remove('text-danger');
        elSaldo.classList.add('text-primary');
    }
}
function eksekusiTransfer() {
    const asal = document.getElementById('trf-asal').value;
    const tujuan = document.getElementById('trf-tujuan').value;
    const rawNominal = document.getElementById('trf-nominal').value;
    const nominal = Number(rawNominal.replace(/\./g, ''));
    const ket = document.getElementById('trf-ket').value;

    if(asal === tujuan) return myAlert('Error', 'Akun asal dan tujuan tidak boleh sama.', 'warning');
    if(nominal <= 0) return myAlert('Error', 'Nominal transfer tidak valid.', 'warning');

    // Cek saldo cukup gak? (Opsional, kalau mau maksa transfer biarin aja)
    const selAsal = document.getElementById('trf-asal');
    const saldoAsal = Number(selAsal.options[selAsal.selectedIndex]?.getAttribute('data-saldo') || 0);
    
    if(nominal > saldoAsal) {
         if(!confirm(`Saldo akun ${asal} hanya ${rupiah(saldoAsal)}. Transfer akan membuat saldo minus. Lanjutkan?`)) return;
    }

    const payload = {
        akunAsal: asal,
        akunTujuan: tujuan,
        nominal: nominal,
        ket: ket
    };

    loading(true);
    google.script.run.withSuccessHandler(res => {
        loading(false);
        bootstrap.Modal.getInstance(document.getElementById('modalTransfer')).hide();
        loadKeuangan();
        loadDashboard();
        myAlert('Berhasil', 'Transfer saldo sukses!', 'success');
    }).prosesTransferSaldo(payload);
}

// 2. Fungsi Refresh Dropdown (Dipisahkan agar bisa dipanggil ulang)
function refreshDropdownKategori() {
    const selectEl = document.getElementById('keu-kategori');
    
    // Tampilkan indikator loading kecil di dalam dropdown (opsional)
    selectEl.innerHTML = '<option>Loading...</option>';

    google.script.run.withSuccessHandler(categories => {
        selectEl.innerHTML = ''; // Bersihkan dropdown
        
        if (categories && categories.length > 0) {
            categories.forEach(cat => {
                selectEl.innerHTML += `<option value="${cat}">${cat}</option>`;
            });
        } else {
            selectEl.innerHTML = '<option value="">Belum ada kategori</option>';
        }
    }).getKategori();
}

// 3. [PENGGANTI PROMPT] Fungsi Buka Modal Input Kategori
function tambahKategoriBaru() {
    // Reset inputan biar bersih
    document.getElementById('input-kategori-baru-val').value = ''; 
    // Tampilkan Modal Kecil Baru
    new bootstrap.Modal(document.getElementById('modalInputKategori')).show();
    // Auto focus ke input biar user langsung ngetik
    setTimeout(() => document.getElementById('input-kategori-baru-val').focus(), 500);
}

// 4. Fungsi Eksekusi Simpan ke Database
function prosesSimpanKategoriBaru() {
    const namaKategori = document.getElementById('input-kategori-baru-val').value;
    
    if(!namaKategori) return myAlert('Error', 'Nama kategori tidak boleh kosong!', 'warning');

    // Tutup modal input kecil
    const modalEl = document.getElementById('modalInputKategori');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    modalInstance.hide();

    loading(true); // Tampilkan loading

    google.script.run.withSuccessHandler(() => {
        loading(false); // Matikan loading
        
        // --- INI KUNCINYA: REFRESH DROPDOWN SETELAH SUKSES ---
        refreshDropdownKategori(); 
        
        // Kasih notif sukses cantik
        myAlert('Berhasil', `Kategori "${namaKategori}" ditambahkan!`, 'success');
        
    }).tambahKategori(namaKategori);
}

// Tambahan: Supaya bisa tekan ENTER di input kategori baru
document.getElementById('input-kategori-baru-val').addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    prosesSimpanKategoriBaru();
  }
});

function switchTab(tabId, el) {
    document.querySelectorAll('.tab-content-item').forEach(d => d.classList.add('d-none'));
    document.getElementById('tab-' + tabId).classList.remove('d-none');

    document.querySelectorAll('#payrollTabs .nav-link').forEach(l => {
        l.classList.remove('active', 'text-primary');
        l.classList.add('text-muted');
    });
    if(el) {
        el.classList.add('active', 'text-primary');
        el.classList.remove('text-muted');
    }

    if(tabId === 'karyawan') loadKaryawan();
    if(tabId === 'kasbon') loadKasbon();
    if(tabId === 'penggajian') initPenggajian();
}

// [UPDATE FIX] Preview Foto (Anti Error jika elemen HTML hilang)
function previewKaryawanImage(input) {
    const preview = document.getElementById('kry-preview-foto');
    
    // CEK DULU: Apakah elemen gambar ada?
    if (!preview) {
        console.error("ERROR: Elemen <img id='kry-preview-foto'> tidak ditemukan di index.html");
        alert("Error Tampilan: Kotak preview foto tidak ditemukan. Pastikan Anda sudah update file index.html");
        return; // Berhenti agar tidak error merah
    }

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// [UPDATE] Reset Modal (Ganti Link Placeholder biar gak Error Merah)
function modalKaryawan() { 
    document.getElementById('kry-id').value = '';
    
    // Placeholder Base64 (Aman Tanpa Internet) - Kotak Abu-abu
    const placeholder = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWVlZWVlIiAvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjYWFhYWFhIj5GT1RPPC90ZXh0Pjwvc3ZnPg==";
    
    document.getElementById('kry-preview-foto').src = placeholder;
    document.getElementById('kry-file-foto').value = '';

    // Reset semua input text
    const ids = ['kry-nama', 'kry-tmp-lahir', 'kry-tgl-lahir', 'kry-email', 'kry-no-id', 'kry-alamat-ktp', 'kry-alamat-dom', 'kry-darurat-nama', 'kry-darurat-telp', 'kry-gaji', 'kry-bonus'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    
    // Reset Select
    document.getElementById('kry-gender').value = 'Laki-laki';
    document.getElementById('kry-tipe-id').value = 'KTP';

    new bootstrap.Modal(document.getElementById('modalKaryawan')).show(); 
}

// [FUNGSI BARU: BUKA EDIT (POPULATE DATA)]
function bukaEditKaryawan(index) {
    const d = globalListKaryawan[index];
    if(!d) return;

    // Set Value dari Data Array
    // Urutan Array: 0:ID, 1:Nama, 2:TmpLahir, 3:TglLahir, 4:Gender, 5:NoID, 6:TipeID, 7:Email, 8:AlamatKTP, 9:Domisili, 10:DaruratNama, 11:DaruratTelp, 12:Gaji, 13:Bonus, 14:Foto, 15:Status
    
    document.getElementById('kry-id').value = d[0];
    document.getElementById('kry-nama').value = d[1];
    document.getElementById('kry-tmp-lahir').value = d[2];
    
    // Format Tanggal Lahir (YYYY-MM-DD)
    if(d[3]) {
        let tgl = new Date(d[3]);
        // Fix offset timezone
        tgl.setMinutes(tgl.getMinutes() - tgl.getTimezoneOffset());
        document.getElementById('kry-tgl-lahir').value = tgl.toISOString().split('T')[0];
    }

    if(d[4] === 'Perempuan') document.getElementById('genderP').checked = true;
    else document.getElementById('genderL').checked = true;

    document.getElementById('kry-no-id').value = d[5];
    document.getElementById('kry-tipe-id').value = d[6] || 'KTP';
    document.getElementById('kry-email').value = d[7];
    document.getElementById('kry-alamat-ktp').value = d[8];
    document.getElementById('kry-alamat-dom').value = d[9];
    
    document.getElementById('kry-darurat-nama').value = d[10];
    document.getElementById('kry-darurat-telp').value = d[11];

    document.getElementById('kry-gaji').value = Number(d[12]).toLocaleString('id-ID');
    document.getElementById('kry-bonus').value = Number(d[13]).toLocaleString('id-ID');

    // Handle Foto (LOGIKA BARU)
    document.getElementById('kry-foto-lama').value = d[14];
    
    if(d[14] && d[14].length > 5) {
        // JIKA ADA FOTO:
        const imgEl = document.getElementById('kry-preview-img');
        imgEl.src = d[14];
        imgEl.classList.remove('d-none');                // Muncul Foto
        document.getElementById('kry-no-foto').classList.add('d-none'); // Sembunyi Icon
    } else {
        // JIKA TIDAK ADA FOTO (Pakai Icon):
        document.getElementById('kry-preview-img').src = '';
        document.getElementById('kry-preview-img').classList.add('d-none'); // Sembunyi Foto
        document.getElementById('kry-no-foto').classList.remove('d-none');  // Muncul Icon
    }

    // Reset Input File
    document.getElementById('kry-foto-input').value = '';
    
    // Buka Tab Pertama
    const firstTab = new bootstrap.Tab(document.querySelector('#pribadi-tab'));
    firstTab.show();

    new bootstrap.Modal(document.getElementById('modalKaryawan')).show();
}

// [UPDATE FIX] Buka Edit Karyawan (Versi Anti-Error / Safe Mode)
function bukaEditKaryawan(id) {
    loading(true);
    google.script.run.withSuccessHandler(data => {
        loading(false);
        
        // 1. Cari Data Karyawan
        const k = data.find(row => row[0] == id);
        if(!k) return myAlert('Error', 'Data karyawan tidak ditemukan!', 'error');

        // 2. Helper Aman: Hanya isi jika elemen ada di HTML
        const setVal = (elmId, val) => {
            const el = document.getElementById(elmId);
            if(el) {
                el.value = (val === undefined || val === null) ? '' : val;
            } else {
                console.warn('Element HTML tidak ditemukan:', elmId);
            }
        };

        // 3. Isi Form (Menggunakan Helper Aman)
        setVal('kry-id', k[0]);
        setVal('kry-nama', k[1]);
        setVal('kry-tmp-lahir', k[2]);
        
        // Format Tanggal (Safe)
        try {
            if(k[3]) {
                let d = new Date(k[3]);
                let yyyy = d.getFullYear();
                let mm = String(d.getMonth()+1).padStart(2,'0');
                let dd = String(d.getDate()).padStart(2,'0');
                setVal('kry-tgl-lahir', `${yyyy}-${mm}-${dd}`);
            } else {
                setVal('kry-tgl-lahir', '');
            }
        } catch(e) { setVal('kry-tgl-lahir', ''); }

        setVal('kry-gender', k[4] || 'Laki-laki');
        setVal('kry-no-id', k[5]);
        setVal('kry-tipe-id', k[6] || 'KTP');
        setVal('kry-email', k[7]);
        setVal('kry-alamat-ktp', k[8]);
        setVal('kry-alamat-dom', k[9]);
        setVal('kry-darurat-nama', k[10]);
        setVal('kry-darurat-telp', k[11]);
        
        // Handle Tanggal Masuk (Safe Check)
        try {
            if(k[16]) { // Index 16 = Kolom Q
                let dm = new Date(k[16]);
                let yyyy = dm.getFullYear();
                let mm = String(dm.getMonth()+1).padStart(2,'0');
                let dd = String(dm.getDate()).padStart(2,'0');
                setVal('kry-tgl-masuk', `${yyyy}-${mm}-${dd}`);
            } else {
                setVal('kry-tgl-masuk', '');
            }
        } catch(e) { setVal('kry-tgl-masuk', ''); }
        
        // Format Angka (Safe)
        const gaji = k[12] ? Number(k[12]) : 0;
        const bonus = k[13] ? Number(k[13]) : 0;
        setVal('kry-gaji', gaji.toLocaleString('id-ID'));
        setVal('kry-bonus', bonus.toLocaleString('id-ID'));

        // 4. Handle Foto (Safe)
        const imgEl = document.getElementById('kry-preview-foto');
        const fileIn = document.getElementById('kry-file-foto');
        
        // Placeholder default (Base64)
        const placeholder = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWVlZWVlIiAvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjYWFhYWFhIj5GT1RPPC90ZXh0Pjwvc3ZnPg==";

        if(imgEl) {
            const urlFoto = k[14];
            if(urlFoto && urlFoto.length > 10) {
                imgEl.src = urlFoto;
            } else {
                imgEl.src = placeholder;
            }
        }
        
        if(fileIn) fileIn.value = ''; // Reset input file

        // 5. Buka Modal
        const modalEl = document.getElementById('modalKaryawan');
        if(modalEl) {
            new bootstrap.Modal(modalEl).show();
        } else {
            alert('Error: Modal HTML (id="modalKaryawan") tidak ditemukan. Pastikan Anda sudah update index.html!');
        }

    }).getData('KARYAWAN');
}

// [UPDATE FIX] Simpan Karyawan (Anti-Crash: Cek Elemen Dulu)
function simpanKaryawanDB() {
    // 1. Ambil Element File dengan Pengecekan Aman
    const fileInput = document.getElementById('kry-file-foto');
    let file = null;
    
    // Cek dulu: Apakah elemennya ada?
    if (fileInput && fileInput.files) {
        file = fileInput.files[0];
    } else {
        console.warn("Input file foto tidak ditemukan di HTML. Foto diabaikan.");
    }

    // 2. Ambil Helper Value (Fungsi kecil biar gak error kalau ID salah)
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };

    // 3. Susun Data
    const d = { 
        id: getVal('kry-id'), 
        nama: getVal('kry-nama'), 
        tmpLahir: getVal('kry-tmp-lahir'),
        tglLahir: getVal('kry-tgl-lahir'),
        gender: getVal('kry-gender'),
        noId: getVal('kry-no-id'),
        tipeId: getVal('kry-tipe-id'),
        email: getVal('kry-email'),
        alamatId: getVal('kry-alamat-ktp'),
        alamatDom: getVal('kry-alamat-dom'),
        daruratNama: getVal('kry-darurat-nama'),
        daruratTelp: getVal('kry-darurat-telp'),
        // Hapus titik pada format rupiah
        gaji: getVal('kry-gaji').replace(/\./g, ''),
        bonus: getVal('kry-bonus').replace(/\./g, ''),
        tglMasuk: getVal('kry-tgl-masuk'), // <--- TAMBAHKAN INI
        foto: null
    };

    // Validasi Sederhana
    if(!d.nama) return myAlert('Error', 'Nama karyawan wajib diisi!', 'warning');

    // 4. Logika Foto Lama (Jika Edit)
    if(d.id) {
        const imgPreview = document.getElementById('kry-preview-foto');
        if(imgPreview) {
            const currentSrc = imgPreview.src;
            // Jika src bukan placeholder base64 default, berarti itu foto lama
            if(currentSrc.includes('googleusercontent') || currentSrc.includes('drive.google')) {
                d.foto = currentSrc;
            }
        }
    }

    // 5. Fungsi Kirim ke Server
    const kirim = (payload) => {
        loading(true);
        google.script.run
            // [UPDATE] Bagian Success Handler di simpanKaryawanDB
            .withSuccessHandler((res) => {
                loading(false); 
                
                // 1. Tutup Modal
                const modalEl = document.getElementById('modalKaryawan');
                if(modalEl) bootstrap.Modal.getInstance(modalEl).hide();
                
                // 2. Refresh Tabel Karyawan
                loadKaryawan(); 
                
                // 3. [BARU] Refresh Halaman Penggajian (Jika sedang dibuka)
                // Cek apakah user sedang membuka tab penggajian dan sudah pilih periode?
                const periodeInput = document.getElementById('filter-periode-gaji');
                if(periodeInput && periodeInput.value) {
                    // Panggil cekDataGaji agar karyawan baru langsung terdeteksi (muncul kuning)
                    cekDataGaji(); 
                }

                myAlert('Berhasil', res, 'success');
            })
            .withFailureHandler((err) => {
                loading(false);
                myAlert('Gagal', err.message, 'error');
            })
            .simpanKaryawan(payload);
    };

    // 6. Eksekusi (Dengan atau Tanpa Upload Foto)
    if (file) {
        // Cek Ukuran (Maks 2MB)
        if(file.size > 2 * 1024 * 1024) return myAlert('Error', 'Ukuran foto maksimal 2MB', 'warning');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            d.foto = {
                data: e.target.result.split(',')[1],
                mimeType: file.type,
                fileName: file.name
            };
            kirim(d);
        };
        reader.readAsDataURL(file);
    } else {
        // Simpan tanpa ganti foto baru
        kirim(d);
    }
}

// [UPDATE FIX] Load Karyawan (Anti Error Null & Tampilan Baru)
function loadKaryawan() {
    const tb = document.querySelector('#tabel-karyawan tbody');
    if(tb) tb.innerHTML = '<tr><td colspan="5" class="text-center py-3">Memuat data...</td></tr>';

    google.script.run
    .withFailureHandler(err => {
        console.log("Gagal load karyawan: " + err);
        if(tb) tb.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Gagal mengambil data. Coba Refresh.</td></tr>';
    })
    .withSuccessHandler(d => {
      const sk = document.getElementById('kasbon-nama');
      if(tb) tb.innerHTML=''; 
      if(sk) sk.innerHTML='';
      
      // [PENTING] Tambahkan (d || []) untuk mencegah error "reading forEach of null"
      const dataAman = d || []; 

      if(dataAman.length === 0) {
          if(tb) tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted fst-italic py-3">Belum ada data karyawan.</td></tr>';
          return;
      }
      
      dataAman.forEach(r => {
        // r[1] = Nama, r[12] = Gaji, r[13] = Bonus, r[14] = Foto URL
        
        // Ambil Foto (Kolom O / Index 14)
        let imgHtml = '';
        if(r[14] && r[14].length > 10) {
            imgHtml = `<img src="${r[14]}" class="rounded-circle border me-2" style="width:35px; height:35px; object-fit:cover;">`;
        } else {
            // Avatar inisial jika tidak ada foto
            let inisial = r[1] ? r[1].substring(0,2).toUpperCase() : 'NA';
            imgHtml = `<div class="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center me-2" style="width:35px; height:35px; font-size:12px;">${inisial}</div>`;
        }

        // Format Rupiah (Safe Check)
        let gaji = r[12] ? Number(r[12]) : 0;
        let bonus = r[13] ? Number(r[13]) : 0;

        // Render Baris Tabel
        if(tb) {
            tb.innerHTML += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        ${imgHtml}
                        <div>
                            <div class="fw-bold text-dark">${r[1]}</div>
                            <small class="text-muted" style="font-size:10px;">${r[6] || 'ID'}: ${r[5] || '-'}</small>
                        </div>
                    </div>
                </td>
                <td>
                    ${r[11] || '-'}<br>
                    <small class="text-muted" style="font-size:10px;">Darurat: ${r[10] || '-'}</small>
                </td>
                <td>${rupiah(gaji)}</td>
                <td>${rupiah(bonus)}</td>
                <td>
                    <button class="btn btn-sm btn-warning text-dark me-1" onclick="bukaEditKaryawan('${r[0]}')">
                        <i class="material-icons" style="font-size:14px">edit</i>
                    </button>
                    <button class="btn btn-sm btn-light text-danger border" onclick="hapusKaryawan('${r[0]}')">
                        <i class="material-icons" style="font-size:14px">delete</i>
                    </button>
                </td>
            </tr>`;
        }
        if(sk) sk.innerHTML+=`<option>${r[1]}</option>`;
      });
    }).getData('KARYAWAN');
}



function hapusKaryawan(id) { if(confirm('Hapus?')) google.script.run.withSuccessHandler(loadKaryawan).hapusKaryawan(id); }

// 1. UPDATE FUNGSI LOAD KASBON (Tambah Tombol Detail)
function loadKasbon() {
    const filter = document.getElementById('filter-status-kasbon').value;
    const tb = document.querySelector('#tabel-kasbon tbody');
    tb.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';

    google.script.run.withSuccessHandler(data => {
        tb.innerHTML = '';
        let filtered = data;
        if(filter !== 'Semua') {
            filtered = data.filter(x => String(x[5]).includes(filter));
        }

        if(filtered.length === 0) {
            tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Tidak ada data.</td></tr>';
            return;
        }

        filtered.forEach(r => {
            // r[0]:ID, r[2]:Nama, r[3]:Total, r[6]:SudahBayar, r[8]:Angsuran
            let tgl = new Date(r[1]).toLocaleDateString('id-ID');
            let sudahBayar = Number(r[6]) || 0;
            let sisa = Number(r[3]) - sudahBayar;
            let statusBadge = r[5].includes('Belum') 
                ? '<span class="badge bg-danger">Belum Lunas</span>' 
                : '<span class="badge bg-success">Lunas</span>';

            tb.innerHTML += `
                <tr>
                    <td>${tgl}</td>
                    <td class="fw-bold">${r[2]}</td>
                    <td>
                        <div class="fw-bold">${rupiah(r[3])}</div>
                        <small class="text-muted">Sisa: <span class="text-danger fw-bold">${rupiah(sisa)}</span></small>
                    </td>
                    <td>${rupiah(r[8])}<small>/bln</small></td>
                    <td>
                        ${statusBadge}
                        <button class="btn btn-sm btn-outline-dark rounded-pill px-3 mt-1 d-block" onclick="bukaModalBayarKasbon('${r[0]}', '${r[2]}', ${r[3]}, ${sudahBayar})">
                            Detail / Bayar
                        </button>
                    </td>
                </tr>
            `;
        });
    }).getDataKasbonFull();
}

// [UPDATE FINAL] Buka Detail Kasbon + Tombol Cetak Rekap Full
function bukaModalBayarKasbon(id, nama, total, sudah) {
    let sisa = total - sudah;
    
    // Isi Summary Info
    document.getElementById('det-kasbon-id').value = id;
    document.getElementById('det-kasbon-nama').innerText = nama;
    document.getElementById('det-kasbon-total').innerText = rupiah(total);
    document.getElementById('det-kasbon-sudah').innerText = rupiah(sudah);
    document.getElementById('det-kasbon-sisa').innerText = rupiah(sisa);
    document.getElementById('input-bayar-cicilan').value = '';

    // Hide form bayar jika sudah lunas
    const formArea = document.getElementById('form-bayar-manual-area');
    if(sisa <= 0) {
        formArea.classList.add('d-none');
    } else {
        formArea.classList.remove('d-none');
        
        // Load Akun ke Dropdown
        const selAkun = document.getElementById('input-bayar-akun');
        selAkun.innerHTML = '<option value="">Loading...</option>';
        google.script.run.withSuccessHandler(akunList => {
            selAkun.innerHTML = '';
            akunList.forEach(a => {
                let selected = a.nama.toLowerCase().includes('tunai') ? 'selected' : '';
                selAkun.innerHTML += `<option value="${a.nama}" ${selected}>${a.nama}</option>`;
            });
        }).getDaftarAkun();
    }

    // --- [UPDATE UI] HEADER RIWAYAT DENGAN TOMBOL CETAK ---
    const headerRiwayat = document.querySelector('#modalDetailKasbon h6.mt-4'); // Selector header "Riwayat Pembayaran"
    
    // Kita ganti HTML header riwayat agar ada tombol di kanannya
    // Kita buat container flex
    if(headerRiwayat) {
        headerRiwayat.outerHTML = `
        <div class="d-flex justify-content-between align-items-center mt-4 border-bottom pb-2 mb-2">
            <h6 class="fw-bold m-0">Riwayat Pembayaran</h6>
            <button id="btn-cetak-rekap" class="btn btn-sm btn-dark rounded-pill px-3" disabled>
                <i class="material-icons align-middle" style="font-size:14px">print</i> Cetak Rekap
            </button>
        </div>`;
    }

    // Load Tabel History
    const tbHistory = document.querySelector('#tabel-history-cicilan tbody');
    tbHistory.innerHTML = '<tr><td colspan="4" class="text-center">Memuat riwayat...</td></tr>';
    
    new bootstrap.Modal(document.getElementById('modalDetailKasbon')).show();

    // AMBIL DATA RIWAYAT
    google.script.run.withSuccessHandler(hist => {
        tbHistory.innerHTML = '';
        const btnCetakRekap = document.getElementById('btn-cetak-rekap');

        if(!hist || hist.length === 0) {
            tbHistory.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Belum ada riwayat pembayaran.</td></tr>';
            if(btnCetakRekap) btnCetakRekap.disabled = true; // Disable tombol jika tidak ada data
            return;
        }

        // Aktifkan Tombol Cetak & Pasang Event Listener
        if(btnCetakRekap) {
            btnCetakRekap.disabled = false;
            btnCetakRekap.onclick = () => {
                // Siapkan Data Objek Lengkap untuk dicetak
                const dataLengkap = {
                    idKasbon: id,
                    namaKaryawan: nama,
                    totalPinjam: total,
                    totalBayar: sudah,
                    sisaHutang: sisa,
                    listRiwayat: hist // Array history lengkap
                };
                cetakRekapKasbonFull(dataLengkap);
            };
        }

        // Render Tabel (Sama seperti sebelumnya)
        const currentSisaStr = document.getElementById('det-kasbon-sisa').innerText;
        const currentSisa = Number(currentSisaStr.replace(/[^0-9,-]+/g,""));

        hist.forEach(h => {
            let tgl = new Date(h.tanggal).toLocaleDateString('id-ID');
            
            let badgeTipe = '';
            if(String(h.tipe).includes('Manual')) {
                badgeTipe = `<span class="badge bg-success bg-opacity-10 text-success border border-success">${h.tipe}</span>`;
            } else {
                badgeTipe = `<span class="badge bg-warning bg-opacity-10 text-dark border border-warning">${h.tipe}</span>`;
            }
            
            const printData = JSON.stringify({
                idKasbon: id, 
                nama: nama,
                tanggal: tgl,
                nominal: h.nominal,
                tipe: h.tipe,
                ket: h.ket,
                sisa: currentSisa 
            }).replace(/"/g, "&quot;");

            tbHistory.innerHTML += `
                <tr>
                    <td>${tgl}</td>
                    <td>
                        ${badgeTipe}<br> 
                        <small class="text-muted d-block text-truncate" style="max-width:200px; font-size:11px">"${h.ket}"</small>
                    </td>
                    <td class="text-end fw-bold text-dark">${rupiah(h.nominal)}</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-dark rounded-circle p-1 shadow-sm" onclick="cetakSlipKasbon(${printData})" title="Cetak Struk Ini">
                            <i class="material-icons" style="font-size:16px">print</i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }).getDetailHistoryKasbon(id);
}

// [UPDATE] Proses Bayar Cicilan (Kirim Akun yang Dipilih)
function prosesBayarCicilanManual() {
    const id = document.getElementById('det-kasbon-id').value;
    const nama = document.getElementById('det-kasbon-nama').innerText; 
    
    // AMBIL AKUN
    const akunDipilih = document.getElementById('input-bayar-akun').value;
    
    // AMBIL NOMINAL (BERSIHKAN TITIK)
    const rawNominal = document.getElementById('input-bayar-cicilan').value;
    const nominalStr = rawNominal.replace(/\./g, ''); 
    const nominal = Number(nominalStr);

    // VALIDASI
    if(!akunDipilih) return myAlert('Error', 'Silakan pilih Akun Pembayaran dulu!', 'warning');
    if(!nominal || nominal <= 0) return myAlert('Error', 'Nominal tidak valid', 'warning');

    myConfirm('Konfirmasi Bayar', `Terima pembayaran ${rupiah(nominal)} via ${akunDipilih}?`, () => {
        loading(true);
        
        const payload = { 
            idKasbon: id, 
            nominal: nominal,
            akun: akunDipilih // Kirim nama akun ke backend
        };

        google.script.run.withSuccessHandler(res => {
            loading(false);
            
            // 1. TUTUP MODAL
            const modalEl = document.getElementById('modalDetailKasbon');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if(modalInstance) modalInstance.hide();
            
            // 2. REFRESH SEMUA (Agar saldo akun di keuangan juga update)
            loadKasbon();     
            loadDashboard();  
            loadKeuangan();   

            // 3. CETAK SLIP
            const sisaLamaStr = document.getElementById('det-kasbon-sisa').innerText;
            const sisaLama = Number(sisaLamaStr.replace(/[^0-9,-]+/g,""));
            const sisaBaru = sisaLama - nominal;

            const dataCetak = {
                idKasbon: id,
                nama: nama,
                tanggal: new Date().toLocaleDateString('id-ID'),
                nominal: nominal,
                tipe: `Manual (${akunDipilih})`, // Tampilkan nama akun di struk
                ket: 'Pembayaran Cicilan Manual',
                sisa: sisaBaru
            };

            setTimeout(() => {
                const header = document.getElementById('globalModalHeader');
                const btnYes = document.getElementById('btn-confirm');
                
                myConfirm('Pembayaran Berhasil', 'Data tersimpan. Cetak struk sekarang?', () => {
                    cetakSlipKasbon(dataCetak);
                });

                if(header) {
                    header.className = 'modal-header text-white bg-success';
                    document.getElementById('globalModalIcon').innerText = 'check_circle';
                }
                if(btnYes) {
                    btnYes.innerText = "YA, CETAK STRUK";
                    btnYes.className = 'btn btn-success fw-bold px-4';
                }
            }, 500); 

        }).withFailureHandler(err => {
            loading(false);
            myAlert('Gagal', err.message, 'error');
        }).bayarCicilanManual(payload);
    });
}

function initPenggajian() {
    // Set default bulan ini
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const picker = document.getElementById('filter-periode-gaji');
    
    // 1. Jika kosong, isi tanggal default dulu
    if(!picker.value) {
        picker.value = `${yyyy}-${mm}`;
    }

    // 2. [SOLUSI] Selalu panggil fungsi load data setiap kali fungsi ini jalan
    cekDataGaji(); 
}

// [UPDATE FIX] Cek Data Gaji (Support Karyawan Susulan)
// [UPDATE RAPI] Cek Data Gaji (Sudah Cair)
function cekDataGaji() {
    const periode = document.getElementById('filter-periode-gaji').value;
    if(!periode) return;

    const btnArea = document.getElementById('btn-area-gaji');
    const msg = document.getElementById('status-periode-msg');
    const tbody = document.getElementById('tbody-gaji');

    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5"><div class="spinner-border text-primary spinner-border-sm"></div> Memuat data...</td></tr>';
    btnArea.innerHTML = '';

    google.script.run
    .withFailureHandler(err => {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Gagal: ${err.message}</td></tr>`;
    })
    .withSuccessHandler(data => {
        const safeData = data || []; 
        let totalOrang = safeData.length;
        let belumDigaji = safeData.filter(x => x.status === 'Belum Digaji').length;
        
        if(totalOrang > 0) {
            tbody.innerHTML = '';
            
            // Render Tabel
            safeData.forEach(row => {
                let isLunas = row.status !== 'Belum Digaji';
                let badge = isLunas 
                    ? `<span class="badge bg-success rounded-pill px-3">LUNAS</span>` 
                    : `<span class="badge bg-warning text-dark rounded-pill px-3">BELUM CAIR</span>`;
                
                let btnAksi = isLunas ? `
                        <button class="btn btn-sm btn-dark rounded-pill px-3 shadow-sm" onclick="cetakSlipGaji(${JSON.stringify(row).replace(/"/g, "&quot;")})">
                            <i class="material-icons align-middle" style="font-size:12px">print</i> Slip
                        </button>` : `<small class="text-muted fst-italic">Pending...</small>`;

                tbody.innerHTML += `
                    <tr class="${!isLunas ? 'table-warning' : ''}">
                        <td class="fw-bold text-dark">
                             <div class="d-flex align-items-center">
                                <div class="rounded-circle bg-light border text-muted d-flex align-items-center justify-content-center me-2" style="width:32px; height:32px; font-size:12px;">${row.nama.substring(0,2).toUpperCase()}</div>
                                ${row.nama}
                            </div>
                        </td>
                        <td class="text-end text-end-num text-muted">${rupiah(row.gaji)}</td>
                        <td class="text-end text-end-num text-success fw-bold">${rupiah(row.bonus)}</td>
                        <td class="text-end text-end-num text-danger">${rupiah(row.kasbon)}</td>
                        <td class="text-end text-end-num fw-bold text-primary bg-primary-subtle">${rupiah(row.total)}</td>
                        <td class="text-center">${badge}</td>
                        <td class="text-center">${btnAksi}</td>
                    </tr>
                `;
            });
            
            // Logic Pesan Status (Tetap sama seperti sebelumnya)
            if (belumDigaji > 0) {
                msg.innerHTML = `<span class="text-warning fw-bold"><i class="material-icons align-middle">info</i> Ditemukan ${belumDigaji} Karyawan Baru Belum Digaji!</span>`;
                btnArea.innerHTML = `<button class="btn btn-warning rounded-pill fw-bold shadow px-4" onclick="loadPreviewHitungGaji('${periode}')"><i class="material-icons align-middle">update</i> UPDATE PENCAIRAN (+${belumDigaji})</button>`;
            } else {
                msg.innerHTML = `<span class="text-success fw-bold"><i class="material-icons align-middle">check_circle</i> Periode ${periode} Selesai (${totalOrang} Orang).</span>`;
                btnArea.innerHTML = `<button class="btn btn-outline-dark rounded-pill fw-bold" onclick="printLaporanPDF('tabel-gaji-detail', 'Rekap Gaji ${periode}')"><i class="material-icons align-middle">print</i> Cetak Laporan</button>`;
            }

        } else {
            msg.innerHTML = `<span class="text-muted">Data Gaji Periode ${periode} Belum Ada.</span>`;
            loadPreviewHitungGaji(periode);
        }
    }).getRiwayatGajiByPeriode(periode);
}

// [UPDATE FIX TOMBOL] Load Preview Hanya Yang Belum Lunas & Munculkan Tombol Cairkan
function loadPreviewHitungGaji(periode) {
    const tbody = document.getElementById('tbody-gaji');
    const btnArea = document.getElementById('btn-area-gaji');

    // Tampilkan Loading
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div> Memuat karyawan pending...</td></tr>';

    google.script.run
    .withFailureHandler(err => {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Gagal: ${err.message}</td></tr>`;
    })
    .withSuccessHandler(data => {
        const safeData = data || []; 

        // 1. FILTER: Ambil hanya yang "Belum Digaji"
        const pendingList = safeData.filter(x => x.status === 'Belum Digaji');

        if (pendingList.length === 0) {
             tbody.innerHTML = '<tr><td colspan="7" class="text-center text-success fw-bold py-5"><i class="material-icons d-block mb-2" style="font-size:32px">check_circle</i>Semua karyawan sudah digaji untuk periode ini.</td></tr>';
             btnArea.innerHTML = ''; // Kosongkan tombol jika tidak ada data
             return;
        }

        // 2. MAPPING DATA KE SESSION (Agar bisa diedit)
        sessionPayrollData = pendingList.map(item => ({
            id: item.id,
            nama: item.nama,
            gaji: Number(item.gaji),
            bonus: Number(item.bonus),
            kasbonPotongan: Number(item.kasbon), 
            sisaHutang: 0, 
            total: Number(item.total),
            
            // Default Status Draft
            statusVerifikasi: 'Draft',
            kasbonBaru: 0,
            potonganLain: 0,
            ketKasbonBaru: ''
        })); 

        // 3. [PENTING] PASANG TOMBOL "CAIRKAN" DULU SEBELUM RENDER TABEL
        // Agar saat renderTabelPayroll() jalan, dia bisa mendeteksi tombol ini.
        btnArea.innerHTML = `
            <button id="btn-cairkan-final" class="btn btn-secondary rounded-pill fw-bold shadow px-4" onclick="prosesCairkanSemua('${periode}')" disabled>
                <i class="material-icons align-middle">lock</i> BELUM ADA YANG VERIFIKASI
            </button>
        `;
        
        // 4. RENDER TABEL (Ini akan otomatis update status tombol di atas)
        renderTabelPayroll(); 

        // 5. UPDATE PESAN HEADER
        const msg = document.getElementById('status-periode-msg');
        if(msg) msg.innerHTML = `<span class="text-warning fw-bold"><i class="material-icons align-middle">edit</i> Memproses ${pendingList.length} karyawan yang belum digaji.</span>`;

    }).getRiwayatGajiByPeriode(periode); 
}

// [UPDATE RAPI] Render Tabel Payroll (Draft)
function renderTabelPayroll() {
    const tbody = document.getElementById('tbody-gaji');
    tbody.innerHTML = '';
    
    let verifiedCount = 0;

    if(sessionPayrollData.length === 0) {
         tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted fst-italic py-5">Tidak ada data karyawan aktif.</td></tr>';
         return;
    }

    sessionPayrollData.forEach((p, index) => {
        let badgeStatus = p.statusVerifikasi === 'Sesuai' 
            ? '<span class="badge bg-success-subtle text-success border border-success rounded-pill px-3">SESUAI</span>' 
            : '<span class="badge bg-secondary-subtle text-secondary border border-secondary rounded-pill px-3">DRAFT</span>';
        
        if(p.statusVerifikasi === 'Sesuai') verifiedCount++;

        let infoHutang = p.sisaHutang > 0 ? `<div class="text-danger small mt-1" style="font-size:11px"><i class="material-icons" style="font-size:10px">warning</i> Sisa Hutang: ${rupiah(p.sisaHutang)}</div>` : '';
        let totalPotongan = (p.kasbonPotongan || 0) + (p.potonganLain || 0);

        // Class 'text-end-num' dari style.html untuk angka rata kanan
        tbody.innerHTML += `
            <tr id="row-gaji-${index}" class="${p.statusVerifikasi === 'Sesuai' ? 'bg-success-subtle' : ''}">
                <td class="fw-bold text-dark">
                    <div class="d-flex align-items-center">
                        <div class="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center me-2" style="width:32px; height:32px; font-size:12px;">${p.nama.substring(0,2).toUpperCase()}</div>
                        <div>
                            ${p.nama}
                            ${infoHutang}
                        </div>
                    </div>
                </td>
                <td class="text-end text-end-num text-muted">${rupiah(p.gaji)}</td>
                <td class="text-end text-end-num text-success fw-bold">${rupiah(p.bonus)}</td>
                <td class="text-end text-end-num text-danger">${rupiah(totalPotongan)}</td>
                <td class="text-end text-end-num fw-bold text-primary fs-6 bg-primary-subtle">${rupiah(p.total)}</td>
                <td class="text-center">${badgeStatus}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary rounded-pill px-3 shadow-sm" onclick="bukaModalVerifikasi(${index})">
                        Edit
                    </button>
                </td>
            </tr>
        `;
    });
    
    // --- BAGIAN INI YANG DIUBAH AGAR BISA PARTIAL ---
    const btnFinal = document.getElementById('btn-cairkan-final');
    if(btnFinal) {
        // Logika Baru: Tombol AKTIF jika ada MINIMAL 1 yang terverifikasi (verifiedCount > 0)
        // Tidak perlu menunggu semua (verifiedCount === sessionPayrollData.length)
        
        if(verifiedCount > 0) {
            btnFinal.disabled = false;
            btnFinal.className = "btn btn-success rounded-pill fw-bold shadow px-4";
            
            // Teks tombol menunjukkan berapa orang yang akan dibayar
            // Contoh: "CAIRKAN GAJI (2 Org)"
            btnFinal.innerHTML = `<i class="material-icons align-middle">payments</i> CAIRKAN GAJI (${verifiedCount})`;
        } else {
            // Jika belum ada satupun yang diverifikasi
            btnFinal.disabled = true;
            btnFinal.className = "btn btn-secondary rounded-pill fw-bold shadow px-4";
            btnFinal.innerHTML = `<i class="material-icons align-middle">lock</i> BELUM ADA YANG VERIFIKASI`;
        }
    }
}

// [UPDATE] Buka Modal & Isi Data (Dengan Tombol Batal Verifikasi)
function bukaModalVerifikasi(index) {
    const data = sessionPayrollData[index];
    
    document.getElementById('ver-index').value = index;
    document.getElementById('ver-nama').innerText = data.nama;
    document.getElementById('ver-jabatan').innerText = data.statusVerifikasi === 'Sesuai' ? 'SUDAH DIVERIFIKASI' : 'Status: Draft';
    
    // Warnai badge status di modal biar jelas
    const badgeEl = document.getElementById('ver-jabatan');
    if(data.statusVerifikasi === 'Sesuai') {
        badgeEl.className = 'badge bg-success text-white border';
    } else {
        badgeEl.className = 'badge bg-light text-dark border';
    }
    
    // Set Nilai Input (Format Ribuan)
    document.getElementById('ver-gaji').value = Number(data.gaji).toLocaleString('id-ID');
    document.getElementById('ver-bonus').value = Number(data.bonus).toLocaleString('id-ID');
    
    // Potongan Kasbon (Cicilan)
    document.getElementById('ver-potongan-kasbon').value = Number(data.kasbonPotongan).toLocaleString('id-ID');
    document.getElementById('info-sisa-hutang').innerText = `Total Hutang: ${rupiah(data.sisaHutang)}`;

    // Potongan Lain (Manual)
    document.getElementById('ver-potongan-lain').value = Number(data.potonganLain || 0).toLocaleString('id-ID');

    // Kasbon Baru (Jika ada)
    const checkKasbon = document.getElementById('check-kasbon-baru');
    const areaKasbon = document.getElementById('area-kasbon-baru');
    const inputKasbonBaru = document.getElementById('ver-kasbon-baru');
    const inputKasbonKet = document.getElementById('ver-kasbon-ket');

    if(data.kasbonBaru > 0) {
        checkKasbon.checked = true;
        areaKasbon.classList.remove('d-none');
        inputKasbonBaru.value = Number(data.kasbonBaru).toLocaleString('id-ID');
        inputKasbonKet.value = data.ketKasbonBaru;
    } else {
        checkKasbon.checked = false;
        areaKasbon.classList.add('d-none');
        inputKasbonBaru.value = '';
        inputKasbonKet.value = '';
    }

    hitungTotalModal(); // Hitung awal

    // --- LOGIKA BARU: TOMBOL DRAFT ---
    const modalFooter = document.querySelector('#modalDetailGaji .modal-footer');
    let btnDraft = '';

    // Jika statusnya sudah SESUAI, munculkan tombol "Kembalikan ke Draft" warna Kuning
    if(data.statusVerifikasi === 'Sesuai') {
        btnDraft = `
        <button type="button" class="btn btn-warning rounded-pill me-auto fw-bold text-dark shadow-sm" onclick="kembalikanKeDraft(${index})">
            <i class="material-icons align-middle">undo</i> Jadi Draft Lagi
        </button>`;
    }

    modalFooter.innerHTML = `
        ${btnDraft}
        <button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Tutup</button>
        <button type="button" class="btn btn-success rounded-pill fw-bold px-4 shadow" onclick="simpanVerifikasiKaryawan()">
            <i class="material-icons align-middle me-1">check_circle</i> ${data.statusVerifikasi === 'Sesuai' ? 'UPDATE DATA' : 'SESUAI'}
        </button>
    `;

    new bootstrap.Modal(document.getElementById('modalDetailGaji')).show();
}

// [BARU] Fungsi untuk membatalkan status Sesuai menjadi Draft
function kembalikanKeDraft(index) {
    // 1. Ubah status data di memori sementara
    sessionPayrollData[index].statusVerifikasi = 'Draft';

    // 2. Tutup Modal
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalDetailGaji'));
    if(modalInstance) modalInstance.hide();

    // 3. Render ulang tabel (Baris akan kembali jadi abu-abu/putih)
    renderTabelPayroll();

    // 4. Notif kecil (Opsional)
    // myAlert('Info', 'Status dikembalikan ke Draft.', 'info');
}

// [BARU] Toggle Input Kasbon Baru
function toggleKasbonBaru() {
    const isChecked = document.getElementById('check-kasbon-baru').checked;
    const area = document.getElementById('area-kasbon-baru');
    if(isChecked) {
        area.classList.remove('d-none');
        document.getElementById('ver-kasbon-baru').focus();
    } else {
        area.classList.add('d-none');
        document.getElementById('ver-kasbon-baru').value = 0;
        hitungTotalModal();
    }
}

// [BARU] Hitung Realtime di dalam Modal
function hitungTotalModal() {
    const gaji = Number(document.getElementById('ver-gaji').value.replace(/\./g, '')) || 0;
    const bonus = Number(document.getElementById('ver-bonus').value.replace(/\./g, '')) || 0;
    const cicilan = Number(document.getElementById('ver-potongan-kasbon').value.replace(/\./g, '')) || 0;
    const potLain = Number(document.getElementById('ver-potongan-lain').value.replace(/\./g, '')) || 0;
    
    // Kasbon Baru (Menambah Uang Diterima, tapi nanti jadi hutang)
    // Logika: Karyawan terima Gaji + Uang Pinjaman Baru
    let kasbonBaru = 0;
    if(document.getElementById('check-kasbon-baru').checked) {
        kasbonBaru = Number(document.getElementById('ver-kasbon-baru').value.replace(/\./g, '')) || 0;
    }

    // Rumus THP: (Gaji + Bonus + PinjamanBaru) - (CicilanLama + PotonganLain)
    const total = (gaji + bonus + kasbonBaru) - (cicilan + potLain);
    
    document.getElementById('ver-total').innerText = rupiah(total);
}

function simpanVerifikasiKaryawan() {
    const index = document.getElementById('ver-index').value;
    
    // 1. AMBIL GAJI DARI INPUT (Karena sekarang bisa diedit manual untuk Pro-rata)
    const gajiBaru = Number(document.getElementById('ver-gaji').value.replace(/\./g, '')) || 0;

    // 2. Ambil Data Lainnya
    const bonus = Number(document.getElementById('ver-bonus').value.replace(/\./g, '')) || 0;
    const cicilan = Number(document.getElementById('ver-potongan-kasbon').value.replace(/\./g, '')) || 0;
    const potLain = Number(document.getElementById('ver-potongan-lain').value.replace(/\./g, '')) || 0;
    
    let kasbonBaru = 0;
    let ketKasbon = '';
    if(document.getElementById('check-kasbon-baru').checked) {
        kasbonBaru = Number(document.getElementById('ver-kasbon-baru').value.replace(/\./g, '')) || 0;
        ketKasbon = document.getElementById('ver-kasbon-ket').value;
    }

    // 3. Update Object Session dengan GAJI BARU
    sessionPayrollData[index].gaji = gajiBaru; // <--- INI KUNCINYA
    sessionPayrollData[index].bonus = bonus;
    sessionPayrollData[index].kasbonPotongan = cicilan;
    sessionPayrollData[index].potonganLain = potLain;
    sessionPayrollData[index].kasbonBaru = kasbonBaru;
    sessionPayrollData[index].ketKasbonBaru = ketKasbon;
    
    // 4. Hitung Total Final (Gaji Baru + Bonus ...)
    sessionPayrollData[index].total = (gajiBaru + bonus + kasbonBaru) - (cicilan + potLain);
    
    // Set Status
    sessionPayrollData[index].statusVerifikasi = 'Sesuai';

    // Tutup Modal & Refresh Tabel
    bootstrap.Modal.getInstance(document.getElementById('modalDetailGaji')).hide();
    renderTabelPayroll();
}

function prosesCairkanSemua(periode) {
    // 1. Ambil HANYA yang statusnya 'Sesuai'
    const dataFinal = sessionPayrollData.filter(p => p.statusVerifikasi === 'Sesuai');
    
    if(dataFinal.length === 0) return myAlert('Error', 'Belum ada data yang diverifikasi.', 'warning');

    // 2. Konfirmasi jumlah orang yang akan digaji
    myConfirm('Konfirmasi Pencairan', `Siap mencairkan gaji untuk ${dataFinal.length} karyawan yang dipilih?\n(Sisa karyawan lain bisa diproses nanti)`, () => {
        loading(true);
        google.script.run.withSuccessHandler(res => {
            loading(false);
            myAlert('Sukses', res, 'success');
            
            // --- UPDATE DASHBOARD & KEUANGAN SECARA REALTIME ---
            
            // 1. Refresh Tabel Gaji (Agar yang sudah dibayar jadi HIJAU/LUNAS)
            cekDataGaji(); 
            
            // 2. Refresh Dashboard (Agar Pengeluaran Gaji langsung mengurangi Laba)
            if(typeof loadDashboard === 'function') loadDashboard();
            
            // 3. Refresh Keuangan (Agar tercatat di Tabel Arus Kas)
            if(typeof loadKeuangan === 'function') loadKeuangan();
            
            // 4. Refresh Kasbon (Update sisa hutang karyawan)
            if(typeof loadKasbon === 'function') loadKasbon();

        }).simpanGajiBulanan(periode, dataFinal);
    });
}

// [UPDATE FIX] Proses Simpan Gaji (Membersihkan Titik Ribuan)
function prosesSimpanGaji(periode) {
    let finalData = [];
    
    // Loop data preview untuk mengambil nilai input terbaru
    dataGajiPreview.forEach((p, index) => {
        const row = document.getElementById(`row-gaji-${index}`);
        
        // AMBIL NILAI INPUT & BUANG TITIKNYA
        // Contoh: "500.000" -> replace titik -> "500000" -> Number -> 500000
        const bonusStr = row.querySelector('.input-bonus-gaji').value.replace(/\./g, '');
        const potonganStr = row.querySelector('.input-potongan-gaji').value.replace(/\./g, '');

        const bonusVal = Number(bonusStr) || 0;
        const potonganVal = Number(potonganStr) || 0;
        
        // Hitung ulang total di sini untuk memastikan akurasi
        const totalFix = p.gaji + bonusVal - potonganVal;

        finalData.push({
            nama: p.nama,
            gaji: p.gaji,
            bonus: bonusVal,          
            potonganManual: potonganVal, 
            total: totalFix
        });
    });

    myConfirm('Konfirmasi Payroll', `Simpan dan cairkan gaji untuk periode ${periode}?`, () => {
        loading(true);
        google.script.run.withSuccessHandler(res => {
            loading(false);
            
            // Tampilkan Pesan Sukses
            myAlert('Sukses', res, 'success');
            
            // REFRESH SEMUA HALAMAN PENTING
            // Beri jeda sedikit agar server selesai menulis data
            setTimeout(() => {
                cekDataGaji();    // Refresh Tabel Gaji
                loadKasbon();     // Refresh Tabel Kasbon
                loadKeuangan();   // Refresh Keuangan
                loadDashboard();  // Refresh Dashboard
            }, 1000);

        }).simpanGajiBulanan(periode, finalData); 
    });
}

// [UPDATE] Hitung Cicilan Realtime (Support Ribuan)
function hitungCicilan() {
    // Ambil value input, buang titik
    const rawNominal = document.getElementById('kasbon-nominal').value.replace(/\./g, '');
    const nominal = Number(rawNominal) || 0;
    
    const tenor = Number(document.getElementById('kasbon-tenor').value) || 1;
    let finalTenor = tenor < 1 ? 1 : tenor;
    
    let angsuran = Math.ceil(nominal / finalTenor);
    document.getElementById('kasbon-estimasi').value = rupiah(angsuran);
}

// [UPDATE] Simpan Kasbon (Support Ribuan)
function simpanKasbon() {
    // Ambil value input, buang titik
    const rawNominal = document.getElementById('kasbon-nominal').value.replace(/\./g, '');

    const data = {
        nama: document.getElementById('kasbon-nama').value,
        nominal: rawNominal, // Kirim angka murni
        tenor: document.getElementById('kasbon-tenor').value, 
        ket: document.getElementById('kasbon-ket').value
    };

    if(!data.nominal || data.nominal <= 0) return myAlert('Error', 'Nominal harus diisi', 'warning');

    loading(true);
    google.script.run.withSuccessHandler(res => {
        loading(false);
        myAlert('Sukses', res, 'success');
        
        document.getElementById('kasbon-nominal').value = '';
        document.getElementById('kasbon-tenor').value = '1';
        document.getElementById('kasbon-estimasi').value = 'Rp 0';
        document.getElementById('kasbon-ket').value = '';
        
        loadKasbon(); 
    }).simpanKasbon(data);
}

  function loadHitungGaji() {
    document.querySelector('#tabel-hitung-gaji tbody').innerHTML='Loading...';
    google.script.run.withSuccessHandler(d => {
      payrollDataTemp = d; const tb = document.querySelector('#tabel-hitung-gaji tbody'); tb.innerHTML='';
      d.forEach(p => tb.innerHTML+=`<tr><td>${p.nama}</td><td>${rupiah(p.gaji)}</td><td>${rupiah(p.bonus)}</td><td class="text-danger">${rupiah(p.kasbon)}</td><td class="fw-bold">${rupiah(p.total)}</td></tr>`);
    }).getDataPayroll();
  }
  function cairkanGaji() {
    if(confirm('Cairkan Gaji? Kasbon akan dianggap Lunas.')) google.script.run.withSuccessHandler(alert).prosesPayrollFinal(payrollDataTemp);
  }

  // --- HELPER: SET TANGGAL OTOMATIS (1 sd Hari Ini) ---
function setAutoDate(tipe) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1); // Tanggal 1 Bulan Ini

    // Fungsi Format ke YYYY-MM-DD (Waktu Lokal Indonesia)
    const toStr = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Set ke Input HTML
    const elStart = document.getElementById(`filter-${tipe}-start`);
    const elEnd = document.getElementById(`filter-${tipe}-end`);

    if(elStart) elStart.value = toStr(firstDay);
    if(elEnd) elEnd.value = toStr(now);
}

// Listener untuk Metode Bayar
document.getElementById('pos-metode-bayar')?.addEventListener('change', function() {
    const val = this.value;
    const box = document.getElementById('box-jatuh-tempo');
    
    if(val === 'Hutang') {
        box.classList.remove('d-none'); // Munculkan tanggal
        // Set default jatuh tempo: 7 hari dari sekarang
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        document.getElementById('pos-jatuh-tempo').value = nextWeek.toISOString().split('T')[0];
    } else {
        box.classList.add('d-none'); // Sembunyikan
    }
});

// --- 1. FUNGSI LOAD PIUTANG (FIX BUG STATUS) ---
function loadPiutang() {
   loading(true);
   google.script.run
     .withFailureHandler(err => {
         loading(false);
         myAlert('Error', err.message, 'error');
     })
     .withSuccessHandler(data => {
        loading(false);
        const tb = document.querySelector('#tabel-piutang tbody');
        tb.innerHTML = '';
        
        if(!data || data.length === 0) {
           tb.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-4">Tidak ada data piutang.</td></tr>';
           return;
        }

        data.forEach(row => {
           // row: [0:ID, 1:WaktuStr, 2:Pelanggan, 3:Total, 4:JatuhTempoStr, 5:Status]
           
           const idTrx = row[0];
           const namaPel = row[2];
           const total = row[3];
           const status = row[5] ? row[5].toString().trim() : ''; 
           
           // [PERBAIKAN DISINI] Cek Persis kata 'Lunas' (Case insensitive)
           const isLunas = status.toLowerCase() === 'lunas'; 

           // Format Tanggal Jatuh Tempo
           let tglTempo = '-';
           let isLate = false;

           if(row[4] && row[4].length > 5) {
               let d = new Date(row[4]);
               tglTempo = d.toLocaleDateString('id-ID'); 
               // Telat jika Belum Lunas DAN Tanggal Lewat
               if(!isLunas && d < new Date()) isLate = true;
           }

           let tglTrx = row[1] ? new Date(row[1]).toLocaleDateString('id-ID') : '-';
           
           // Styling Tanggal
           let tempoDisplay = '';
           if(isLunas) {
               tempoDisplay = `<span class="text-success fw-bold"><i class="material-icons align-middle" style="font-size:14px">check_circle</i> Selesai</span>`;
           } else {
               let badgeLate = isLate ? '<span class="badge bg-danger ms-1" style="font-size:9px">Telat</span>' : '';
               let textClass = isLate ? 'text-danger fw-bold' : 'text-dark';
               tempoDisplay = `<div class="${textClass}">${tglTempo} ${badgeLate}</div>`;
           }

           // --- LOGIKA TOMBOL AKSI & CETAK ---
           let buttonsHtml = '';
           
           if (isLunas) {
               // KONDISI LUNAS: Badge + Cetak Bukti Lunas
               buttonsHtml = `
                   <span class="badge bg-light text-secondary border border-secondary px-2 py-1 me-1">SUDAH LUNAS</span>
                   <button class="btn btn-secondary btn-sm rounded-pill px-3 py-1 fw-bold shadow-sm" onclick="cetakSlipPiutang('${idTrx}', '${namaPel}', ${total}, '${tglTempo}', 'LUNAS')" style="font-size:11px">
                      <i class="material-icons align-middle" style="font-size:12px">print</i> BUKTI LUNAS
                   </button>
               `;
           } else {
               // KONDISI HUTANG: Tombol Lunasi + Cetak Tagihan
               buttonsHtml = `
                   <button class="btn btn-success btn-sm rounded-pill px-2 py-1 fw-bold shadow-sm me-1" onclick="prosesPelunasan('${idTrx}', '${namaPel}', ${total})" style="font-size:11px">
                      LUNASI
                   </button>
                   <button class="btn btn-info text-white btn-sm rounded-pill px-2 py-1 fw-bold shadow-sm" onclick="cetakSlipPiutang('${idTrx}', '${namaPel}', ${total}, '${tglTempo}', 'TAGIHAN')" style="font-size:11px">
                      <i class="material-icons align-middle" style="font-size:12px">print</i> TAGIHAN
                   </button>
               `;
           }

           // --- WARNA BACKGROUND BARIS ---
           let bgRow = isLunas ? 'style="background-color: #f8f9fa;"' : '';
           let opacity = isLunas ? 'style="opacity: 0.8;"' : '';

           tb.innerHTML += `
             <tr ${bgRow}>
                <td>
                   ${tempoDisplay}
                   <small class="text-muted d-block" style="font-size:11px">Trx: ${tglTrx}</small>
                </td>
                <td ${opacity}>
                   <span class="fw-bold text-dark">${namaPel}</span><br>
                   <small class="text-muted text-truncate d-block" style="max-width:150px; font-size:10px">${idTrx}</small>
                </td>
                <td class="fw-bold ${isLunas ? 'text-decoration-line-through text-muted' : 'text-danger'}" ${opacity}>
                    ${rupiah(total)}
                </td>
                <td class="text-center" style="white-space: nowrap;">
                   ${buttonsHtml}
                </td>
             </tr>
           `;
        });
     }).getDataPiutang(); 
}
function prosesPelunasan(id, nama, total) {
    myConfirm('Pelunasan Hutang', `Terima pembayaran sebesar ${rupiah(total)} dari ${nama}?\n\nData akan dicatat ke KEUANGAN (Pemasukan) dan status transaksi menjadi LUNAS.`, () => {
        loading(true);
        google.script.run.withSuccessHandler(res => {
            loading(false);
            myAlert('Berhasil', res, 'success');
            loadPiutang();      // Refresh tabel piutang
            loadDashboard();    // Update uang di dashboard
            loadNotifHutang();  // Update lonceng notifikasi
        }).lunasiHutang(id, total, nama);
    });
}

function filterTabelPiutang() {
   // Ambil apa yang diketik user
   const keyword = document.getElementById('cari-piutang').value.toLowerCase();
   
   // Ambil semua baris di tabel piutang
   const rows = document.querySelectorAll('#tabel-piutang tbody tr');
   
   rows.forEach(tr => {
      // Ambil teks di dalam baris tersebut
      const text = tr.innerText.toLowerCase();
      
      // Jika teks cocok dengan pencarian, tampilkan. Jika tidak, sembunyikan.
      if (text.includes(keyword)) {
         tr.style.display = '';
      } else {
         tr.style.display = 'none';
      }
   });
}

function tampilkanInvoice(dataPayload, idTrx) {
    const tglSekarang = new Date().toLocaleString('id-ID');
    const areaCetak = document.getElementById('area-cetak');
    
    // --- 1. LOGIKA JATUH TEMPO ---
    let infoMetode = `Metode Bayar: ${dataPayload.metode}`;
    if(dataPayload.metode === 'Hutang' && dataPayload.jatuhTempo) {
        const dateObj = new Date(dataPayload.jatuhTempo);
        const tglIndo = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const today = new Date(); today.setHours(0,0,0,0); dateObj.setHours(0,0,0,0);
        const diffDays = Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24));
        
        infoMetode = `
           Metode: <b>HUTANG</b><br>
           <div class="mt-1" style="border: 1px dashed red; padding: 2px 5px; display:inline-block;">
               <span class="text-danger fw-bold" style="font-size: 10pt;">
                   JATUH TEMPO: ${tglIndo}<br>(Waktu: ${diffDays} Hari Lagi)
               </span>
           </div>`;
    }

    // --- 2. GENERATE BARIS BARANG ---
    let rowsInvoice = '';
    let rowsSuratJalan = '';
    let grandTotal = 0;

    dataPayload.items.forEach(item => {
        grandTotal += item.total;
        
        // Invoice (Ada Harga)
        rowsInvoice += `
            <tr>
                <td class="text-start">${item.produkNama}<br><small class="text-muted fst-italic">${item.tipe}</small></td>
                <td>${rupiah(item.hargaSatuan)}</td>
                <td>${item.qty}</td>
                <td class="text-end fw-bold">${rupiah(item.total)}</td>
            </tr>`;
            
        // Surat Jalan (Tanpa Harga)
        rowsSuratJalan += `
            <tr>
                <td class="text-start">${item.produkNama}<br><small class="text-muted fst-italic">${item.tipe}</small></td>
                <td class="fw-bold fs-5">${item.qty}</td>
                <td class="text-center" style="width: 50px; border: 1px solid #000;"></td> 
            </tr>`;
    });

    // --- SETUP HEADER DENGAN LOGO ---
        const namaPT = globalCompanyProfile.nama_perusahaan || 'NAMA PERUSAHAAN';
        const alamatPT = globalCompanyProfile.alamat || '-';
        const noPT = globalCompanyProfile.no_perusahaan || '-';
        
        // Cek apakah ada logo?
        let htmlLogo = '';
        if(globalCompanyProfile.logo_perusahaan) {
            // Logo ditampilkan di kiri nama PT
            htmlLogo = `<img src="${globalCompanyProfile.logo_perusahaan}" style="height: 50px; width: auto; margin-right: 15px;">`;
        }

        const headerPT = `
            <div class="d-flex justify-content-between border-bottom border-2 border-dark pb-2 mb-2">
                <div class="d-flex align-items-center">
                    ${htmlLogo} 
                    <div>
                        <h4 class="fw-bold text-danger m-0 text-uppercase" style="font-size:16pt;">${namaPT}</h4>
                        <small class="text-muted fw-bold" style="font-size:9pt">Telp: ${noPT}</small><br>
                        <small class="text-muted" style="font-size:8pt; display:block; max-width:300px; line-height:1.2;">${alamatPT}</small>
                    </div>
                </div>
                <div class="text-end">
                    <h4 class="fw-bold text-dark" id="judul-dokumen">INVOICE</h4>
                    <div style="font-size:9pt">${tglSekarang}</div>
                    <div class="text-danger fw-bold" style="font-size:10pt">${idTrx}</div>
                </div>
            </div>`;

    // --- 4. HALAMAN 1: INVOICE (DENGAN TTD PELANGGAN) ---
    // Perhatikan bagian footer di bawah ini sudah saya ubah jadi 3 kolom
    const htmlInvoice = `
      <div class="h-100">
         ${headerPT}
         <div class="row mb-2" style="font-size:10pt">
             <div class="col-6">
                 <small class="text-muted fw-bold">KEPADA YTH:</small><br>
                 <strong class="text-dark fs-6">${dataPayload.pelanggan}</strong><br>
                 <small>${infoMetode}</small>
             </div>
             <div class="col-6 text-end">
                 <small class="text-muted fw-bold">KASIR:</small><br>
                 <strong>${dataPayload.kasir}</strong>
             </div>
         </div>

         <table class="table table-bordered border-dark mb-0 table-sm" style="border-color: #000 !important; font-size:10pt;">
             <thead class="bg-light text-center">
                 <tr><th>Nama Barang</th><th>Harga</th><th>Qty</th><th>Total</th></tr>
             </thead>
             <tbody class="text-center">${rowsInvoice}</tbody>
             <tfoot class="fw-bold">
                 <tr><td colspan="3" class="text-end pe-2">GRAND TOTAL</td><td class="text-end bg-light">${rupiah(grandTotal)}</td></tr>
             </tfoot>
         </table>
         
         <div class="row mt-4 align-items-end" style="page-break-inside: avoid;">
            <div class="col-4">
                <small class="fst-italic text-muted" style="font-size:8pt">
                   * Pembayaran sah jika disertai tanda tangan/stempel.<br>
                   * Komplain maksimal 1x24 jam.
                </small>
            </div>
            <div class="col-4 text-center">
                <small>Tanda Terima,</small>
                <br><br><br>
                <small class="fw-bold text-uppercase">( ${dataPayload.pelanggan} )</small>
            </div>
            <div class="col-4 text-center">
                <small>Hormat Kami,</small>
                <br><br><br>
                <small class="fw-bold text-uppercase">( ${dataPayload.kasir} )</small>
            </div>
         </div>
      </div>
    `;

    // --- 5. HALAMAN 2: SURAT JALAN (TETAP SAMA) ---
    const headerSJ = headerPT.replace('INVOICE', 'SURAT JALAN'); 
    const htmlSuratJalan = `
      <div class="h-100">
         ${headerSJ}
         <div class="alert alert-secondary p-1 mb-2 text-center fw-bold" style="font-size:10pt; border:1px solid #999;">
             DOKUMEN GUDANG / PENGIRIMAN
         </div>
         
         <div class="row mb-2" style="font-size:10pt">
             <div class="col-6">
                 <small class="text-muted fw-bold">TUJUAN:</small><br>
                 <strong class="text-dark fs-6">${dataPayload.pelanggan}</strong>
             </div>
             <div class="col-6 text-end">
                 <small class="text-muted fw-bold">GUDANG:</small><br>
                 <strong>________________</strong>
             </div>
         </div>

         <table class="table table-bordered border-dark mb-0 table-sm" style="border-color: #000 !important; font-size:10pt;">
             <thead class="bg-light text-center">
                 <tr><th>Nama Barang / Deskripsi</th><th>Qty (Fisik)</th><th>Cek</th></tr>
             </thead>
             <tbody class="text-center align-middle">${rowsSuratJalan}</tbody>
         </table>

         <div class="row mt-4 text-center" style="page-break-inside: avoid;">
            <div class="col-4"><small>Penerima,</small><br><br><br><br><small>( ....................... )</small></div>
            <div class="col-4"><small>Supir / Kurir,</small><br><br><br><br><small>( ....................... )</small></div>
            <div class="col-4"><small>Kepala Gudang,</small><br><br><br><br><small>( ....................... )</small></div>
         </div>
      </div>
    `;

    areaCetak.innerHTML = htmlInvoice + '<div class="page-break"></div>' + htmlSuratJalan;
    new bootstrap.Modal(document.getElementById('modalInvoice')).show();
}

function tutupInvoice() {
    // Saat invoice ditutup, baru reset keranjang
    resetKeranjang(); 
}

// --- UPDATE FUNGSI FILTER CEPAT ---
function setFilterCepat(pilihan, tipe) {
    
    // 1. Setup Awal (Default: Hari Ini)
    const now = new Date();
    let start = new Date(); 
    let end = new Date();   

    // Helper format YYYY-MM-DD
    const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // 2. Logika Pilihan Waktu
    if (pilihan === "" || pilihan === "bulan_ini") {
        start = new Date(now.getFullYear(), now.getMonth(), 1); // Tgl 1 Bulan Ini
        end = now; // Hari Ini
    } else {
        switch(pilihan) {
            case 'hari_ini':
                // Tidak perlu diubah, start & end sudah default 'now'
                break; 
            
            case 'kemarin':
                start.setDate(now.getDate() - 1);
                end.setDate(now.getDate() - 1);
                break;
            
            case '7_hari':
                start.setDate(now.getDate() - 6); 
                break;
                
            case 'bulan_lalu':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1); 
                end = new Date(now.getFullYear(), now.getMonth(), 0); 
                break;
        }
    }

    // 3. Tentukan ID Input berdasarkan Tipe (JUAL / BELI / KEUANGAN)
    let idStart, idEnd;

    if (tipe === 'JUAL') {
        idStart = 'filter-jual-start'; 
        idEnd = 'filter-jual-end';
    } else if (tipe === 'BELI') {
        idStart = 'filter-beli-start'; 
        idEnd = 'filter-beli-end';
    } else if (tipe === 'KEUANGAN') { // <--- INI BAGIAN PENTING YANG KURANG
        idStart = 'filter-keu-start'; 
        idEnd = 'filter-keu-end';
    } else {
        return; // Jika tipe tidak dikenali, berhenti
    }

    // 4. Eksekusi Update ke Input
    const elStart = document.getElementById(idStart);
    const elEnd = document.getElementById(idEnd);

    // Update Start Date
    if (elStart) {
        if (elStart._flatpickr) elStart._flatpickr.setDate(fmt(start), true);
        else elStart.value = fmt(start);
    }

    // Update End Date
    if (elEnd) {
        if (elEnd._flatpickr) elEnd._flatpickr.setDate(fmt(end), true);
        else elEnd.value = fmt(end);
    }

    // 5. Jalankan Filter Tabel Otomatis
    if(tipe === 'JUAL') terapkanFilter('JUAL');
    else if(tipe === 'BELI') terapkanFilter('BELI');
    else if(tipe === 'KEUANGAN') terapkanFilterKeuangan(); // <--- Refresh Tabel Keuangan
}

// 2. Export ke Excel (Format .xls HTML Table)
function exportKeExcel(tableId, filename = 'Laporan') {
    const table = document.getElementById(tableId);
    let html = table.outerHTML;

    // Bersihkan kolom 'Aksi' (Tombol) agar tidak ikut ke Excel
    // Kita buat elemen sementara untuk manipulasi
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Hapus kolom terakhir (Aksi) di header dan body
    const rows = tempDiv.querySelectorAll('tr');
    rows.forEach(row => {
        if(row.children.length > 0) {
            row.removeChild(row.lastElementChild); // Hapus kolom terakhir (Aksi)
        }
    });

    // Tambahkan CSS sederhana agar Excel rapi
    const style = `
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    `;

    // Buat Blob
    const finalHtml = style + tempDiv.innerHTML;
    const blob = new Blob([finalHtml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    
    // Trigger Download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '_' + new Date().toLocaleDateString('id-ID').replace(/\//g,'-') + '.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// --- FUNGSI CETAK SLIP PIUTANG (REVISI TENGAH & RAPI) ---
function cetakSlipPiutang(idTrx, pelanggan, total, jatuhTempo, mode) {
    
    // 1. Ambil Data Perusahaan
    const namaPT = globalCompanyProfile.nama_perusahaan || 'NAMA PERUSAHAAN';
    const alamatPT = globalCompanyProfile.alamat || '-';
    const noPT = globalCompanyProfile.no_perusahaan || '-';
    const logoUrl = globalCompanyProfile.logo_perusahaan || '';
    
    let htmlLogo = '';
    if (logoUrl) {
        htmlLogo = `<img src="${logoUrl}" style="height: 65px; width: auto; margin-right: 15px;">`;
    }

    const tglCetak = new Date().toLocaleString('id-ID');

    // 2. Konten Dinamis
    let judulDokumen = '';
    let warnaHeader = '';
    let pesanBody = '';
    let labelTotal = '';
    
    if (mode === 'LUNAS') {
        judulDokumen = 'TANDA TERIMA PELUNASAN';
        warnaHeader = '#198754'; // Hijau
        labelTotal = 'TOTAL DIBAYARKAN';
        pesanBody = `
            <div style="background-color: #d1e7dd; padding: 15px; border-left: 5px solid #198754; margin-bottom: 20px; color: #0f5132;">
                <strong>TERIMA KASIH.</strong><br>
                Pembayaran untuk transaksi ini telah kami terima dengan lunas.<br>
                Bukti ini adalah tanda terima yang sah.
            </div>`;
    } else {
        judulDokumen = 'INVOICE / SURAT TAGIHAN';
        warnaHeader = '#dc3545'; // Merah
        labelTotal = 'SISA TAGIHAN';
        pesanBody = `
            <div style="background-color: #f8d7da; padding: 15px; border-left: 5px solid #dc3545; margin-bottom: 20px; color: #842029;">
                <strong>MOHON SEGERA DIBAYAR.</strong><br>
                Kami informasikan bahwa tagihan ini telah/akan jatuh tempo pada tanggal <b>${jatuhTempo}</b>.<br>
                Mohon segera melakukan pembayaran.
            </div>`;
    }

    // 3. Template HTML
    const win = window.open('', '', 'height=700,width=900');
    
    // PERBAIKAN: CSS Header dibuat Center
    const htmlContent = `
    <html>
    <head>
        <title>${judulDokumen} - ${pelanggan}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
            body { font-family: 'Roboto', sans-serif; padding: 40px; color: #333; -webkit-print-color-adjust: exact; }
            
            /* HEADER KOP SURAT (DIPERBAIKI) */
            .header { 
                display: flex; 
                align-items: center; 
                justify-content: center; /* INI KUNCINYA: Biar di Tengah */
                border-bottom: 3px double #333; 
                padding-bottom: 20px; 
                margin-bottom: 30px; 
                text-align: center; /* Teks di dalamnya juga tengah */
            }
            
            .judul-besar { font-size: 20px; font-weight: bold; color: ${warnaHeader}; text-transform: uppercase; margin-bottom: 5px; }
            .box-info { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 1px dashed #ccc; padding-bottom: 20px; }
            .tabel-detail { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .tabel-detail th { background: #f2f2f2; text-align: left; padding: 10px; border-bottom: 2px solid #ddd; }
            .tabel-detail td { padding: 10px; border-bottom: 1px solid #eee; }
            .total-box { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
            .ttd-area { display: flex; justify-content: space-between; margin-top: 60px; text-align: center; }
            .footer-note { margin-top: 50px; font-size: 10px; color: #777; font-style: italic; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
    </head>
    <body>
        <div class="header">
            ${htmlLogo}
            <div style="text-align: center;"> <h2 style="margin:0; font-size:24px; color:#d32f2f; text-transform: uppercase; line-height:1.2;">${namaPT}</h2>
                <div style="font-size:11px; font-weight:bold; margin-top:5px;">${alamatPT}</div>
                <div style="font-size:11px;">Telp: ${noPT}</div>
            </div>
        </div>

        <div style="text-align:center; margin-bottom:30px;">
            <div class="judul-besar" style="border: 2px solid ${warnaHeader}; display:inline-block; padding: 8px 30px; border-radius: 8px;">
                ${judulDokumen}
            </div>
            <div style="margin-top:5px; color:#555; font-size:12px;">Dicetak pada: ${tglCetak}</div>
        </div>

        <div class="box-info">
            <div style="width: 48%;">
                <small style="color:#777; font-weight:bold; letter-spacing:1px;">KEPADA YTH:</small><br>
                <span style="font-size:18px; font-weight:bold; color:#000;">${pelanggan}</span>
            </div>
            <div style="width: 48%; text-align:right;">
                <small style="color:#777; font-weight:bold; letter-spacing:1px;">NO. REFERENSI:</small><br>
                <span style="font-size:16px; font-weight:bold;">${idTrx}</span>
            </div>
        </div>

        ${pesanBody}

        <table class="tabel-detail">
            <thead>
                <tr>
                    <th>Keterangan Transaksi</th>
                    <th style="text-align:right;">Nominal Tagihan</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Tagihan Pembelian Barang (ID: <b>${idTrx}</b>)</td>
                    <td style="text-align:right;">${rupiah(total)}</td>
                </tr>
            </tbody>
        </table>

        <div class="total-box">
            ${labelTotal}: <span style="font-size:26px; color:${warnaHeader}; margin-left:10px;">${rupiah(total)}</span>
        </div>

        <div class="ttd-area">
            <div style="width: 200px;">
                <small>Penerima,</small>
                <br><br><br><br>
                <div style="border-bottom: 1px solid #000; font-weight:bold;">(${pelanggan})</div>
            </div>
            <div style="width: 200px;">
                <small>Hormat Kami,</small>
                <br><br><br><br>
                <div style="border-bottom: 1px solid #000; font-weight:bold;">( Admin Keuangan )</div>
            </div>
        </div>

        <div class="footer-note">
            Dokumen ini dicetak secara otomatis oleh sistem SiGAS PRO. <br>
            Harap simpan bukti ini sebagai referensi transaksi yang sah.
        </div>

        <script>
            setTimeout(() => { window.print(); }, 800);
        ` + '</sc' + 'ript>' + `
    </body>
    </html>
    `;
    
    win.document.write(htmlContent);
    win.document.close();
}

// [UPDATE FIX] Laporan PDF: Header Besar & Berwarna, Tabel Ramping/Padat
function printLaporanPDF(tableId, judulLaporan) {
    const table = document.getElementById(tableId);
    
    // 1. Ambil Data Perusahaan
    const namaPT = globalCompanyProfile.nama_perusahaan || 'NAMA PERUSAHAAN';
    const alamatPT = globalCompanyProfile.alamat || 'Alamat perusahaan belum diatur';
    const noPT = globalCompanyProfile.no_perusahaan || '-';
    const logoUrl = globalCompanyProfile.logo_perusahaan || ''; 

    // 2. Siapkan Logo (Ukuran Normal 70px)
    let htmlLogo = '';
    if (logoUrl) {
        htmlLogo = `<img src="${logoUrl}" style="height: 75px; width: auto; margin-right: 20px;">`;
    }

    // 3. Header KOP SURAT (Dibuat Besar & Jelas Kembali)
    const headerHtml = `
        <div style="display: flex; align-items: center; justify-content: center; border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 20px;">
            ${htmlLogo}
            <div style="text-align: center;">
                <h2 style="margin: 0; font-size: 20pt; font-weight: 800; text-transform: uppercase; color: #d32f2f; line-height: 1;">${namaPT}</h2>
                <div style="font-size: 10pt; font-weight: bold; margin-top: 5px; color: #333;">${alamatPT}</div>
                <div style="font-size: 10pt; color: #555;">Telp: ${noPT}</div>
            </div>
        </div>
        
        <div style="text-align: center; margin-bottom: 15px;">
            <h3 style="margin: 0; text-transform: uppercase; font-size: 14pt; font-weight:bold; text-decoration: underline;">${judulLaporan}</h3>
            <small style="color: #555; font-style: italic;">Dicetak pada: ${new Date().toLocaleString('id-ID')}</small>
        </div>
    `;

    // 4. Clone Tabel & Bersihkan Kolom Aksi
    let tableClone = table.cloneNode(true);
    
    // Hapus kolom terakhir (Aksi) di Header
    const ths = tableClone.querySelectorAll('th');
    if(ths.length > 0) ths[ths.length - 1].remove();

    // Hapus kolom terakhir (Aksi) di Body
    const rows = tableClone.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if(cells.length > 0) cells[cells.length - 1].remove();
    });

    // 5. Buka Jendela Print
    const win = window.open('', '', 'height=800,width=1100');
    
    // 6. CSS KHUSUS (Header Besar, Tabel Ramping, Warna NYALA)
    const cssStyle = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
            
            /* Paksa Browser Cetak Warna Background */
            body { 
                font-family: 'Roboto', sans-serif; 
                padding: 30px; 
                color: #000;
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important;
            }

            /* --- STYLING TABEL (RAMPING) --- */
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 5px; 
                font-size: 9pt; /* Font isi tabel kecil pas */
            }
            
            /* Header Tabel: Warna Abu Terang, Padding Rapat */
            th { 
                background-color: #e0e0e0 !important; /* Warna Abu Wajib !important */
                color: #000; 
                font-weight: bold; 
                text-transform: uppercase; 
                padding: 6px 4px; /* Atas-Bawah 6px (Rapat), Kiri-Kanan 4px */
                border: 1px solid #666; 
                text-align: center;
                font-size: 8.5pt;
            }

            /* Isi Tabel: Padding Sangat Rapat agar Baris Pendek */
            td { 
                padding: 4px 5px; /* INI KUNCINYA: Padding kecil bikin baris pendek */
                border: 1px solid #999; 
                vertical-align: middle; 
                line-height: 1.2; /* Jarak antar baris teks didalam sel rapat */
            }

            /* Warna Baris Selang-seling */
            tr:nth-child(even) td { background-color: #f9f9f9 !important; }

            /* Kembalikan Warna Teks (Biru/Merah) */
            .text-primary { color: #0d6efd !important; font-weight: bold; }
            .text-danger { color: #dc3545 !important; font-weight: bold; }
            .fw-bold { font-weight: bold; }
            .text-muted { color: #666 !important; font-size: 0.85em; }
            
            /* Utility */
            .text-end { text-align: right; }
            .text-center { text-align: center; }

            /* Footer Halaman */
            @page { margin: 10mm; size: A4; }
        </style>
    `;

    win.document.write('<html><head><title>Laporan - SiGAS PRO</title>');
    win.document.write(cssStyle);
    win.document.write('</head><body>');
    win.document.write(headerHtml);
    win.document.write(tableClone.outerHTML);
    
    // TTD Admin
    win.document.write(`
        <div style="margin-top: 30px; display: flex; justify-content: flex-end; page-break-inside: avoid;">
            <div style="text-align: center; width: 180px;">
                <small style="font-size:9pt;">Dibuat Oleh,</small>
                <br><br><br><br>
                <div style="border-bottom: 1px solid #000; font-weight: bold; font-size:10pt;">( Admin )</div>
            </div>
        </div>
    `);

    win.document.write('</body></html>');
    win.document.close();
    
    // Jeda sedikit agar logo terload sempurna sebelum dialog print muncul
    setTimeout(() => {
        win.focus();
        win.print();
    }, 800);
}

// --- FUNGSI CETAK NOTA KEUANGAN (A5 LANDSCAPE + 3 TANDA TANGAN) ---
function cetakNotaKeuangan(data) {
    // 1. Ambil Profil Perusahaan
    const namaPT = globalCompanyProfile.nama_perusahaan || 'NAMA PERUSAHAAN';
    const alamatPT = globalCompanyProfile.alamat || '-';
    const noPT = globalCompanyProfile.no_perusahaan || '-';
    const logoUrl = globalCompanyProfile.logo_perusahaan || '';
    
    let htmlLogo = '';
    if (logoUrl) {
        htmlLogo = `<img src="${logoUrl}" style="height: 50px; width: auto; margin-right: 15px;">`;
    }

    // 2. Tentukan Judul, Warna & Label Tanda Tangan Ketiga
    let judulDokumen = '';
    let warnaHeader = '';
    let labelPihakKetiga = ''; // <--- Variabel Baru
    
    if (data.jenis === 'Pemasukan') {
        judulDokumen = 'BUKTI KAS MASUK';
        warnaHeader = '#198754'; // Hijau
        labelPihakKetiga = 'Penyetor / Pelanggan'; // Orang yang ngasih duit
    } else {
        judulDokumen = 'BUKTI KAS KELUAR';
        warnaHeader = '#dc3545'; // Merah
        labelPihakKetiga = 'Penerima Uang'; // Orang yang terima duit
    }

    // Format Tanggal
    let tglStr = new Date(data.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // 3. Template HTML Nota
    const win = window.open('', '', 'height=600,width=800');
    
    const htmlContent = `
    <html>
    <head>
        <title>Cetak Nota - ${data.id}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
            
            @page { 
                size: A5 landscape; 
                margin: 0; 
            }

            body { 
                font-family: 'Roboto', sans-serif; 
                padding: 10mm; 
                margin: 0;
                color: #333; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
                background-color: white;
            }
            
            .container { 
                border: 2px solid #333; 
                padding: 20px; 
                width: 100%; 
                height: 100%; 
                box-sizing: border-box; 
                position: relative; 
            }
            
            .header { 
                display: flex; 
                align-items: center; 
                border-bottom: 2px solid #333; 
                padding-bottom: 10px; 
                margin-bottom: 15px; 
            }
            .header-text h2 { margin: 0; font-size: 18px; color: #333; text-transform: uppercase; }
            .header-text p { margin: 0; font-size: 10px; color: #555; }
            
            .judul-nota { 
                text-align: center; font-size: 16px; font-weight: bold; 
                background-color: ${warnaHeader}; color: white; 
                padding: 5px; margin-bottom: 15px; border-radius: 4px; letter-spacing: 1px;
                -webkit-print-color-adjust: exact;
            }

            .row-content { display: flex; gap: 20px; }
            .col-left { flex: 1; }
            .col-right { flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; }

            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .info-table td { padding: 4px 5px; vertical-align: top; font-size: 12px; } 
            .label { font-weight: bold; width: 120px; color: #555; }
            .separator { width: 10px; }
            .isi { border-bottom: 1px dotted #ccc; font-weight: 500; }
            
            .nominal-box { 
                background: #f8f9fa; border: 2px dashed ${warnaHeader}; 
                padding: 10px 30px; font-size: 22px; font-weight: bold; 
                color: ${warnaHeader}; display: inline-block; margin-top: 5px;
                border-radius: 8px;
                text-align: center;
            }
            .terbilang-label { font-size: 10px; color: #777; margin-top: 5px; }

            /* --- UPDATED FOOTER (3 KOLOM) --- */
            .footer { 
                display: flex; 
                justify-content: space-between; /* Agar 3 kolom rata kiri-tengah-kanan */
                margin-top: 25px; 
                text-align: center; 
                padding: 0 10px;
            }
            .ttd-box { width: 30%; } /* Lebar proporsional untuk 3 kolom */
            .ttd-line { border-bottom: 1px solid #000; margin-top: 50px; font-weight: bold; font-size: 12px;}
            
            .timestamp {
                position: absolute;
                bottom: 5px;
                left: 0; right: 0;
                font-size: 8px; color: #999; 
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                ${htmlLogo}
                <div class="header-text">
                    <h2>${namaPT}</h2>
                    <p>${alamatPT}</p>
                    <p>Telp: ${noPT}</p>
                </div>
            </div>

            <div class="judul-nota">${judulDokumen}</div>

            <div class="row-content">
                <div class="col-left">
                    <table class="info-table">
                        <tr>
                            <td class="label">No. Transaksi</td><td class="separator">:</td>
                            <td class="isi">${data.id}</td>
                        </tr>
                        <tr>
                            <td class="label">Tanggal</td><td class="separator">:</td>
                            <td class="isi">${tglStr}</td>
                        </tr>
                        <tr>
                            <td class="label">Kategori</td><td class="separator">:</td>
                            <td class="isi">${data.kategori}</td>
                        </tr>
                        <tr>
                            <td class="label">Keterangan</td><td class="separator">:</td>
                            <td class="isi" style="font-style: italic;">"${data.ket}"</td>
                        </tr>
                    </table>
                </div>

                <div class="col-right">
                    <div class="terbilang-label">JUMLAH UANG</div>
                    <div class="nominal-box">${rupiah(data.nominal)}</div>
                </div>
            </div>

            <div class="footer">
                <div class="ttd-box">
                    <small>Disetujui Oleh,</small>
                    <div class="ttd-line">( Pimpinan / Owner )</div>
                </div>
                <div class="ttd-box">
                    <small>Dibuat Oleh,</small>
                    <div class="ttd-line">( Admin Keuangan )</div>
                </div>
                <div class="ttd-box">
                    <small>${labelPihakKetiga},</small>
                    <div class="ttd-line">( ....................... )</div>
                </div>
            </div>
            
            <div class="timestamp">
                Dicetak otomatis oleh Sistem SiGAS PRO pada ${new Date().toLocaleString('id-ID')}
            </div>
        </div>

        <script>
            setTimeout(() => { window.print(); }, 800);
        ` + '</sc' + 'ript>' + `
    </body>
    </html>
    `;
    
    win.document.write(htmlContent);
    win.document.close();
}

// [UPDATE FINAL] Cetak Slip Kasbon - Style Formal (Hitam Putih / Minimalis)
function cetakSlipKasbon(data) {
    const namaPT = globalCompanyProfile.nama_perusahaan || 'NAMA PERUSAHAAN';
    const alamatPT = globalCompanyProfile.alamat || '-';
    const noPT = globalCompanyProfile.no_perusahaan || '-';
    const logoUrl = globalCompanyProfile.logo_perusahaan || '';
    
    // Logika Judul & Label
    let judul = '';
    let labelMetode = '';

    if(String(data.tipe).includes('Manual')) {
        judul = 'BUKTI SETORAN CICILAN';
        labelMetode = 'PEMBAYARAN MANDIRI (TUNAI/BANK)';
    } else {
        judul = 'BUKTI POTONG GAJI';
        labelMetode = 'PEMOTONGAN OTOMATIS (PAYROLL)';
    }

    let htmlLogo = logoUrl ? `<img src="${logoUrl}" alt="Logo">` : '';

    const win = window.open('', '', 'height=700,width=900');
    
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <title>Slip ${data.nama}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
            
            @page {
                size: A5 landscape;
                margin: 0; 
            }

            body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; /* Font standar dokumen resmi */
                margin: 0;
                padding: 0;
                background-color: #e0e0e0; /* Abu saat preview */
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }

            /* KONTEN UTAMA (Kertas A5) */
            .slip-container {
                width: 210mm;
                height: 147mm; /* Pas 1 Lembar A5 */
                background: #fff;
                padding: 15mm;
                box-sizing: border-box;
                position: relative;
                display: flex;
                flex-direction: column;
                color: #000;
            }

            /* HEADER */
            .header {
                display: flex;
                align-items: center;
                border-bottom: 2px solid #000; /* Garis Hitam Tegas */
                padding-bottom: 15px;
                margin-bottom: 20px;
            }
            .header-logo img { height: 50px; width: auto; margin-right: 20px; filter: grayscale(100%); /* Logo jadi hitam putih biar formal */ }
            .header-info h2 { margin: 0; font-size: 18px; text-transform: uppercase; color: #000; letter-spacing: 1px; }
            .header-info p { margin: 2px 0 0; font-size: 10px; color: #444; }

            /* JUDUL DOKUMEN */
            .doc-title {
                text-align: center;
                font-size: 14px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 25px;
                text-decoration: underline;
                text-underline-offset: 5px;
            }

            /* ISI: GRID 2 KOLOM */
            .content-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
                gap: 30px;
            }
            
            .col-left, .col-right {
                flex: 1;
            }

            /* TABEL INFO */
            .info-table { width: 100%; border-collapse: collapse; }
            .info-table td {
                padding: 6px 0;
                font-size: 11px;
                vertical-align: top;
                border-bottom: 1px dotted #ccc;
            }
            .label { font-weight: bold; width: 120px; color: #333; text-transform: uppercase; font-size: 9px; }
            .val { color: #000; font-weight: 500; }

            /* KOTAK NOMINAL (GAYA BANK) */
            .nominal-section {
                margin-top: 10px;
                text-align: right;
                background-color: #f8f9fa; /* Abu sangat muda */
                border: 1px solid #000;
                padding: 15px;
            }
            .nom-label { font-size: 10px; text-transform: uppercase; font-weight: bold; color: #555; margin-bottom: 5px;}
            .nom-value { font-size: 20px; font-weight: 700; color: #000; }
            
            .sisa-row {
                display: flex; justify-content: flex-end; align-items: center;
                margin-top: 5px; font-size: 11px; color: #333;
            }

            /* FOOTER TANDA TANGAN */
            .footer {
                margin-top: auto; /* Dorong ke bawah */
                display: flex;
                justify-content: space-between;
                padding-top: 10px;
            }
            .ttd-box { width: 30%; text-align: center; }
            .ttd-title { font-size: 9px; text-transform: uppercase; font-weight: bold; margin-bottom: 50px; color: #555; }
            .ttd-line { border-top: 1px solid #000; width: 80%; margin: 0 auto; }
            .ttd-name { font-size: 10px; font-weight: 700; margin-top: 5px; text-transform: uppercase; }

            /* INFO TAMBAHAN */
            .meta-info {
                position: absolute; bottom: 10mm; left: 15mm;
                font-size: 8px; color: #666; font-family: monospace;
            }

            /* PRINT RESET */
            @media print {
                body { background: none; }
                .slip-container { border: none; margin: 0; box-shadow: none; }
            }
        </style>
    </head>
    <body>
        <div class="slip-container">
            <div class="header">
                <div class="header-logo">${htmlLogo}</div>
                <div class="header-info">
                    <h2>${namaPT}</h2>
                    <p>${alamatPT} | Telp: ${noPT}</p>
                </div>
            </div>

            <div class="doc-title">${judul}</div>

            <div class="content-row">
                <div class="col-left">
                    <table class="info-table">
                        <tr><td class="label">No. Referensi</td><td class="val">#${'PAY-' + Date.now().toString().slice(-6)}</td></tr>
                        <tr><td class="label">Tanggal Transaksi</td><td class="val">${data.tanggal}</td></tr>
                        <tr><td class="label">Nama Karyawan</td><td class="val" style="font-weight:bold; font-size:12px">${data.nama}</td></tr>
                        <tr><td class="label">Metode Bayar</td><td class="val">${labelMetode}</td></tr>
                        <tr><td class="label">Keterangan</td><td class="val" style="font-style:italic;">"${data.ket}"</td></tr>
                    </table>
                </div>

                <div class="col-right">
                    <div class="nominal-section">
                        <div class="nom-label">Jumlah Dibayar (IDR)</div>
                        <div class="nom-value">${rupiah(data.nominal)}</div>
                        
                        <div style="border-top: 1px solid #ccc; margin: 10px 0;"></div>
                        
                        <div class="sisa-row">
                            <span style="margin-right: 10px;">Sisa Pokok Hutang:</span>
                            <span style="font-weight:bold;">${rupiah(data.sisa)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="footer">
                <div class="ttd-box">
                    <div class="ttd-title">Diterima Oleh (Admin),</div>
                    <div class="ttd-line"></div>
                    <div class="ttd-name">.........................</div>
                </div>
                <div class="ttd-box">
                    <div class="ttd-title">Penyetor (Karyawan),</div>
                    <div class="ttd-line"></div>
                    <div class="ttd-name">${data.nama}</div>
                </div>
            </div>

            <div class="meta-info">
                Dicetak: ${new Date().toLocaleString('id-ID')} | Ref ID: ${data.idKasbon}
            </div>
        </div>

        <script>
            setTimeout(() => { window.print(); }, 1000);
        ` + '</sc' + 'ript>' + `
    </body>
    </html>
    `;
    
    win.document.write(htmlContent);
    win.document.close();
}

// [UPDATE FINAL] Cetak Rekap Lengkap Kasbon (Versi A4 Portrait)
function cetakRekapKasbonFull(data) {
    const namaPT = globalCompanyProfile.nama_perusahaan || 'NAMA PERUSAHAAN';
    const alamatPT = globalCompanyProfile.alamat || '-';
    const noPT = globalCompanyProfile.no_perusahaan || '-';
    const logoUrl = globalCompanyProfile.logo_perusahaan || '';
    
    let htmlLogo = logoUrl ? `<img src="${logoUrl}" style="height: 60px; width: auto; margin-right: 20px; filter: grayscale(100%);">` : '';

    // Generate Baris Tabel History
    let rowsHTML = '';
    if(data.listRiwayat.length === 0) {
        rowsHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Belum ada riwayat pembayaran.</td></tr>';
    } else {
        data.listRiwayat.forEach(item => {
            let tgl = new Date(item.tanggal).toLocaleDateString('id-ID');
            rowsHTML += `
                <tr>
                    <td>${tgl}</td>
                    <td>
                        <div style="font-weight:bold;">${item.tipe}</div>
                        <div style="font-size:10px; color:#555;">${item.ket}</div>
                    </td>
                    <td style="text-align:right;">${rupiah(item.nominal)}</td>
                </tr>
            `;
        });
    }

    const win = window.open('', '', 'height=800,width=700');
    
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <title>Rekap Kasbon - ${data.namaKaryawan}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
            
            /* SETTING KERTAS A4 PORTRAIT */
            @page { 
                size: A4; 
                margin: 0; 
            }

            body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                margin: 0; padding: 0; background: #e0e0e0;
                display: flex; justify-content: center; 
                min-height: 100vh;
                -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }

            /* CONTAINER A4 */
            .sheet {
                width: 210mm; 
                min-height: 297mm; /* Tinggi A4 */
                background: #fff; 
                padding: 15mm 20mm; /* Margin kiri-kanan lebih lega */
                box-sizing: border-box; 
                position: relative; 
                display: flex; 
                flex-direction: column;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }

            /* HEADER */
            .header {
                display: flex; align-items: center; border-bottom: 3px double #000;
                padding-bottom: 15px; margin-bottom: 25px;
            }
            .header-info h2 { margin: 0; font-size: 20px; text-transform: uppercase; color: #000; letter-spacing: 1px; }
            .header-info p { margin: 2px 0 0; font-size: 11px; color: #444; }
            
            /* JUDUL */
            .doc-title {
                text-align: center; font-size: 16px; font-weight: 800;
                text-transform: uppercase; letter-spacing: 1.5px;
                background: #f8f9fa; padding: 10px; margin-bottom: 30px; 
                border-top: 1px solid #000; border-bottom: 1px solid #000;
            }

            /* SUMMARY GRID */
            .info-grid {
                display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px;
            }
            .info-col {
                display: flex; flex-direction: column; gap: 8px;
            }
            .row-item {
                display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; padding-bottom: 2px;
            }
            .lbl { font-size: 11px; color: #666; font-weight: bold; text-transform: uppercase; }
            .val { font-size: 13px; font-weight: bold; color: #000; }
            .val-red { color: #d32f2f; font-size: 16px; }

            /* TABEL HISTORY */
            .table-container { flex-grow: 1; }
            .tbl-rekap { width: 100%; border-collapse: collapse; font-size: 11px; }
            .tbl-rekap th { 
                background: #333; color: #fff; padding: 10px 8px; text-align: left; 
                text-transform: uppercase; letter-spacing: 0.5px;
            }
            .tbl-rekap td { 
                border-bottom: 1px solid #ddd; padding: 8px; vertical-align: top; 
            }
            .tbl-rekap tr:nth-child(even) { background-color: #f9f9f9; }

            /* FOOTER */
            .footer { 
                margin-top: 50px; 
                display: flex; justify-content: space-between; text-align: center; 
                page-break-inside: avoid;
            }
            .ttd-box { width: 30%; }
            .ttd-line { border-bottom: 1px solid #000; margin-top: 60px; font-weight: bold; font-size: 11px; }
            .timestamp { margin-top: 30px; font-size: 9px; color: #999; text-align: center; }

            /* PRINT STYLE */
            @media print {
                body { background: none; margin: 0; padding: 0; }
                .sheet { margin: 0; box-shadow: none; border: none; width: 100%; height: auto; }
            }
        </style>
    </head>
    <body>
        <div class="sheet">
            <div class="header">
                ${htmlLogo}
                <div class="header-info">
                    <h2>${namaPT}</h2>
                    <p>${alamatPT} | Telp: ${noPT}</p>
                </div>
            </div>

            <div class="doc-title">REKAPITULASI PINJAMAN KARYAWAN</div>

            <div class="info-grid">
                <div class="info-col">
                    <div class="row-item">
                        <span class="lbl">ID Karyawan</span> <span class="val">-</span>
                    </div>
                    <div class="row-item">
                        <span class="lbl">Nama Karyawan</span> <span class="val" style="font-size:14px">${data.namaKaryawan}</span>
                    </div>
                    <div class="row-item">
                        <span class="lbl">ID Pinjaman</span> <span class="val">${data.idKasbon}</span>
                    </div>
                </div>
                <div class="info-col" style="background:#fffcfc; padding:10px; border:1px solid #eee;">
                    <div class="row-item">
                        <span class="lbl">Total Pinjaman</span> <span class="val">${rupiah(data.totalPinjam)}</span>
                    </div>
                    <div class="row-item">
                        <span class="lbl">Total Terbayar</span> <span class="val text-success">${rupiah(data.totalBayar)}</span>
                    </div>
                    <div class="row-item" style="border-bottom:none; margin-top:5px; align-items:center;">
                        <span class="lbl" style="color:#d32f2f;">SISA HUTANG</span> <span class="val val-red">${rupiah(data.sisaHutang)}</span>
                    </div>
                </div>
            </div>

            <div class="table-container">
                <h4 style="font-size:12px; text-transform:uppercase; border-bottom:2px solid #333; display:inline-block; margin-bottom:10px;">Rincian Pembayaran</h4>
                <table class="tbl-rekap">
                    <thead>
                        <tr>
                            <th style="width: 20%;">Tanggal</th>
                            <th style="width: 50%;">Keterangan / Metode</th>
                            <th style="width: 30%; text-align:right;">Nominal Bayar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                    </tbody>
                    <tfoot style="border-top: 2px solid #333; font-weight:bold;">
                        <tr>
                            <td colspan="2" style="text-align:right; padding-top:10px;">TOTAL PEMBAYARAN MASUK</td>
                            <td style="text-align:right; padding-top:10px; font-size:12px;">${rupiah(data.totalBayar)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="footer">
                <div class="ttd-box">
                    <small>Disetujui Oleh,</small>
                    <div class="ttd-line">( Admin / HRD )</div>
                </div>
                <div class="ttd-box">
                    <small>Penyetor / Karyawan,</small>
                    <div class="ttd-line">( ${data.namaKaryawan} )</div>
                </div>
            </div>

            <div class="timestamp">
                Dicetak pada: ${new Date().toLocaleString('id-ID')}
            </div>
        </div>
        <script>setTimeout(() => { window.print(); }, 1000);
        ` + '</sc' + 'ript>' + `
    </body>
    </html>
    `;
    
    win.document.write(htmlContent);
    win.document.close();
}

// --- FUNGSI CETAK SLIP GAJI KARYAWAN ---
function cetakSlipGaji(data) {
    // --- TAMBAHAN BARU: Bikin idGaji isinya angka saja (Hapus huruf) ---
    data.idGaji = data.id ? data.id.replace(/\D/g, '') : '-'; 

    // 1. Ambil Profil Perusahaan
    const namaPT = globalCompanyProfile.nama_perusahaan || 'PERUSAHAAN ANDA';
    const alamatPT = globalCompanyProfile.alamat || '-';
    const logoUrl = globalCompanyProfile.logo_perusahaan || '';
    
    let htmlLogo = logoUrl ? `<img src="${logoUrl}" style="height: 50px; width: auto; margin-right: 15px; filter: grayscale(100%);">` : '';

    // 2. Format Rupiah Helper
    const rp = (n) => new Intl.NumberFormat('id-ID', {style: 'currency', currency: 'IDR', minimumFractionDigits:0}).format(n);

    // 3. Buka Jendela Print
    const win = window.open('', '', 'height=600,width=800');
    
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <title>Slip Gaji - ${data.nama}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
            @page { size: A5 landscape; margin: 0; }
            body { 
                font-family: 'Roboto', sans-serif; 
                background: #e0e0e0; 
                margin: 0; padding: 0;
                display: flex; justify-content: center; align-items: center; 
                min-height: 100vh;
                -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
            .slip-box {
                width: 210mm; height: 140mm; /* A5 Landscape */
                background: white; padding: 15mm; box-sizing: border-box;
                display: flex; flex-direction: column; position: relative;
            }
            .header {
                display: flex; align-items: center; border-bottom: 2px solid #000;
                padding-bottom: 10px; margin-bottom: 20px;
            }
            .header h2 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
            .header p { margin: 2px 0 0; font-size: 10px; color: #555; }
            
            .title { text-align: center; font-weight: bold; text-transform: uppercase; text-decoration: underline; margin-bottom: 20px; font-size: 16px; }
            
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
            .info-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; }
            .lbl { font-weight: bold; color: #444; }
            
            .rincian-box { border: 1px solid #ccc; padding: 10px; height: 100%; }
            .rincian-head { font-size: 11px; font-weight: bold; border-bottom: 1px dashed #ccc; padding-bottom: 5px; margin-bottom: 10px; text-transform: uppercase; }
            
            .total-row { 
                background: #f1f1f1; padding: 10px; 
                display: flex; justify-content: space-between; align-items: center;
                border: 1px solid #999; margin-top: auto;
            }
            
            .footer { margin-top: auto; display: flex; justify-content: space-between; text-align: center; }
            .ttd-line { border-bottom: 1px solid #000; margin-top: 50px; width: 120px; margin-left: auto; margin-right: auto; }
            
            @media print {
                body { background: none; }
                .slip-box { width: 100%; height: 100%; margin: 0; border: none; }
            }
        </style>
    </head>
    <body>
        <div class="slip-box">
            <div class="header">
                ${htmlLogo}
                <div>
                    <h2>${namaPT}</h2>
                    <p>${alamatPT}</p>
                </div>
            </div>

            <div class="title">SLIP GAJI KARYAWAN</div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px;">
                <table>
                    <tr><td class="lbl" width="100">Periode</td><td>: ${data.periode}</td></tr>
                    <tr><td class="lbl">ID Transaksi</td><td>: ${data.id}</td></tr>
                    <tr><td class="lbl">Nama</td><td>: <b>${data.nama}</b></td></tr>
                </table>
                <div style="text-align: right;">
                    <small>Dicetak: ${new Date().toLocaleDateString('id-ID')}</small><br>
                </div>
            </div>

            <div class="info-grid">
                <div class="rincian-box">
                    <div class="rincian-head" style="color: green;">PENERIMAAN (+)</div>
                    <div class="info-row"><span class="lbl">Gaji Pokok</span> <span>${rp(data.gaji)}</span></div>
                    <div class="info-row"><span class="lbl">Bonus / Tunjangan</span> <span>${rp(data.bonus)}</span></div>
                </div>
                <div class="rincian-box">
                    <div class="rincian-head" style="color: red;">POTONGAN (-)</div>
                    <div class="info-row"><span class="lbl">Kasbon / Cicilan</span> <span>${rp(data.kasbon)}</span></div>
                </div>
            </div>

            <div class="total-row">
                <span style="font-weight: bold; font-size: 14px;">TOTAL DITERIMA (THP)</span>
                <span style="font-weight: bold; font-size: 20px; color: #333;">${rp(data.total)}</span>
            </div>

            <div class="footer">
                <div style="width: 30%;">
                    <small>Diserahkan Oleh,</small>
                    <div class="ttd-line"></div>
                    <small>Admin Keuangan</small>
                </div>
                <div style="width: 30%;">
                    <small>Diterima Oleh,</small>
                    <div class="ttd-line"></div>
                    <small>${data.nama}</small>
                </div>
            </div>
        </div>
        <script>setTimeout(() => { window.print(); }, 800);
        ` + '</sc' + 'ript>' + `
    </body>
    </html>
    `;
    
    win.document.write(htmlContent);
    win.document.close();
}

// --- LOGIKA LAPORAN BARU ---

function loadLaporanUtama() {
    const start = document.getElementById('lap-start').value;
    const end = document.getElementById('lap-end').value;
    
    if(!start || !end) return; // Tunggu date terisi

    loading(true);
    google.script.run.withSuccessHandler(data => {
        loading(false);
        renderLaporanUI(data);
    }).getLaporanDetail(start, end);
}

function renderLaporanUI(data) {
    const rp = (n) => new Intl.NumberFormat('id-ID', {style: 'currency', currency: 'IDR', minimumFractionDigits:0}).format(n);

    // 1. ISI KARTU UTAMA (SUB MENU 1.1)
    document.getElementById('lap-pendapatan').innerText = rp(data.pendapatan);
    document.getElementById('lap-hpp').innerText = rp(data.hpp);
    document.getElementById('lap-kotor').innerText = rp(data.labaKotor);
    document.getElementById('lap-beban').innerText = rp(data.pengeluaran);
    document.getElementById('lap-bersih').innerText = rp(data.labaBersih);
    
    document.getElementById('lap-stok').innerText = rp(data.nilaiStok);
    document.getElementById('lap-beli').innerText = rp(data.pembelian);

    // 2. ISI TABEL METODE BAYAR (SUB MENU 1.2)
    const tbMetode = document.querySelector('#tabel-metode-bayar tbody');
    tbMetode.innerHTML = '';
    
    // Urutkan key agar rapi
    Object.keys(data.metodeBayar).forEach(m => {
        let nominal = data.metodeBayar[m];
        tbMetode.innerHTML += `
            <tr>
                <td class="ps-3 fw-bold text-muted">${m}</td>
                <td class="text-end pe-3 fw-bold text-dark">${rp(nominal)}</td>
            </tr>
        `;
    });

    // 3. ISI TABEL PENGELUARAN (SUB MENU 2)
    document.getElementById('lap-beban-total').innerText = rp(data.pengeluaran); // Total di Tab 2
    
    const tbBeban = document.querySelector('#tabel-det-pengeluaran tbody');
    tbBeban.innerHTML = '';

    if(data.listPengeluaran.length === 0) {
        tbBeban.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Tidak ada pengeluaran pada periode ini.</td></tr>';
    } else {
        data.listPengeluaran.forEach(r => {
            let tgl = new Date(r.tanggal).toLocaleDateString('id-ID');
            tbBeban.innerHTML += `
                <tr>
                    <td class="fw-bold text-primary" style="font-size:12px">${r.id}</td>
                    <td>${tgl}</td>
                    <td><span class="badge bg-light text-dark border">${r.kategori}</span></td>
                    <td class="text-muted small">${r.ket}</td>
                    <td class="text-end fw-bold text-danger">${rp(r.jumlah)}</td>
                </tr>
            `;
        });
    }
}

// FUNGSI FILTER CEPAT (Dropdown) - SUDAH DIPERBAIKI SUPORT FLATPICKR
function setFilterLaporan(pilihan) {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    // Helper Format YYYY-MM-DD
    const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const d_str = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${d_str}`;
    };

    if (pilihan === "bulan_ini") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (pilihan === "bulan_lalu") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0); 
    } else if (pilihan === "kemarin") {
        start.setDate(now.getDate() - 1);
        end.setDate(now.getDate() - 1);
    } else if (pilihan === "7_hari") {
        start.setDate(now.getDate() - 6);
    } 
    // "hari_ini" default start=now, end=now

    // --- PERBAIKAN UTAMA DI SINI ---
    const elStart = document.getElementById('lap-start');
    const elEnd = document.getElementById('lap-end');

    // Cek apakah elemen ini dikendalikan oleh Flatpickr?
    if (elStart._flatpickr) {
        elStart._flatpickr.setDate(start, true); // true = trigger change event
    } else {
        elStart.value = fmt(start);
    }

    if (elEnd._flatpickr) {
        elEnd._flatpickr.setDate(end, true);
    } else {
        elEnd.value = fmt(end);
    }

    // Trigger Load Data
    loadLaporanUtama();
}

// --- EKSPOR PDF & EXCEL (Sederhana) ---
function exportLaporanExcel() {
    // Gunakan fungsi export yang sudah ada, tapi targetkan tabel spesifik
    // Untuk Laporan Lengkap, idealnya buat endpoint khusus, tapi untuk cepat:
    // Kita export tabel Pengeluaran saja dulu atau buat HTML khusus hidden table
    alert('Fitur Excel Full Report akan segera hadir. Saat ini gunakan Print PDF.');
}

// --- FUNGSI CETAK LAPORAN PROFESIONAL (A4) ---
function printLaporanPDFCurrent() {
    // 1. Cek Tab Mana yang Sedang Aktif?
    const isTabLabaAktif = document.getElementById('tab-laba').classList.contains('active');
    
    // 2. Ambil Data Perusahaan & Periode
    const namaPT = globalCompanyProfile.nama_perusahaan || 'NAMA PERUSAHAAN';
    const alamatPT = globalCompanyProfile.alamat || '-';
    
    // Format Tanggal Periode
    const tglStart = new Date(document.getElementById('lap-start').value).toLocaleDateString('id-ID');
    const tglEnd = new Date(document.getElementById('lap-end').value).toLocaleDateString('id-ID');
    const periodeStr = `${tglStart} s/d ${tglEnd}`;

    // 3. Siapkan Konten HTML Berdasarkan Tab
    let judulLaporan = '';
    let kontenBody = '';

    if (isTabLabaAktif) {
        judulLaporan = 'LAPORAN LABA RUGI (PROFIT & LOSS)';
        
        // Ambil Nilai dari Dashboard
        const valPendapatan = document.getElementById('lap-pendapatan').innerText;
        const valHPP = document.getElementById('lap-hpp').innerText;
        const valKotor = document.getElementById('lap-kotor').innerText;
        const valBeban = document.getElementById('lap-beban').innerText;
        const valBersih = document.getElementById('lap-bersih').innerText;
        
        const valStok = document.getElementById('lap-stok').innerText;
        const valBeli = document.getElementById('lap-beli').innerText;

        // Ambil Tabel Metode Bayar
        const tabelMetodeHTML = document.getElementById('tabel-metode-bayar').innerHTML;

        // Susun Layout Laba Rugi yang Rapi
        kontenBody = `
            <div class="summary-box">
                <table class="table-clean" style="width:100%">
                    <tr>
                        <td class="label">A. Pendapatan (Omzet)</td>
                        <td class="value text-success">${valPendapatan}</td>
                    </tr>
                    <tr>
                        <td class="label">B. Harga Pokok Penjualan (HPP)</td>
                        <td class="value text-warning">(${valHPP})</td>
                    </tr>
                    <tr class="highlight-row">
                        <td class="label fw-bold">C. LABA KOTOR (A - B)</td>
                        <td class="value fw-bold">${valKotor}</td>
                    </tr>
                    <tr>
                        <td class="label">D. Pengeluaran Operasional</td>
                        <td class="value text-danger">(${valBeban})</td>
                    </tr>
                    <tr class="highlight-row bg-dark text-white">
                        <td class="label fw-bold" style="font-size:14pt">G. LABA BERSIH (NET PROFIT)</td>
                        <td class="value fw-bold" style="font-size:14pt">${valBersih}</td>
                    </tr>
                </table>
            </div>

            <div class="row-cols mt-4">
                <div class="col-half">
                    <h4 class="sub-title">Informasi Tambahan</h4>
                    <table class="table-bordered">
                        <tr><td>Total Aset Stok</td><td class="text-end fw-bold">${valStok}</td></tr>
                        <tr><td>Pembelian Stok (Periode Ini)</td><td class="text-end fw-bold">${valBeli}</td></tr>
                    </table>
                </div>
                <div class="col-half">
                    <h4 class="sub-title">Rincian Metode Pembayaran</h4>
                    <table class="table-bordered">
                        <thead><tr style="background:#eee"><th>Metode</th><th class="text-end">Jumlah</th></tr></thead>
                        ${tabelMetodeHTML}
                    </table>
                </div>
            </div>
        `;

    } else {
        judulLaporan = 'LAPORAN PENGELUARAN OPERASIONAL';
        
        // Ambil Total & Tabel
        const valTotalBeban = document.getElementById('lap-beban-total').innerText;
        
        // Clone tabel agar tidak merusak tampilan asli (kita mau buang class bootstrap)
        let tabelAsli = document.getElementById('tabel-det-pengeluaran').cloneNode(true);
        // Hapus class bootstrap agar style PDF yang menang
        tabelAsli.className = 'table-bordered full-width'; 
        
        kontenBody = `
            <div class="summary-box mb-4">
                <div style="font-size:14pt; font-weight:bold; border: 2px solid #dc3545; padding: 15px; display:inline-block; border-radius:8px; color:#dc3545;">
                    TOTAL PENGELUARAN: ${valTotalBeban}
                </div>
            </div>
            
            <h4 class="sub-title">Rincian Transaksi</h4>
            ${tabelAsli.outerHTML}
        `;
    }

    // 4. Buka Jendela Print Baru
    const win = window.open('', '', 'height=800,width=1000');
    
    // 5. Template HTML Full (A4 Style)
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <title>${judulLaporan}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
            
            @page { 
                size: A4; 
                margin: 15mm 20mm; 
            }
            
            body { 
                font-family: 'Roboto', sans-serif; 
                color: #000; 
                -webkit-print-color-adjust: exact; 
            }

            /* Header Perusahaan */
            .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 15px; margin-bottom: 25px; }
            .pt-name { font-size: 20pt; font-weight: 800; text-transform: uppercase; margin: 0; color: #333; }
            .pt-addr { font-size: 10pt; margin-top: 5px; color: #555; }

            /* Judul Laporan */
            .report-title { text-align: center; text-transform: uppercase; font-size: 16pt; font-weight: bold; margin-bottom: 5px; text-decoration: underline; }
            .report-period { text-align: center; font-size: 11pt; color: #555; margin-bottom: 30px; font-style: italic; }

            /* Tabel Bersih (Laba Rugi) */
            .table-clean td { padding: 8px 5px; border-bottom: 1px dotted #ccc; font-size: 11pt; }
            .table-clean .label { width: 60%; }
            .table-clean .value { text-align: right; font-weight: 500; }
            .highlight-row { background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #ccc; border-bottom: 2px solid #ccc; }
            .bg-dark { background-color: #333 !important; color: white !important; }

            /* Tabel Garis (Detail) */
            .table-bordered { width: 100%; border-collapse: collapse; font-size: 10pt; }
            .table-bordered th, .table-bordered td { border: 1px solid #999; padding: 6px; }
            .table-bordered th { background-color: #eee; text-transform: uppercase; }
            .full-width { width: 100%; }

            /* Layout Grid */
            .row-cols { display: flex; gap: 30px; }
            .col-half { flex: 1; }
            .sub-title { border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 10px; font-size: 11pt; text-transform: uppercase; }

            /* Warna Teks */
            .text-success { color: #198754; }
            .text-danger { color: #dc3545; }
            .text-warning { color: #d63384; } /* Pink tua biar jelas di kertas */
            .text-end { text-align: right; }
            .fw-bold { font-weight: bold; }
            
            /* Footer */
            .footer { margin-top: 50px; text-align: right; font-size: 9pt; color: #777; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1 class="pt-name">${namaPT}</h1>
            <div class="pt-addr">${alamatPT}</div>
        </div>

        <div class="report-title">${judulLaporan}</div>
        <div class="report-period">Periode: ${periodeStr}</div>

        ${kontenBody}

        <div class="footer">
            Dicetak otomatis oleh Sistem SiGAS PRO pada ${new Date().toLocaleString('id-ID')}
        </div>

        <script>
            setTimeout(() => { window.print(); }, 1000);
        ` + '</sc' + 'ript>' + `
    </body>
    </html>
    `;

    win.document.write(htmlContent);
    win.document.close();
}
// --- FUNGSI FORMAT RUPIAH SAAT MENGETIK ---
function formatRupiahInput(input) {
  // 1. Hapus semua karakter selain angka
  let value = input.value.replace(/\D/g, ''); 
  
  // 2. Format jadi ribuan (Cth: 100000 -> 100.000)
  if(value !== '') {
      input.value = new Intl.NumberFormat('id-ID').format(value);
  } else {
      input.value = '';
  }
}
</script>
