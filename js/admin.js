class AdminManager {
  constructor() {
    this.storeId = authManager.getCurrentStoreId();
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
    if (!this.storeId) {
      Utils.showNotification('Error: No se pudo identificar la tienda', 'error');
      return;
    }

    // Verificar propiedad de la tienda
    const isOwner = await authManager.verifyStoreOwnership(this.storeId);
    if (!isOwner) {
      Utils.showNotification('No tienes permiso para acceder a esta tienda', 'error');
      authManager.logout();
      return;
    }

    // Cargar datos iniciales
    await this.loadStoreData();
    this.setupEventListeners();
    this.updateStoreLink();
    this.updateStats();
    this.loadCategories();
    this.loadProducts();
    this.loadPromotions();
  }

  async loadStoreData() {
    try {
      const storeDoc = await db.collection('stores').doc(this.storeId).get();
      
      if (!storeDoc.exists) {
        throw new Error('Tienda no encontrada');
      }
      
      this.currentStore = storeDoc.data();
      
      // Actualizar UI
      document.getElementById('store-name-header').textContent = this.currentStore.storeInfo.name;
      document.getElementById('store-name').value = this.currentStore.storeInfo.name;
      document.getElementById('store-whatsapp').value = this.currentStore.storeInfo.whatsapp || '';
      document.getElementById('store-address').value = this.currentStore.storeInfo.address || '';
      document.getElementById('store-map').value = this.currentStore.storeInfo.mapLink || '';
      document.getElementById('store-primary-color').value = this.currentStore.storeInfo.colors?.primary || '#001f3f';
      document.getElementById('store-secondary-color').value = this.currentStore.storeInfo.colors?.secondary || '#0074D9';
      
      // Mostrar logo si existe
      if (this.currentStore.storeInfo.logoUrl) {
        document.getElementById('store-logo-preview').innerHTML = 
          `<img src="${this.currentStore.storeInfo.logoUrl}" alt="Logo">`;
        document.getElementById('store-logo-remove').style.display = 'inline-block';
      }
      
      // Actualizar vista previa
      this.updatePreview();
      
    } catch (error) {
      console.error('Error cargando datos de la tienda:', error);
      Utils.showNotification('Error cargando datos de la tienda', 'error');
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
      authManager.logout();
    });

    // Ver tienda
    document.getElementById('view-store-btn').addEventListener('click', (e) => {
      e.preventDefault();
      const storeUrl = `${window.location.origin}/store.html?storeId=${this.storeId}`;
      window.open(storeUrl, '_blank');
    });

    // Guardar configuración de tienda
    document.getElementById('save-store-settings').addEventListener('click', () => {
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
        'storeInfo.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
      };

      // Subir logo si hay uno nuevo
      if (this.tempImages.storeLogo) {
        const logoUrl = await Utils.uploadImage(
          this.tempImages.storeLogo, 
          `stores/${this.storeId}/logo`
        );
        storeData['storeInfo.logoUrl'] = logoUrl;
      }

      // Actualizar en Firestore
      await db.collection('stores').doc(this.storeId).update(storeData);

      // Actualizar datos locales
      await this.loadStoreData();

      Utils.showNotification('Configuración guardada exitosamente', 'success');
    } catch (error) {
      console.error('Error guardando configuración:', error);
      Utils.showNotification('Error guardando configuración', 'error');
    }
  }

  async loadCategories() {
    try {
      const categoriesSnapshot = await db.collection('stores').doc(this.storeId)
        .collection('categories').orderBy('name').get();
      
      const tbody = document.getElementById('categories-table-body');
      tbody.innerHTML = '';
      
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
          const confirmed = await Utils.confirmDelete();
          if (confirmed) {
            await this.deleteCategory(categoryId);
          }
        });
      });

      // Actualizar contador
      document.getElementById('categories-count').textContent = categoriesSnapshot.size;
    } catch (error) {
      console.error('Error cargando categorías:', error);
    }
  }

  async loadProducts(searchTerm = '') {
    try {
      let query = db.collection('stores').doc(this.storeId)
        .collection('products');
      
      // Aplicar búsqueda si existe
      if (searchTerm) {
        // Nota: Firestore no soporta búsqueda por texto completo
        // Esta es una implementación básica
        const productsSnapshot = await query.get();
        const filteredProducts = [];
        
        productsSnapshot.forEach(doc => {
          const product = doc.data();
          if (product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              product.description.toLowerCase().includes(searchTerm.toLowerCase())) {
            filteredProducts.push({ id: doc.id, ...product });
          }
        });
        
        this.displayProducts(filteredProducts);
      } else {
        const productsSnapshot = await query.orderBy('createdAt', 'desc').get();
        const products = [];
        productsSnapshot.forEach(doc => {
          products.push({ id: doc.id, ...doc.data() });
        });
        this.displayProducts(products);
      }
      
      // Actualizar contador
      const count = await query.get();
      document.getElementById('products-count').textContent = count.size;
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  }

  displayProducts(products) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';
    
    products.forEach(product => {
      const categoryName = 'Cargando...'; // Se podría cargar el nombre de la categoría
      
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
          <p class="product-price">${Utils.formatPrice(product.price)}</p>
          <p class="product-description">${product.description.substring(0, 100)}...</p>
          <div class="product-category">${categoryName}</div>
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
        const confirmed = await Utils.confirmDelete();
        if (confirmed) {
          await this.deleteProduct(productId);
        }
      });
    });
  }

  async loadPromotions() {
    try {
      const promotionsSnapshot = await db.collection('stores').doc(this.storeId)
        .collection('promotions').orderBy('createdAt', 'desc').get();
      
      const grid = document.getElementById('promotions-grid');
      grid.innerHTML = '';
      
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
          const confirmed = await Utils.confirmDelete();
          if (confirmed) {
            await this.deletePromotion(promotionId);
          }
        });
      });

      // Actualizar contador
      document.getElementById('promotions-count').textContent = promotionsSnapshot.size;
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

  async updateStats() {
    // Los contadores se actualizan en loadCategories, loadProducts, loadPromotions
  }

  updateStoreLink() {
    const storeUrl = `${window.location.origin}/store.html?storeId=${this.storeId}`;
    document.getElementById('store-link').textContent = storeUrl;
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
      Utils.showNotification('Formato de imagen no válido. Use JPG o PNG.', 'error');
      return;
    }
    
    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      Utils.showNotification('La imagen es demasiado grande. Máximo 5MB.', 'error');
      return;
    }
    
    // Guardar archivo temporalmente
    this.tempImages[type] = file;
    
    // Mostrar vista previa
    const previewElement = document.getElementById(`${type}-preview`);
    if (previewElement) {
      Utils.createImagePreview(file, previewElement);
    }
    
    // Mostrar botón de eliminar
    const removeBtn = document.getElementById(`${type}-remove`);
    if (removeBtn) {
      removeBtn.style.display = 'inline-block';
    }
    
    Utils.showNotification('Imagen cargada correctamente', 'success');
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
    
    Utils.showNotification('Imagen eliminada', 'info');
  }

  openCategoryModal(categoryId = null) {
    this.editingItem.category = categoryId;
    
    if (categoryId) {
      document.getElementById('category-modal-title').textContent = 'Editar Categoría';
      
      // Cargar datos de la categoría
      db.collection('stores').doc(this.storeId)
        .collection('categories').doc(categoryId).get()
        .then(doc => {
          if (doc.exists) {
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
        Utils.showNotification('El nombre de la categoría es obligatorio', 'error');
        return;
      }
      
      const categoryData = {
        name,
        description,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      if (this.editingItem.category) {
        // Actualizar categoría existente
        await db.collection('stores').doc(this.storeId)
          .collection('categories').doc(this.editingItem.category).update(categoryData);
        Utils.showNotification('Categoría actualizada exitosamente', 'success');
      } else {
        // Crear nueva categoría
        categoryData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('stores').doc(this.storeId)
          .collection('categories').add(categoryData);
        Utils.showNotification('Categoría creada exitosamente', 'success');
      }
      
      this.closeAllModals();
      await this.loadCategories();
      
    } catch (error) {
      console.error('Error guardando categoría:', error);
      Utils.showNotification('Error guardando categoría', 'error');
    }
  }

  async deleteCategory(categoryId) {
    try {
      // Verificar si hay productos en esta categoría
      const productsSnapshot = await db.collection('stores').doc(this.storeId)
        .collection('products').where('categoryId', '==', categoryId).get();
      
      if (!productsSnapshot.empty) {
        const confirm = await Utils.confirmDelete(
          'Esta categoría tiene productos asociados. ¿Deseas eliminarla de todos modos?'
        );
        if (!confirm) return;
        
        // Actualizar productos para quitar la categoría
        const batch = db.batch();
        productsSnapshot.forEach(doc => {
          batch.update(doc.ref, { categoryId: '' });
        });
        await batch.commit();
      }
      
      // Eliminar la categoría
      await db.collection('stores').doc(this.storeId)
        .collection('categories').doc(categoryId).delete();
      
      Utils.showNotification('Categoría eliminada exitosamente', 'success');
      await this.loadCategories();
      
    } catch (error) {
      console.error('Error eliminando categoría:', error);
      Utils.showNotification('Error eliminando categoría', 'error');
    }
  }

  async editCategory(categoryId) {
    this.openCategoryModal(categoryId);
  }

  openProductModal(productId = null) {
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
    Utils.loadCategoriesSelect(this.storeId, document.getElementById('modal-product-category'));
    
    if (productId) {
      document.getElementById('product-modal-title').textContent = 'Editar Producto';
      
      // Cargar datos del producto
      db.collection('stores').doc(this.storeId)
        .collection('products').doc(productId).get()
        .then(doc => {
          if (doc.exists) {
            const product = doc.data();
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
        });
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

  async saveProduct() {
    try {
      const name = document.getElementById('modal-product-name').value.trim();
      const price = parseFloat(document.getElementById('modal-product-price').value);
      const description = document.getElementById('modal-product-description').value.trim();
      const categoryId = document.getElementById('modal-product-category').value;
      
      // Validaciones
      if (!name || !description) {
        Utils.showNotification('Nombre y descripción son obligatorios', 'error');
        return;
      }
      
      if (isNaN(price) || price <= 0) {
        Utils.showNotification('El precio debe ser un número válido mayor que 0', 'error');
        return;
      }
      
      if (!categoryId) {
        Utils.showNotification('Debes seleccionar una categoría', 'error');
        return;
      }
      
      // Validar imagen (solo para productos nuevos)
      if (!this.editingItem.product && !this.tempImages.product) {
        Utils.showNotification('Debes subir una imagen para el producto', 'error');
        return;
      }
      
      let imageUrl = null;
      
      // Subir imagen si hay una nueva
      if (this.tempImages.product) {
        imageUrl = await Utils.uploadImage(
          this.tempImages.product,
          `stores/${this.storeId}/products`
        );
      }
      
      const productData = {
        name,
        price,
        description,
        categoryId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      // Agregar URL de imagen si se subió una nueva
      if (imageUrl) {
        productData.imageUrl = imageUrl;
      }
      
      if (this.editingItem.product) {
        // Actualizar producto existente
        // Si no se subió nueva imagen, mantener la existente
        if (!imageUrl) {
          const existingProduct = await db.collection('stores').doc(this.storeId)
            .collection('products').doc(this.editingItem.product).get();
          if (existingProduct.exists) {
            productData.imageUrl = existingProduct.data().imageUrl;
          }
        }
        
        await db.collection('stores').doc(this.storeId)
          .collection('products').doc(this.editingItem.product).update(productData);
        Utils.showNotification('Producto actualizado exitosamente', 'success');
      } else {
        // Crear nuevo producto
        productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('stores').doc(this.storeId)
          .collection('products').add(productData);
        Utils.showNotification('Producto creado exitosamente', 'success');
      }
      
      this.closeAllModals();
      await this.loadProducts();
      
    } catch (error) {
      console.error('Error guardando producto:', error);
      Utils.showNotification('Error guardando producto', 'error');
    }
  }

  async deleteProduct(productId) {
    try {
      await db.collection('stores').doc(this.storeId)
        .collection('products').doc(productId).delete();
      
      Utils.showNotification('Producto eliminado exitosamente', 'success');
      await this.loadProducts();
      
    } catch (error) {
      console.error('Error eliminando producto:', error);
      Utils.showNotification('Error eliminando producto', 'error');
    }
  }

  async editProduct(productId) {
    this.openProductModal(productId);
  }

  searchProducts() {
    const searchTerm = document.getElementById('products-search').value.trim();
    this.loadProducts(searchTerm);
  }

  openPromotionModal(promotionId = null) {
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
      db.collection('stores').doc(this.storeId)
        .collection('promotions').doc(promotionId).get()
        .then(doc => {
          if (doc.exists) {
            const promotion = doc.data();
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
        });
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
        Utils.showNotification('Título y descripción son obligatorios', 'error');
        return;
      }
      
      let imageUrl = null;
      
      // Subir imagen si hay una nueva
      if (this.tempImages.promotion) {
        imageUrl = await Utils.uploadImage(
          this.tempImages.promotion,
          `stores/${this.storeId}/promotions`
        );
      }
      
      const promotionData = {
        title,
        description,
        type,
        active,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      // Agregar URL de imagen si se subió una nueva
      if (imageUrl) {
        promotionData.imageUrl = imageUrl;
      }
      
      if (this.editingItem.promotion) {
        // Actualizar promoción existente
        // Si no se subió nueva imagen, mantener la existente
        if (!imageUrl) {
          const existingPromotion = await db.collection('stores').doc(this.storeId)
            .collection('promotions').doc(this.editingItem.promotion).get();
          if (existingPromotion.exists) {
            promotionData.imageUrl = existingPromotion.data().imageUrl;
          }
        }
        
        await db.collection('stores').doc(this.storeId)
          .collection('promotions').doc(this.editingItem.promotion).update(promotionData);
        Utils.showNotification('Promoción actualizada exitosamente', 'success');
      } else {
        // Crear nueva promoción
        promotionData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('stores').doc(this.storeId)
          .collection('promotions').add(promotionData);
        Utils.showNotification('Promoción creada exitosamente', 'success');
      }
      
      this.closeAllModals();
      await this.loadPromotions();
      
    } catch (error) {
      console.error('Error guardando promoción:', error);
      Utils.showNotification('Error guardando promoción', 'error');
    }
  }

  async deletePromotion(promotionId) {
    try {
      await db.collection('stores').doc(this.storeId)
        .collection('promotions').doc(promotionId).delete();
      
      Utils.showNotification('Promoción eliminada exitosamente', 'success');
      await this.loadPromotions();
      
    } catch (error) {
      console.error('Error eliminando promoción:', error);
      Utils.showNotification('Error eliminando promoción', 'error');
    }
  }

  async editPromotion(promotionId) {
    this.openPromotionModal(promotionId);
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
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  // Verificar autenticación
  authManager.auth.onAuthStateChanged(async (user) => {
    if (user) {
      // Inicializar AdminManager
      window.adminManager = new AdminManager();
    } else {
      // Redirigir a login
      window.location.href = 'index.html';
    }
  });
});