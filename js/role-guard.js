// role-guard.js — Guard akses halaman berbasis role (compat)
// PERBAIKAN: hindari inisialisasi Database ganda
// - Prioritas pakai window._kk.{auth,db} jika tersedia (dibuat oleh firebase-config.js kamu)
// - Jika tidak ada, baru fallback ke firebase.app() dan gunakan databaseURL yang sama

(function(){
  function detectPage(){
    const p = location.pathname.toLowerCase();
    if (p.endsWith('/pages/pembukuan.html')) return 'pembukuan';
    if (p.endsWith('/pages/rekap.html'))      return 'rekap';
    if (p.endsWith('/pages/pendataan.html'))  return 'pendataan';
    return 'lain';
  }

  const page = detectPage();

  // 1) Utamakan instance dari window._kk (dibuat oleh firebase-config.js milikmu)
  let auth = null; let db = null;
  if (window._kk && window._kk.auth && window._kk.db) {
    auth = window._kk.auth;
    db   = window._kk.db;
  } else if (window.firebase && firebase.apps && firebase.apps.length) {
    // 2) Fallback: pakai instance dari firebase.app() yg SUDAH di-init di tempat lain
    const app = firebase.app();
    const cfg = app.options || {};
    try {
      // gunakan databaseURL yang sama jika ada agar tidak memicu error "Database initialized multiple times"
      db = cfg.databaseURL ? app.database(cfg.databaseURL) : app.database();
    } catch (e) {
      // fallback terakhir (seharusnya jarang dipakai)
      db = firebase.database();
    }
    auth = firebase.auth();
  } else {
    console.error('[role-guard] Firebase belum diinisialisasi. Pastikan <script src="../js/firebase-config.js"></script> dimuat SEBELUM role-guard.js');
    return; // berhenti agar tidak error
  }

  function getRole(uid){
    return db.ref('users/'+uid+'/role').once('value').then(s => s.val() || 'user');
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      if (page === 'pendataan' || page === 'pembukuan' || page === 'rekap') {
        location.href = '../pages/pendaftaran.html';
      }
      return;
    }

    const role = await getRole(user.uid);
    const isAdmin = (role === 'admin');

    if ((page === 'pembukuan' || page === 'rekap') && !isAdmin) {
      location.href = '../index.html';
      return;
    }

    if (page === 'pendataan') {
      document.querySelectorAll('[data-admin-only]')
        .forEach(el => el.style.display = isAdmin ? '' : 'none');
    }
  });
})();
