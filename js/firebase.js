// admin.js - Panel de administración de la tienda
import { 
    auth, 
    db, 
    storage,
    signOut,
    onAuthStateChanged,
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
} from './firebase.js';

import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

class AdminManager {
    constructor() {
        this.storeId = null;
        this.currentStore = null;
        this.tempImages = {
            storeLogo: null,
            product: null,
            promotion: null
        };
        this.editingItem = {
            category: null,
            product: null,
            promotion: null
        };
        
        this.init();
    }

    async init() {
        // Verificar autenticación
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }
            
            this.storeId = user.displayName;
            if (!this.storeId) {
                alert('Error: No se pudo identificar la tienda');
                return;
            }
            
            console.log('Store ID:', this.storeId);
            
            // Cargar datos iniciales
            await this.loadStoreData();
            this.setupEventListeners();
            this.updateStoreLink();
            this.updateStats();
            this.loadCategories();
            this.loadProducts();
            this.loadPromotions();
        });
    }

    async loadStoreData() {
        try {
            console.log('Cargando datos de la tienda:', this.storeId);
            const storeDoc = await getDoc(doc(db, 'stores', this.storeId));
            
            if (!storeDoc.exists()) {
                console.error('Tienda no encontrada');
                return;
            }
            
            this.currentStore = storeDoc.data();
            console.log('Datos de la tienda:', this.currentStore);
            
            // Actualizar UI
            document.getElementById('store-name-header').textContent = this.currentStore.storeInfo?.name || 'Sin nombre';
            document.getElementById('store-name').value = this.currentStore.storeInfo?.name || '';
            document.getElementById('store-whatsapp').value = this.currentStore.storeInfo?.whatsapp || '';
            document.getElementById('store-address').value = this.currentStore.storeInfo?.address || '';
            document.getElementById('store-map').value = this.currentStore.storeInfo?.mapLink || '';
            document.getElementById('store-primary-color').value = this.currentStore.storeInfo?.colors?.primary || '#001f3f';
            document.getElementById('store-secondary-color').value = this.currentStore.storeInfo?.colors?.secondary || '#0074D9';
            
            // Mostrar logo si existe
            if (this.currentStore.storeInfo?.logoUrl) {
                document.getElementById('store-logo-preview').innerHTML = 
                    `<img src="${this.currentStore.storeInfo.logoUrl}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;">`;
                document.getElementById('store-logo-remove').style.display = 'inline-block';
            }
            
            // Actualizar vista previa
            this.updatePreview();
            
        } catch (error) {
            console.error('Error cargando datos de la tienda:', error);
            this.showNotification('Error cargando datos de la tienda', 'error');
        }
    }

    setupEventListeners() {
        // Navegación
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.showSection(section);
            });
        });

        // Acciones rápidas
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section;
                this.showSection(section);
            });
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        // Ver tienda
        document.getElementById('view-store-btn').addEventListener('click', (e) => {
            e.preventDefault();
            const storeUrl = `${window.location.origin}/store.html?storeId=${this.storeId}`;
            window.open(storeUrl, '_blank');
        });

        // Guardar configuración de tienda
        document.getElementById('save-store-settings').addEventListener('click', (e) => {
            e.preventDefault();
            this.saveStoreSettings();
        });

        // Carga de imágenes
        this.setupImageUploads();

        // Gestión de categorías
        document.getElementById('add-category-btn').addEventListener('click', () => {
            this.openCategoryModal();
        });

        // Gestión de productos
        document.getElementById('add-product-btn').addEventListener('click', () => {
            this.openProductModal();
        });
        document.getElementById('products-search-btn').addEventListener('click', () => {
            this.searchProducts();
        });
        document.getElementById('products-search').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.searchProducts();
        });

        // Gestión de promociones
        document.getElementById('add-promotion-btn').addEventListener('click', () => {
            this.openPromotionModal();
        });

        // Vista previa
        document.getElementById('refresh-preview').addEventListener('click', () => {
            this.updatePreview();
        });

        // Sidebar toggle para móviles
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            document.querySelector('.admin-sidebar').classList.toggle('active');
        });

        // Modales
        this.setupModals();
    }

    setupImageUploads() {
        // Logo de tienda
        document.getElementById('store-logo-upload').addEventListener('click', () => {
            document.getElementById('store-logo-input').click();
        });
        document.getElementById('store-logo-input').addEventListener('change', (e) => {
            this.handleImageUpload(e, 'storeLogo');
        });
        document.getElementById('store-logo-remove').addEventListener('click', () => {
            this.removeImage('storeLogo');
        });
    }

    setupModals() {
        // Cerrar modales
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAllModals();
            });
        });

        // Cerrar al hacer clic fuera
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });

        // Formulario de categorías
        document.getElementById('category-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCategory();
        });

        // Formulario de productos
        document.getElementById('product-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        // Formulario de promociones
        document.getElementById('promotion-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePromotion();
        });
    }

    async saveStoreSettings() {
        try {
            const storeData = {
                'storeInfo.name': document.getElementById('store-name').value,
                'storeInfo.whatsapp': document.getElementById('store-whatsapp').value,
                'storeInfo.address': document.getElementById('store-address').value,
                'storeInfo.mapLink': document.getElementById('store-map').value,
                'storeInfo.colors.primary': document.getElementById('store-primary-color').value,
                'storeInfo.colors.secondary': document.getElementById('store-secondary-color').value,
                'storeInfo.updatedAt': serverTimestamp()
            };

            console.log('Guardando configuración:', storeData);

            // Subir logo si hay uno nuevo
            if (this.tempImages.storeLogo) {
                try {
                    const logoUrl = await this.uploadImage(
                        this.tempImages.storeLogo, 
                        `stores/${this.storeId}/logo`
                    );
                    storeData['storeInfo.logoUrl'] = logoUrl;
                    console.log('Logo subido:', logoUrl);
                } catch (error) {
                    console.error('Error subiendo logo:', error);
                    this.showNotification('Error subiendo logo', 'error');
                }
            }

            // Actualizar en Firestore
            await updateDoc(doc(db, 'stores', this.storeId), storeData);

            // Actualizar datos locales
            await this.loadStoreData();

            this.showNotification('Configuración guardada exitosamente', 'success');
        } catch (error) {
            console.error('Error guardando configuración:', error);
            this.showNotification('Error guardando configuración: ' + error.message, 'error');
        }
    }

    async loadCategories() {
        try {
            const categoriesRef = collection(db, 'stores', this.storeId, 'categories');
            const categoriesQuery = query(categoriesRef, orderBy('name'));
            const categoriesSnapshot = await getDocs(categoriesQuery);
            
            const tbody = document.getElementById('categories-table-body');
            tbody.innerHTML = '';
            
            let categoryCount = 0;
            categoriesSnapshot.forEach(doc => {
                const category = doc.data();
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${category.name}</td>
                    <td>${category.description || '-'}</td>
                    <td>0</td>
                    <td>
                        <button class="btn-icon edit-category" data-id="${doc.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-category" data-id="${doc.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                tbody.appendChild(row);
                categoryCount++;
            });

            // Event listeners para botones
            document.querySelectorAll('.edit-category').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const categoryId = e.target.closest('button').dataset.id;
                    this.editCategory(categoryId);
                });
            });

            document.querySelectorAll('.delete-category').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const categoryId = e.target.closest('button').dataset.id;
                    const confirmed = await this.confirmDelete();
                    if (confirmed) {
                        await this.deleteCategory(categoryId);
                    }
                });
            });

            // Actualizar contador
            document.getElementById('categories-count').textContent = categoryCount;
        } catch (error) {
            console.error('Error cargando categorías:', error);
        }
    }

    async loadProducts(searchTerm = '') {
        try {
            const productsRef = collection(db, 'stores', this.storeId, 'products');
            const productsQuery = query(productsRef, orderBy('createdAt', 'desc'));
            const productsSnapshot = await getDocs(productsQuery);
            
            const products = [];
            let productCount = 0;
            
            productsSnapshot.forEach(doc => {
                products.push({ id: doc.id, ...doc.data() });
                productCount++;
            });
            
            // Filtrar localmente si hay término de búsqueda
            let filteredProducts = products;
            if (searchTerm) {
                filteredProducts = products.filter(product => 
                    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    product.description.toLowerCase().includes(searchTerm.toLowerCase())
                );
            }
            
            this.displayProducts(filteredProducts);
            
            // Actualizar contador
            document.getElementById('products-count').textContent = productCount;
        } catch (error) {
            console.error('Error cargando productos:', error);
        }
    }

    displayProducts(products) {
        const grid = document.getElementById('products-grid');
        grid.innerHTML = '';
        
        products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            
            productCard.innerHTML = `
                <div class="product-card-image">
                    ${product.imageUrl ? 
                        `<img src="${product.imageUrl}" alt="${product.name}">` : 
                        `<div class="image-placeholder"><i class="fas fa-box"></i></div>`
                    }
                </div>
                <div class="product-card-info">
                    <h4>${product.name}</h4>
                    <p class="product-price">$${product.price?.toFixed(2) || '0.00'}</p>
                    <p class="product-description">${(product.description || '').substring(0, 100)}...</p>
                    <div class="product-actions">
                        <button class="btn-icon edit-product" data-id="${product.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-product" data-id="${product.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            
            grid.appendChild(productCard);
        });

        // Event listeners
        document.querySelectorAll('.edit-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.closest('button').dataset.id;
                this.editProduct(productId);
            });
        });

        document.querySelectorAll('.delete-product').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const productId = e.target.closest('button').dataset.id;
                const confirmed = await this.confirmDelete();
                if (confirmed) {
                    await this.deleteProduct(productId);
                }
            });
        });
    }

    async loadPromotions() {
        try {
            const promotionsRef = collection(db, 'stores', this.storeId, 'promotions');
            const promotionsQuery = query(promotionsRef, orderBy('createdAt', 'desc'));
            const promotionsSnapshot = await getDocs(promotionsQuery);
            
            const grid = document.getElementById('promotions-grid');
            grid.innerHTML = '';
            
            let promotionCount = 0;
            promotionsSnapshot.forEach(doc => {
                const promotion = doc.data();
                const promotionCard = document.createElement('div');
                promotionCard.className = 'promotion-card';
                
                promotionCard.innerHTML = `
                    <div class="promotion-header">
                        <h4>${promotion.title}</h4>
                        <span class="promotion-status ${promotion.active ? 'active' : 'inactive'}">
                            ${promotion.active ? 'Activa' : 'Inactiva'}
                        </span>
                    </div>
                    <p>${promotion.description}</p>
                    <div class="promotion-type">${this.getPromotionTypeText(promotion.type)}</div>
                    <div class="promotion-actions">
                        <button class="btn-icon edit-promotion" data-id="${doc.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-promotion" data-id="${doc.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                grid.appendChild(promotionCard);
                promotionCount++;
            });

            // Event listeners
            document.querySelectorAll('.edit-promotion').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const promotionId = e.target.closest('button').dataset.id;
                    this.editPromotion(promotionId);
                });
            });

            document.querySelectorAll('.delete-promotion').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const promotionId = e.target.closest('button').dataset.id;
                    const confirmed = await this.confirmDelete();
                    if (confirmed) {
                        await this.deletePromotion(promotionId);
                    }
                });
            });

            // Actualizar contador
            document.getElementById('promotions-count').textContent = promotionCount;
        } catch (error) {
            console.error('Error cargando promociones:', error);
        }
    }

    getPromotionTypeText(type) {
        const types = {
            'discount': 'Descuento',
            'shipping': 'Envío Gratis',
            'offer': 'Oferta Especial'
        };
        return types[type] || type;
    }

    updateStats() {
        // Los contadores se actualizan en loadCategories, loadProducts, loadPromotions
    }

    updateStoreLink() {
        const storeUrl = `${window.location.origin}/store.html?storeId=${this.storeId}`;
        document.getElementById('store-link').textContent = storeUrl;
        document.getElementById('view-store-btn').href = storeUrl;
    }

    updatePreview() {
        const storeUrl = `${window.location.origin}/store.html?storeId=${this.storeId}`;
        document.getElementById('store-preview').src = storeUrl;
    }

    showSection(sectionId) {
        // Actualizar navegación
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
        
        // Actualizar título
        const titles = {
            'dashboard': 'Dashboard',
            'store-settings': 'Configuración de Tienda',
            'categories': 'Gestión de Categorías',
            'products': 'Gestión de Productos',
            'promotions': 'Promociones y Modales',
            'preview': 'Vista Previa'
        };
        document.getElementById('section-title').textContent = titles[sectionId];
        
        // Mostrar sección
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionId}-section`).classList.add('active');
    }

    async handleImageUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validar tipo de archivo
        if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
            this.showNotification('Formato de imagen no válido. Use JPG o PNG.', 'error');
            return;
        }
        
        // Validar tamaño (5MB máximo)
        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('La imagen es demasiado grande. Máximo 5MB.', 'error');
            return;
        }
        
        // Guardar archivo temporalmente
        this.tempImages[type] = file;
        
        // Mostrar vista previa
        const previewElement = document.getElementById(`${type}-preview`);
        if (previewElement) {
            this.createImagePreview(file, previewElement);
        }
        
        // Mostrar botón de eliminar
        const removeBtn = document.getElementById(`${type}-remove`);
        if (removeBtn) {
            removeBtn.style.display = 'inline-block';
        }
        
        this.showNotification('Imagen cargada correctamente', 'success');
    }

    createImagePreview(file, previewElement) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            previewElement.innerHTML = '';
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 4px;
            `;
            previewElement.appendChild(img);
        };
        
        reader.readAsDataURL(file);
    }

    removeImage(type) {
        this.tempImages[type] = null;
        
        const previewElement = document.getElementById(`${type}-preview`);
        if (previewElement) {
            previewElement.innerHTML = `
                <div class="image-preview-placeholder">
                    <i class="fas fa-image"></i>
                    <span>Vista previa de la imagen</span>
                </div>
            `;
        }
        
        const removeBtn = document.getElementById(`${type}-remove`);
        if (removeBtn) {
            removeBtn.style.display = 'none';
        }
        
        const fileInput = document.getElementById(`${type}-input`);
        if (fileInput) {
            fileInput.value = '';
        }
        
        this.showNotification('Imagen eliminada', 'info');
    }

    async uploadImage(file, path) {
        try {
            // Crear referencia en storage
            const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
            
            // Subir archivo
            const snapshot = await uploadBytes(storageRef, file);
            
            // Obtener URL de descarga
            const downloadUrl = await getDownloadURL(snapshot.ref);
            
            return downloadUrl;
        } catch (error) {
            console.error('Error subiendo imagen:', error);
            throw error;
        }
    }

    openCategoryModal(categoryId = null) {
        this.editingItem.category = categoryId;
        
        if (categoryId) {
            document.getElementById('category-modal-title').textContent = 'Editar Categoría';
            
            // Cargar datos de la categoría
            getDoc(doc(db, 'stores', this.storeId, 'categories', categoryId))
                .then(doc => {
                    if (doc.exists()) {
                        const category = doc.data();
                        document.getElementById('modal-category-name').value = category.name;
                        document.getElementById('modal-category-description').value = category.description || '';
                    }
                });
        } else {
            document.getElementById('category-modal-title').textContent = 'Agregar Categoría';
            document.getElementById('category-form').reset();
        }
        
        document.getElementById('category-modal').classList.add('active');
    }

    async saveCategory() {
        try {
            const name = document.getElementById('modal-category-name').value.trim();
            const description = document.getElementById('modal-category-description').value.trim();
            
            if (!name) {
                this.showNotification('El nombre de la categoría es obligatorio', 'error');
                return;
            }
            
            const categoryData = {
                name,
                description,
                updatedAt: serverTimestamp()
            };
            
            if (this.editingItem.category) {
                // Actualizar categoría existente
                await updateDoc(doc(db, 'stores', this.storeId, 'categories', this.editingItem.category), categoryData);
                this.showNotification('Categoría actualizada exitosamente', 'success');
            } else {
                // Crear nueva categoría
                categoryData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'stores', this.storeId, 'categories'), categoryData);
                this.showNotification('Categoría creada exitosamente', 'success');
            }
            
            this.closeAllModals();
            await this.loadCategories();
            
        } catch (error) {
            console.error('Error guardando categoría:', error);
            this.showNotification('Error guardando categoría: ' + error.message, 'error');
        }
    }

    async deleteCategory(categoryId) {
        try {
            // Verificar si hay productos en esta categoría
            const productsQuery = query(
                collection(db, 'stores', this.storeId, 'products'),
                where('categoryId', '==', categoryId)
            );
            const productsSnapshot = await getDocs(productsQuery);
            
            if (!productsSnapshot.empty) {
                const confirm = await this.confirmDelete(
                    'Esta categoría tiene productos asociados. ¿Deseas eliminarla de todos modos?'
                );
                if (!confirm) return;
                
                // Actualizar productos para quitar la categoría
                const batch = writeBatch(db);
                productsSnapshot.forEach(doc => {
                    batch.update(doc.ref, { categoryId: '' });
                });
                await batch.commit();
            }
            
            // Eliminar la categoría
            await deleteDoc(doc(db, 'stores', this.storeId, 'categories', categoryId));
            
            this.showNotification('Categoría eliminada exitosamente', 'success');
            await this.loadCategories();
            
        } catch (error) {
            console.error('Error eliminando categoría:', error);
            this.showNotification('Error eliminando categoría: ' + error.message, 'error');
        }
    }

    async editCategory(categoryId) {
        this.openCategoryModal(categoryId);
    }

    async openProductModal(productId = null) {
        this.editingItem.product = productId;
        this.tempImages.product = null;
        
        // Resetear vista previa
        document.getElementById('product-image-preview').innerHTML = `
            <div class="image-preview-placeholder">
                <i class="fas fa-image"></i>
                <span>Vista previa de la imagen</span>
            </div>
        `;
        document.getElementById('modal-product-remove').style.display = 'none';
        document.getElementById('modal-product-image-input').value = '';
        
        // Cargar categorías en el select
        await this.loadCategoriesSelect();
        
        if (productId) {
            document.getElementById('product-modal-title').textContent = 'Editar Producto';
            
            // Cargar datos del producto
            const productDoc = await getDoc(doc(db, 'stores', this.storeId, 'products', productId));
            if (productDoc.exists()) {
                const product = productDoc.data();
                document.getElementById('modal-product-name').value = product.name;
                document.getElementById('modal-product-price').value = product.price;
                document.getElementById('modal-product-description').value = product.description;
                
                if (product.categoryId) {
                    document.getElementById('modal-product-category').value = product.categoryId;
                }
                
                // Mostrar imagen si existe
                if (product.imageUrl) {
                    document.getElementById('product-image-preview').innerHTML = 
                        `<img src="${product.imageUrl}" alt="${product.name}">`;
                    document.getElementById('modal-product-remove').style.display = 'inline-block';
                }
            }
        } else {
            document.getElementById('product-modal-title').textContent = 'Agregar Producto';
            document.getElementById('product-form').reset();
        }
        
        // Configurar carga de imagen
        document.getElementById('modal-product-upload').addEventListener('click', () => {
            document.getElementById('modal-product-image-input').click();
        });
        document.getElementById('modal-product-image-input').addEventListener('change', (e) => {
            this.handleImageUpload(e, 'product');
        });
        document.getElementById('modal-product-remove').addEventListener('click', () => {
            this.removeImage('product');
        });
        
        document.getElementById('product-modal').classList.add('active');
    }

    async loadCategoriesSelect() {
        try {
            const categoriesQuery = query(
                collection(db, 'stores', this.storeId, 'categories'),
                orderBy('name')
            );
            const categoriesSnapshot = await getDocs(categoriesQuery);
            
            const select = document.getElementById('modal-product-category');
            select.innerHTML = '<option value="">Selecciona una categoría</option>';
            
            categoriesSnapshot.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = doc.data().name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error cargando categorías:', error);
        }
    }

    async saveProduct() {
        try {
            const name = document.getElementById('modal-product-name').value.trim();
            const price = parseFloat(document.getElementById('modal-product-price').value);
            const description = document.getElementById('modal-product-description').value.trim();
            const categoryId = document.getElementById('modal-product-category').value;
            
            // Validaciones
            if (!name || !description) {
                this.showNotification('Nombre y descripción son obligatorios', 'error');
                return;
            }
            
            if (isNaN(price) || price <= 0) {
                this.showNotification('El precio debe ser un número válido mayor que 0', 'error');
                return;
            }
            
            if (!categoryId) {
                this.showNotification('Debes seleccionar una categoría', 'error');
                return;
            }
            
            // Validar imagen (solo para productos nuevos)
            if (!this.editingItem.product && !this.tempImages.product) {
                this.showNotification('Debes subir una imagen para el producto', 'error');
                return;
            }
            
            let imageUrl = null;
            
            // Subir imagen si hay una nueva
            if (this.tempImages.product) {
                imageUrl = await this.uploadImage(
                    this.tempImages.product,
                    `stores/${this.storeId}/products`
                );
            }
            
            const productData = {
                name,
                price,
                description,
                categoryId,
                updatedAt: serverTimestamp()
            };
            
            // Agregar URL de imagen si se subió una nueva
            if (imageUrl) {
                productData.imageUrl = imageUrl;
            }
            
            if (this.editingItem.product) {
                // Actualizar producto existente
                // Si no se subió nueva imagen, mantener la existente
                if (!imageUrl) {
                    const existingProduct = await getDoc(doc(db, 'stores', this.storeId, 'products', this.editingItem.product));
                    if (existingProduct.exists()) {
                        productData.imageUrl = existingProduct.data().imageUrl;
                    }
                }
                
                await updateDoc(doc(db, 'stores', this.storeId, 'products', this.editingItem.product), productData);
                this.showNotification('Producto actualizado exitosamente', 'success');
            } else {
                // Crear nuevo producto
                productData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'stores', this.storeId, 'products'), productData);
                this.showNotification('Producto creado exitosamente', 'success');
            }
            
            this.closeAllModals();
            await this.loadProducts();
            
        } catch (error) {
            console.error('Error guardando producto:', error);
            this.showNotification('Error guardando producto: ' + error.message, 'error');
        }
    }

    async deleteProduct(productId) {
        try {
            await deleteDoc(doc(db, 'stores', this.storeId, 'products', productId));
            
            this.showNotification('Producto eliminado exitosamente', 'success');
            await this.loadProducts();
            
        } catch (error) {
            console.error('Error eliminando producto:', error);
            this.showNotification('Error eliminando producto: ' + error.message, 'error');
        }
    }

    async editProduct(productId) {
        await this.openProductModal(productId);
    }

    searchProducts() {
        const searchTerm = document.getElementById('products-search').value.trim();
        this.loadProducts(searchTerm);
    }

    async openPromotionModal(promotionId = null) {
        this.editingItem.promotion = promotionId;
        this.tempImages.promotion = null;
        
        // Resetear vista previa
        document.getElementById('promotion-image-preview').innerHTML = `
            <div class="image-preview-placeholder">
                <i class="fas fa-image"></i>
                <span>Vista previa de la imagen</span>
            </div>
        `;
        document.getElementById('modal-promotion-remove').style.display = 'none';
        document.getElementById('modal-promotion-image-input').value = '';
        
        if (promotionId) {
            document.getElementById('promotion-modal-title').textContent = 'Editar Promoción';
            
            // Cargar datos de la promoción
            const promotionDoc = await getDoc(doc(db, 'stores', this.storeId, 'promotions', promotionId));
            if (promotionDoc.exists()) {
                const promotion = promotionDoc.data();
                document.getElementById('modal-promotion-title').value = promotion.title;
                document.getElementById('modal-promotion-description').value = promotion.description;
                document.getElementById('modal-promotion-type').value = promotion.type || 'discount';
                document.getElementById('modal-promotion-active').checked = promotion.active !== false;
                
                // Mostrar imagen si existe
                if (promotion.imageUrl) {
                    document.getElementById('promotion-image-preview').innerHTML = 
                        `<img src="${promotion.imageUrl}" alt="${promotion.title}">`;
                    document.getElementById('modal-promotion-remove').style.display = 'inline-block';
                }
            }
        } else {
            document.getElementById('promotion-modal-title').textContent = 'Agregar Promoción';
            document.getElementById('promotion-form').reset();
        }
        
        // Configurar carga de imagen
        document.getElementById('modal-promotion-upload').addEventListener('click', () => {
            document.getElementById('modal-promotion-image-input').click();
        });
        document.getElementById('modal-promotion-image-input').addEventListener('change', (e) => {
            this.handleImageUpload(e, 'promotion');
        });
        document.getElementById('modal-promotion-remove').addEventListener('click', () => {
            this.removeImage('promotion');
        });
        
        document.getElementById('promotion-modal').classList.add('active');
    }

    async savePromotion() {
        try {
            const title = document.getElementById('modal-promotion-title').value.trim();
            const description = document.getElementById('modal-promotion-description').value.trim();
            const type = document.getElementById('modal-promotion-type').value;
            const active = document.getElementById('modal-promotion-active').checked;
            
            // Validaciones
            if (!title || !description) {
                this.showNotification('Título y descripción son obligatorios', 'error');
                return;
            }
            
            let imageUrl = null;
            
            // Subir imagen si hay una nueva
            if (this.tempImages.promotion) {
                imageUrl = await this.uploadImage(
                    this.tempImages.promotion,
                    `stores/${this.storeId}/promotions`
                );
            }
            
            const promotionData = {
                title,
                description,
                type,
                active,
                updatedAt: serverTimestamp()
            };
            
            // Agregar URL de imagen si se subió una nueva
            if (imageUrl) {
                promotionData.imageUrl = imageUrl;
            }
            
            if (this.editingItem.promotion) {
                // Actualizar promoción existente
                // Si no se subió nueva imagen, mantener la existente
                if (!imageUrl) {
                    const existingPromotion = await getDoc(doc(db, 'stores', this.storeId, 'promotions', this.editingItem.promotion));
                    if (existingPromotion.exists()) {
                        promotionData.imageUrl = existingPromotion.data().imageUrl;
                    }
                }
                
                await updateDoc(doc(db, 'stores', this.storeId, 'promotions', this.editingItem.promotion), promotionData);
                this.showNotification('Promoción actualizada exitosamente', 'success');
            } else {
                // Crear nueva promoción
                promotionData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'stores', this.storeId, 'promotions'), promotionData);
                this.showNotification('Promoción creada exitosamente', 'success');
            }
            
            this.closeAllModals();
            await this.loadPromotions();
            
        } catch (error) {
            console.error('Error guardando promoción:', error);
            this.showNotification('Error guardando promoción: ' + error.message, 'error');
        }
    }

    async deletePromotion(promotionId) {
        try {
            await deleteDoc(doc(db, 'stores', this.storeId, 'promotions', promotionId));
            
            this.showNotification('Promoción eliminada exitosamente', 'success');
            await this.loadPromotions();
            
        } catch (error) {
            console.error('Error eliminando promoción:', error);
            this.showNotification('Error eliminando promoción: ' + error.message, 'error');
        }
    }

    async editPromotion(promotionId) {
        await this.openPromotionModal(promotionId);
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        
        // Resetear estados de edición
        this.editingItem.category = null;
        this.editingItem.product = null;
        this.editingItem.promotion = null;
        
        // Resetear imágenes temporales
        this.tempImages.product = null;
        this.tempImages.promotion = null;
    }

    async logout() {
        try {
            await signOut(auth);
            this.showNotification('Sesión cerrada exitosamente', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            console.error('Error cerrando sesión:', error);
            this.showNotification('Error cerrando sesión', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Eliminar notificaciones anteriores
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());
        
        // Crear notificación
        const notification = document.createElement('div');
        notification.className = `notification`;
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
            <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i>
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

    async confirmDelete(message = '¿Estás seguro de eliminar este elemento?') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            `;
            
            modal.innerHTML = `
                <div style="
                    background: white;
                    padding: 30px;
                    border-radius: 8px;
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                ">
                    <h3 style="margin-bottom: 15px;">Confirmar eliminación</h3>
                    <p style="margin-bottom: 25px;">${message}</p>
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button id="confirm-cancel" style="
                            padding: 10px 20px;
                            background: #f0f0f0;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                        ">Cancelar</button>
                        <button id="confirm-delete" style="
                            padding: 10px 20px;
                            background: #FF4136;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                        ">Eliminar</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Event listeners
            document.getElementById('confirm-cancel').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });
            
            document.getElementById('confirm-delete').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
            });
        });
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.adminManager = new AdminManager();
});