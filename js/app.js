/**
 * DIAGRAMADOR-APP - Aplicación Principal
 * =====================================
 * 
 * Archivo principal que maneja la navegación entre vistas,
 * inicialización de módulos y lógica general de la aplicación.
 * 
 * @author Universidad - Proyecto Web
 * @version 1.0.0
 */

class DiagramadorApp {
    constructor() {
        // Referencias a los módulos
        this.storage = null;
        this.canvas = null;
        
        // Estado de la aplicación
        this.currentView = 'home';
        this.currentDiagram = null;
        
        // Referencias DOM
        this.views = {
            home: document.getElementById('home-view'),
            diagramsList: document.getElementById('diagrams-list-view'),
            canvas: document.getElementById('canvas-view')
        };
        
        this.elements = {
            addDiagramBtn: document.getElementById('add-diagram-btn'),
            newDiagramBtn: document.getElementById('new-diagram-btn'),
            backBtn: document.getElementById('back-btn'),
            saveBtn: document.getElementById('save-btn'),
            diagramsList: document.getElementById('diagrams-list'),
            diagramName: document.getElementById('diagram-name')
        };

        this.init();
    }

    /**
     * Inicializa la aplicación
     */
    async init() {
        console.log('Inicializando DIAGRAMADOR-APP...');

        try {
            // Inicializar módulos
            await this.initializeModules();
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Cargar datos iniciales
            await this.loadInitialData();
            
            console.log('Aplicación inicializada correctamente');
            
        } catch (error) {
            console.error('Error inicializando aplicación:', error);
            this.showError('Error inicializando la aplicación');
        }
    }

    /**
     * Inicializa los módulos de la aplicación
     */
    async initializeModules() {
        // Inicializar Storage Manager
        this.storage = new StorageManager();
        
        // El canvas se inicializará cuando se necesite
        console.log('Módulos inicializados');
    }

    /**
     * Configura todos los event listeners
     */
    setupEventListeners() {
        // Botón principal "Agregar Diagrama"
        if (this.elements.addDiagramBtn) {
            this.elements.addDiagramBtn.addEventListener('click', () => {
                this.handleAddDiagram();
            });
        }

        // Botón "Nuevo Diagrama" en la vista de lista
        if (this.elements.newDiagramBtn) {
            this.elements.newDiagramBtn.addEventListener('click', () => {
                this.createNewDiagram();
            });
        }

        // Botón "Volver"
        if (this.elements.backBtn) {
            this.elements.backBtn.addEventListener('click', () => {
                this.goBack();
            });
        }

        // Botón "Guardar"
        if (this.elements.saveBtn) {
            this.elements.saveBtn.addEventListener('click', () => {
                this.saveDiagram();
            });
        }

        // Atajos de teclado
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });

        // Prevenir cierre accidental
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        console.log('Event listeners configurados');
    }

    /**
     * Carga datos iniciales de la aplicación
     */
    async loadInitialData() {
        // Verificar si hay diagramas guardados
        const result = await this.storage.getAllDiagrams();
        
        if (result.success && result.data.length > 0) {
            // Hay diagramas existentes, mostrar lista
            console.log(`${result.data.length} diagramas encontrados`);
        } else {
            // No hay diagramas, mantener vista de inicio
            console.log('No hay diagramas guardados');
        }
    }

    /**
     * Maneja el clic en el botón principal "Agregar"
     */
    async handleAddDiagram() {
        // Verificar si existen diagramas
        const result = await this.storage.getAllDiagrams();
        
        if (result.success && result.data.length > 0) {
            // Hay diagramas existentes, mostrar lista
            this.showDiagramsList();
        } else {
            // No hay diagramas, crear uno nuevo directamente
            this.createNewDiagram();
        }
    }

    /**
     * Muestra la vista de lista de diagramas
     */
    async showDiagramsList() {
        try {
            this.showView('diagramsList');
            await this.renderDiagramsList();
        } catch (error) {
            console.error('Error mostrando lista de diagramas:', error);
            this.showError('Error cargando la lista de diagramas');
        }
    }

    /**
     * Renderiza la lista de diagramas
     */
    async renderDiagramsList() {
        const result = await this.storage.getAllDiagrams();
        
        if (!result.success) {
            this.showError('Error cargando diagramas');
            return;
        }

        const listContainer = this.elements.diagramsList;
        listContainer.innerHTML = '';

        if (result.data.length === 0) {
            listContainer.innerHTML = `
                <div class="w3-center w3-padding">
                    <p class="w3-text-grey">No hay diagramas creados aún</p>
                </div>
            `;
            return;
        }

        result.data.forEach(diagram => {
            const diagramElement = this.createDiagramListItem(diagram);
            listContainer.appendChild(diagramElement);
        });
    }

    /**
     * Crea un elemento de la lista de diagramas
     */
    createDiagramListItem(diagram) {
        const item = document.createElement('div');
        item.className = 'diagram-item w3-hover-light-grey';
        
        const createdDate = new Date(diagram.created).toLocaleDateString();
        const modifiedDate = new Date(diagram.modified).toLocaleDateString();
        
        item.innerHTML = `
            <div class="diagram-preview">
                📊
            </div>
            <div class="diagram-info">
                <div class="diagram-title">${this.escapeHtml(diagram.name)}</div>
                <div class="diagram-date">
                    Creado: ${createdDate} | 
                    Modificado: ${modifiedDate} | 
                    Elementos: ${diagram.elementsCount}
                </div>
            </div>
            <div class="diagram-actions">
                <button class="w3-button w3-small w3-blue" onclick="app.openDiagram('${diagram.id}')">
                    Abrir
                </button>
                <button class="w3-button w3-small w3-grey" onclick="app.duplicateDiagram('${diagram.id}')">
                    Duplicar
                </button>
                <button class="w3-button w3-small w3-red" onclick="app.deleteDiagram('${diagram.id}')">
                    Eliminar
                </button>
            </div>
        `;

        // Event listener para abrir al hacer clic en el elemento
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.diagram-actions')) {
                this.openDiagram(diagram.id);
            }
        });

        return item;
    }

    /**
     * Crea un nuevo diagrama
     */
    async createNewDiagram() {
        try {
            const newDiagram = {
                id: 'new',
                name: `Nuevo Diagrama ${new Date().toLocaleDateString()}`,
                elements: [],
                settings: {
                    gridVisible: true,
                    gridSpacing: 20,
                    canvasState: {}
                }
            };

            this.currentDiagram = newDiagram;
            this.openCanvasView();
            
        } catch (error) {
            console.error('Error creando nuevo diagrama:', error);
            this.showError('Error creando nuevo diagrama');
        }
    }

    /**
     * Abre un diagrama existente
     */
    async openDiagram(diagramId) {
        try {
            const result = await this.storage.loadDiagram(diagramId);
            
            if (result.success) {
                this.currentDiagram = result.data;
                this.openCanvasView();
            } else {
                this.showError('Error cargando el diagrama');
            }
            
        } catch (error) {
            console.error('Error abriendo diagrama:', error);
            this.showError('Error abriendo el diagrama');
        }
    }

    /**
     * Abre la vista del canvas
     */
    openCanvasView() {
        this.showView('canvas');
        
        // Actualizar nombre del diagrama
        if (this.elements.diagramName && this.currentDiagram) {
            this.elements.diagramName.textContent = this.currentDiagram.name;
        }

        // Inicializar canvas si no existe
        if (!this.canvas) {
            this.initializeCanvas();
        }

        // Cargar datos del diagrama en el canvas
        this.loadDiagramToCanvas();
    }

    /**
     * Inicializa el canvas SVG
     */
    initializeCanvas() {
        try {
            this.canvas = new DiagramCanvas('canvas-container', {
                gridVisible: this.currentDiagram?.settings?.gridVisible || true,
                gridSpacing: this.currentDiagram?.settings?.gridSpacing || 20
            });
            
            console.log('Canvas inicializado');
            
        } catch (error) {
            console.error('Error inicializando canvas:', error);
            this.showError('Error inicializando el canvas');
        }
    }

    /**
     * Carga los datos del diagrama en el canvas
     */
    loadDiagramToCanvas() {
        if (!this.canvas || !this.currentDiagram) return;

        // TODO: Cargar elementos del diagrama en el canvas
        console.log('Cargando diagrama en canvas:', this.currentDiagram.name);
        
        // Aplicar configuraciones del diagrama
        if (this.currentDiagram.settings?.canvasState) {
            // TODO: Restaurar estado del canvas (zoom, pan, etc.)
        }
    }

    /**
     * Guarda el diagrama actual
     */
    async saveDiagram() {
        if (!this.currentDiagram) return;

        try {
            this.elements.saveBtn.classList.add('loading');
            
            // TODO: Obtener elementos actuales del canvas
            const elements = []; // this.canvas.getElements();
            
            const diagramData = {
                ...this.currentDiagram,
                elements: elements,
                settings: {
                    ...this.currentDiagram.settings,
                    canvasState: this.canvas ? {
                        scale: this.canvas.getScale(),
                        translation: this.canvas.getTranslation()
                    } : {}
                }
            };

            const result = await this.storage.saveDiagram(diagramData);
            
            if (result.success) {
                this.showSuccess('Diagrama guardado correctamente');
                this.currentDiagram._id = result.id;
                this.currentDiagram._rev = result.rev;
            } else {
                this.showError('Error guardando el diagrama');
            }
            
        } catch (error) {
            console.error('Error guardando diagrama:', error);
            this.showError('Error guardando el diagrama');
        } finally {
            this.elements.saveBtn.classList.remove('loading');
        }
    }

    /**
     * Duplica un diagrama
     */
    async duplicateDiagram(diagramId) {
        try {
            const result = await this.storage.duplicateDiagram(diagramId);
            
            if (result.success) {
                this.showSuccess('Diagrama duplicado correctamente');
                await this.renderDiagramsList(); // Actualizar lista
            } else {
                this.showError('Error duplicando el diagrama');
            }
            
        } catch (error) {
            console.error('Error duplicando diagrama:', error);
            this.showError('Error duplicando el diagrama');
        }
    }

    /**
     * Elimina un diagrama
     */
    async deleteDiagram(diagramId) {
        if (!confirm('¿Estás seguro de que quieres eliminar este diagrama?')) {
            return;
        }

        try {
            const result = await this.storage.deleteDiagram(diagramId);
            
            if (result.success) {
                this.showSuccess('Diagrama eliminado correctamente');
                await this.renderDiagramsList(); // Actualizar lista
            } else {
                this.showError('Error eliminando el diagrama');
            }
            
        } catch (error) {
            console.error('Error eliminando diagrama:', error);
            this.showError('Error eliminando el diagrama');
        }
    }

    /**
     * Navega hacia atrás
     */
    goBack() {
        if (this.currentView === 'canvas') {
            if (this.hasUnsavedChanges()) {
                if (confirm('Hay cambios sin guardar. ¿Quieres guardar antes de salir?')) {
                    this.saveDiagram().then(() => {
                        this.goToHomeOrList();
                    });
                    return;
                }
            }
            this.goToHomeOrList();
        } else if (this.currentView === 'diagramsList') {
            this.showView('home');
        }
    }

    /**
     * Va a la vista de inicio o lista según corresponda
     */
    async goToHomeOrList() {
        const result = await this.storage.getAllDiagrams();
        
        if (result.success && result.data.length > 0) {
            this.showDiagramsList();
        } else {
            this.showView('home');
        }
    }

    /**
     * Cambia entre vistas
     */
    showView(viewName) {
        // Ocultar todas las vistas
        Object.values(this.views).forEach(view => {
            if (view) {
                view.classList.add('w3-hide');
                view.classList.remove('fade-in');
            }
        });

        // Mostrar vista solicitada
        const targetView = this.views[viewName];
        if (targetView) {
            targetView.classList.remove('w3-hide');
            targetView.classList.add('fade-in');
            this.currentView = viewName;
        }
    }

    /**
     * Maneja atajos de teclado
     */
    handleKeyboard(event) {
        // Ctrl+S - Guardar
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            if (this.currentView === 'canvas') {
                this.saveDiagram();
            }
        }

        // Escape - Volver
        if (event.key === 'Escape') {
            this.goBack();
        }

        // Ctrl+N - Nuevo diagrama
        if (event.ctrlKey && event.key === 'n') {
            event.preventDefault();
            this.createNewDiagram();
        }
    }

    /**
     * Verifica si hay cambios sin guardar
     */
    hasUnsavedChanges() {
        // TODO: Implementar lógica para detectar cambios
        return false;
    }

    /**
     * Utilidades para mostrar mensajes
     */
    showSuccess(message) {
        console.log('✅', message);
        // TODO: Implementar notificaciones visuales
    }

    showError(message) {
        console.error('❌', message);
        // TODO: Implementar notificaciones visuales
        alert(message); // Temporal
    }

    showInfo(message) {
        console.info('ℹ️', message);
        // TODO: Implementar notificaciones visuales
    }

    /**
     * Escapa HTML para prevenir XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Destructor de la aplicación
     */
    destroy() {
        if (this.storage) {
            this.storage.destroy();
        }
        if (this.canvas) {
            this.canvas.destroy();
        }
    }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DiagramadorApp();
});

// Exportar para uso global
window.DiagramadorApp = DiagramadorApp;