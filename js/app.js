const { auth: kkAuth, db: kkDB } = window._kk;
let currentUser = null;
let isAdmin = false;
let state = { families: [] };

// ======= UI Helpers =======
const toastEl = document.getElementById('toast');
const toast = (msg)=>{ toastEl.textContent = msg; toastEl.classList.add('show'); setTimeout(()=>toastEl.classList.remove('show'), 2200); };
const $ = (id)=>document.getElementById(id);

// ======= Privacy Masking Utilities =======
function maskName(name) {
  if (!name) return '-';
  const flat = String(name).trim().replace(/\s+/g, '');
  const prefix = flat.slice(0, 4);
  return prefix + 'xxxxx';
}
function maskNumber(numStr, visible = 3) {
  if (!numStr) return '-';
  const s = String(numStr);
  const prefix = s.slice(0, visible);
  return prefix + 'xxxx';
}
function maskGeneric(value, visible = 3) {
  if (!value) return '-';
  const v = String(value).trim();
  return v.slice(0, visible) + 'xxxx';
}
// Helper untuk memilih tampilan full vs masked
function view(value, opt = {}) {
  // opt.type: 'name' | 'number' | 'generic'
  // opt.visible: jumlah karakter awal yang ditampilkan
  if (currentUser) return value ?? '-';
  const type = opt.type || 'generic';
  const visible = opt.visible ?? 3;
  if (type === 'name') return maskName(value);
  if (type === 'number') return maskNumber(value, visible);
  return maskGeneric(value, visible);
}

// ======= Refs =======
const list = $('list');
const countKK = $('countKK');
const countWarga = $('countWarga');
const search = $('search');

const kkModal = $('kkModal');
const kkTitle = $('kkTitle');
const kkNo = $('kkNo');
const kkKepala = $('kkKepala');
const kkAlamat = $('kkAlamat');
const kkRTRW = $('kkRTRW');
const kkKel = $('kkKel');
const kkKec = $('kkKec');
const kkKab = $('kkKab');
const kkProv = $('kkProv');
const kkPos = $('kkPos');
const kkNote = $('kkNote');
const saveKK = $('saveKK');

const agtModal = $('agtModal');
const agtTitle = $('agtTitle');
const agtNIK = $('agtNIK');
const agtNama = $('agtNama');
const agtJK = $('agtJK');
const agtTmp = $('agtTmp');
const agtTgl = $('agtTgl');
const agtAgm = $('agtAgm');
const agtPdd = $('agtPdd');
const agtKer = $('agtKer');
const agtKwn = $('agtKwn');
const agtHub = $('agtHub');
const agtNote = $('agtNote');
const saveAgt = $('saveAgt');

// Auth UI elements
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');

// ======= Auth State =======
kkAuth.onAuthStateChanged(user => {
  currentUser = user;
  btnLogin.style.display = user ? 'none' : 'inline-flex';
  btnLogout.style.display = user ? 'inline-flex' : 'none';

  if (user) {
    kkDB.ref(`admins/${user.uid}`).once('value').then(snap => {
      isAdmin = snap.exists();
      document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? 'inline-flex' : 'none';
      });
    });
    loadData();
  } else {
    state = { families: [] };
    document.querySelectorAll('.admin-only').forEach(el => { el.style.display = 'none'; });
    render();
  }
});

// ======= Login Modal (email/username + password) =======
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const closeLogin = document.getElementById('closeLogin');
const loginIdentifier = document.getElementById('loginIdentifier');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');

btnLogin.addEventListener('click', ()=>{ loginForm.reset(); loginError.style.display='none'; loginModal.showModal(); });
closeLogin.addEventListener('click', ()=> loginModal.close());

function findEmailByUsername(username){
  // Cari pada beberapa indeks yang mungkin: admins (by username), admins_by_username, users
  return kkDB.ref('admins').orderByChild('username').equalTo(username).once('value').then(snap=>{
    if (snap.exists()) {
      const first = Object.values(snap.val())[0];
      if(!first || !first.email) throw new Error('invalid_user_data');
      return first.email;
    }
    return kkDB.ref(`admins_by_username/${username}`).once('value').then(s2 => {
      if (s2.exists() && s2.val() && s2.val().email) return s2.val().email;
      return kkDB.ref('users').orderByChild('username').equalTo(username).once('value').then(s3 => {
        if (s3.exists()){
          const any = Object.values(s3.val())[0];
          if (any && any.email) return any.email;
        }
        throw new Error('username_not_found');
      });
    });
  });
}

loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const idf = (loginIdentifier.value||'').trim();
  const pwd = loginPassword.value||'';
  if(!idf || !pwd){ loginError.textContent='Mohon isi identifier dan password'; loginError.style.display='block'; return; }
  loginError.style.display='none';
  try{
    let email = idf;
    if(!idf.includes('@')){ email = await findEmailByUsername(idf); }
    await kkAuth.signInWithEmailAndPassword(email, pwd);
    loginModal.close();
    toast('Login berhasil');
  }catch(err){
    console.error('Login error:', err);
    const code = err.code || err.message || String(err);
    let msg = 'Login gagal';
    if(code==='auth/user-not-found') msg='Akun tidak ditemukan';
    else if(code==='auth/wrong-password') msg='Password salah';
    else if(code==='username_not_found') msg='Username tidak ditemukan';
    else if(code==='invalid_user_data') msg='Data admin tidak valid';
    else if(code==='auth/invalid-email') msg='Email tidak valid';
    loginError.textContent = `${msg} (${code})`;
    loginError.style.display='block';
  }
});

btnLogout.addEventListener('click', () => {
  kkAuth.signOut().then(() => { toast('Berhasil logout'); }).catch(error => { toast('Logout gagal: ' + error.message); });
});

// ======= Data (Firebase) =======
function loadData() {
  kkDB.ref('families').on('value', snap => {
    state = { families: [] };
    if (snap.exists()) {
      const data = snap.val();
      state.families = Object.values(data);
    }
    render();
  });
}

function saveToFirebase(newState) {
  if (!currentUser || !isAdmin) {
    toast('Hanya admin yang dapat mengubah data');
    return Promise.reject(new Error('Unauthorized'));
  }
  return kkDB.ref('families').set(newState.families.reduce((acc, family) => {
    acc[family.id] = family;
    return acc;
  }, {}));
}

// ======= Render =======
function render(){
  const q = (search.value||'').toLowerCase();
  list.innerHTML = '';
  let totalKK = 0, totalWarga = 0;

  const fams = state.families.slice().sort((a,b)=> (a.kepala||'').localeCompare(b.kepala||'', 'id'));
  for(const f of fams){
    const match = [f.no, f.kepala, f.alamat].map(x=> (x||'').toLowerCase()).some(x=> x.includes(q));
    if(!match) continue;
    totalKK++; totalWarga += (f.members?.length||0);

    const card = document.createElement('div'); card.className='kk-card';
    const head = document.createElement('div'); head.className='kk-head';

    const noKKText = view(f.no, { type:'number', visible:3 });
    const kepalaText = view(f.kepala, { type:'name' });

    head.innerHTML = `<div>
      <strong>No. KK: ${escapeHtml(noKKText || '-')}</strong>
      <div class="badge">Kepala: ${escapeHtml(kepalaText || '-')}</div>
    </div>`;

    const actions = document.createElement('div'); actions.className='kk-actions';
    actions.innerHTML = `
      ${ (currentUser && isAdmin) ? `
        <button class="btn" data-act="edit" data-id="${f.id}">Edit</button>
        <button class="btn-danger" data-act="del" data-id="${f.id}">Hapus</button>
        <button class="btn-blue" data-act="addAgt" data-id="${f.id}">Tambah Anggota</button>
      ` : '' }
      <button class="btn" data-act="format" data-id="${f.id}">Format KK</button>`;
    head.appendChild(actions); card.appendChild(head);

    const meta = document.createElement('div'); meta.className='kk-meta';
    meta.innerHTML = `
      <div>Alamat: ${escapeHtml(view(f.alamat, { type:'generic', visible:8 }))}</div>
      <div>RT/RW: ${escapeHtml(view(f.rtrw))}</div>
      <div>Kel/Desa: ${escapeHtml(view(f.kel))}</div>
      <div>Kecamatan: ${escapeHtml(view(f.kec))}</div>
      <div>Kab/Kota: ${escapeHtml(view(f.kab))}</div>
      <div>Provinsi: ${escapeHtml(view(f.prov))}</div>
      <div>Kode Pos: ${escapeHtml(view(f.pos))}</div>
      <div>Catatan: ${escapeHtml(view(f.note, { visible:4 }))}</div>`;
    card.appendChild(meta);

    const table = document.createElement('table');
    table.innerHTML = `
      <thead><tr>
        <th style="min-width:140px">NIK</th>
        <th style="min-width:160px">Nama</th>
        <th>JK</th>
        <th style="min-width:120px">Tempat/Tgl Lahir</th>
        <th>Agama</th>
        <th>Pendidikan</th>
        <th>Pekerjaan</th>
        <th>Status Kawin</th>
        <th>Hubungan</th>
        <th style="min-width:120px">Aksi</th>
      </tr></thead>
      <tbody></tbody>`;
    const tb = table.querySelector('tbody');
    for(const m of (f.members||[])){
      const tr = document.createElement('tr');
      const nikText = view(m.nik, { type:'number', visible:3 });
      const namaText = view(m.nama, { type:'name' });
      const jkText = view(m.jk);
      const ttlText = `${escapeHtml(view(m.tmp))}/${escapeHtml(view(m.tgl))}`;
      const agmText = view(m.agm);
      const pddText = view(m.pdd);
      const kerText = view(m.ker);
      const kwnText = view(m.kwn);
      const hubText = view(m.hub);

      tr.innerHTML = `
        <td>${escapeHtml(nikText || '-')}</td>
        <td>${escapeHtml(namaText || '-')}</td>
        <td>${escapeHtml(jkText || '-')}</td>
        <td>${ttlText}</td>
        <td>${escapeHtml(agmText || '-')}</td>
        <td>${escapeHtml(pddText || '-')}</td>
        <td>${escapeHtml(kerText || '-')}</td>
        <td>${escapeHtml(kwnText || '-')}</td>
        <td>${escapeHtml(hubText || '-')}</td>
        <td>
          ${ (currentUser && isAdmin) ? `
            <button class="btn" data-act="editAgt" data-kk="${f.id}" data-id="${m.id}">Edit</button>
            <button class="btn-danger" data-act="delAgt" data-kk="${f.id}" data-id="${m.id}">Hapus</button>
          ` : `<span class="badge">Privat</span>` }
        </td>`;
      tb.appendChild(tr);
    }
    card.appendChild(table);
    list.appendChild(card);
  }
  countKK.textContent = totalKK;
  countWarga.textContent = totalWarga;

  list.querySelectorAll('button[data-act]').forEach(b=> b.addEventListener('click', onAction));
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

function onAction(e){
  const act = e.currentTarget.getAttribute('data-act');
  const id = e.currentTarget.getAttribute('data-id');
  const kk = e.currentTarget.getAttribute('data-kk');
  if(act==='edit') openKK(id);
  else if(act==='del') delKK(id);
  else if(act==='addAgt'){ currentKK=id; openMember(null, id); }
  else if(act==='editAgt') openMember(e.currentTarget.getAttribute('data-id'), kk);
  else if(act==='delAgt') delMember(e.currentTarget.getAttribute('data-id'), kk);
  else if(act==='format') openSheetFormat(id);
}

// ======= KK CRUD =======
let editingKK = null;  // id kk when editing
let currentKK = null;  // id kk for adding member
let editingMember = null; // id member when editing

function openKK(id){
  editingKK = id;
  kkTitle.textContent = id ? 'Edit KK' : 'Tambah KK';
  const f = state.families.find(x=>x.id===id) || {};
  kkNo.value=f.no||''; kkKepala.value=f.kepala||''; kkAlamat.value=f.alamat||''; kkRTRW.value=f.rtrw||''; kkKel.value=f.kel||''; kkKec.value=f.kec||''; kkKab.value=f.kab||''; kkProv.value=f.prov||''; kkPos.value=f.pos||''; kkNote.value=f.note||'';
  kkModal.showModal();
}

function readKK(){
  return {
    no: kkNo.value.trim(), kepala: kkKepala.value.trim(), alamat: kkAlamat.value.trim(), rtrw: kkRTRW.value.trim(), kel: kkKel.value.trim(), kec: kkKec.value.trim(), kab: kkKab.value.trim(), prov: kkProv.value.trim(), pos: kkPos.value.trim(), note: kkNote.value.trim()
  };
}

$('btnAddKK').addEventListener('click', ()=> openKK(null));
$('closeKK').addEventListener('click', ()=> kkModal.close());
$('saveKK').addEventListener('click', (e)=>{
  e.preventDefault();
  const v = readKK();
  if(!v.no || !v.kepala){ toast('No.KK & Kepala Keluarga wajib'); return; }
  if (!currentUser || !isAdmin) { toast('Hanya admin yang dapat mengubah data'); return; }
  if(editingKK){
    const i = state.families.findIndex(x=>x.id===editingKK);
    if(i>-1){
      state.families[i] = { ...state.families[i], ...v };
      saveToFirebase(state).then(() => { kkModal.close(); toast('KK tersimpan'); }).catch(err => toast('Gagal menyimpan: ' + err.message));
    }
  }else{
    const newFamily = { id: 'kk_'+Math.random().toString(36).slice(2,10), ...v, members:[] };
    state.families.push(newFamily);
    saveToFirebase(state).then(() => { kkModal.close(); toast('KK tersimpan'); }).catch(err => toast('Gagal menyimpan: ' + err.message));
  }
});

function delKK(id){
  if(!confirm('Hapus KK ini beserta anggotanya?')) return;
  if (!currentUser || !isAdmin) { toast('Hanya admin yang dapat menghapus data'); return; }
  state.families = state.families.filter(x=>x.id!==id);
  saveToFirebase(state).then(() => { toast('KK terhapus'); }).catch(err => toast('Gagal menghapus: ' + err.message));
}

// ======= Member CRUD =======
function openMember(memberId, kkId){
  editingMember = memberId; currentKK = kkId;
  const fam = state.families.find(x=>x.id===kkId); if(!fam) return;
  agtTitle.textContent = memberId ? 'Edit Anggota' : 'Tambah Anggota';
  const m = (fam.members||[]).find(x=>x.id===memberId) || {};
  agtNIK.value=m.nik||''; agtNama.value=m.nama||''; agtJK.value=m.jk||'L'; agtTmp.value=m.tmp||''; agtTgl.value=m.tgl||''; agtAgm.value=m.agm||'Islam'; agtPdd.value=m.pdd||''; agtKer.value=m.ker||''; agtKwn.value=m.kwn||'Belum Kawin'; agtHub.value=m.hub||'Anak'; agtNote.value=m.note||'';
  agtModal.showModal();
}

$('closeAgt').addEventListener('click', ()=> agtModal.close());
$('saveAgt').addEventListener('click', (e)=>{
  e.preventDefault();
  const fam = state.families.find(x=>x.id===currentKK); if(!fam) return;
  const m = { nik:agtNIK.value.trim(), nama:agtNama.value.trim(), jk:agtJK.value, tmp:agtTmp.value.trim(), tgl:agtTgl.value, agm:agtAgm.value, pdd:agtPdd.value.trim(), ker:agtKer.value.trim(), kwn:agtKwn.value, hub:agtHub.value, note:agtNote.value.trim() };
  if(!m.nik || !m.nama){ toast('NIK & Nama wajib'); return; }
  if (!currentUser || !isAdmin) { toast('Hanya admin yang dapat mengubah data'); return; }
  if(!fam.members) fam.members=[];
  if(editingMember){ const i=fam.members.findIndex(x=>x.id===editingMember); if(i>-1) fam.members[i]={...fam.members[i], ...m}; }
  else { fam.members.push({ id:'agt_'+Math.random().toString(36).slice(2,10), ...m }); }
  saveToFirebase(state).then(() => { agtModal.close(); toast('Anggota tersimpan'); }).catch(err => toast('Gagal menyimpan: ' + err.message));
});

function delMember(memberId, kkId){
  if(!confirm('Hapus anggota ini?')) return;
  if (!currentUser || !isAdmin) { toast('Hanya admin yang dapat menghapus data'); return; }
  const fam=state.families.find(x=>x.id===kkId);
  if(!fam) return;
  fam.members = (fam.members||[]).filter(x=>x.id!==memberId);
  saveToFirebase(state).then(() => { toast('Anggota terhapus'); }).catch(err => toast('Gagal menghapus: ' + err.message));
}

// ======= Search =======
let timer=null; search.addEventListener('input', ()=>{ clearTimeout(timer); timer=setTimeout(render, 200); });

// ======= Sheet Builder (Format KK Resmi) =======
const sheetModal = document.getElementById('sheetModal');
const sheetHost = document.getElementById('sheetHost');
document.getElementById('closeSheet').addEventListener('click', ()=> sheetModal.close());
document.getElementById('printSheet').addEventListener('click', ()=> window.print());

function buildKkSheet(f){
  const rows1 = (f.members||[]).map((m,i)=>{
    const nama = view(m.nama, { type:'name' });
    const nik = view(m.nik, { type:'number', visible:3 });
    const jk = view(m.jk);
    const tmp = view(m.tmp);
    const tgl = view(m.tgl);
    const agm = view(m.agm);
    const pdd = view(m.pdd);
    const ker = view(m.ker);
    return `
      <tr>
        <td>${i+1}</td>
        <td>${escapeHtml(nama || '')}</td>
        <td>${escapeHtml(nik || '')}</td>
        <td>${escapeHtml(jk || '')}</td>
        <td>${escapeHtml(tmp || '')}</td>
        <td>${escapeHtml(tgl || '')}</td>
        <td>${escapeHtml(agm || '')}</td>
        <td>${escapeHtml(pdd || '')}</td>
        <td>${escapeHtml(ker || '')}</td>
        <td></td>
      </tr>`;
  }).join('');

  const rows2 = (f.members||[]).map((m,i)=>{
    const kwn = view(m.kwn);
    const hub = view(m.hub);
    return `
      <tr>
        <td>${i+1}</td>
        <td>${escapeHtml(kwn || '')}</td>
        <td></td>
        <td></td>
        <td>${escapeHtml(hub || '')}</td>
        <td>WNI</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>`;
  }).join('');

  const noKK = view(f.no, { type:'number', visible:3 });
  const kepala = view(f.kepala, { type:'name' });

  return `
    <div class="kk-headline">
      <div class="kk-emblem">Lambang</div>
      <div class="kk-title">
        <h2>KARTU KELUARGA</h2>
        <div class="no">No. ${escapeHtml(noKK || '-')}</div>
      </div>
      <div class="kk-qr">QR</div>
    </div>

    <div class="kk-meta-grid">
      <div class="cell"><strong>Nama Kepala Keluarga</strong><br>${escapeHtml(kepala || '-')}</div>
      <div class="cell"><strong>Alamat</strong><br>${escapeHtml(view(f.alamat, { visible:8 }) || '-')}</div>
      <div class="cell"><strong>RT/RW</strong><br>${escapeHtml(view(f.rtrw) || '-')}</div>
      <div class="cell"><strong>Kode Pos</strong><br>${escapeHtml(view(f.pos) || '-')}</div>
      <div class="cell"><strong>Kel/Desa</strong><br>${escapeHtml(view(f.kel) || '-')}</div>
      <div class="cell"><strong>Kecamatan</strong><br>${escapeHtml(view(f.kec) || '-')}</div>
      <div class="cell"><strong>Kab/Kota</strong><br>${escapeHtml(view(f.kab) || '-')}</div>
      <div class="cell"><strong>Provinsi</strong><br>${escapeHtml(view(f.prov) || '-')}</div>
    </div>

    <div class="kk-section-title">I. DATA ANGGOTA KELUARGA</div>
    <table class="kk-table">
      <thead><tr>
        <th>No</th><th>Nama Lengkap</th><th>NIK</th><th>JK</th><th>Tempat Lahir</th><th>Tanggal Lahir</th><th>Agama</th><th>Pendidikan</th><th>Jenis Pekerjaan</th><th>Gol. Darah</th>
      </tr></thead>
      <tbody>${rows1||''}</tbody>
    </table>

    <div class="kk-section-title">II. DATA PENDUKUNG</div>
    <table class="kk-table">
      <thead><tr>
        <th>No</th><th>Status Perkawinan</th><th>Tgl Perkawinan</th><th>Tgl Perceraian</th><th>Status Hub. Keluarga</th><th>Kewarganegaraan</th><th>No. Paspor</th><th>No. KITAP</th><th>Nama Ayah</th><th>Nama Ibu</th>
      </tr></thead>
      <tbody>${rows2||''}</tbody>
    </table>

    <div class="kk-note"><span>Jumlah anggota: ${(f.members||[]).length}</span><span>Tanggal cetak: ${new Date().toLocaleDateString('id-ID')}</span></div>
  `;
}

function openSheetFormat(kkId){
  const f = state.families.find(x=>x.id===kkId); if(!f) return;
  sheetHost.innerHTML = buildKkSheet(f);
  sheetModal.showModal();
}

// ======= Export / Import / Print / Reset =======
$('btnExport').addEventListener('click', ()=>{
  if (!currentUser || !isAdmin) { toast('Hanya admin yang dapat mengekspor data'); return; }
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='kk_data.json'; a.click(); URL.revokeObjectURL(url);
});

$('btnImport').addEventListener('click', ()=>{
  if (!currentUser || !isAdmin) { toast('Hanya admin yang dapat mengimpor data'); return; }
  const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json';
  inp.addEventListener('change', ()=>{
    const f=inp.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        const obj=JSON.parse(rd.result);
        if(!obj || !Array.isArray(obj.families)) throw new Error('Format tidak sesuai');
        state = obj;
        saveToFirebase(state).then(() => { toast('Impor berhasil'); }).catch(err => toast('Gagal impor: ' + err.message));
      }catch(e){ toast('Gagal impor: '+e.message); }
    };
    rd.readAsText(f);
  });
  inp.click();
});

$('btnPrint').addEventListener('click', ()=> window.print());

$('btnReset').addEventListener('click', ()=>{
  if(!confirm('Hapus semua data?')) return;
  if (!currentUser || !isAdmin) { toast('Hanya admin yang dapat mereset data'); return; }
  state={families:[]};
  saveToFirebase(state).then(() => { toast('Data direset'); }).catch(err => toast('Gagal reset: ' + err.message));
});

// ======= Init =======
render();
