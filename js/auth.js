// auth.js - Manejo de autenticación
import { auth, db } from './firebase.js';
import { 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

import { 
    doc, 
    setDoc, 
    getDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export class AuthManager {
    constructor() {
        this.currentUser = null;
        this.initAuthStateListener();
    }

    initAuthStateListener() {
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            console.log('Usuario actual:', user);
        });
    }

    async register(email, password, storeName) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Crear storeId único
            const storeId = 'store_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Crear documento de tienda
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
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                }
            };
            
            await setDoc(doc(db, 'stores', storeId), storeData);
            
            // Actualizar perfil del usuario
            await updateProfile(user, { displayName: storeId });
            
            return { success: true, storeId, user };
        } catch (error) {
            console.error('Error en registro:', error);
            throw error;
        }
    }

    async login(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            console.error('Error en login:', error);
            throw error;
        }
    }

    async logout() {
        try {
            await signOut(auth);
            return { success: true };
        } catch (error) {
            console.error('Error en logout:', error);
            throw error;
        }
    }

    async resetPassword(email) {
        try {
            await sendPasswordResetEmail(auth, email);
            return { success: true };
        } catch (error) {
            console.error('Error en reset password:', error);
            throw error;
        }
    }

    getCurrentUser() {
        return auth.currentUser;
    }

    getCurrentStoreId() {
        return auth.currentUser?.displayName;
    }
}