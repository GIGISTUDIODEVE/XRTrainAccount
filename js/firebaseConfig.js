import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCPmnm713iyGIW9aUEZMZDFyrfVTsadXIE",
    authDomain: "trainingsocialacount.firebaseapp.com",
    projectId: "trainingsocialacount",
    storageBucket: "trainingsocialacount.firebasestorage.app",
    messagingSenderId: "421668100128",
    appId: "1:421668100128:web:1dcdbc1bc6e10001904445",
    measurementId: "G-9J8Z8VTTLZ"
};

const firebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp);
export { firebaseApp };
