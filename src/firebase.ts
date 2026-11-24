
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "polleria-buensabor.firebaseapp.com",
  projectId: "polleria-buensabor",
  storageBucket: "polleria-buensabor.firebasestorage.app",
  messagingSenderId: "249341724990",
  appId: "1:249341724990:web:72a79a615d44e510ac046f",
};

// INICIALIZAR FIREBASE
const app = initializeApp(firebaseConfig);

// BASE DE DATOS FIRESTORE
export const db = getFirestore(app);

// AUTENTICACIÓN DE USUARIOS
export const auth = getAuth(app);

// EXPORTAR APLICACIÓN
export default app;
