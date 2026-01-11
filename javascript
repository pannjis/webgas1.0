<script>
  let currentUser = {};
  let payrollDataTemp = [];
  const rupiah = (n) => new Intl.NumberFormat('id-ID', {style: 'currency', currency: 'IDR', minimumFractionDigits:0}).format(n);

  window.onload = function() { google.script.run.setupDatabase(); };

  function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.add('d-none'));
    document.getElementById('page-' + pageId).classList.remove('d-none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-' + pageId).classList.add('active');

    if(pageId === 'dashboard' || pageId === 'laporan') loadDashboard();
    if(pageId === 'produk' || pageId === 'kasir') loadProduk();
    if(pageId === 'keuangan') loadKeuangan();
    if(pageId === 'pembelian') loadPembelianData();
    if(pageId === 'payroll') switchTab('karyawan');
  }

  // --- AUTH ---
  function handleLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    google.script.run.withSuccessHandler(res => {
      if(res.status === 'success') {
        currentUser = res;
        document.getElementById('login-section').classList.add('d-none');
        document.getElementById('main-app').classList.remove('d-none');
        document.getElementById('display-user').innerText = res.nama;
        showPage('dashboard');
      } else { alert('Gagal Login'); }
    }).loginUser(u, p);
  }
  function logout() { location.reload(); }

  // --- DASHBOARD ---
  function loadDashboard() {
    google.script.run.withSuccessHandler(s => {
      document.getElementById('dash-income').innerText = rupiah(s.income);
      document.getElementById('dash-expense').innerText = rupiah(s.expense);
      document.getElementById('dash-net').innerText = rupiah(s.net);
      document.getElementById('lap-net').innerText = rupiah(s.net);
    }).getDashboardStats();
  }

  // --- PRODUK & KASIR ---
  function loadProduk() {
    google.script.run.withSuccessHandler(data => {
      const tb = document.querySelector('#tabel-produk tbody');
      const selK = document.getElementById('kasir-produk');
      const selB = document.getElementById('beli-produk');
      tb.innerHTML = ''; selK.innerHTML = '<option value="">--Pilih--</option>'; selB.innerHTML = '<option value="">--Pilih--</option>';
      
      data.forEach(p => {
        tb.innerHTML += `<tr><td>${p[1]}</td><td>${rupiah(p[2])}</td><td>${rupiah(p[3])}</td><td class="text-success fw-bold">${p[4]}</td><td class="text-danger">${p[5]}</td><td><button class="btn btn-sm btn-danger" onclick="hapusProduk('${p[1]}')">X</button></td></tr>`;
        selK.innerHTML += `<option value="${p[1]}" data-price="${p[2]}">${p[1]} (Stok: ${p[4]})</option>`;
        selB.innerHTML += `<option value="${p[1]}" data-buy="${p[3]}">${p[1]}</option>`;
      });
    }).getData('PRODUK');
  }
  function simpanProduk() {
    const d = {nama: document.getElementById('prod-nama').value, hargaJual: document.getElementById('prod-jual').value, hargaBeli: document.getElementById('prod-beli').value, stokIsi: document.getElementById('prod-isi').value, stokKosong: document.getElementById('prod-kosong').value};
    google.script.run.withSuccessHandler(() => { bootstrap.Modal.getInstance(document.getElementById('modalProduk')).hide(); loadProduk(); }).tambahProduk(d);
  }
  function hapusProduk(n) { if(confirm('Hapus?')) google.script.run.withSuccessHandler(loadProduk).hapusProduk(n); }

  function updateHargaJual() {
    const sel = document.getElementById('kasir-produk');
    const price = sel.options[sel.selectedIndex]?.getAttribute('data-price') || 0;
    const qty = document.getElementById('kasir-qty').value;
    document.getElementById('kasir-total').innerText = rupiah(price * qty);
  }
  function prosesJual() {
    const p = document.getElementById('kasir-produk');
    if(!p.value) return alert('Pilih Produk');
    const price = p.options[p.selectedIndex]?.getAttribute('data-price') || 0;
    const d = { pelanggan: document.getElementById('kasir-pelanggan').value, produkNama: p.value, qty: document.getElementById('kasir-qty').value, total: price * document.getElementById('kasir-qty').value, tipe: document.getElementById('kasir-tipe').value, kasir: currentUser.nama };
    if(confirm('Bayar?')) google.script.run.withSuccessHandler(()=>{ alert('Berhasil'); loadProduk(); }).simpanTransaksi(d);
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
    if(confirm('Simpan Beli?')) google.script.run.withSuccessHandler(()=>{ alert('Sukses'); loadProduk(); }).simpanPembelian(d);
  }

  // --- KEUANGAN ---
  function loadKeuangan() {
    google.script.run.withSuccessHandler(d => {
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
    google.script.run.withSuccessHandler(()=>{ bootstrap.Modal.getInstance(document.getElementById('modalKeuangan')).hide(); loadKeuangan(); }).simpanKeuangan(d);
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
