const mongoose = require('mongoose');

// ===== Schema de Servicios =====
const serviceSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String, // URL de la imagen
        default: null
    },
    imageFilename: {
        type: String, // Nombre del archivo en servidor
        default: null
    },
    active: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// ===== Schema de Datos de Página =====
const pageDataSchema = new mongoose.Schema({
    hero: {
        title: String,
        subtitle: String,
        description: String
    },
    about: {
        text1: String,
        text2: String,
        features: [String]
    },
    services: [serviceSchema],
    testimonials: [{
        name: String,
        position: String,
        text: String,
        active: { type: Boolean, default: true }
    }],
    contact: {
        whatsapp: String,
        email: String,
        instagram: String,
        tiktok: String,
        linkedin: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// ===== Schema de Imágenes =====
const imageSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true,
        unique: true
    },
    originalName: String,
    url: String,
    size: Number,
    width: Number,
    height: Number,
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

// ===== Modelos =====
const Service = mongoose.model('Service', serviceSchema);
const PageData = mongoose.model('PageData', pageDataSchema);
const Image = mongoose.model('Image', imageSchema);

module.exports = {
    Service,
    PageData,
    Image
};
