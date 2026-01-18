class StoreManager {
  constructor() {
    this.storeId = this.getStoreIdFromUrl();
    this.currentStore = null;
    this.products = [];
    this.categories = [];
    this.promotions = [];
    this.cart = this.loadCartFromStorage();
    
    if (!this.storeId) {
      this.showError('No se especificó una tienda en la URL');
      return;
    }
    
    this.init();
  }

  getStoreIdFromUrl() {
    const params = Utils.getUrlParams();
    return params.storeId || null;
  }

  async init() {
    try {
      await this.loadStoreData();
      this.setupEventListeners();
      this.updateCartUI();
      this.applyStoreColors();
      this.showActivePromotions();
    } catch (error) {
      console.error('Error inicializando tienda:', error);
      this.showError('Error cargando la tienda');
    }
  }

  async loadStoreData() {
    // Cargar datos de la tienda
    const storeDoc = await db.collection('stores').doc(this.storeId).get();
    
    if (!storeDoc.exists) {
      throw new Error('Tienda no encontrada');
    }
    
    this.currentStore = storeDoc.data();
    
    // Actualizar UI con datos de la tienda
    this.updateStoreUI();
    
    // Cargar categorías
    await this.loadCategories();
    
    // Cargar productos
    await this.loadProducts();
    
    // Cargar promociones activas
    await this.loadPromotions();
  }

  updateStoreUI() {
    if (!this.currentStore) return;
    
    const storeInfo = this.currentStore.storeInfo;
    
    // Actualizar título de la página
    document.title = storeInfo.name;
    
    // Actualizar header
    document.getElementById('store-name-header').textContent = storeInfo.name;
    document.getElementById('sidebar-store-name').textContent = storeInfo.name;
    document.getElementById('footer-store-name').textContent = storeInfo.name;
    document.getElementById('copyright-store-name').textContent = storeInfo.name;
    
    // Actualizar logo si existe
    if (storeInfo.logoUrl) {
      document.querySelectorAll('.logo-placeholder').forEach(placeholder => {
        placeholder.innerHTML = `<img src="${storeInfo.logoUrl}" alt="${storeInfo.name}">`;
      });
    }
    
    // Actualizar información de contacto
    document.getElementById('sidebar-address').textContent = storeInfo.address || '';
    document.getElementById('footer-address').textContent = storeInfo.address || '';
    document.getElementById('footer-whatsapp').textContent = storeInfo.whatsapp || '';
    document.getElementById('whatsapp-number').textContent = storeInfo.whatsapp || '';
    
    // Actualizar enlaces
    const mapLink = document.getElementById('map-link');
    if (storeInfo.mapLink) {
      mapLink.href = storeInfo.mapLink;
      mapLink.target = '_blank';
    } else {
      mapLink.style.display = 'none';
    }
    
    const whatsappLink = document.getElementById('whatsapp-link');
    if (storeInfo.whatsapp) {
      const whatsappNumber = storeInfo.whatsapp.replace(/\D/g, '');
      whatsappLink.href = `https://wa.me/${whatsappNumber}`;
      whatsappLink.target = '_blank';
    } else {
      whatsappLink.style.display = 'none';
    }
  }

  applyStoreColors() {
    if (!this.currentStore?.storeInfo?.colors) return;
    
    const colors = this.currentStore.storeInfo.colors;
    const root = document.documentElement;
    
    // Aplicar colores personalizados como variables CSS
    root.style.setProperty('--navy-blue', colors.primary);
    root.style.setProperty('--navy-blue-light', this.lightenColor(colors.primary, 20));
    root.style.setProperty('--accent', colors.secondary);
  }

  lightenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      G = (num >> 8 & 0x00FF) + amt,
      B = (num & 0x0000FF) + amt;
    
    return "#" + (
      0x1000000 +
      (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
  }

  async loadCategories() {
    try {
      const categoriesSnapshot = await db.collection('stores').doc(this.storeId)
        .collection('categories').orderBy('name').get();
      
      this.categories = [];
      categoriesSnapshot.forEach(doc => {
        this.categories.push({ id: doc.id, ...doc.data() });
      });
      
      this.updateCategoriesUI();
    } catch (error) {
      console.error('Error cargando categorías:', error);
    }
  }

  updateCategoriesUI() {
    const categoriesList = document.getElementById('categories-list');
    const categoryFilter = document.getElementById('category-filter');
    
    // Limpiar listas
    categoriesList.innerHTML = '';
    categoryFilter.innerHTML = '';
    
    // Agregar opción "Todas"
    const allCategoriesItem = document.createElement('li');
    allCategoriesItem.className = 'category-item active';
    allCategoriesItem.dataset.category = 'all';
    allCategoriesItem.innerHTML = '<span>Todas las categorías</span>';
    allCategoriesItem.addEventListener('click', () => this.filterProductsByCategory('all'));
    categoriesList.appendChild(allCategoriesItem);
    
    // Botón para "Todas" en el filtro
    const allButton = document.createElement('button');
    allButton.className = 'btn btn-outline active';
    allButton.textContent = 'Todas';
    allButton.addEventListener('click', () => this.filterProductsByCategory('all'));
    categoryFilter.appendChild(allButton);
    
    // Agregar cada categoría
    this.categories.forEach(category => {
      // En la barra lateral
      const categoryItem = document.createElement('li');
      categoryItem.className = 'category-item';
      categoryItem.dataset.category = category.id;
      categoryItem.innerHTML = `<span>${category.name}</span>`;
      categoryItem.addEventListener('click', () => this.filterProductsByCategory(category.id));
      categoriesList.appendChild(categoryItem);
      
      // En el filtro
      const categoryButton = document.createElement('button');
      categoryButton.className = 'btn btn-outline';
      categoryButton.textContent = category.name;
      categoryButton.addEventListener('click', () => this.filterProductsByCategory(category.id));
      categoryFilter.appendChild(categoryButton);
    });
  }

  async loadProducts() {
    try {
      const productsSnapshot = await db.collection('stores').doc(this.storeId)
        .collection('products').orderBy('createdAt', 'desc').get();
      
      this.products = [];
      productsSnapshot.forEach(doc => {
        this.products.push({ id: doc.id, ...doc.data() });
      });
      
      this.displayProducts(this.products);
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  }

  async loadPromotions() {
    try {
      const promotionsSnapshot = await db.collection('stores').doc(this.storeId)
        .collection('promotions')
        .where('active', '==', true)
        .orderBy('createdAt', 'desc')
        .get();
      
      this.promotions = [];
      promotionsSnapshot.forEach(doc => {
        this.promotions.push({ id: doc.id, ...doc.data() });
      });
      
      this.displayPromotions();
    } catch (error) {
      console.error('Error cargando promociones:', error);
    }
  }

  displayProducts(products) {
    const container = document.getElementById('products-container');
    
    if (products.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-box-open"></i>
          <h3>No hay productos disponibles</h3>
          <p>Vuelve pronto para ver nuestros productos.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    
    products.forEach(product => {
      const category = this.categories.find(c => c.id === product.categoryId);
      
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
          <p class="product-description">${product.description}</p>
          <div class="product-category">${category ? category.name : 'Sin categoría'}</div>
          <div class="product-actions">
            <button class="btn btn-primary add-to-cart" data-id="${product.id}">
              <i class="fas fa-cart-plus"></i> Agregar al Carrito
            </button>
          </div>
        </div>
      `;
      
      container.appendChild(productCard);
    });
    
    // Event listeners para agregar al carrito
    document.querySelectorAll('.add-to-cart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productId = e.target.closest('button').dataset.id;
        this.addToCart(productId);
      });
    });
  }

  displayPromotions() {
    const container = document.getElementById('promotions-section');
    const modalsContainer = document.getElementById('promotion-modals-container');
    
    if (this.promotions.length === 0) {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = 'block';
    container.innerHTML = '';
    modalsContainer.innerHTML = '';
    
    // Mostrar promociones en la sección principal
    this.promotions.forEach((promotion, index) => {
      // Tarjeta de promoción
      const promotionCard = document.createElement('div');
      promotionCard.className = 'promotion-card';
      
      promotionCard.innerHTML = `
        <div class="promotion-card-content">
          ${promotion.imageUrl ? 
            `<img src="${promotion.imageUrl}" alt="${promotion.title}" class="promotion-image">` : 
            `<div class="promotion-icon"><i class="fas fa-tag"></i></div>`
          }
          <div class="promotion-info">
            <h3>${promotion.title}</h3>
            <p>${promotion.description}</p>
            <button class="btn btn-outline view-promotion" data-index="${index}">
              Ver más
            </button>
          </div>
        </div>
      `;
      
      container.appendChild(promotionCard);
      
      // Modal de promoción
      const promotionModal = document.createElement('div');
      promotionModal.className = 'modal promotion-modal';
      promotionModal.id = `promotion-modal-${index}`;
      
      promotionModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>${promotion.title}</h3>
            <button class="close-modal">&times;</button>
          </div>
          <div class="modal-body">
            ${promotion.imageUrl ? 
              `<img src="${promotion.imageUrl}" alt="${promotion.title}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin-bottom: 20px;">` : ''
            }
            <p style="font-size: 16px; line-height: 1.6;">${promotion.description}</p>
            <div class="form-actions" style="margin-top: 30px;">
              <button class="btn btn-secondary close-modal">Cerrar</button>
            </div>
          </div>
        </div>
      `;
      
      modalsContainer.appendChild(promotionModal);
    });
    
    // Event listeners para ver promociones
    document.querySelectorAll('.view-promotion').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = e.target.dataset.index;
        document.getElementById(`promotion-modal-${index}`).classList.add('active');
      });
    });
    
    // Event listeners para cerrar modales
    document.querySelectorAll('.promotion-modal .close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.remove('active');
      });
    });
    
    // Cerrar modal al hacer clic fuera
    document.querySelectorAll('.promotion-modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });
  }

  showActivePromotions() {
    // Mostrar el primer modal de promoción al cargar la página
    setTimeout(() => {
      if (this.promotions.length > 0) {
        document.getElementById('promotion-modal-0').classList.add('active');
      }
    }, 2000);
  }

  filterProductsByCategory(categoryId) {
    // Actualizar categorías activas
    document.querySelectorAll('.category-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.category === categoryId) {
        item.classList.add('active');
      }
    });
    
    // Actualizar botones de filtro
    document.querySelectorAll('#category-filter .btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    if (categoryId === 'all') {
      document.querySelector('#category-filter .btn:first-child').classList.add('active');
    } else {
      const categoryButton = Array.from(document.querySelectorAll('#category-filter .btn')).find(
        btn => btn.textContent === this.categories.find(c => c.id === categoryId)?.name
      );
      if (categoryButton) {
        categoryButton.classList.add('active');
      }
    }
    
    // Filtrar productos
    let filteredProducts = this.products;
    
    if (categoryId !== 'all') {
      filteredProducts = this.products.filter(product => product.categoryId === categoryId);
    }
    
    this.displayProducts(filteredProducts);
  }

  setupEventListeners() {
    // Sidebar
    document.getElementById('menu-toggle').addEventListener('click', this.toggleSidebar);
    document.getElementById('close-sidebar').addEventListener('click', this.toggleSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', this.toggleSidebar);
    
    // Buscador
    document.getElementById('search-btn').addEventListener('click', () => this.searchProducts());
    document.getElementById('search-input').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this.searchProducts();
    });
    
    // Carrito
    document.getElementById('cart-btn').addEventListener('click', () => this.openCartModal());
    document.getElementById('clear-cart-btn').addEventListener('click', () => this.clearCart());
    document.getElementById('checkout-btn').addEventListener('click', () => this.checkout());
    
    // Modales
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.remove('active');
      });
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });
  }

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('sidebar-overlay').classList.toggle('active');
  }

  openCartModal() {
    document.getElementById('cart-modal').classList.add('active');
  }

  searchProducts() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    
    if (!searchTerm) {
      this.displayProducts(this.products);
      return;
    }
    
    const filteredProducts = this.products.filter(product => 
      product.name.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm)
    );
    
    this.displayProducts(filteredProducts);
  }

  // Funciones del carrito
  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = this.cart.find(item => item.id === productId);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.cart.push({
        id: productId,
        name: product.name,
        price: product.price,
        quantity: 1
      });
    }
    
    this.saveCartToStorage();
    this.updateCartUI();
    
    Utils.showNotification(`¡${product.name} agregado al carrito!`, 'success');
  }

  updateCartUI() {
    // Actualizar contador
    document.getElementById('cart-count').textContent = 
      this.cart.reduce((total, item) => total + item.quantity, 0);
    
    // Actualizar contenido del carrito
    const container = document.getElementById('cart-items-container');
    
    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="empty-cart" id="empty-cart">
          <i class="fas fa-shopping-cart"></i>
          <p>Tu carrito está vacío</p>
        </div>
      `;
      document.getElementById('cart-total-amount').textContent = '$0.00';
      return;
    }
    
    container.innerHTML = '';
    
    let total = 0;
    
    this.cart.forEach(item => {
      const itemTotal = item.price * item.quantity;
      total += itemTotal;
      
      const cartItem = document.createElement('div');
      cartItem.className = 'cart-item';
      
      cartItem.innerHTML = `
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-price">${Utils.formatPrice(item.price)}</div>
          <div class="cart-item-actions">
            <button class="quantity-btn decrease-quantity" data-id="${item.id}">-</button>
            <span class="cart-item-quantity">${item.quantity}</span>
            <button class="quantity-btn increase-quantity" data-id="${item.id}">+</button>
            <button class="remove-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
      
      container.appendChild(cartItem);
    });
    
    // Actualizar total
    document.getElementById('cart-total-amount').textContent = Utils.formatPrice(total);
    
    // Event listeners para los botones del carrito
    document.querySelectorAll('.decrease-quantity').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productId = e.target.closest('button').dataset.id;
        this.updateCartQuantity(productId, -1);
      });
    });
    
    document.querySelectorAll('.increase-quantity').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productId = e.target.closest('button').dataset.id;
        this.updateCartQuantity(productId, 1);
      });
    });
    
    document.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productId = e.target.closest('button').dataset.id;
        this.removeFromCart(productId);
      });
    });
  }

  updateCartQuantity(productId, change) {
    const item = this.cart.find(item => item.id === productId);
    if (!item) return;
    
    item.quantity += change;
    
    if (item.quantity <= 0) {
      this.cart = this.cart.filter(item => item.id !== productId);
    }
    
    this.saveCartToStorage();
    this.updateCartUI();
  }

  removeFromCart(productId) {
    this.cart = this.cart.filter(item => item.id !== productId);
    this.saveCartToStorage();
    this.updateCartUI();
    Utils.showNotification('Producto eliminado del carrito', 'info');
  }

  clearCart() {
    if (this.cart.length === 0) return;
    
    const confirmClear = confirm('¿Estás seguro de vaciar el carrito?');
    if (!confirmClear) return;
    
    this.cart = [];
    this.saveCartToStorage();
    this.updateCartUI();
    Utils.showNotification('Carrito vaciado', 'info');
  }

  checkout() {
    if (this.cart.length === 0) {
      Utils.showNotification('Tu carrito está vacío', 'error');
      return;
    }
    
    if (!this.currentStore?.storeInfo?.whatsapp) {
      Utils.showNotification('La tienda no tiene configurado un número de WhatsApp', 'error');
      return;
    }
    
    const message = Utils.generateWhatsappMessage(this.cart, this.currentStore.storeInfo);
    const whatsappNumber = this.currentStore.storeInfo.whatsapp.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
    
    window.open(whatsappUrl, '_blank');
  }

  saveCartToStorage() {
    localStorage.setItem(`cart_${this.storeId}`, JSON.stringify(this.cart));
  }

  loadCartFromStorage() {
    const cartData = localStorage.getItem(`cart_${this.storeId}`);
    return cartData ? JSON.parse(cartData) : [];
  }

  showError(message) {
    document.body.innerHTML = `
      <div class="error-container">
        <div class="error-content">
          <i class="fas fa-exclamation-triangle"></i>
          <h2>Error</h2>
          <p>${message}</p>
          <a href="/" class="btn btn-primary">Volver al inicio</a>
        </div>
      </div>
    `;
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.storeManager = new StoreManager();
});