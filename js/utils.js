class Utils {
  // Mostrar notificaciones
  static showNotification(message, type = 'info', duration = 3000) {
    // Eliminar notificaciones anteriores
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    // Crear notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle"></i>
      <span>${message}</span>
    `;
    
    // Estilos
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
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    // Agregar animación
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto-eliminar
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, duration);
  }

  // Formatear precio
  static formatPrice(price) {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  }

  // Obtener parámetros de la URL
  static getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  }

  // Validar email
  static validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  // Validar contraseña
  static validatePassword(password) {
    return password.length >= 6;
  }

  // Cargar imagen a Firebase Storage
  static async uploadImage(file, path) {
    try {
      // Validar tipo de archivo
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        throw new Error('Formato de imagen no válido. Use JPG o PNG.');
      }
      
      // Validar tamaño (5MB máximo)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('La imagen es demasiado grande. Máximo 5MB.');
      }
      
      // Crear referencia en storage
      const storageRef = storage.ref();
      const imageRef = storageRef.child(`${path}/${Date.now()}_${file.name}`);
      
      // Subir archivo
      const snapshot = await imageRef.put(file);
      
      // Obtener URL de descarga
      const downloadUrl = await snapshot.ref.getDownloadURL();
      
      return downloadUrl;
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      throw error;
    }
  }

  // Crear vista previa de imagen
  static createImagePreview(file, previewElement) {
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

  // Confirmación antes de eliminar
  static confirmDelete(message = '¿Estás seguro de eliminar este elemento?') {
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

  // Cargar categorías para select
  static async loadCategoriesSelect(storeId, selectElement, selectedId = null) {
    try {
      const categoriesSnapshot = await db.collection('stores').doc(storeId)
        .collection('categories').orderBy('name').get();
      
      selectElement.innerHTML = '<option value="">Selecciona una categoría</option>';
      
      categoriesSnapshot.forEach(doc => {
        const category = doc.data();
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = category.name;
        if (selectedId === doc.id) {
          option.selected = true;
        }
        selectElement.appendChild(option);
      });
    } catch (error) {
      console.error('Error cargando categorías:', error);
    }
  }

  // Generar mensaje de WhatsApp
  static generateWhatsappMessage(cartItems, storeInfo) {
    let message = `¡Hola ${storeInfo.name}! Me interesan los siguientes productos:\n\n`;
    
    let total = 0;
    cartItems.forEach(item => {
      const itemTotal = item.price * item.quantity;
      total += itemTotal;
      message += `• ${item.name} x${item.quantity}: ${Utils.formatPrice(itemTotal)}\n`;
    });
    
    message += `\nTotal: ${Utils.formatPrice(total)}\n\n`;
    message += `Mis datos:\nNombre: \nTeléfono: \nDirección: \n\nGracias.`;
    
    return encodeURIComponent(message);
  }
}