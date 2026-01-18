// auth-manager.js - Gestor de autenticación
import { 
    auth, 
    db,
    onAuthStateChanged,
    signOut,
    collection,
    query,
    where,
    getDocs
} from './firebase.js';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.currentStoreId = null;
        this.isAdmin = false;
    }

    async init() {
        return new Promise((resolve, reject) => {
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    this.currentUser = user;
                    console.log('Usuario autenticado:', user.uid);
                    
                    // Obtener el storeId del displayName o buscar en la base de datos
                    this.currentStoreId = user.displayName || await this.getUserStoreId(user.uid);
                    
                    if (this.currentStoreId) {
                        console.log('Store ID encontrado:', this.currentStoreId);
                        this.isAdmin = true;
                        resolve({ user, storeId: this.currentStoreId });
                    } else {
                        console.error('Usuario no tiene una tienda asignada');
                        this.showNotification('No tienes una tienda asignada', 'error');
                        this.logout();
                        resolve(null);
                    }
                } else {
                    this.currentUser = null;
                    this.currentStoreId = null;
                    this.isAdmin = false;
                    console.log('Usuario no autenticado');
                    resolve(null);
                }
            });
        });
    }

    async getUserStoreId(userId) {
        try {
            // Buscar tiendas donde el usuario es propietario
            const storesRef = collection(db, 'stores');
            const q = query(storesRef, where('ownerId', '==', userId));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const storeDoc = querySnapshot.docs[0];
                return storeDoc.id;
            }
            
            return null;
        } catch (error) {
            console.error('Error obteniendo storeId:', error);
            return null;
        }
    }

    getCurrentStoreId() {
        return this.currentStoreId;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    async verifyStoreOwnership(storeId) {
        if (!this.currentUser || !storeId) return false;
        
        try {
            const storeDoc = await getDoc(doc(db, 'stores', storeId));
            
            if (!storeDoc.exists()) {
                return false;
            }
            
            const storeData = storeDoc.data();
            return storeData.ownerId === this.currentUser.uid;
        } catch (error) {
            console.error('Error verificando propiedad:', error);
            return false;
        }
    }

    async logout() {
        try {
            await signOut(auth);
            this.currentUser = null;
            this.currentStoreId = null;
            this.isAdmin = false;
            
            // Redirigir a la página de inicio
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
            
            return true;
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            this.showNotification('Error al cerrar sesión', 'error');
            return false;
        }
    }

    showNotification(message, type = 'info') {
        // Eliminar notificaciones anteriores
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());
        
        // Crear notificación
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            background: ${type === 'success' ? '#2ECC40' : type === 'error' ? '#FF4136' : '#0074D9'};
            color: white;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-eliminar después de 5 segundos
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.remove();
            }
        }, 5000);
    }

    // Métodos de autenticación adicionales si los necesitas
    async login(email, password) {
        try {
            const { signInWithEmailAndPassword } = await import(
                "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js"
            );
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            console.error('Error de login:', error);
            return { success: false, error: error.message };
        }
    }

    async register(email, password, storeData) {
        try {
            const { createUserWithEmailAndPassword, updateProfile } = await import(
                "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js"
            );
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Crear tienda en Firestore
            const { addDoc, collection, serverTimestamp } = await import(
                "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js"
            );
            
            const storeDocRef = await addDoc(collection(db, 'stores'), {
                ...storeData,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            
            // Actualizar displayName del usuario con el ID de la tienda
            await updateProfile(user, {
                displayName: storeDocRef.id
            });
            
            return { success: true, user, storeId: storeDocRef.id };
        } catch (error) {
            console.error('Error de registro:', error);
            return { success: false, error: error.message };
        }
    }
}

// Crear instancia global
const authManager = new AuthManager();

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', async () => {
    await authManager.init();
});

export default authManager;