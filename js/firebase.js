// firebase.js - Configuración completa de Firebase Modular v9
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getAuth, 
    signOut, 
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getFirestore,
    doc,
    getDoc,
    updateDoc,
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { 
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// TU CONFIGURACIÓN DE FIREBASE ACTUALIZADA
const firebaseConfig = {
    apiKey: "AIzaSyA9PFibILofWX0C4NVGVgKy0umN4t01d3c",
    authDomain: "livo-app-ccf00.firebaseapp.com",
    projectId: "livo-app-ccf00",
    storageBucket: "livo-app-ccf00.firebasestorage.app",
    messagingSenderId: "1094757018625",
    appId: "1:1094757018625:web:5b693d8e900076a43d6400"
};

// Inicializar Firebase
let app;
try {
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase inicializado correctamente para Livo App');
} catch (error) {
    console.error('❌ Error inicializando Firebase:', error);
}

// Obtener instancias de servicios
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Exportar funciones de autenticación
export { 
    signOut, 
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile
};

// Exportar funciones de Firestore
export { 
    doc,
    getDoc,
    updateDoc,
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    writeBatch
};

// Exportar funciones de Storage
export { 
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
};

// Función para verificar si Firebase está inicializado
export const isFirebaseInitialized = () => {
    return !!app;
};

// Función para obtener la configuración actual
export const getFirebaseConfig = () => {
    return { ...firebaseConfig };
};