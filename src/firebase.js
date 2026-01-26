import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDNU-MuR2OwxtxoVoktw3XQAYsKouRytys",
    authDomain: "rede-conecta-local.firebaseapp.com",
    projectId: "rede-conecta-local",
    storageBucket: "rede-conecta-local.firebasestorage.app",
    messagingSenderId: "880192657489",
    appId: "1:880192657489:web:71fbc2008716f35c84c070"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
