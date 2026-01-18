// ===== Configuración del cliente API =====

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
let authToken = localStorage.getItem('adminToken');

// ===== Función auxiliar para peticiones =====
async function apiCall(endpoint, method = 'GET', data = null, requiresAuth = false) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (requiresAuth) {
        if (!authToken) {
            throw new Error('No autenticado');
        }
        options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

        if (response.status === 401) {
            // Token expirado, limpiar
            localStorage.removeItem('adminToken');
            authToken = null;
            throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ===== Autenticación =====

async function login(username, password) {
    try {
        const response = await apiCall('/auth/login', 'POST', { username, password });
        authToken = response.token;
        localStorage.setItem('adminToken', authToken);
        return response;
    } catch (error) {
        console.error('Error en login:', error);
        throw error;
    }
}

async function logout() {
    authToken = null;
    localStorage.removeItem('adminToken');
}

async function verifyToken() {
    try {
        return await apiCall('/auth/verify', 'GET', null, true);
    } catch (error) {
        return false;
    }
}

// ===== Servicios (Imágenes) =====

async function uploadServiceImage(file) {
    try {
        if (!authToken) {
            throw new Error('No autenticado');
        }

        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`${API_BASE_URL}/services/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al subir imagen');
        }

        return await response.json();
    } catch (error) {
        console.error('Error al subir imagen:', error);
        throw error;
    }
}

async function getServiceImages() {
    try {
        return await apiCall('/services/images', 'GET', null, true);
    } catch (error) {
        console.error('Error al obtener imágenes:', error);
        throw error;
    }
}

async function deleteServiceImage(filename) {
    try {
        return await apiCall(`/services/images/${filename}`, 'DELETE', null, true);
    } catch (error) {
        console.error('Error al eliminar imagen:', error);
        throw error;
    }
}

// ===== Contenido de la página =====

async function getPageData() {
    try {
        return await apiCall('/content/page-data', 'GET');
    } catch (error) {
        console.error('Error al obtener datos:', error);
        throw error;
    }
}

async function savePageData(data) {
    try {
        return await apiCall('/content/page-data', 'POST', data, true);
    } catch (error) {
        console.error('Error al guardar datos:', error);
        throw error;
    }
}

// ===== Salud del servidor =====

async function checkServerHealth() {
    try {
        return await apiCall('/health', 'GET');
    } catch (error) {
        console.error('Servidor no disponible:', error);
        return null;
    }
}

// ===== Exportar funciones para uso en otros archivos =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        login,
        logout,
        verifyToken,
        uploadServiceImage,
        getServiceImages,
        deleteServiceImage,
        getPageData,
        savePageData,
        checkServerHealth
    };
}
