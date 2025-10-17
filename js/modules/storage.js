/**
 * DIAGRAMADOR-APP - Módulo de Almacenamiento
 * ==========================================
 * 
 * Maneja el almacenamiento de diagramas usando PouchDB y Web Storage
 * Incluye funcionalidades para guardar, cargar, listar y eliminar diagramas
 * 
 * @author Universidad - Proyecto Web
 * @version 1.0.0
 */

class StorageManager {
    constructor() {
        // Inicializar PouchDB para almacenamiento local
        this.db = new PouchDB('diagramador_db');
        
        // Configuración
        this.config = {
            maxDiagrams: 50, // Límite de diagramas almacenados
            autoSave: true,
            autoSaveInterval: 30000, // 30 segundos
        };

        // Estado
        this.currentDiagram = null;
        this.autoSaveTimer = null;

        this.init();
    }

    /**
     * Inicializa el sistema de almacenamiento
     */
    async init() {
        try {
            // Verificar si PouchDB está funcionando
            await this.db.info();
            console.log('Storage Manager inicializado correctamente');
            
            // Configurar auto-guardado si está habilitado
            if (this.config.autoSave) {
                this.startAutoSave();
            }
        } catch (error) {
            console.error('Error inicializando storage:', error);
            // Fallback a localStorage si PouchDB falla
            this.fallbackToLocalStorage();
        }
    }

    /**
     * Guarda un diagrama
     */
    async saveDiagram(diagramData) {
        try {
            const diagram = {
                _id: diagramData.id || this.generateId(),
                name: diagramData.name || `Diagrama ${new Date().toLocaleDateString()}`,
                elements: diagramData.elements || [],
                metadata: {
                    created: diagramData.metadata?.created || new Date().toISOString(),
                    modified: new Date().toISOString(),
                    version: '1.0.0'
                },
                settings: {
                    gridVisible: diagramData.settings?.gridVisible || true,
                    gridSpacing: diagramData.settings?.gridSpacing || 20,
                    canvasState: diagramData.settings?.canvasState || {}
                }
            };

            // Si es una actualización, obtener la revisión actual
            if (diagram._id && diagram._id !== 'new') {
                try {
                    const existing = await this.db.get(diagram._id);
                    diagram._rev = existing._rev;
                } catch (e) {
                    // El documento no existe, crear uno nuevo
                }
            }

            const result = await this.db.put(diagram);
            
            // Actualizar diagrama actual
            this.currentDiagram = { ...diagram, _rev: result.rev };
            
            console.log('Diagrama guardado:', result.id);
            
            // Guardar referencia en localStorage para acceso rápido
            this.saveToLocalStorage('lastDiagram', diagram._id);
            
            return { success: true, id: result.id, rev: result.rev };
            
        } catch (error) {
            console.error('Error guardando diagrama:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Carga un diagrama por ID
     */
    async loadDiagram(diagramId) {
        try {
            const diagram = await this.db.get(diagramId);
            this.currentDiagram = diagram;
            
            console.log('Diagrama cargado:', diagram._id);
            return { success: true, data: diagram };
            
        } catch (error) {
            console.error('Error cargando diagrama:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtiene la lista de todos los diagramas
     */
    async getAllDiagrams() {
        try {
            const result = await this.db.allDocs({
                include_docs: true,
                descending: true // Más recientes primero
            });

            const diagrams = result.rows.map(row => ({
                id: row.doc._id,
                name: row.doc.name,
                created: row.doc.metadata.created,
                modified: row.doc.metadata.modified,
                elementsCount: row.doc.elements.length
            }));

            return { success: true, data: diagrams };
            
        } catch (error) {
            console.error('Error obteniendo diagramas:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Elimina un diagrama
     */
    async deleteDiagram(diagramId) {
        try {
            const diagram = await this.db.get(diagramId);
            await this.db.remove(diagram);
            
            // Si era el diagrama actual, limpiar referencia
            if (this.currentDiagram && this.currentDiagram._id === diagramId) {
                this.currentDiagram = null;
            }
            
            console.log('Diagrama eliminado:', diagramId);
            return { success: true };
            
        } catch (error) {
            console.error('Error eliminando diagrama:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Duplica un diagrama existente
     */
    async duplicateDiagram(diagramId) {
        try {
            const original = await this.db.get(diagramId);
            
            const duplicate = {
                _id: this.generateId(),
                name: `${original.name} (Copia)`,
                elements: JSON.parse(JSON.stringify(original.elements)), // Deep copy
                metadata: {
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    version: original.metadata.version
                },
                settings: { ...original.settings }
            };

            const result = await this.db.put(duplicate);
            
            console.log('Diagrama duplicado:', result.id);
            return { success: true, id: result.id };
            
        } catch (error) {
            console.error('Error duplicando diagrama:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Exporta un diagrama a JSON
     */
    async exportDiagram(diagramId, format = 'json') {
        try {
            const diagram = await this.db.get(diagramId);
            
            // Limpiar metadatos internos para exportación
            const exportData = {
                name: diagram.name,
                elements: diagram.elements,
                settings: diagram.settings,
                metadata: {
                    exported: new Date().toISOString(),
                    version: diagram.metadata.version,
                    source: 'DIAGRAMADOR-APP'
                }
            };

            if (format === 'json') {
                return {
                    success: true,
                    data: JSON.stringify(exportData, null, 2),
                    filename: `${diagram.name.replace(/[^a-z0-9]/gi, '_')}.json`
                };
            }

            return { success: false, error: 'Formato no soportado' };
            
        } catch (error) {
            console.error('Error exportando diagrama:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Importa un diagrama desde JSON
     */
    async importDiagram(jsonData, filename = null) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            // Validar estructura
            if (!data.elements || !Array.isArray(data.elements)) {
                throw new Error('Formato de archivo inválido');
            }

            const diagram = {
                _id: this.generateId(),
                name: data.name || filename || `Diagrama Importado ${new Date().toLocaleDateString()}`,
                elements: data.elements,
                metadata: {
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    version: '1.0.0',
                    imported: true,
                    originalSource: data.metadata?.source || 'unknown'
                },
                settings: data.settings || {
                    gridVisible: true,
                    gridSpacing: 20,
                    canvasState: {}
                }
            };

            const result = await this.db.put(diagram);
            
            console.log('Diagrama importado:', result.id);
            return { success: true, id: result.id };
            
        } catch (error) {
            console.error('Error importando diagrama:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Auto-guardado del diagrama actual
     */
    async autoSaveDiagram() {
        if (this.currentDiagram && this.config.autoSave) {
            console.log('Auto-guardando diagrama...');
            await this.saveDiagram(this.currentDiagram);
        }
    }

    /**
     * Inicia el timer de auto-guardado
     */
    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        this.autoSaveTimer = setInterval(() => {
            this.autoSaveDiagram();
        }, this.config.autoSaveInterval);
    }

    /**
     * Detiene el auto-guardado
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * Limpia la base de datos (mantiene solo los últimos N diagramas)
     */
    async cleanupDatabase() {
        try {
            const result = await this.db.allDocs({
                include_docs: true,
                descending: true
            });

            if (result.rows.length > this.config.maxDiagrams) {
                const toDelete = result.rows.slice(this.config.maxDiagrams);
                
                for (const row of toDelete) {
                    await this.db.remove(row.doc);
                }
                
                console.log(`Limpieza completada: ${toDelete.length} diagramas eliminados`);
            }
            
        } catch (error) {
            console.error('Error en limpieza de base de datos:', error);
        }
    }

    /**
     * Utilidades de localStorage como fallback
     */
    saveToLocalStorage(key, value) {
        try {
            localStorage.setItem(`diagramador_${key}`, JSON.stringify(value));
        } catch (error) {
            console.warn('Error guardando en localStorage:', error);
        }
    }

    loadFromLocalStorage(key) {
        try {
            const item = localStorage.getItem(`diagramador_${key}`);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.warn('Error cargando de localStorage:', error);
            return null;
        }
    }

    /**
     * Fallback a localStorage si PouchDB no está disponible
     */
    fallbackToLocalStorage() {
        console.warn('Usando localStorage como fallback');
        // Implementar métodos simplificados usando localStorage
        // TODO: Implementar fallback completo si es necesario
    }

    /**
     * Genera un ID único para los diagramas
     */
    generateId() {
        return `diagram_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Obtiene estadísticas de la base de datos
     */
    async getStats() {
        try {
            const info = await this.db.info();
            const allDocs = await this.db.allDocs();
            
            return {
                totalDiagrams: allDocs.total_rows,
                dbSize: info.sizes?.file || 0,
                lastUpdate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            return null;
        }
    }

    /**
     * Destructor
     */
    destroy() {
        this.stopAutoSave();
        if (this.db) {
            this.db.close();
        }
    }
}

// Exportar para uso global
window.StorageManager = StorageManager;