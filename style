<script>
  let currentUser = {};
  let payrollDataTemp = [];
  let keranjangBelanja = [];
  let globalRiwayatData = [];
  let dataJualTemp = [];
  let dataBeliTemp = [];
  let globalModalObj;
  let onConfirmAction = null;
  const rupiah = (n) => new Intl.NumberFormat('id-ID', {style: 'currency', currency: 'IDR', minimumFractionDigits:0}).format(n);

  window.onload = function() { google.script.run.setupDatabase(); };

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
    // 1. Logika Ganti Halaman (UI)
    document.querySelectorAll('.page-section').forEach(el => el.classList.add('d-none'));
    document.getElementById('page-' + pageId).classList.remove('d-none');
    
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    // Cek element nav ada atau tidak sebelum add class active (untuk menghindari error null)
    const navEl = document.getElementById('nav-' + pageId);
    if(navEl) navEl.classList.add('active');

    // 2. Logika Muat Data (Data Fetching)
    if(pageId === 'dashboard' || pageId === 'laporan') loadDashboard();
    
    // Update bagian Kasir: Muat Produk DAN Pelanggan
    if(pageId === 'produk' || pageId === 'kasir') {
        loadProduk();
        if(pageId === 'kasir') loadPelangganDropdown();
    }
    
    if(pageId === 'keuangan') loadKeuangan();
    if(pageId === 'pembelian') loadPembelianData();
    if(pageId === 'payroll') switchTab('karyawan');
    if(pageId === 'riwayat') loadRiwayatData();
    
    // --- INI YANG KETINGGALAN ---
    if(pageId === 'pelanggan') loadPelanggan(); 
  }

  // --- AUTH ---
  function handleLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    
    loading(true); // MULAI LOADING

    google.script.run.withSuccessHandler(res => {
      loading(false); // STOP LOADING
      if(res.status === 'success') {
        currentUser = res;
        document.getElementById('login-section').classList.add('d-none');
        document.getElementById('main-app').classList.remove('d-none');
        document.getElementById('display-user').innerText = res.nama;
        showPage('dashboard');
      } else { 
          myAlert('Gagal Masuk', 'Username atau Password salah!', 'error');
      }
    }).withFailureHandler(e => {
        loading(false);
        myAlert('Error Koneksi', e, 'error');
    }).loginUser(u, p);
  }
  
  function logout() { location.reload(); }

  // --- DASHBOARD ---
  function loadDashboard() {
    loading(true);
    google.script.run.withSuccessHandler(s => {
      loading(false);
      document.getElementById('dash-income').innerText = rupiah(s.income);
      document.getElementById('dash-expense').innerText = rupiah(s.expense);
      document.getElementById('dash-net').innerText = rupiah(s.net);
      document.getElementById('lap-net').innerText = rupiah(s.net);
    }).getDashboardStats();
  }

  // --- PRODUK & KASIR ---
  function loadProduk() {
    loading(true);
    google.script.run.withSuccessHandler(data => {
      loading(false);
      const tb = document.querySelector('#tabel-produk tbody');
      const selK = document.getElementById('kasir-produk');
      const selB = document.getElementById('beli-produk');
      
      // Reset tabel dan dropdown
      tb.innerHTML = ''; 
      selK.innerHTML = '<option value="">--Pilih--</option>'; 
      selB.innerHTML = '<option value="">--Pilih--</option>';
      
      data.forEach(p => {
        // Isi Tabel
        tb.innerHTML += `<tr>
            <td>${p[1]}</td>
            <td>${rupiah(p[2])}</td>
            <td>${rupiah(p[3])}</td>
            <td class="text-success fw-bold">${p[4]}</td>
            <td class="text-danger">${p[5]}</td>
            <td><button class="btn btn-sm btn-danger" onclick="hapusProduk('${p[1]}')">X</button></td>
        </tr>`;
        
        // Isi Dropdown Kasir (PENTING: ada data-stok)
        selK.innerHTML += `<option value="${p[1]}" data-price="${p[2]}" data-stok="${p[4]}">${p[1]} (Stok: ${p[4]})</option>`;
        
        // Isi Dropdown Beli
        selB.innerHTML += `<option value="${p[1]}" data-buy="${p[3]}">${p[1]}</option>`;
      });
    }).getData('PRODUK');
  }

  function simpanProduk() {
    const d = {nama: document.getElementById('prod-nama').value, hargaJual: document.getElementById('prod-jual').value, hargaBeli: document.getElementById('prod-beli').value, stokIsi: document.getElementById('prod-isi').value, stokKosong: document.getElementById('prod-kosong').value};
    
    loading(true);
    google.script.run.withSuccessHandler(() => { 
        loading(false);
        bootstrap.Modal.getInstance(document.getElementById('modalProduk')).hide(); 
        loadProduk(); 
    }).tambahProduk(d);
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

function tambahKeKeranjang() {
    const p = document.getElementById('kasir-produk');
    const qtyInput = document.getElementById('kasir-qty');
    const tipe = document.getElementById('kasir-tipe').value;
    
    // GANTI ALERT BIASA
    if(!p.value) return myAlert('Perhatian', 'Silakan pilih produk terlebih dahulu.', 'error');
    if(!qtyInput.value || qtyInput.value < 1) return myAlert('Perhatian', 'Jumlah (Qty) minimal 1!', 'error');
    
    const price = Number(p.options[p.selectedIndex].getAttribute('data-price') || 0);
    const currentStok = Number(p.options[p.selectedIndex].getAttribute('data-stok') || 0);
    const qtyInputan = Number(qtyInput.value);
    
    let indexFound = keranjangBelanja.findIndex(item => item.produkNama === p.value && item.tipe === tipe);

    if (indexFound !== -1) {
       let itemExisting = keranjangBelanja[indexFound];
       let totalQtyBaru = itemExisting.qty + qtyInputan;

       // GANTI ALERT STOK
       if (totalQtyBaru > currentStok) {
          return myAlert('Stok Tidak Cukup', `Di keranjang: ${itemExisting.qty}\nDitambah: ${qtyInputan}\nTotal butuh: ${totalQtyBaru}\nSisa Stok: ${currentStok}`, 'error');
       }
       
       keranjangBelanja[indexFound].qty = totalQtyBaru;
       keranjangBelanja[indexFound].total = totalQtyBaru * price;

    } else {
       // GANTI ALERT STOK BARU
       if(qtyInputan > currentStok) return myAlert('Stok Habis', `Permintaan: ${qtyInputan}, Sisa Stok: ${currentStok}`, 'error');

       keranjangBelanja.push({ produkNama: p.value, qty: qtyInputan, tipe: tipe, hargaSatuan: price, total: qtyInputan * price });
    }

    renderKeranjang();
    p.value = "";
    qtyInput.value = "";
    document.getElementById('kasir-total').innerText = "Rp 0";
    p.focus();
  }

  function renderKeranjang() {
    const tb = document.querySelector('#tabel-keranjang tbody');
    tb.innerHTML = '';
    let grandTotal = 0;

    keranjangBelanja.forEach((item, index) => {
      grandTotal += item.total;
      tb.innerHTML += `
        <tr>
          <td>${item.produkNama}</td>
          <td><small>${item.tipe}</small></td>
          <td>${item.qty}</td>
          <td>${rupiah(item.total)}</td>
          <td><button class="btn btn-sm btn-danger py-0" onclick="hapusItemKeranjang(${index})">x</button></td>
        </tr>
      `;
    });

    document.getElementById('label-grand-total').innerText = rupiah(grandTotal);
  }

  function hapusItemKeranjang(index) {
    keranjangBelanja.splice(index, 1);
    renderKeranjang();
  }

  function resetKeranjang() {
    keranjangBelanja = [];
    renderKeranjang();
  }

function prosesBayarFinal() {
    if(keranjangBelanja.length === 0) return myAlert('Keranjang Kosong', 'Belum ada barang yang diinput.', 'error');
    
    // Cek Tabung Kosong
    let butuhTabungKosong = 0;
    keranjangBelanja.forEach(k => { if(k.tipe === 'Tukar (Refill)') butuhTabungKosong += k.qty; });

    // --- FUNGSI PEMBAYARAN UTAMA ---
    const eksekusiBayar = () => {
        const totalBayarStr = document.getElementById('label-grand-total').innerText;
        
        // Konfirmasi Kedua: Total Bayar
        myConfirm('Konfirmasi Pembayaran', `Total Transaksi: ${totalBayarStr}\n\nSimpan data ini?`, () => {
            
            const payload = {
              pelanggan: document.getElementById('kasir-pelanggan').value,
              kasir: currentUser.nama || 'Admin',
              items: keranjangBelanja
            };

            loading(true);
            google.script.run.withSuccessHandler(res => {
               loading(false);
               myAlert('Berhasil', res, 'success'); 
               resetKeranjang();
               loadProduk(); 
            }).withFailureHandler(err => {
               loading(false);
               myAlert('Gagal', err, 'error');
            }).simpanTransaksiBulk(payload);

        });
    };

    // --- LOGIC PENGECEKAN TABUNG ---
    if(butuhTabungKosong > 0) {
       // Konfirmasi Pertama: Tabung Kosong
       myConfirm('Cek Fisik Tabung', `Transaksi ini ada Refill.\nApakah Anda sudah menerima ${butuhTabungKosong} Tabung Kosong dari pelanggan?`, () => {
           
           // --- PERBAIKAN DI SINI: PAKAI SETTIMEOUT ---
           // Beri jeda 500ms (0.5 detik) agar modal pertama nutup dulu dengan mulus
           setTimeout(() => {
               eksekusiBayar();
           }, 500); 
           // -------------------------------------------

       });
    } else {
       // Jika tidak butuh tabung, langsung bayar
       eksekusiBayar();
    }
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
function renderTabelRiwayat(tableId, data, tipe) {
   const tb = document.querySelector(`#${tableId} tbody`);
   tb.innerHTML = '';
   if(!data || data.length === 0) { tb.innerHTML = '<tr><td colspan="4" class="text-center">Kosong</td></tr>'; return; }

   data.forEach((trx, index) => {
      let tgl = new Date(trx.waktu).toLocaleString('id-ID');
      tb.innerHTML += `
        <tr>
           <td><span class="fw-bold text-primary">${trx.id}</span><br><small>${tgl}</small></td>
           <td>${trx.pelanggan}</td>
           <td class="fw-bold">${rupiah(trx.totalBayar)}</td>
           <td>
             <button class="btn btn-sm btn-info text-white" onclick="viewDetailTrx('${tipe}', ${index})">
                <i class="material-icons" style="font-size:16px">visibility</i> View
             </button>
           </td>
        </tr>`;
   });
}

// 4. VIEW DETAIL & TOMBOL RETUR
function viewDetailTrx(tipe, index) {
   const data = tipe === 'JUAL' ? dataJualTemp : dataBeliTemp;
   const trx = data[index];
   
   // Isi Modal Detail (Reuse modal yang sudah ada)
   document.getElementById('det-id').innerText = trx.id;
   document.getElementById('det-pelanggan').innerText = trx.pelanggan;
   document.getElementById('det-waktu').innerText = new Date(trx.waktu).toLocaleString();
   document.getElementById('det-total').innerText = rupiah(trx.totalBayar);
   
   const tb = document.querySelector('#tabel-detail-trx tbody');
   tb.innerHTML = '';
   trx.items.forEach(item => {
       tb.innerHTML += `<tr><td>${item.produk}</td><td class="text-center">${item.qty}</td><td class="text-end">${rupiah(item.hargaTotal)}</td></tr>`;
   });

   // PERUBAHAN: Tambahkan Tombol Retur di Footer Modal Detail secara dinamis
   const footer = document.querySelector('#modalDetailTrx .modal-footer');
   // Reset footer dulu
   footer.innerHTML = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>`;
   
   // Tambah tombol RETUR
   const btnRetur = document.createElement('button');
   btnRetur.className = 'btn btn-danger ms-2';
   btnRetur.innerText = 'RETUR / BATAL';
   btnRetur.onclick = () => {
       // Tutup modal detail, buka modal form retur
       bootstrap.Modal.getInstance(document.getElementById('modalDetailTrx')).hide();
       bukaFormRetur(trx, tipe);
   };
   footer.appendChild(btnRetur);

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

  // --- PEMBELIAN ---
  function loadPembelianData() {
    google.script.run.withSuccessHandler(d => {
       const s = document.getElementById('beli-supplier'); s.innerHTML=''; d.forEach(r=>s.innerHTML+=`<option>${r[1]}</option>`);
    }).getData('SUPPLIER');
  }
  function simpanSupplier() {
    google.script.run.withSuccessHandler(()=>{ bootstrap.Modal.getInstance(document.getElementById('modalSupplier')).hide(); loadPembelianData(); }).tambahSupplier({nama:document.getElementById('sup-nama').value, hp:document.getElementById('sup-hp').value, alamat:document.getElementById('sup-alamat').value});
  }
  function updateHargaBeli() {
    const sel = document.getElementById('beli-produk');
    const price = sel.options[sel.selectedIndex]?.getAttribute('data-buy') || 0;
    const qty = document.getElementById('beli-qty').value;
    document.getElementById('beli-harga').value = price;
    document.getElementById('beli-total').innerText = rupiah(price * qty);
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

    if(!d.nama) return alert('Nama wajib diisi!');

    loading(true);
    google.script.run.withSuccessHandler(res => {
       loading(false);
       alert(res);
       bootstrap.Modal.getInstance(document.getElementById('modalPelanggan')).hide();
       
       if(isFromKasir) {
          // Jika input dari kasir, refresh dropdown kasir
          loadPelangganDropdown(); 
       } else {
          // Jika dari menu admin, refresh tabel
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
  
function loadPelangganDropdown() {
    // Jangan loading(true) agar tidak mengganggu UI
    google.script.run.withSuccessHandler(data => {
       // --- PENGAMAN: Cek jika data kosong/null ---
       if (!data) return; 

       const sel = document.getElementById('kasir-pelanggan');
       const currentVal = sel.value; 
       
       sel.innerHTML = '<option value="Umum">Umum</option>';
       
       data.forEach(r => {
          let label = r[1]; 
          if(r[2]) label = `${r[2]} (${r[1]})`; 
          sel.innerHTML += `<option value="${label}">${label}</option>`;
       });

       if(currentVal) sel.value = currentVal;

    }).getListPelanggan();
  }

  // --- KEUANGAN ---
  function loadKeuangan() {
    loading(true);
    google.script.run.withSuccessHandler(d => {
      loading(false);
      const tb = document.querySelector('#tabel-keuangan tbody'); tb.innerHTML='';
      d.reverse().slice(0,10).forEach(r => tb.innerHTML+=`<tr><td>${new Date(r[1]).toLocaleDateString()}</td><td>${r[2]}</td><td>${r[3]}</td><td>${rupiah(r[4])}</td><td>${r[5]}</td></tr>`);
    }).getData('KEUANGAN');
  }
  function bukaModalKeuangan() {
    new bootstrap.Modal(document.getElementById('modalKeuangan')).show();
    google.script.run.withSuccessHandler(c => { const s=document.getElementById('keu-kategori'); s.innerHTML=''; c.forEach(x=>s.innerHTML+=`<option>${x}</option>`); }).getKategori();
  }
  function tambahKategoriBaru() { const n = prompt('Nama Kategori?'); if(n) google.script.run.tambahKategori(n); }
  function simpanKeuangan() {
    const d = { jenis: document.getElementById('keu-jenis').value, kategori: document.getElementById('keu-kategori').value, nominal: document.getElementById('keu-nominal').value, keterangan: document.getElementById('keu-ket').value };
    loading(true);
    google.script.run.withSuccessHandler(()=>{ 
        loading(false);
        bootstrap.Modal.getInstance(document.getElementById('modalKeuangan')).hide(); 
        loadKeuangan(); 
    }).simpanKeuangan(d);
  }

  // --- PAYROLL (TABS) ---
  function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(e=>e.classList.add('d-none')); document.getElementById('tab-'+t).classList.remove('d-none');
    document.querySelectorAll('#payrollTabs .nav-link').forEach(e=>e.classList.remove('active')); event.target.classList.add('active');
    if(t==='karyawan') loadKaryawan();
    if(t==='kasbon') loadKasbon();
  }

  function loadKaryawan() {
    google.script.run.withSuccessHandler(d => {
      const tb = document.querySelector('#tabel-karyawan tbody'); const sk = document.getElementById('kasbon-nama');
      tb.innerHTML=''; sk.innerHTML='';
      d.forEach(r => {
        tb.innerHTML+=`<tr><td>${r[1]}</td><td>${r[2]}</td><td>${rupiah(r[3])}</td><td>${rupiah(r[4])}</td><td><button class="btn btn-sm btn-danger" onclick="hapusKaryawan('${r[0]}')">X</button></td></tr>`;
        sk.innerHTML+=`<option>${r[1]}</option>`;
      });
    }).getData('KARYAWAN');
  }
  function modalKaryawan() { document.getElementById('kry-id').value=''; new bootstrap.Modal(document.getElementById('modalKaryawan')).show(); }
  function simpanKaryawanDB() {
    const d = { id: document.getElementById('kry-id').value, nama: document.getElementById('kry-nama').value, hp: document.getElementById('kry-hp').value, gaji: document.getElementById('kry-gaji').value, bonus: document.getElementById('kry-bonus').value };
    google.script.run.withSuccessHandler(()=>{ bootstrap.Modal.getInstance(document.getElementById('modalKaryawan')).hide(); loadKaryawan(); }).simpanKaryawan(d);
  }
  function hapusKaryawan(id) { if(confirm('Hapus?')) google.script.run.withSuccessHandler(loadKaryawan).hapusKaryawan(id); }

  function loadKasbon() {
    google.script.run.withSuccessHandler(d => {
      const tb = document.querySelector('#tabel-kasbon tbody'); tb.innerHTML='';
      d.filter(x=>x[5]==='Belum Lunas').forEach(r => tb.innerHTML+=`<tr><td>${new Date(r[1]).toLocaleDateString()}</td><td>${r[2]}</td><td class="text-danger">${rupiah(r[3])}</td></tr>`);
    }).getData('KASBON');
  }
  function simpanKasbon() {
    google.script.run.withSuccessHandler(()=>{ alert('Kasbon OK'); loadKasbon(); }).simpanKasbon({nama:document.getElementById('kasbon-nama').value, nominal:document.getElementById('kasbon-nominal').value, ket:document.getElementById('kasbon-ket').value});
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
</script>
