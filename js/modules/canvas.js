/**
 * DIAGRAMADOR-APP - Módulo Canvas SVG Interactivo
 * ===============================================
 * 
 * Módulo completo para un canvas SVG interactivo con fondo de puntos
 * para el diagramador de flujo. Incluye pan, zoom, grid de puntos y
 * todas las funcionalidades de navegación especificadas.
 * 
 * @author Universidad - Proyecto Web
 * @version 1.0.0
 */

class DiagramCanvas {
    constructor(containerId, options = {}) {
        // Configuración por defecto
        this.config = {
            // Canvas
            minZoom: 0.1,
            maxZoom: 10,
            zoomStep: 0.1,
            zoomSensitivity: 0.001,
            
            // Grid
            gridSpacing: 20,
            gridDotSize: 2,
            gridColor: '#cccccc',
            gridOpacity: 0.6,
            gridVisible: true,
            
            // Pan
            panSensitivity: 1,
            
            // Viewport inicial
            initialViewBox: { x: -500, y: -500, width: 1000, height: 1000 },
            
            ...options
        };

        // Estado del canvas
        this.state = {
            scale: 1,
            translateX: 0,
            translateY: 0,
            isPanning: false,
            lastPanPoint: { x: 0, y: 0 },
            viewBox: { ...this.config.initialViewBox }
        };

        // Referencias DOM
        this.container = document.getElementById(containerId);
        this.svg = null;
        this.grid = null;
        this.mainGroup = null;

        // Grid instance
        this.gridManager = new GridManager(this);

        // Inicializar
        this.init();
    }

    /**
     * Inicializa el canvas SVG
     */
    init() {
        if (!this.container) {
            throw new Error(`Container con id "${containerId}" no encontrado`);
        }

        this.createSVG();
        this.setupEventListeners();
        this.updateViewBox();
        this.gridManager.updateGrid();

        console.log('Canvas SVG inicializado correctamente');
    }

    /**
     * Crea la estructura SVG base
     */
    createSVG() {
        // Limpiar container
        this.container.innerHTML = '';

        // Crear SVG principal
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.id = 'main-canvas';
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');

        // Grupo principal para transformaciones
        this.mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.mainGroup.id = 'main-group';

        // Grupo para el grid
        this.grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.grid.id = 'grid-group';

        // Grupo para elementos del diagrama
        this.diagramGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.diagramGroup.id = 'diagram-group';

        // Estructura jerárquica
        this.mainGroup.appendChild(this.grid);
        this.mainGroup.appendChild(this.diagramGroup);
        this.svg.appendChild(this.mainGroup);
        this.container.appendChild(this.svg);
    }

    /**
     * Configura todos los event listeners
     */
    setupEventListeners() {
        // Zoom con rueda del ratón
        this.svg.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

        // Pan con ratón
        this.svg.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.svg.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.svg.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.svg.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

        // Eventos táctiles para dispositivos móviles
        this.svg.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.svg.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.svg.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Redimensionar ventana
        window.addEventListener('resize', this.handleResize.bind(this));

        // Prevenir menú contextual
        this.svg.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Maneja el evento de rueda del ratón para zoom
     */
    handleWheel(event) {
        event.preventDefault();

        const rect = this.svg.getBoundingClientRect();
        const clientX = event.clientX - rect.left;
        const clientY = event.clientY - rect.top;

        // Convertir a coordenadas SVG
        const svgPoint = this.clientToSVG(clientX, clientY);

        // Calcular nuevo zoom
        const zoomFactor = event.deltaY > 0 ? 
            (1 - this.config.zoomStep) : 
            (1 + this.config.zoomStep);

        this.zoomAtPoint(svgPoint.x, svgPoint.y, zoomFactor);
    }

    /**
     * Eventos de mouse para pan
     */
    handleMouseDown(event) {
        if (event.button === 0) { // Click izquierdo
            this.startPan(event.clientX, event.clientY);
        }
    }

    handleMouseMove(event) {
        if (this.state.isPanning) {
            this.updatePan(event.clientX, event.clientY);
        }
    }

    handleMouseUp(event) {
        this.endPan();
    }

    handleMouseLeave(event) {
        this.endPan();
    }

    /**
     * Eventos táctiles
     */
    handleTouchStart(event) {
        event.preventDefault();
        
        if (event.touches.length === 1) {
            // Pan con un dedo
            const touch = event.touches[0];
            this.startPan(touch.clientX, touch.clientY);
        } else if (event.touches.length === 2) {
            // Zoom con dos dedos (implementación básica)
            this.endPan();
            // TODO: Implementar zoom con gestos
        }
    }

    handleTouchMove(event) {
        event.preventDefault();
        
        if (event.touches.length === 1 && this.state.isPanning) {
            const touch = event.touches[0];
            this.updatePan(touch.clientX, touch.clientY);
        }
    }

    handleTouchEnd(event) {
        event.preventDefault();
        this.endPan();
    }

    /**
     * Maneja el redimensionamiento de la ventana
     */
    handleResize() {
        // Recalcular grid cuando cambia el tamaño
        this.gridManager.updateGrid();
    }

    /**
     * Inicia el proceso de pan
     */
    startPan(clientX, clientY) {
        this.state.isPanning = true;
        this.state.lastPanPoint = { x: clientX, y: clientY };
        this.svg.style.cursor = 'grabbing';
    }

    /**
     * Actualiza la posición durante el pan
     */
    updatePan(clientX, clientY) {
        if (!this.state.isPanning) return;

        const deltaX = (clientX - this.state.lastPanPoint.x) * this.config.panSensitivity;
        const deltaY = (clientY - this.state.lastPanPoint.y) * this.config.panSensitivity;

        // Aplicar desplazamiento
        this.state.translateX += deltaX / this.state.scale;
        this.state.translateY += deltaY / this.state.scale;

        this.state.lastPanPoint = { x: clientX, y: clientY };

        this.updateTransform();
        this.gridManager.updateGrid();
    }

    /**
     * Termina el proceso de pan
     */
    endPan() {
        this.state.isPanning = false;
        this.svg.style.cursor = 'grab';
    }

    /**
     * Aplica zoom en un punto específico
     */
    zoomAtPoint(svgX, svgY, zoomFactor) {
        const newScale = Math.max(
            this.config.minZoom,
            Math.min(this.config.maxZoom, this.state.scale * zoomFactor)
        );

        if (newScale !== this.state.scale) {
            // Calcular offset para zoom centrado en el punto
            const scaleDiff = newScale - this.state.scale;
            this.state.translateX -= (svgX * scaleDiff) / newScale;
            this.state.translateY -= (svgY * scaleDiff) / newScale;
            
            this.state.scale = newScale;
            
            this.updateTransform();
            this.gridManager.updateGrid();
        }
    }

    /**
     * Actualiza la transformación del grupo principal
     */
    updateTransform() {
        const transform = `scale(${this.state.scale}) translate(${this.state.translateX}, ${this.state.translateY})`;
        this.mainGroup.setAttribute('transform', transform);
    }

    /**
     * Actualiza el viewBox del SVG
     */
    updateViewBox() {
        const vb = this.state.viewBox;
        this.svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
    }

    /**
     * Convierte coordenadas de cliente a coordenadas SVG
     */
    clientToSVG(clientX, clientY) {
        const rect = this.svg.getBoundingClientRect();
        const svgX = (clientX - rect.left - rect.width / 2) / this.state.scale - this.state.translateX;
        const svgY = (clientY - rect.top - rect.height / 2) / this.state.scale - this.state.translateY;
        
        return { x: svgX, y: svgY };
    }

    /**
     * Convierte coordenadas SVG a coordenadas de cliente
     */
    svgToClient(svgX, svgY) {
        const rect = this.svg.getBoundingClientRect();
        const clientX = (svgX + this.state.translateX) * this.state.scale + rect.width / 2 + rect.left;
        const clientY = (svgY + this.state.translateY) * this.state.scale + rect.height / 2 + rect.top;
        
        return { x: clientX, y: clientY };
    }

    /**
     * Función snap para alinear a los puntos del grid
     */
    snapToGrid(svgX, svgY) {
        if (!this.config.gridVisible) return { x: svgX, y: svgY };

        const spacing = this.config.gridSpacing;
        const snappedX = Math.round(svgX / spacing) * spacing;
        const snappedY = Math.round(svgY / spacing) * spacing;

        return { x: snappedX, y: snappedY };
    }

    /**
     * Centra la vista en coordenadas específicas
     */
    centerOn(svgX, svgY) {
        this.state.translateX = -svgX;
        this.state.translateY = -svgY;
        
        this.updateTransform();
        this.gridManager.updateGrid();
    }

    /**
     * Reestablece la vista a la configuración inicial
     */
    resetView() {
        this.state.scale = 1;
        this.state.translateX = 0;
        this.state.translateY = 0;
        
        this.updateTransform();
        this.gridManager.updateGrid();
    }

    /**
     * Ajusta la vista para mostrar todo el contenido
     */
    fitToContent() {
        // TODO: Implementar lógica para ajustar a todo el contenido
        console.log('fitToContent - Pendiente de implementar');
    }

    /**
     * Métodos públicos para interactuar con el grid
     */
    toggleGrid() {
        this.config.gridVisible = !this.config.gridVisible;
        this.gridManager.setVisible(this.config.gridVisible);
    }

    setGridSpacing(spacing) {
        this.config.gridSpacing = spacing;
        this.gridManager.updateGrid();
    }

    setGridColor(color) {
        this.config.gridColor = color;
        this.gridManager.updateGrid();
    }

    /**
     * Getters para acceder al estado
     */
    getScale() {
        return this.state.scale;
    }

    getTranslation() {
        return { x: this.state.translateX, y: this.state.translateY };
    }

    getViewBox() {
        return { ...this.state.viewBox };
    }

    /**
     * Destructor para limpiar event listeners
     */
    destroy() {
        window.removeEventListener('resize', this.handleResize.bind(this));
        this.container.innerHTML = '';
        console.log('Canvas destruido');
    }
}

/**
 * Gestor del Grid de Puntos
 * =========================
 */
class GridManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.dots = [];
        this.isVisible = canvas.config.gridVisible;
    }

    /**
     * Actualiza la visualización del grid
     */
    updateGrid() {
        if (!this.isVisible) {
            this.clearGrid();
            return;
        }

        this.clearGrid();
        this.createVisibleDots();
    }

    /**
     * Crea solo los puntos visibles dentro del viewport
     */
    createVisibleDots() {
        const rect = this.canvas.svg.getBoundingClientRect();
        const scale = this.canvas.state.scale;
        const spacing = this.canvas.config.gridSpacing;
        
        // Calcular área visible en coordenadas SVG
        const topLeft = this.canvas.clientToSVG(0, 0);
        const bottomRight = this.canvas.clientToSVG(rect.width, rect.height);

        // Expandir área para incluir puntos parcialmente visibles
        const margin = spacing * 2;
        const startX = Math.floor((topLeft.x - margin) / spacing) * spacing;
        const endX = Math.ceil((bottomRight.x + margin) / spacing) * spacing;
        const startY = Math.floor((topLeft.y - margin) / spacing) * spacing;
        const endY = Math.ceil((bottomRight.y + margin) / spacing) * spacing;

        // Ajustar densidad según el zoom
        let step = spacing;
        if (scale < 0.3) {
            step = spacing * 4; // Menos denso en zoom alejado
        } else if (scale < 0.6) {
            step = spacing * 2;
        }

        // Crear puntos
        for (let x = startX; x <= endX; x += step) {
            for (let y = startY; y <= endY; y += step) {
                this.createDot(x, y);
            }
        }
    }

    /**
     * Crea un punto individual del grid
     */
    createDot(x, y) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y);
        dot.setAttribute('r', this.canvas.config.gridDotSize);
        dot.setAttribute('class', 'grid-dot');
        dot.style.fill = this.canvas.config.gridColor;
        dot.style.opacity = this.canvas.config.gridOpacity;

        this.canvas.grid.appendChild(dot);
        this.dots.push(dot);
    }

    /**
     * Limpia todos los puntos del grid
     */
    clearGrid() {
        this.canvas.grid.innerHTML = '';
        this.dots = [];
    }

    /**
     * Muestra u oculta el grid
     */
    setVisible(visible) {
        this.isVisible = visible;
        this.canvas.grid.style.display = visible ? 'block' : 'none';
        
        if (visible) {
            this.updateGrid();
        } else {
            this.clearGrid();
        }
    }

    /**
     * Resalta un punto específico (útil para snap)
     */
    highlightPoint(x, y) {
        // Remover highlights anteriores
        this.clearHighlights();

        // Encontrar el punto más cercano
        const snapPoint = this.canvas.snapToGrid(x, y);
        
        // TODO: Implementar highlight visual
        console.log(`Highlighting point at ${snapPoint.x}, ${snapPoint.y}`);
    }

    /**
     * Limpia todos los highlights
     */
    clearHighlights() {
        this.dots.forEach(dot => {
            dot.classList.remove('highlighted');
        });
    }
}

// Exportar para uso en otros módulos
window.DiagramCanvas = DiagramCanvas;
window.GridManager = GridManager;