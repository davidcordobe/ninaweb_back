require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const mongoose = require('mongoose');

const { PageData } = require('./models');

const app = express();

// ===== Configuración =====
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET; // Default si no está en .env
const ADMIN_USERNAME = process.env.ADMIN_USERNAME; // Default si no está en .env
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // Default si no está en .env
const MAX_FILE_SIZE = 10485760; // 10MB
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL; // Opcional si se usa dominio
const MONGO_URI = process.env.MONGO_URI;

console.log(`✅ JWT_SECRET configurado: ${JWT_SECRET ? 'Sí' : 'No'}`);
console.log(`✅ ADMIN_USERNAME configurado: ${ADMIN_USERNAME ? 'Sí' : 'No'}`);
console.log(`✅ ADMIN_PASSWORD configurado: ${ADMIN_PASSWORD ? 'Sí' : 'No'}`);
console.log(`✅ MONGO_URI configurado: ${MONGO_URI ? 'Sí' : 'No'}`);

// ===== Carpetas de almacenamiento =====
const uploadDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Base URL para recursos públicos (imágenes/videos)
function getPublicBaseUrl(req) {
    if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL.replace(/\/$/, '');
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${proto}://${host}`;
}

// ===== Datos por defecto =====
const defaultPageData = {
    hero: { title: 'Nina Multipotencial', subtitle: 'Creadora de contenido UGC & Edición de Video Profesional', description: 'Transformo ideas en contenido visual impactante...' },
    about: { text1: '', text2: '', features: [] },
    portfolioPage: {
        eyebrow: 'Seleccion de trabajos',
        heroTitle: 'Portafolio en video',
        sectionTitle: 'Reel de proyectos'
    },
    portfolioIntro: '',
    services: [],
    portfolio: [],
    testimonials: [],
    contact: { whatsapp: '', email: '', instagram: '', tiktok: '', linkedin: '' },
    colors: {
        primary: '#667eea',
        primaryDark: '#764ba2',
        accent: '#25d366',
        textDark: '#1a1a1a',
        textLight: '#666',
        bgLight: '#f5f7fa',
        bgWhite: '#ffffff',
        contactBg: '#ffffff',
        bgCard: '#ffffff',
        borderColor: '#e0e0e0',
        inputBg: '#ffffff',
        inputBorder: '#ddd',
        navbarBg: 'rgba(255,255,255,0.95)',
        navbarText: '#1a1a1a'
    },
    typography: {
        primaryFont: "'Poppins', sans-serif",
        h1Size: '48px',
        h2Size: '32px',
        bodySize: '16px',
        fontWeight: '400',
        lineHeight: '1.6'
    }
};

function mergeDefaults(data = {}) {
    return {
        ...defaultPageData,
        ...data,
        hero: { ...defaultPageData.hero, ...(data.hero || {}) },
        about: { ...defaultPageData.about, ...(data.about || {}) },
        portfolioPage: { ...defaultPageData.portfolioPage, ...(data.portfolioPage || {}) },
        contact: { ...defaultPageData.contact, ...(data.contact || {}) },
        colors: { ...defaultPageData.colors, ...(data.colors || {}) },
        typography: { ...defaultPageData.typography, ...(data.typography || {}) },
        services: Array.isArray(data.services) ? data.services : [],
        portfolio: Array.isArray(data.portfolio) ? data.portfolio : [],
        testimonials: Array.isArray(data.testimonials) ? data.testimonials : []
    };
}

// ===== Conexión a MongoDB =====
if (!MONGO_URI) {
    console.error('❌ MONGO_URI no está configurado. Define la variable de entorno para usar Mongo Atlas.');
} else {
    mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        console.log('✅ Conectado a MongoDB Atlas');
    }).catch(err => {
        console.error('❌ Error conectando a MongoDB:', err.message);
        process.exit(1);
    });
}

async function getOrCreatePageData() {
    if (!MONGO_URI) {
        throw new Error('MONGO_URI no configurado');
    }
    let doc = await PageData.findOne();
    if (!doc) {
        doc = new PageData(defaultPageData);
        await doc.save();
        return doc.toObject();
    }

    const merged = mergeDefaults(doc.toObject());
    doc.set(merged);
    await doc.save();
    return merged;
}

async function savePageDataMongo(payload) {
    if (!MONGO_URI) {
        throw new Error('MONGO_URI no configurado');
    }
    const merged = mergeDefaults(payload);
    let doc = await PageData.findOne();
    if (!doc) {
        doc = new PageData(merged);
    } else {
        doc.set(merged);
    }
    await doc.save();
    return merged;
}

// ===== Middleware =====
// Logging middleware
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path}`);
    next();
});

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'https://ninamulti.netlify.app'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(uploadDir));

// ===== Función para comprimir imagen =====
async function compressImage(inputPath, outputPath) {
    try {
        // Verificar que el archivo de entrada existe
        if (!fs.existsSync(inputPath)) {
            throw new Error(`Archivo de entrada no existe: ${inputPath}`);
        }

        // Usar Sharp para comprimir
        await sharp(inputPath)
            .resize(1200, 1200, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80, progressive: true })
            .toFile(outputPath);

        // Verificar que el archivo de salida se creó
        if (!fs.existsSync(outputPath)) {
            throw new Error(`Archivo de salida no se creó: ${outputPath}`);
        }

        return true;
    } catch (error) {
        console.error('❌ Error en compressImage:', error.message);
        return false;
    }
}

// ===== Configuración Multer =====
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generar nombre único
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido'));
        }
    }
});

// Multer para videos (sin compresión) -> memoria para enviar a S3 o disco
// Nota: se eliminó soporte de subida de videos; solo URLs externas

// ===== Middleware de autenticación =====
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log(`🔐 Auth Header: ${authHeader ? 'Presente' : 'Faltante'}`);
    console.log(`🔐 Token: ${token ? token.substring(0, 20) + '...' : 'No'}`);

    if (!token) {
        console.error('❌ Token requerido');
        return res.status(401).json({ error: 'Token requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('❌ Error verificando token:', err.message);
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        console.log('✅ Token válido');
        req.user = user;
        next();
    });
};

// ===== Rutas de autenticación =====

// Login
app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }

        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            console.log('✅ Credenciales correctas, generando token...');
            const token = jwt.sign(
                { role: 'admin', username, timestamp: Date.now() },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            console.log(`✅ Token generado: ${token.substring(0, 20)}...`);
            res.json({
                success: true,
                token,
                message: 'Login exitoso'
            });
        } else {
            console.error('❌ Usuario o contraseña incorrectos');
            res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Verificar token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// ===== Rutas de servicios (imágenes) =====

// Subir imagen
app.post('/api/services/upload', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se envió imagen' });
        }

        const inputPath = req.file.path;
        const filename = req.file.filename;
        const outputPath = path.join(uploadDir, `compressed-${filename}`);

        console.log(`📸 Procesando imagen: ${filename}`);
        console.log(`   Input: ${inputPath}`);
        console.log(`   Output: ${outputPath}`);

        // Comprimir imagen
        const compressed = await compressImage(inputPath, outputPath);

        if (!compressed) {
            console.error('❌ Fallo en compresión');
            fs.unlinkSync(inputPath); // Limpiar archivo original
            return res.status(500).json({ error: 'Error al comprimir imagen' });
        }

        // Eliminar archivo original
        try {
            fs.unlinkSync(inputPath);
        } catch (e) {
            console.warn('⚠️ No se pudo eliminar archivo original:', e.message);
        }

        const stats = fs.statSync(outputPath);
        const baseUrl = getPublicBaseUrl(req);
        const url = `${baseUrl}/uploads/compressed-${filename}`;

        console.log(`✅ Imagen comprimida: compressed-${filename} (${stats.size} bytes)`);

        res.json({
            success: true,
            filename: `compressed-${filename}`,
            url,
            size: stats.size,
            message: 'Imagen subida exitosamente'
        });
    } catch (error) {
        console.error('❌ Error al subir imagen:', error.message);
        
        // Limpiar archivo en caso de error
        try {
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
        } catch (e) {
            console.warn('No se pudo limpiar archivo:', e.message);
        }
        
        res.status(500).json({ error: error.message || 'Error al subir la imagen' });
    }
});


// Obtener lista de imágenes
app.get('/api/services/images', authenticateToken, (req, res) => {
    try {
        const baseUrl = getPublicBaseUrl(req);
        const files = fs.readdirSync(uploadDir);
        const images = files.map(file => ({
            filename: file,
            url: `${baseUrl}/uploads/${file}`,
            size: fs.statSync(path.join(uploadDir, file)).size
        }));

        res.json({ images });
    } catch (error) {
        console.error('Error obteniendo imágenes:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eliminar imagen
app.delete('/api/services/images/:filename', authenticateToken, (req, res) => {
    try {
        const filename = req.params.filename;
        const filepath = path.join(uploadDir, filename);

        // Validar que el archivo está en la carpeta de uploads
        if (!path.resolve(filepath).startsWith(path.resolve(uploadDir))) {
            return res.status(400).json({ error: 'Acceso denegado' });
        }

        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        fs.unlinkSync(filepath);
        res.json({ success: true, message: 'Imagen eliminada' });
    } catch (error) {
        console.error('Error eliminando imagen:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== Rutas de contenido (datos de la página) =====

// Obtener datos de la página (sin autenticación para lectura pública)
app.get('/api/content/page-data', async (req, res) => {
    try {
        const data = await getOrCreatePageData();
        res.json(data);
    } catch (error) {
        console.error('Error obteniendo datos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta alternativa sin /api para compatibilidad
app.get('/content/page-data', async (req, res) => {
    try {
        const data = await getOrCreatePageData();
        res.json(data);
    } catch (error) {
        console.error('Error obteniendo datos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Guardar datos de página
app.post('/api/content/page-data', authenticateToken, async (req, res) => {
    try {
        const data = req.body;

        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'Datos inválidos' });
        }

        const saved = await savePageDataMongo(data);
        res.json({ success: true, message: 'Datos guardados', data: saved });
    } catch (error) {
        console.error('Error guardando datos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', server: 'running' });
});

// Manejo de errores de multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({ error: error.message });
    }
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error desconocido' });
});

// ===== Iniciar servidor =====

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor ejecutándose `);
});

module.exports = app;
