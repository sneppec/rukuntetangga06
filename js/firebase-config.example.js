
const firebaseConfig = {
  apiKey: "AIzaSyC63Y9hW7S9GoPfJrvwYVXIuzLO85J93UQ",
  authDomain: "rt-06-c854f.firebaseapp.com",
  databaseURL: "https://rt-06-c854f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "rt-06-c854f",
  
  storageBucket: "rt-06-c854f.appspot.com",
  messagingSenderId: "337211904633",
  appId: "1:337211904633:web:e574354d9b8c134d9bfaa8",
  measurementId: "G-GEGJC9V4RF"
};


const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);


const db = app.database(firebaseConfig.databaseURL);
const auth = app.auth();


window._kk = { auth, db };
