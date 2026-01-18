class AuthManager {
  constructor() {
    this.auth = firebase.auth();
    this.currentUser = null;
    this.initAuthStateListener();
  }

  // Escuchar cambios en el estado de autenticación
  initAuthStateListener() {
    this.auth.onAuthStateChanged((user) => {
      this.currentUser = user;
      
      // Si el usuario está logueado y está en index.html, redirigir a admin
      if (user && window.location.pathname.includes('index.html')) {
        window.location.href = 'admin.html';
      }
      
      // Si no hay usuario y está en admin.html, redirigir a index
      if (!user && window.location.pathname.includes('admin.html')) {
        window.location.href = 'index.html';
      }
    });
  }

  // Registro de nueva tienda
  async register(email, password, storeName) {
    try {
      // Crear usuario en Firebase Auth
      const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Crear documento de tienda en Firestore
      const storeId = this.generateStoreId();
      const storeData = {
        ownerUid: user.uid,
        storeInfo: {
          name: storeName,
          email: email,
          whatsapp: '',
          address: '',
          mapLink: '',
          logoUrl: '',
          colors: {
            primary: '#001f3f',
            secondary: '#0074D9'
          },
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      };
      
      await db.collection('stores').doc(storeId).set(storeData);
      
      // Guardar storeId en el perfil del usuario
      await user.updateProfile({
        displayName: storeId
      });
      
      return { success: true, storeId };
    } catch (error) {
      console.error('Error en registro:', error);
      throw error;
    }
  }

  // Login
  async login(email, password) {
    try {
      await this.auth.signInWithEmailAndPassword(email, password);
      return { success: true };
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  }

  // Recuperar contraseña
  async resetPassword(email) {
    try {
      await this.auth.sendPasswordResetEmail(email);
      return { success: true };
    } catch (error) {
      console.error('Error en reset password:', error);
      throw error;
    }
  }

  // Cerrar sesión
  async logout() {
    try {
      await this.auth.signOut();
      window.location.href = 'index.html';
    } catch (error) {
      console.error('Error en logout:', error);
      throw error;
    }
  }

  // Obtener storeId del usuario actual
  getCurrentStoreId() {
    return this.auth.currentUser?.displayName || null;
  }

  // Generar ID único para la tienda
  generateStoreId() {
    return 'store_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Verificar si el usuario es propietario de la tienda
  async verifyStoreOwnership(storeId) {
    try {
      const user = this.auth.currentUser;
      if (!user) return false;
      
      const storeDoc = await db.collection('stores').doc(storeId).get();
      if (!storeDoc.exists) return false;
      
      return storeDoc.data().ownerUid === user.uid;
    } catch (error) {
      console.error('Error verificando propiedad:', error);
      return false;
    }
  }
}

// Instancia global
const authManager = new AuthManager();