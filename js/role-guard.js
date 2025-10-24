// role-guard.js — Guard akses halaman berbasis role
// Compatible dengan firebase compat
// Pastikan halaman sudah memuat firebase-config.js sebelum ini

(function(){
  if (!window.firebase) return console.error('[role-guard] Firebase belum dimuat');

  const app = firebase.app();
  const auth = firebase.auth();
  const db   = firebase.database();

  // Deteksi nama halaman
  function detectPage(){
    const p = location.pathname.toLowerCase();
    if (p.endsWith('/pages/pembukuan.html')) return 'pembukuan';
    if (p.endsWith('/pages/rekap.html'))      return 'rekap';
    if (p.endsWith('/pages/pendataan.html'))  return 'pendataan';
    return 'lain';
  }

  const page = detectPage();

  // Helper cek role lewat Realtime Database
  function getRole(uid){
    return db.ref('users/'+uid+'/role').once('value').then(s => s.val()||'user');
  }

  auth.onAuthStateChanged(async (user)=>{
    if (!user){
      if(page === 'pendataan' || page === 'pembukuan' || page === 'rekap'){
        // redirect ke pendaftaran / login
        location.href = '../pages/pendaftaran.html';
      }
      return;
    }

    const role = await getRole(user.uid);
    const isAdmin = (role === 'admin');

    // pembukuan & rekap hanya admin
    if((page === 'pembukuan' || page === 'rekap') && !isAdmin){
      location.href = '../index.html';
      return;
    }

    // pendataan: semua login boleh lihat, tapi tombol admin-only sembunyi
    if(page === 'pendataan'){
      document.querySelectorAll('[data-admin-only]')
        .forEach(el => el.style.display = isAdmin ? '' : 'none');
    }
  });
})();
