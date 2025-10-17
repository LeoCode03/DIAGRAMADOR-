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
            downloadBtn: document.getElementById('download-btn'),
            diagramsList: document.getElementById('diagrams-list'),
            diagramName: document.getElementById('diagram-name'),
            diagramNameInput: document.getElementById('diagram-name-input'),
            recentDiagrams: document.getElementById('recent-diagrams'),
            recentDiagramsList: document.getElementById('recent-diagrams-list'),
            viewAllDiagramsBtn: document.getElementById('view-all-diagrams'),
            headerDiagramControls: document.getElementById('header-diagram-controls'),
            // Elementos del menú lateral
            sidebarMenu: document.getElementById('sidebar-menu'),
            sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
            sidebarCloseBtn: document.getElementById('sidebar-close-btn')
        };

        // Debug: verificar que todos los elementos se encontraron
        console.log('DOM Elements found:', this.elements);

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
            
            // Establecer vista inicial explícitamente
            this.showView('home');
            
            // Restaurar estado del menú lateral (después de establecer la vista)
            this.restoreSidebarState();
            
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

        // Botones de Zoom
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                if (this.canvas) {
                    this.canvas.zoomIn();
                }
            });
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                if (this.canvas) {
                    this.canvas.zoomOut();
                }
            });
        }

        // Botón Home (en el header)
        const homeBtn = document.getElementById('header-home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                this.showView('home');
                // Forzar recarga de la lista de diagramas recientes
                setTimeout(() => {
                    this.loadRecentDiagrams();
                }, 100);
            });
        }

        // Botones de Deshacer/Rehacer
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                this.undo();
            });
        }

        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                this.redo();
            });
        }

        // Botón Descargar
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadDiagram();
            });
        }

        // Campo de nombre del diagrama
        const diagramNameInput = document.getElementById('diagram-name-input');
        if (diagramNameInput) {
            let originalName = diagramNameInput.value;
            
            // Guardar el nombre original cuando se enfoca el campo
            diagramNameInput.addEventListener('focus', () => {
                originalName = diagramNameInput.value;
            });
            
            // Manejar cambio al perder el foco
            diagramNameInput.addEventListener('blur', (e) => {
                const newName = e.target.value.trim();
                if (newName !== originalName && newName !== '') {
                    this.confirmNameChange(newName, originalName);
                } else if (newName === '') {
                    // Si está vacío, restaurar el nombre original
                    diagramNameInput.value = originalName;
                }
            });
            
            // Manejar Enter
            diagramNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const newName = e.target.value.trim();
                    if (newName !== originalName && newName !== '') {
                        e.target.blur(); // Esto activará el evento blur
                    } else if (newName === '') {
                        e.target.value = originalName;
                        e.target.blur();
                    }
                }
            });
        }

        // Botón Ver Todos los Diagramas
        if (this.elements.viewAllDiagramsBtn) {
            this.elements.viewAllDiagramsBtn.addEventListener('click', () => {
                this.showDiagramsList();
            });
        }

        // Menú lateral - Botón abrir
        if (this.elements.sidebarToggleBtn) {
            this.elements.sidebarToggleBtn.addEventListener('click', () => {
                this.openSidebar();
            });
        }

        // Menú lateral - Botón cerrar
        if (this.elements.sidebarCloseBtn) {
            this.elements.sidebarCloseBtn.addEventListener('click', () => {
                this.closeSidebar();
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
            
            // Cargar diagramas recientes inmediatamente
            await this.loadRecentDiagrams();
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
                id: 'diagram_' + Date.now(), // Generar ID único
                name: 'Nuevo Diagrama',
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

        // Configurar el input de nombre del diagrama
        if (this.elements.diagramNameInput && this.currentDiagram) {
            this.elements.diagramNameInput.value = this.currentDiagram.name;
        }

        // Inicializar canvas si no existe
        if (!this.canvas) {
            this.initializeCanvas();
        }

        // Cargar datos del diagrama en el canvas
        this.loadDiagramToCanvas();
        
        // Actualizar estado de botones de undo/redo
        this.updateUndoRedoButtons();
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
        if (!this.currentDiagram) {
            console.log('No current diagram to save');
            return;
        }

        try {
            this.elements.saveBtn.classList.add('loading');
            
            // Obtener el nombre del input
            const nameInput = this.elements.diagramNameInput;
            const diagramName = nameInput ? nameInput.value.trim() || 'Nuevo Diagrama' : 'Nuevo Diagrama';
            
            console.log('Saving diagram with name:', diagramName);
            console.log('Current diagram before save:', this.currentDiagram);
            
            // TODO: Obtener elementos actuales del canvas
            const elements = []; // this.canvas.getElements();
            
            const diagramData = {
                ...this.currentDiagram,
                name: diagramName,
                elements: elements,
                settings: {
                    ...this.currentDiagram.settings,
                    canvasState: this.canvas ? {
                        scale: this.canvas.getScale(),
                        translation: this.canvas.getTranslation()
                    } : {}
                }
            };

            console.log('Diagram data to save:', diagramData);
            
            const result = await this.storage.saveDiagram(diagramData);
            console.log('Save result:', result);
            
            if (result.success) {
                this.showSuccess('Diagrama guardado correctamente');
                this.currentDiagram._id = result.id;
                this.currentDiagram._rev = result.rev;
                this.currentDiagram.name = diagramName;
                
                console.log('Updated current diagram:', this.currentDiagram);
                
                // Actualizar el título mostrado
                this.updateDiagramDisplayName(diagramName);
                
                // Recargar la lista de diagramas recientes para cuando se vuelva al home
                setTimeout(() => {
                    console.log('Reloading recent diagrams after save...');
                    this.loadRecentDiagrams();
                }, 100);
            } else {
                console.error('Failed to save diagram:', result.error);
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
     * Actualiza el nombre del diagrama
     */
    updateDiagramName(name) {
        if (!name || !name.trim()) return;
        
        const trimmedName = name.trim();
        if (this.currentDiagram) {
            this.currentDiagram.name = trimmedName;
        }
        
        this.updateDiagramDisplayName(trimmedName);
    }

    /**
     * Actualiza el nombre mostrado en la interfaz
     */
    updateDiagramDisplayName(name) {
        if (this.elements.diagramName) {
            this.elements.diagramName.textContent = name;
        }
    }

    /**
     * Confirma el cambio de nombre del diagrama
     */
    confirmNameChange(newName, originalName) {
        const confirmed = confirm(`¿Deseas cambiar el nombre del diagrama de "${originalName}" a "${newName}"?`);
        
        if (confirmed) {
            console.log('User confirmed name change from', originalName, 'to', newName);
            
            // Actualizar el nombre del diagrama
            this.updateDiagramName(newName);
            
            // Guardar automáticamente el diagrama con el nuevo nombre
            this.saveDiagram().then(() => {
                this.showSuccess(`Nombre cambiado a "${newName}"`);
                console.log('Name change saved successfully');
                
                // Forzar recarga de la lista después de guardar
                setTimeout(() => {
                    console.log('Force reloading diagrams after name change...');
                    this.loadRecentDiagrams();
                }, 200);
                
            }).catch((error) => {
                console.error('Error saving name change:', error);
                this.showError('Error guardando el cambio de nombre');
                // Restaurar el nombre original si hay error
                if (this.elements.diagramNameInput) {
                    this.elements.diagramNameInput.value = originalName;
                }
            });
        } else {
            console.log('User cancelled name change');
            // Restaurar el nombre original si se cancela
            if (this.elements.diagramNameInput) {
                this.elements.diagramNameInput.value = originalName;
            }
        }
    }

    /**
     * Descarga el diagrama como archivo
     */
    async downloadDiagram() {
        try {
            if (!this.canvas) {
                this.showError('No hay diagrama para descargar');
                return;
            }

            // Obtener el SVG del canvas
            const svgElement = this.canvas.getSVG();
            if (!svgElement) {
                this.showError('Error obteniendo el diagrama');
                return;
            }

            // Obtener el nombre del diagrama
            const nameInput = this.elements.diagramNameInput;
            const diagramName = nameInput ? nameInput.value.trim() || 'diagrama' : 'diagrama';
            
            // Crear archivo SVG para descarga
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            
            // Crear enlace de descarga
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(svgBlob);
            downloadLink.download = `${diagramName}.svg`;
            
            // Activar descarga
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // Limpiar URL object
            URL.revokeObjectURL(downloadLink.href);
            
            this.showSuccess('Diagrama descargado correctamente');
            
        } catch (error) {
            console.error('Error descargando diagrama:', error);
            this.showError('Error descargando el diagrama');
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

        // Cargar diagramas recientes si estamos en la vista home
        if (viewName === 'home') {
            this.loadRecentDiagrams();
        }

        // Manejar visibilidad de los controles del diagrama en el header
        const headerDiagramControls = this.elements.headerDiagramControls;
        if (headerDiagramControls) {
            if (viewName === 'canvas') {
                headerDiagramControls.classList.remove('w3-hide');
            } else {
                headerDiagramControls.classList.add('w3-hide');
            }
        }

        // Manejar visibilidad del botón de menú lateral
        const sidebarToggleBtn = this.elements.sidebarToggleBtn;
        if (sidebarToggleBtn) {
            if (viewName === 'canvas') {
                sidebarToggleBtn.classList.remove('w3-hide');
            } else {
                sidebarToggleBtn.classList.add('w3-hide');
                // Cerrar el menú si estamos saliendo del canvas
                this.closeSidebar();
            }
        }
    }

    /**
     * Maneja atajos de teclado
     */
    handleKeyboard(event) {
        // Escape - Cerrar menú lateral
        if (event.key === 'Escape') {
            if (this.elements.sidebarMenu && this.elements.sidebarMenu.classList.contains('open')) {
                event.preventDefault();
                this.closeSidebar();
                return;
            }
        }

        // Ctrl+S - Guardar
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            if (this.currentView === 'canvas') {
                this.saveDiagram();
            }
        }

        // Ctrl+Z - Deshacer
        if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            if (this.currentView === 'canvas') {
                this.undo();
            }
        }

        // Ctrl+Y o Ctrl+Shift+Z - Rehacer
        if ((event.ctrlKey && event.key === 'y') || (event.ctrlKey && event.shiftKey && event.key === 'z')) {
            event.preventDefault();
            if (this.currentView === 'canvas') {
                this.redo();
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
     * Deshacer último cambio (Ctrl+Z)
     */
    undo() {
        // TODO: Implementar lógica de deshacer
        // Por ahora, solo mostrar mensaje en consola
        console.log('Undo action triggered');
        
        // Placeholder para futuro sistema de historial
        this.updateUndoRedoButtons();
    }

    /**
     * Rehacer último cambio deshecho (Ctrl+Y)
     */
    redo() {
        // TODO: Implementar lógica de rehacer
        // Por ahora, solo mostrar mensaje en consola
        console.log('Redo action triggered');
        
        // Placeholder para futuro sistema de historial
        this.updateUndoRedoButtons();
    }

    /**
     * Actualiza el estado de los botones de deshacer/rehacer
     */
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        // TODO: Habilitar/deshabilitar según el historial disponible
        // Por ahora, mantener habilitados
        if (undoBtn) {
            undoBtn.disabled = false; // Cambiar según historial
        }
        if (redoBtn) {
            redoBtn.disabled = false; // Cambiar según historial
        }
    }

    /**
     * Carga y muestra los diagramas recientes en la vista home
     */
    async loadRecentDiagrams() {
        try {
            console.log('=== LOADING RECENT DIAGRAMS ===');
            const result = await this.storage.getAllDiagrams();
            console.log('Storage result:', result);
            
            const recentContainer = this.elements.recentDiagrams;
            const recentList = this.elements.recentDiagramsList;
            
            console.log('Recent container element:', recentContainer);
            console.log('Recent list element:', recentList);
            
            if (!result.success) {
                console.log('Error getting diagrams:', result.error);
                if (recentContainer) {
                    recentContainer.classList.add('w3-hide');
                }
                return;
            }

            if (result.data.length === 0) {
                console.log('No diagrams found');
                // No hay diagramas, ocultar la sección
                if (recentContainer) {
                    recentContainer.classList.add('w3-hide');
                }
                return;
            }

            console.log('Found', result.data.length, 'diagrams');
            
            // Mostrar la sección de diagramas recientes
            if (recentContainer) {
                recentContainer.classList.remove('w3-hide');
                console.log('Showing recent diagrams container');
            }

            // Tomar solo los 3 más recientes
            const recentDiagrams = result.data.slice(0, 3);
            console.log('Recent diagrams to display:', recentDiagrams);
            
            if (recentList) {
                recentList.innerHTML = '';
                
                recentDiagrams.forEach(diagram => {
                    const item = document.createElement('div');
                    item.className = 'w3-card w3-margin-bottom w3-hover-light-grey';
                    item.style.cursor = 'pointer';
                    
                    const modifiedDate = new Date(diagram.modified).toLocaleDateString();
                    
                    item.innerHTML = `
                        <div class="w3-container w3-padding-small">
                            <div class="w3-row">
                                <div class="w3-col s10">
                                    <strong class="w3-text-dark-grey">${this.escapeHtml(diagram.name)}</strong>
                                    <br>
                                    <small class="w3-text-grey">Modificado: ${modifiedDate}</small>
                                </div>
                                <div class="w3-col s2 w3-center">
                                    <span class="w3-text-grey">📊</span>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    item.addEventListener('click', () => {
                        this.openDiagram(diagram.id);
                    });
                    
                    recentList.appendChild(item);
                });
            }
            
        } catch (error) {
            console.error('Error cargando diagramas recientes:', error);
        }
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

    /**
     * Abre el menú lateral
     */
    openSidebar() {
        if (this.elements.sidebarMenu) {
            this.elements.sidebarMenu.classList.add('open');
        }
        
        // Ocultar el botón de menú cuando el sidebar está abierto
        if (this.elements.sidebarToggleBtn) {
            this.elements.sidebarToggleBtn.classList.add('w3-hide');
        }
        
        // Guardar estado del menú
        localStorage.setItem('sidebarOpen', 'true');
        
        console.log('Sidebar opened');
    }

    /**
     * Cierra el menú lateral
     */
    closeSidebar() {
        if (this.elements.sidebarMenu) {
            this.elements.sidebarMenu.classList.remove('open');
        }
        
        // Mostrar el botón de menú solo si estamos en la vista canvas
        if (this.elements.sidebarToggleBtn && this.currentView === 'canvas') {
            this.elements.sidebarToggleBtn.classList.remove('w3-hide');
        }
        
        // Guardar estado del menú
        localStorage.setItem('sidebarOpen', 'false');
        
        console.log('Sidebar closed');
    }

    /**
     * Alterna el estado del menú lateral
     */
    toggleSidebar() {
        if (this.elements.sidebarMenu && this.elements.sidebarMenu.classList.contains('open')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    /**
     * Restaura el estado del menú desde localStorage
     */
    restoreSidebarState() {
        const wasOpen = localStorage.getItem('sidebarOpen') === 'true';
        // Solo restaurar el estado del sidebar si estamos en la vista canvas
        if (wasOpen && this.currentView === 'canvas') {
            this.openSidebar();
        }
    }

    /**
     * Función de debug para verificar el estado de PouchDB
     */
    async debugStorage() {
        console.log('=== DEBUG STORAGE ===');
        try {
            const info = await this.storage.db.info();
            console.log('PouchDB info:', info);
            
            const allDocs = await this.storage.db.allDocs({ include_docs: true });
            console.log('All documents in PouchDB:', allDocs);
            
            const diagrams = await this.storage.getAllDiagrams();
            console.log('Processed diagrams:', diagrams);
            
        } catch (error) {
            console.error('Debug storage error:', error);
        }
    }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DiagramadorApp();
});

// Exportar para uso global
window.DiagramadorApp = DiagramadorApp;