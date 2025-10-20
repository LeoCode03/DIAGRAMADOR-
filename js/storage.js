/**
 * storage.js
 * Gestión de persistencia de diagramas con PouchDB y fallback a localStorage
 */

const SCHEMA_VERSION = '1.0.0';
const STORAGE_KEY_PREFIX = 'diagramador_';
const STORAGE_LIST_KEY = STORAGE_KEY_PREFIX + 'list';

let db = null;
let useLocalStorage = false;

/**
 * Inicializa la base de datos
 * Intenta usar PouchDB, si falla usa localStorage
 */
async function initStorage() {
    try {
        if (typeof PouchDB !== 'undefined') {
            db = new PouchDB('diagramas');
            // Verificar que funciona
            await db.info();
            console.log('PouchDB inicializado correctamente');
            useLocalStorage = false;
        } else {
            throw new Error('PouchDB no disponible');
        }
    } catch (error) {
        console.warn('Error al inicializar PouchDB, usando localStorage:', error);
        useLocalStorage = true;
    }
}

/**
 * Crea un nuevo diagrama
 * @param {string} name - Nombre del diagrama
 * @returns {Promise<Object>} - Documento del diagrama creado
 */
async function createDiagram(name = 'Diagrama') {
    const timestamp = Date.now();
    const id = 'd-' + timestamp;
    
    // Verificar si el nombre ya existe y ajustarlo
    const existingNames = await getAllDiagramNames();
    let finalName = name;
    let counter = 1;
    
    while (existingNames.includes(finalName)) {
        finalName = `${name} (${counter})`;
        counter++;
    }
    
    const diagram = {
        _id: id,
        type: 'diagram',
        name: finalName,
        createdAt: timestamp,
        updatedAt: timestamp,
        schemaVersion: SCHEMA_VERSION,
        nodes: [],
        connections: [],
        metadata: {
            zoom: 100,
            panX: 0,
            panY: 0
        }
    };
    
    if (useLocalStorage) {
        return saveToLocalStorage(diagram);
    } else {
        try {
            const response = await db.put(diagram);
            diagram._rev = response.rev;
            return diagram;
        } catch (error) {
            console.error('Error al crear diagrama:', error);
            throw error;
        }
    }
}

/**
 * Obtiene todos los nombres de diagramas existentes
 */
async function getAllDiagramNames() {
    const diagrams = await listDiagrams();
    return diagrams.map(d => d.name);
}

/**
 * Obtiene un diagrama por su ID
 * @param {string} id - ID del diagrama
 * @returns {Promise<Object>} - Documento del diagrama
 */
async function getDiagram(id) {
    if (useLocalStorage) {
        return getFromLocalStorage(id);
    } else {
        try {
            return await db.get(id);
        } catch (error) {
            console.error('Error al obtener diagrama:', error);
            throw error;
        }
    }
}

/**
 * Actualiza un diagrama existente
 * @param {Object} diagram - Documento del diagrama a actualizar
 * @returns {Promise<Object>} - Documento actualizado
 */
async function updateDiagram(diagram) {
    diagram.updatedAt = Date.now();
    
    if (useLocalStorage) {
        return saveToLocalStorage(diagram);
    } else {
        try {
            const response = await db.put(diagram);
            diagram._rev = response.rev;
            return diagram;
        } catch (error) {
            console.error('Error al actualizar diagrama:', error);
            throw error;
        }
    }
}

/**
 * Elimina un diagrama
 * @param {string} id - ID del diagrama
 * @param {string} rev - Revisión del documento (solo para PouchDB)
 * @returns {Promise<boolean>} - true si se eliminó correctamente
 */
async function deleteDiagram(id, rev) {
    if (useLocalStorage) {
        return deleteFromLocalStorage(id);
    } else {
        try {
            await db.remove(id, rev);
            return true;
        } catch (error) {
            console.error('Error al eliminar diagrama:', error);
            throw error;
        }
    }
}

/**
 * Lista todos los diagramas
 * @returns {Promise<Array>} - Array de diagramas ordenados por fecha de actualización
 */
async function listDiagrams() {
    if (useLocalStorage) {
        return listFromLocalStorage();
    } else {
        try {
            const result = await db.allDocs({
                include_docs: true,
                descending: true
            });
            
            const diagrams = result.rows
                .map(row => row.doc)
                .filter(doc => doc.type === 'diagram')
                .sort((a, b) => b.updatedAt - a.updatedAt);
            
            return diagrams;
        } catch (error) {
            console.error('Error al listar diagramas:', error);
            return [];
        }
    }
}

/**
 * Exporta un diagrama a JSON
 * @param {string} id - ID del diagrama
 * @returns {Promise<string>} - JSON del diagrama
 */
async function exportDiagram(id) {
    const diagram = await getDiagram(id);
    
    // Crear copia limpia sin propiedades internas de PouchDB
    // Excluimos 'type' y 'schemaVersion' de la exportación
    const exportData = {
        _id: diagram._id,
        name: diagram.name,
        createdAt: diagram.createdAt,
        updatedAt: diagram.updatedAt,
        nodes: diagram.nodes,
        connections: diagram.connections,
        metadata: diagram.metadata
    };
    
    return JSON.stringify(exportData, null, 2);
}

/**
 * Importa un diagrama desde JSON
 * @param {string} jsonString - String JSON del diagrama
 * @param {string} mode - 'create', 'replace' o 'cancel'
 * @returns {Promise<Object>} - Diagrama importado
 */
async function importDiagram(jsonString, mode = 'create') {
    try {
        const diagram = JSON.parse(jsonString);
        
        // Validar estructura
        if (!validateDiagramSchema(diagram)) {
            throw new Error('El archivo JSON no tiene un formato válido');
        }
        
        // Agregar propiedades necesarias si no existen
        if (!diagram.type) {
            diagram.type = 'diagram';
        }
        if (!diagram.schemaVersion) {
            diagram.schemaVersion = 1;
        }
        
        // Verificar si ya existe
        const exists = await diagramExists(diagram._id);
        
        if (exists && mode === 'cancel') {
            throw new Error('El diagrama ya existe');
        }
        
        if (exists && mode === 'replace') {
            // Obtener el documento existente para tener el _rev
            const existing = await getDiagram(diagram._id);
            diagram._rev = existing._rev;
            return await updateDiagram(diagram);
        }
        
        // mode === 'create' o no existe
        if (exists || mode === 'create') {
            // Crear una copia con nuevo ID
            const timestamp = Date.now();
            diagram._id = 'd-' + timestamp;
            diagram.createdAt = timestamp;
            diagram.updatedAt = timestamp;
            delete diagram._rev;
            
            // Ajustar nombre si ya existe
            const existingNames = await getAllDiagramNames();
            let finalName = diagram.name;
            let counter = 1;
            
            while (existingNames.includes(finalName)) {
                finalName = `${diagram.name} (${counter})`;
                counter++;
            }
            diagram.name = finalName;
        }
        
        if (useLocalStorage) {
            return saveToLocalStorage(diagram);
        } else {
            const response = await db.put(diagram);
            diagram._rev = response.rev;
            return diagram;
        }
    } catch (error) {
        console.error('Error al importar diagrama:', error);
        throw error;
    }
}

/**
 * Verifica si un diagrama existe
 */
async function diagramExists(id) {
    try {
        await getDiagram(id);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Valida el esquema de un diagrama
 */
function validateDiagramSchema(diagram) {
    return diagram &&
        diagram._id &&
        diagram.name &&
        diagram.createdAt &&
        diagram.updatedAt &&
        Array.isArray(diagram.nodes) &&
        Array.isArray(diagram.connections) &&
        diagram.metadata;
}

// ==================== FUNCIONES DE LOCALSTORAGE ====================

/**
 * Guarda un diagrama en localStorage
 */
function saveToLocalStorage(diagram) {
    try {
        // Guardar el diagrama
        localStorage.setItem(STORAGE_KEY_PREFIX + diagram._id, JSON.stringify(diagram));
        
        // Actualizar la lista de IDs
        const list = getListFromLocalStorage();
        if (!list.includes(diagram._id)) {
            list.push(diagram._id);
            localStorage.setItem(STORAGE_LIST_KEY, JSON.stringify(list));
        }
        
        return diagram;
    } catch (error) {
        console.error('Error al guardar en localStorage:', error);
        throw error;
    }
}

/**
 * Obtiene un diagrama de localStorage
 */
function getFromLocalStorage(id) {
    try {
        const data = localStorage.getItem(STORAGE_KEY_PREFIX + id);
        if (!data) {
            throw new Error('Diagrama no encontrado');
        }
        return JSON.parse(data);
    } catch (error) {
        console.error('Error al leer de localStorage:', error);
        throw error;
    }
}

/**
 * Elimina un diagrama de localStorage
 */
function deleteFromLocalStorage(id) {
    try {
        localStorage.removeItem(STORAGE_KEY_PREFIX + id);
        
        // Actualizar la lista
        let list = getListFromLocalStorage();
        list = list.filter(item => item !== id);
        localStorage.setItem(STORAGE_LIST_KEY, JSON.stringify(list));
        
        return true;
    } catch (error) {
        console.error('Error al eliminar de localStorage:', error);
        throw error;
    }
}

/**
 * Lista todos los diagramas de localStorage
 */
function listFromLocalStorage() {
    try {
        const list = getListFromLocalStorage();
        const diagrams = [];
        
        for (const id of list) {
            try {
                const diagram = getFromLocalStorage(id);
                diagrams.push(diagram);
            } catch (error) {
                console.warn('Error al cargar diagrama:', id);
            }
        }
        
        return diagrams.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
        console.error('Error al listar de localStorage:', error);
        return [];
    }
}

/**
 * Obtiene la lista de IDs de localStorage
 */
function getListFromLocalStorage() {
    try {
        const data = localStorage.getItem(STORAGE_LIST_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        return [];
    }
}

// ==================== UTILIDADES ====================

/**
 * Descarga un archivo JSON
 */
function downloadJSON(filename, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Formatea una fecha en formato legible
 */
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Genera un nombre de archivo para exportación
 */
function generateExportFilename(diagramName) {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const safeName = diagramName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return `${safeName}_${dateStr}.json`;
}
