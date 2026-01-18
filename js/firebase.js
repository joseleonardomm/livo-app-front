// firebase.js - Configuración y servicios de Firebase

// Importar las funciones necesarias de los SDKs de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// Tu configuración de Firebase (la que te proporcionó Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyA9PFibILofWX0C4NVGVgKy0umN4t01d3c",
  authDomain: "livo-app-ccf00.firebaseapp.com",
  projectId: "livo-app-ccf00",
  storageBucket: "livo-app-ccf00.firebasestorage.app",
  messagingSenderId: "1094757018625",
  appId: "1:1094757018625:web:5b693d8e900076a43d6400"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios individuales
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Exportar los servicios para usar en otros archivos
export { auth, db, storage };

// También podemos exportar funciones específicas de Firebase que usaremos comúnmente
// Importar y re-exportar funciones comunes de Auth
export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// Importar y re-exportar funciones comunes de Firestore
export {
  // Operaciones básicas
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  // Consultas
  getDocs,
  query,
  where,
  orderBy,
  limit,
  // Tiempo del servidor
  serverTimestamp,
  // Operaciones en lote
  writeBatch,
  // Escuchas en tiempo real
  onSnapshot,
  // Otros
  arrayUnion,
  arrayRemove,
  increment
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Importar y re-exportar funciones comunes de Storage
export {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// También podemos exportar algunas utilidades comunes
export const getCurrentUser = () => auth.currentUser;
export const getCurrentUserId = () => auth.currentUser?.uid;

// Función helper para manejar errores de Firebase de manera consistente
export const handleFirebaseError = (error) => {
  console.error("Firebase Error:", error.code, error.message);
  
  // Mapear códigos de error a mensajes amigables en español
  const errorMessages = {
    // Errores de Auth
    'auth/email-already-in-use': 'Este correo electrónico ya está registrado.',
    'auth/invalid-email': 'El correo electrónico no es válido.',
    'auth/operation-not-allowed': 'Esta operación no está permitida.',
    'auth/weak-password': 'La contraseña es demasiado débil.',
    'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
    'auth/user-not-found': 'No se encontró una cuenta con este correo electrónico.',
    'auth/wrong-password': 'La contraseña es incorrecta.',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
    // Errores de Firestore
    'permission-denied': 'No tienes permiso para realizar esta acción.',
    'not-found': 'El documento no fue encontrado.',
    'already-exists': 'El documento ya existe.',
    'resource-exhausted': 'Límite de recursos excedido.',
    // Errores de Storage
    'storage/unauthorized': 'No tienes permiso para acceder a este archivo.',
    'storage/canceled': 'La operación fue cancelada.',
    'storage/unknown': 'Error desconocido al subir el archivo.',
  };

  return errorMessages[error.code] || error.message || 'Ha ocurrido un error. Por favor, intenta de nuevo.';
};

// Función para verificar si el usuario está autenticado
export const isAuthenticated = () => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(!!user);
    });
  });
};

// Función para obtener el storeId del usuario actual
export const getCurrentStoreId = () => {
  return auth.currentUser?.displayName || null;
};

// Configuración adicional para desarrollo
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  console.log('Firebase configurado en modo desarrollo');
  // Puedes agregar configuraciones específicas para desarrollo aquí
}