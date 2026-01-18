// admin.js - Panel de administración completo para Livo App
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
    writeBatch,
    ref,
    uploadBytes,
    getDownloadURL
} from './firebase.js';

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
        
        console.log('AdminManager inicializado');
        
        // Inicializar después de un pequeño delay para asegurar que el DOM esté listo
        setTimeout(() => {
            this.init();
        }, 100);
    }

    async init() {
        try {
            console.log('Iniciando AdminManager...');
            
            // Verificar autenticación
            onAuthStateChanged(auth, async (user) => {
                if (!user) {
                    console.log('Usuario no autenticado, redirigiendo...');
                    window.location.href = 'index.html';
                    return;
                }
                
                console.log('Usuario autenticado:', user.uid);
                
                // Obtener storeId del displayName del usuario
                this.storeId = user.displayName;
                if (!this.storeId) {
                    console.error('Error: No se pudo identificar la tienda');
                    this.showNotification('Error: No se pudo identificar la tienda', 'error');
                    
                    // Intentar obtener el storeId de localStorage
                    const urlParams = new URLSearchParams(window.location.search);
                    this.storeId = urlParams.get('storeId') || localStorage.getItem('currentStoreId');
                    
                    if (!this.storeId) {
                        // Si aún no hay storeId, mostrar error y redirigir
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 3000);
                        return;
                    }
                }
                
                console.log('Store ID obtenido:', this.storeId);
                
                // Guardar storeId en localStorage para futuras referencias
                localStorage.setItem('currentStoreId', this.storeId);
                
                // Cargar datos iniciales
                await this.loadStoreData();
                this.setupEventListeners();
                this.updateStoreLink();
                await this.loadCategories();
                await this.loadProducts();
                await this.loadPromotions();
                this.updateStats();
                
                // Mostrar sección dashboard por defecto
                this.showSection('dashboard');
                
                console.log('✅ AdminManager inicializado correctamente');
            });
        } catch (error) {
            console.error('Error en init:', error);
            this.showNotification('Error inicializando el panel: ' + error.message, 'error');
        }
    }

    async loadStoreData() {
        try {
            console.log('Cargando datos de la tienda:', this.storeId);
            
            if (!this.storeId) {
                console.error('No hay storeId definido');
                return;
            }
            
            const storeDoc = await getDoc(doc(db, 'stores', this.storeId));
            
            if (!storeDoc.exists()) {
                console.error('Tienda no encontrada en Firestore');
                this.showNotification('Tienda no encontrada', 'error');
                return;
            }
            
            this.currentStore = storeDoc.data();
            console.log('Datos de la tienda cargados:', this.currentStore);
            
            // Actualizar UI - Verificar que los elementos existan
            const updateElement = (id, value) => {
                const element = document.getElementById(id);
                if (element) element.textContent = value || '';
            };
            
            const updateInput = (id, value) => {
                const element = document.getElementById(id);
                if (element) element.value = value || '';
            };
            
            updateElement('store-name-header', this.currentStore.storeInfo?.name || 'Mi Tienda');
            updateInput('store-name', this.currentStore.storeInfo?.name || '');
            updateInput('store-whatsapp', this.currentStore.storeInfo?.whatsapp || '');
            updateInput('store-address', this.currentStore.storeInfo?.address || '');
            updateInput('store-map', this.currentStore.storeInfo?.mapLink || '');
            updateInput('store-primary-color', this.currentStore.storeInfo?.colors?.primary || '#001f3f');
            updateInput('store-secondary-color', this.currentStore.storeInfo?.colors?.secondary || '#0074D9');
            
            // Mostrar logo si existe
            const logoPreview = document.getElementById('store-logo-preview');
            if (this.currentStore.storeInfo?.logoUrl && logoPreview) {
                logoPreview.innerHTML = `
                    <img src="${this.currentStore.storeInfo.logoUrl}" alt="Logo" 
                         style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">
                `;
                const removeBtn = document.getElementById('store-logo-remove');
                if (removeBtn) removeBtn.style.display = 'inline-block';
            }
            
            // Actualizar vista previa
            this.updatePreview();
            
        } catch (error) {
            console.error('Error cargando datos de la tienda:', error);
            this.showNotification('Error cargando datos de la tienda: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        console.log('Configurando event listeners...');
        
        // Navegación
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                console.log('Navegando a sección:', section);
                this.showSection(section);
            });
        });

        // Acciones rápidas
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section;
                console.log('Acción rápida a sección:', section);
                this.showSection(section);
            });
        });

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Cerrando sesión...');
                this.logout();
            });
        }

        // Ver tienda
        const viewStoreBtn = document.getElementById('view-store-btn');
        if (viewStoreBtn) {
            viewStoreBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.storeId) {
                    const storeUrl = `${window.location.origin}/store.html?storeId=${this.storeId}`;
                    console.log('Abriendo tienda:', storeUrl);
                    window.open(storeUrl, '_blank');
                } else {
                    this.showNotification('No se pudo obtener el ID de la tienda', 'error');
                }
            });
        }

        // Guardar configuración de tienda
        const saveStoreBtn = document.getElementById('save-store-settings');
        if (saveStoreBtn) {
            saveStoreBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Guardando configuración...');
                this.saveStoreSettings();
            });
        }

        // Carga de imágenes
        this.setupImageUploads();

        // Gestión de categorías
        const addCategoryBtn = document.getElementById('add-category-btn');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => {
                console.log('Abriendo modal de categoría');
                this.openCategoryModal();
            });
        }

        // Gestión de productos
        const addProductBtn = document.getElementById('add-product-btn');
        if (addProductBtn) {
            addProductBtn.addEventListener('click', () => {
                console.log('Abriendo modal de producto');
                this.openProductModal();
            });
        }

        const searchBtn = document.getElementById('products-search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.searchProducts();
            });
        }

        const searchInput = document.getElementById('products-search');
        if (searchInput) {
            searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.searchProducts();
            });
        }

        // Gestión de promociones
        const addPromotionBtn = document.getElementById('add-promotion-btn');
        if (addPromotionBtn) {
            addPromotionBtn.addEventListener('click', () => {
                console.log('Abriendo modal de promoción');
                this.openPromotionModal();
            });
        }

        // Vista previa
        const refreshPreviewBtn = document.getElementById('refresh-preview');
        if (refreshPreviewBtn) {
            refreshPreviewBtn.addEventListener('click', () => {
                console.log('Actualizando vista previa');
                this.updatePreview();
            });
        }

        // Sidebar toggle para móviles
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                document.querySelector('.admin-sidebar').classList.toggle('active');
            });
        }

        // Modales
        this.setupModals();
        
        console.log('✅ Event listeners configurados correctamente');
    }

    setupImageUploads() {
        // Logo de tienda
        const logoUploadBtn = document.getElementById('store-logo-upload');
        const logoInput = document.getElementById('store-logo-input');
        const logoRemoveBtn = document.getElementById('store-logo-remove');
        
        if (logoUploadBtn && logoInput) {
            logoUploadBtn.addEventListener('click', () => {
                logoInput.click();
            });
            
            logoInput.addEventListener('change', (e) => {
                this.handleImageUpload(e, 'storeLogo');
            });
        }
        
        if (logoRemoveBtn) {
            logoRemoveBtn.addEventListener('click', () => {
                this.removeImage('storeLogo');
            });
        }
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
        const categoryForm = document.getElementById('category-form');
        if (categoryForm) {
            categoryForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveCategory();
            });
        }

        // Formulario de productos
        const productForm = document.getElementById('product-form');
        if (productForm) {
            productForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProduct();
            });
        }

        // Formulario de promociones
        const promotionForm = document.getElementById('promotion-form');
        if (promotionForm) {
            promotionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.savePromotion();
            });
        }
    }

    async saveStoreSettings() {
        try {
            console.log('Guardando configuración de tienda...');
            
            if (!this.storeId) {
                this.showNotification('Error: No se identificó la tienda', 'error');
                return;
            }

            const storeData = {
                'storeInfo.name': document.getElementById('store-name').value,
                'storeInfo.whatsapp': document.getElementById('store-whatsapp').value,
                'storeInfo.address': document.getElementById('store-address').value,
                'storeInfo.mapLink': document.getElementById('store-map').value,
                'storeInfo.colors.primary': document.getElementById('store-primary-color').value,
                'storeInfo.colors.secondary': document.getElementById('store-secondary-color').value,
                'storeInfo.updatedAt': serverTimestamp()
            };

            console.log('Datos a guardar:', storeData);

            // Subir logo si hay uno nuevo
            if (this.tempImages.storeLogo) {
                try {
                    const logoUrl = await this.uploadImage(
                        this.tempImages.storeLogo, 
                        `stores/${this.storeId}/logo`
                    );
                    storeData['storeInfo.logoUrl'] = logoUrl;
                    console.log('Logo subido exitosamente:', logoUrl);
                } catch (error) {
                    console.error('Error subiendo logo:', error);
                    this.showNotification('Error subiendo la imagen del logo: ' + error.message, 'error');
                }
            }

            // Actualizar en Firestore
            await updateDoc(doc(db, 'stores', this.storeId), storeData);

            // Actualizar datos locales
            await this.loadStoreData();

            this.showNotification('✅ Configuración guardada exitosamente', 'success');
            
        } catch (error) {
            console.error('Error guardando configuración:', error);
            this.showNotification('❌ Error guardando configuración: ' + error.message, 'error');
        }
    }

    async loadCategories() {
        try {
            if (!this.storeId) return;
            
            console.log('Cargando categorías...');
            const categoriesRef = collection(db, 'stores', this.storeId, 'categories');
            const categoriesQuery = query(categoriesRef, orderBy('name'));
            const categoriesSnapshot = await getDocs(categoriesQuery);
            
            const tbody = document.getElementById('categories-table-body');
            if (!tbody) {
                console.warn('No se encontró categories-table-body');
                return;
            }
            
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

            // Event listeners para botones de editar
            tbody.querySelectorAll('.edit-category').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const categoryId = e.target.closest('button').dataset.id;
                    this.editCategory(categoryId);
                });
            });

            // Event listeners para botones de eliminar
            tbody.querySelectorAll('.delete-category').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const categoryId = e.target.closest('button').dataset.id;
                    const confirmed = await this.confirmDelete();
                    if (confirmed) {
                        await this.deleteCategory(categoryId);
                    }
                });
            });

            // Actualizar contador
            const categoriesCount = document.getElementById('categories-count');
            if (categoriesCount) {
                categoriesCount.textContent = categoryCount;
            }
            
            console.log(`✅ ${categoryCount} categorías cargadas`);
            
        } catch (error) {
            console.error('Error cargando categorías:', error);
        }
    }

    async loadProducts(searchTerm = '') {
        try {
            if (!this.storeId) return;
            
            console.log('Cargando productos...');
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
                    product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
                );
            }
            
            this.displayProducts(filteredProducts);
            
            // Actualizar contador
            const productsCount = document.getElementById('products-count');
            if (productsCount) {
                productsCount.textContent = productCount;
            }
            
            console.log(`✅ ${productCount} productos cargados`);
            
        } catch (error) {
            console.error('Error cargando productos:', error);
        }
    }

    displayProducts(products) {
        const grid = document.getElementById('products-grid');
        if (!grid) {
            console.warn('No se encontró products-grid');
            return;
        }
        
        grid.innerHTML = '';
        
        if (products.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 20px;"></i>
                    <h3>No hay productos</h3>
                    <p>Agrega tu primer producto haciendo clic en "Agregar Producto"</p>
                </div>
            `;
            return;
        }
        
        products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            
            productCard.innerHTML = `
                <div class="product-card-image">
                    ${product.imageUrl ? 
                        `<img src="${product.imageUrl}" alt="${product.name || 'Producto'}" 
                             style="width: 100%; height: 200px; object-fit: cover;">` : 
                        `<div class="image-placeholder" style="width: 100%; height: 200px; display: flex; align-items: center; justify-content: center; background: #f5f5f5; color: #001f3f;">
                            <i class="fas fa-box" style="font-size: 3rem;"></i>
                        </div>`
                    }
                </div>
                <div class="product-card-info" style="padding: 15px;">
                    <h4 style="margin: 0 0 10px 0; font-size: 1.1rem;">${product.name || 'Sin nombre'}</h4>
                    <p class="product-price" style="font-size: 1.3rem; font-weight: bold; color: #001f3f; margin: 0 0 10px 0;">
                        $${(product.price || 0).toFixed(2)}
                    </p>
                    <p class="product-description" style="color: #666; font-size: 0.9rem; margin: 0 0 15px 0; line-height: 1.4;">
                        ${(product.description || '').substring(0, 100)}${product.description?.length > 100 ? '...' : ''}
                    </p>
                    <div class="product-actions" style="display: flex; gap: 10px;">
                        <button class="btn-icon edit-product" data-id="${product.id}" style="padding: 8px; background: #0074D9; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-product" data-id="${product.id}" style="padding: 8px; background: #FF4136; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            
            grid.appendChild(productCard);
        });

        // Event listeners
        grid.querySelectorAll('.edit-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.closest('button').dataset.id;
                this.editProduct(productId);
            });
        });

        grid.querySelectorAll('.delete-product').forEach(btn => {
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
            if (!this.storeId) return;
            
            console.log('Cargando promociones...');
            const promotionsRef = collection(db, 'stores', this.storeId, 'promotions');
            const promotionsQuery = query(promotionsRef, orderBy('createdAt', 'desc'));
            const promotionsSnapshot = await getDocs(promotionsQuery);
            
            const grid = document.getElementById('promotions-grid');
            if (!grid) {
                console.warn('No se encontró promotions-grid');
                return;
            }
            
            grid.innerHTML = '';
            
            let promotionCount = 0;
            promotionsSnapshot.forEach(doc => {
                const promotion = doc.data();
                const promotionCard = document.createElement('div');
                promotionCard.className = 'promotion-card';
                promotionCard.style.cssText = 'background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);';
                
                promotionCard.innerHTML = `
                    <div class="promotion-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h4 style="margin: 0; font-size: 1.2rem;">${promotion.title || 'Sin título'}</h4>
                        <span class="promotion-status ${promotion.active ? 'active' : 'inactive'}" 
                              style="padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; background: ${promotion.active ? '#2ECC40' : '#e0e0e0'}; color: ${promotion.active ? 'white' : '#333'}">
                            ${promotion.active ? 'Activa' : 'Inactiva'}
                        </span>
                    </div>
                    <p style="color: #666; margin-bottom: 15px; line-height: 1.5;">${promotion.description || ''}</p>
                    <div class="promotion-type" style="display: inline-block; background: #7FDBFF; color: #001f3f; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; margin-bottom: 15px;">
                        ${this.getPromotionTypeText(promotion.type)}
                    </div>
                    <div class="promotion-actions" style="display: flex; gap: 10px;">
                        <button class="btn-icon edit-promotion" data-id="${doc.id}" style="padding: 8px; background: #0074D9; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-promotion" data-id="${doc.id}" style="padding: 8px; background: #FF4136; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                grid.appendChild(promotionCard);
                promotionCount++;
            });

            // Event listeners
            grid.querySelectorAll('.edit-promotion').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const promotionId = e.target.closest('button').dataset.id;
                    this.editPromotion(promotionId);
                });
            });

            grid.querySelectorAll('.delete-promotion').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const promotionId = e.target.closest('button').dataset.id;
                    const confirmed = await this.confirmDelete();
                    if (confirmed) {
                        await this.deletePromotion(promotionId);
                    }
                });
            });

            // Actualizar contador
            const promotionsCount = document.getElementById('promotions-count');
            if (promotionsCount) {
                promotionsCount.textContent = promotionCount;
            }
            
            console.log(`✅ ${promotionCount} promociones cargadas`);
            
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
        return types[type] || type || 'General';
    }

    updateStats() {
        console.log('Actualizando estadísticas...');
        // Los contadores se actualizan en loadCategories, loadProducts, loadPromotions
    }

    updateStoreLink() {
        if (!this.storeId) return;
        
        const storeUrl = `${window.location.origin}/store.html?storeId=${this.storeId}`;
        const storeLinkElement = document.getElementById('store-link');
        if (storeLinkElement) {
            storeLinkElement.textContent = storeUrl;
        }
        
        console.log('Store link actualizado:', storeUrl);
    }

    updatePreview() {
        if (!this.storeId) return;
        
        const storeUrl = `${window.location.origin}/store.html?storeId=${this.storeId}`;
        const previewFrame = document.getElementById('store-preview');
        if (previewFrame) {
            previewFrame.src = storeUrl;
        }
        
        console.log('Vista previa actualizada:', storeUrl);
    }

    showSection(sectionId) {
        console.log('Mostrando sección:', sectionId);
        
        // Actualizar navegación
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
        if (activeLink) activeLink.classList.add('active');
        
        // Actualizar título
        const titles = {
            'dashboard': 'Dashboard',
            'store-settings': 'Configuración de Tienda',
            'categories': 'Gestión de Categorías',
            'products': 'Gestión de Productos',
            'promotions': 'Promociones y Modales',
            'preview': 'Vista Previa'
        };
        
        const sectionTitle = document.getElementById('section-title');
        if (sectionTitle) {
            sectionTitle.textContent = titles[sectionId] || 'Panel';
        }
        
        // Mostrar sección
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        
        const targetSection = document.getElementById(`${sectionId}-section`);
        if (targetSection) targetSection.classList.add('active');
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
        
        this.showNotification('✅ Imagen cargada correctamente', 'success');
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
                border-radius: 8px;
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
                <div class="image-preview-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #999;">
                    <i class="fas fa-image" style="font-size: 3rem; margin-bottom: 10px;"></i>
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
            console.log('Subiendo imagen...');
            
            // Crear referencia en storage con nombre único
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 15);
            const fileName = `${timestamp}_${randomString}_${file.name}`;
            
            const storageRef = ref(storage, `${path}/${fileName}`);
            
            // Subir archivo
            const snapshot = await uploadBytes(storageRef, file);
            
            // Obtener URL de descarga
            const downloadUrl = await getDownloadURL(snapshot.ref);
            
            console.log('✅ Imagen subida correctamente:', downloadUrl);
            return downloadUrl;
            
        } catch (error) {
            console.error('Error subiendo imagen:', error);
            throw new Error('No se pudo subir la imagen: ' + error.message);
        }
    }

    openCategoryModal(categoryId = null) {
        this.editingItem.category = categoryId;
        
        const modalTitle = document.getElementById('category-modal-title');
        const modalElement = document.getElementById('category-modal');
        
        if (!modalTitle || !modalElement) {
            console.error('No se encontró el modal de categoría');
            return;
        }
        
        if (categoryId) {
            modalTitle.textContent = 'Editar Categoría';
            
            // Cargar datos de la categoría
            getDoc(doc(db, 'stores', this.storeId, 'categories', categoryId))
                .then(doc => {
                    if (doc.exists()) {
                        const category = doc.data();
                        const nameInput = document.getElementById('modal-category-name');
                        const descInput = document.getElementById('modal-category-description');
                        
                        if (nameInput) nameInput.value = category.name || '';
                        if (descInput) descInput.value = category.description || '';
                    }
                })
                .catch(error => {
                    console.error('Error cargando categoría:', error);
                    this.showNotification('Error cargando categoría', 'error');
                });
        } else {
            modalTitle.textContent = 'Agregar Categoría';
            const categoryForm = document.getElementById('category-form');
            if (categoryForm) categoryForm.reset();
        }
        
        modalElement.classList.add('active');
    }

    async saveCategory() {
        try {
            const nameInput = document.getElementById('modal-category-name');
            const descInput = document.getElementById('modal-category-description');
            
            if (!nameInput || !descInput) {
                this.showNotification('Error: No se encontraron los campos del formulario', 'error');
                return;
            }
            
            const name = nameInput.value.trim();
            const description = descInput.value.trim();
            
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
                await updateDoc(
                    doc(db, 'stores', this.storeId, 'categories', this.editingItem.category), 
                    categoryData
                );
                this.showNotification('✅ Categoría actualizada exitosamente', 'success');
            } else {
                // Crear nueva categoría
                categoryData.createdAt = serverTimestamp();
                await addDoc(
                    collection(db, 'stores', this.storeId, 'categories'), 
                    categoryData
                );
                this.showNotification('✅ Categoría creada exitosamente', 'success');
            }
            
            this.closeAllModals();
            await this.loadCategories();
            
        } catch (error) {
            console.error('Error guardando categoría:', error);
            this.showNotification('❌ Error guardando categoría: ' + error.message, 'error');
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
            
            this.showNotification('✅ Categoría eliminada exitosamente', 'success');
            await this.loadCategories();
            
        } catch (error) {
            console.error('Error eliminando categoría:', error);
            this.showNotification('❌ Error eliminando categoría: ' + error.message, 'error');
        }
    }

    async editCategory(categoryId) {
        this.openCategoryModal(categoryId);
    }

    async openProductModal(productId = null) {
        this.editingItem.product = productId;
        this.tempImages.product = null;
        
        // Resetear vista previa
        const productPreview = document.getElementById('product-image-preview');
        const productRemoveBtn = document.getElementById('modal-product-remove');
        const productImageInput = document.getElementById('modal-product-image-input');
        
        if (productPreview) {
            productPreview.innerHTML = `
                <div class="image-preview-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #999;">
                    <i class="fas fa-image" style="font-size: 3rem; margin-bottom: 10px;"></i>
                    <span>Vista previa de la imagen</span>
                </div>
            `;
        }
        
        if (productRemoveBtn) productRemoveBtn.style.display = 'none';
        if (productImageInput) productImageInput.value = '';
        
        // Cargar categorías en el select
        await this.loadCategoriesSelect();
        
        const modalTitle = document.getElementById('product-modal-title');
        const modalElement = document.getElementById('product-modal');
        
        if (!modalTitle || !modalElement) {
            console.error('No se encontró el modal de producto');
            return;
        }
        
        if (productId) {
            modalTitle.textContent = 'Editar Producto';
            
            try {
                // Cargar datos del producto
                const productDoc = await getDoc(doc(db, 'stores', this.storeId, 'products', productId));
                if (productDoc.exists()) {
                    const product = productDoc.data();
                    
                    const nameInput = document.getElementById('modal-product-name');
                    const priceInput = document.getElementById('modal-product-price');
                    const descInput = document.getElementById('modal-product-description');
                    const categorySelect = document.getElementById('modal-product-category');
                    
                    if (nameInput) nameInput.value = product.name || '';
                    if (priceInput) priceInput.value = product.price || '';
                    if (descInput) descInput.value = product.description || '';
                    if (categorySelect && product.categoryId) {
                        categorySelect.value = product.categoryId;
                    }
                    
                    // Mostrar imagen si existe
                    if (product.imageUrl && productPreview) {
                        productPreview.innerHTML = `<img src="${product.imageUrl}" alt="${product.name || 'Producto'}" style="width: 100%; height: 100%; object-fit: cover;">`;
                        if (productRemoveBtn) productRemoveBtn.style.display = 'inline-block';
                    }
                }
            } catch (error) {
                console.error('Error cargando producto:', error);
                this.showNotification('Error cargando producto', 'error');
            }
        } else {
            modalTitle.textContent = 'Agregar Producto';
            const productForm = document.getElementById('product-form');
            if (productForm) productForm.reset();
        }
        
        // Configurar carga de imagen
        const productUploadBtn = document.getElementById('modal-product-upload');
        if (productUploadBtn && productImageInput) {
            productUploadBtn.addEventListener('click', () => {
                productImageInput.click();
            });
        }
        
        if (productImageInput) {
            productImageInput.addEventListener('change', (e) => {
                this.handleImageUpload(e, 'product');
            });
        }
        
        if (productRemoveBtn) {
            productRemoveBtn.addEventListener('click', () => {
                this.removeImage('product');
            });
        }
        
        modalElement.classList.add('active');
    }

    async loadCategoriesSelect() {
        try {
            const categoriesQuery = query(
                collection(db, 'stores', this.storeId, 'categories'),
                orderBy('name')
            );
            const categoriesSnapshot = await getDocs(categoriesQuery);
            
            const select = document.getElementById('modal-product-category');
            if (!select) return;
            
            select.innerHTML = '<option value="">Selecciona una categoría</option>';
            
            categoriesSnapshot.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = doc.data().name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error cargando categorías para select:', error);
        }
    }

    async saveProduct() {
        try {
            const name = document.getElementById('modal-product-name')?.value.trim();
            const price = parseFloat(document.getElementById('modal-product-price')?.value);
            const description = document.getElementById('modal-product-description')?.value.trim();
            const categoryId = document.getElementById('modal-product-category')?.value;
            
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
                    const existingProduct = await getDoc(
                        doc(db, 'stores', this.storeId, 'products', this.editingItem.product)
                    );
                    if (existingProduct.exists()) {
                        productData.imageUrl = existingProduct.data().imageUrl;
                    }
                }
                
                await updateDoc(
                    doc(db, 'stores', this.storeId, 'products', this.editingItem.product), 
                    productData
                );
                this.showNotification('✅ Producto actualizado exitosamente', 'success');
            } else {
                // Crear nuevo producto
                productData.createdAt = serverTimestamp();
                await addDoc(
                    collection(db, 'stores', this.storeId, 'products'), 
                    productData
                );
                this.showNotification('✅ Producto creado exitosamente', 'success');
            }
            
            this.closeAllModals();
            await this.loadProducts();
            
        } catch (error) {
            console.error('Error guardando producto:', error);
            this.showNotification('❌ Error guardando producto: ' + error.message, 'error');
        }
    }

    async deleteProduct(productId) {
        try {
            await deleteDoc(doc(db, 'stores', this.storeId, 'products', productId));
            
            this.showNotification('✅ Producto eliminado exitosamente', 'success');
            await this.loadProducts();
            
        } catch (error) {
            console.error('Error eliminando producto:', error);
            this.showNotification('❌ Error eliminando producto: ' + error.message, 'error');
        }
    }

    async editProduct(productId) {
        await this.openProductModal(productId);
    }

    searchProducts() {
        const searchInput = document.getElementById('products-search');
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        this.loadProducts(searchTerm);
    }

    async openPromotionModal(promotionId = null) {
        this.editingItem.promotion = promotionId;
        this.tempImages.promotion = null;
        
        // Resetear vista previa
        const promotionPreview = document.getElementById('promotion-image-preview');
        const promotionRemoveBtn = document.getElementById('modal-promotion-remove');
        const promotionImageInput = document.getElementById('modal-promotion-image-input');
        
        if (promotionPreview) {
            promotionPreview.innerHTML = `
                <div class="image-preview-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #999;">
                    <i class="fas fa-image" style="font-size: 3rem; margin-bottom: 10px;"></i>
                    <span>Vista previa de la imagen</span>
                </div>
            `;
        }
        
        if (promotionRemoveBtn) promotionRemoveBtn.style.display = 'none';
        if (promotionImageInput) promotionImageInput.value = '';
        
        const modalTitle = document.getElementById('promotion-modal-title');
        const modalElement = document.getElementById('promotion-modal');
        
        if (!modalTitle || !modalElement) {
            console.error('No se encontró el modal de promoción');
            return;
        }
        
        if (promotionId) {
            modalTitle.textContent = 'Editar Promoción';
            
            try {
                // Cargar datos de la promoción
                const promotionDoc = await getDoc(
                    doc(db, 'stores', this.storeId, 'promotions', promotionId)
                );
                if (promotionDoc.exists()) {
                    const promotion = promotionDoc.data();
                    
                    const titleInput = document.getElementById('modal-promotion-title');
                    const descInput = document.getElementById('modal-promotion-description');
                    const typeSelect = document.getElementById('modal-promotion-type');
                    const activeCheckbox = document.getElementById('modal-promotion-active');
                    
                    if (titleInput) titleInput.value = promotion.title || '';
                    if (descInput) descInput.value = promotion.description || '';
                    if (typeSelect) typeSelect.value = promotion.type || 'discount';
                    if (activeCheckbox) activeCheckbox.checked = promotion.active !== false;
                    
                    // Mostrar imagen si existe
                    if (promotion.imageUrl && promotionPreview) {
                        promotionPreview.innerHTML = `<img src="${promotion.imageUrl}" alt="${promotion.title || 'Promoción'}" style="width: 100%; height: 100%; object-fit: cover;">`;
                        if (promotionRemoveBtn) promotionRemoveBtn.style.display = 'inline-block';
                    }
                }
            } catch (error) {
                console.error('Error cargando promoción:', error);
                this.showNotification('Error cargando promoción', 'error');
            }
        } else {
            modalTitle.textContent = 'Agregar Promoción';
            const promotionForm = document.getElementById('promotion-form');
            if (promotionForm) promotionForm.reset();
        }
        
        // Configurar carga de imagen
        const promotionUploadBtn = document.getElementById('modal-promotion-upload');
        if (promotionUploadBtn && promotionImageInput) {
            promotionUploadBtn.addEventListener('click', () => {
                promotionImageInput.click();
            });
        }
        
        if (promotionImageInput) {
            promotionImageInput.addEventListener('change', (e) => {
                this.handleImageUpload(e, 'promotion');
            });
        }
        
        if (promotionRemoveBtn) {
            promotionRemoveBtn.addEventListener('click', () => {
                this.removeImage('promotion');
            });
        }
        
        modalElement.classList.add('active');
    }

    async savePromotion() {
        try {
            const title = document.getElementById('modal-promotion-title')?.value.trim();
            const description = document.getElementById('modal-promotion-description')?.value.trim();
            const type = document.getElementById('modal-promotion-type')?.value;
            const active = document.getElementById('modal-promotion-active')?.checked;
            
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
                type: type || 'discount',
                active: active !== false,
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
                    const existingPromotion = await getDoc(
                        doc(db, 'stores', this.storeId, 'promotions', this.editingItem.promotion)
                    );
                    if (existingPromotion.exists()) {
                        promotionData.imageUrl = existingPromotion.data().imageUrl;
                    }
                }
                
                await updateDoc(
                    doc(db, 'stores', this.storeId, 'promotions', this.editingItem.promotion), 
                    promotionData
                );
                this.showNotification('✅ Promoción actualizada exitosamente', 'success');
            } else {
                // Crear nueva promoción
                promotionData.createdAt = serverTimestamp();
                await addDoc(
                    collection(db, 'stores', this.storeId, 'promotions'), 
                    promotionData
                );
                this.showNotification('✅ Promoción creada exitosamente', 'success');
            }
            
            this.closeAllModals();
            await this.loadPromotions();
            
        } catch (error) {
            console.error('Error guardando promoción:', error);
            this.showNotification('❌ Error guardando promoción: ' + error.message, 'error');
        }
    }

    async deletePromotion(promotionId) {
        try {
            await deleteDoc(doc(db, 'stores', this.storeId, 'promotions', promotionId));
            
            this.showNotification('✅ Promoción eliminada exitosamente', 'success');
            await this.loadPromotions();
            
        } catch (error) {
            console.error('Error eliminando promoción:', error);
            this.showNotification('❌ Error eliminando promoción: ' + error.message, 'error');
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
            this.showNotification('✅ Sesión cerrada exitosamente', 'success');
            
            // Limpiar localStorage
            localStorage.removeItem('currentStoreId');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            console.error('Error cerrando sesión:', error);
            this.showNotification('❌ Error cerrando sesión', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Eliminar notificaciones anteriores
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());
        
        // Crear notificación
        const notification = document.createElement('div');
        notification.className = 'notification';
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
            font-family: 'Open Sans', sans-serif;
            font-size: 14px;
        `;
        
        const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
        notification.innerHTML = `
            <i class="fas fa-${icon}" style="font-size: 1.2rem;"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-eliminar después de 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
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
                z-index: 10000;
                font-family: 'Open Sans', sans-serif;
            `;
            
            modal.innerHTML = `
                <div style="
                    background: white;
                    padding: 30px;
                    border-radius: 8px;
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                ">
                    <h3 style="margin-bottom: 15px; color: #001f3f;">Confirmar eliminación</h3>
                    <p style="margin-bottom: 25px; color: #666; line-height: 1.5;">${message}</p>
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button id="confirm-cancel" style="
                            padding: 10px 20px;
                            background: #f0f0f0;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: 600;
                            transition: all 0.3s;
                        ">Cancelar</button>
                        <button id="confirm-delete" style="
                            padding: 10px 20px;
                            background: #FF4136;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: 600;
                            transition: all 0.3s;
                        ">Eliminar</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Event listeners
            document.getElementById('confirm-cancel').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });
            
            document.getElementById('confirm-delete').addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });
            
            // Efectos hover
            const buttons = modal.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.addEventListener('mouseover', () => {
                    btn.style.opacity = '0.9';
                    btn.style.transform = 'translateY(-1px)';
                });
                btn.addEventListener('mouseout', () => {
                    btn.style.opacity = '1';
                    btn.style.transform = 'translateY(0)';
                });
            });
        });
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('✅ DOM cargado, inicializando AdminManager...');
        window.adminManager = new AdminManager();
    } catch (error) {
        console.error('❌ Error crítico inicializando AdminManager:', error);
        
        // Mostrar mensaje de error amigable
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #f8d7da;
            color: #721c24;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
            z-index: 10000;
            font-family: 'Open Sans', sans-serif;
        `;
        errorDiv.innerHTML = `
            <h2 style="margin-bottom: 20px;">⚠️ Error al cargar el panel de administración</h2>
            <p style="margin-bottom: 20px; max-width: 600px;">${error.message}</p>
            <button onclick="window.location.reload()" style="
                margin-top: 20px;
                padding: 12px 24px;
                background: #721c24;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.3s;
            ">Recargar página</button>
        `;
        document.body.appendChild(errorDiv);
    }
});

// Exportar la clase para uso externo si es necesario
export default AdminManager;