// Configuración de Firebase
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Obtener referencias a los servicios
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Configuración para desarrollo
db.settings({ 
  merge: true 
});

// Helper para manejar errores de Firestore
const handleFirestoreError = (error) => {
  console.error("Firestore error:", error);
  throw error;
};