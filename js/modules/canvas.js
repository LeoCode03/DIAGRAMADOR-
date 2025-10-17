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
            minZoom: 0.5,  // 50%
            maxZoom: 1.5,  // 150%
            zoomStep: 0.05, // 5% por clic (reducido de 0.1)
            zoomSensitivity: 0.001,
            
            // Grid - Deshabilitado por solicitud del usuario
            gridSpacing: 15,  
            gridDotSize: 2.0,
            gridColor: '#cccccc',
            gridOpacity: 0.5,
            gridVisible: false, // Cambiado a false para eliminar los puntos
            
            // Pan
            panSensitivity: 1,
            
            // Viewport inicial - Centrado en (0,0) con área optimizada para pantalla completa
            initialViewBox: { x: -800, y: -600, width: 1600, height: 1200 },
            
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

        // Grid instance - DESHABILITADO
        this.gridManager = null; // No inicializar GridManager

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
        // this.gridManager.updateGrid(); // COMENTADO - Sin grid
        
        // Inicializar la UI del zoom
        this.updateZoomUI();
        
        // Configurar interactividad del zoom
        setTimeout(() => {
            this.setupZoomInteractivity();
        }, 100); // Pequeño delay para asegurar que el DOM esté listo

        console.log('Canvas SVG inicializado correctamente (sin grid)');
    }

    /**
     * Crea la estructura SVG base
     */
    createSVG() {
        // Limpiar container
        this.container.innerHTML = '';

        // Crear SVG principal con configuración optimizada para pantalla completa
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.id = 'main-canvas';
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        this.svg.style.display = 'block'; // Evitar espacios en blanco
        this.svg.style.background = 'transparent';

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
        // Sin grid, no hay nada que recalcular en resize
        console.log('Canvas resized (sin grid)');
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
        // this.gridManager.updateGrid(); // COMENTADO - Sin grid
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
            // this.gridManager.updateGrid(); // COMENTADO - Sin grid
        }
    }

    /**
     * Actualiza la transformación del grupo principal
     */
    updateTransform() {
        const transform = `scale(${this.state.scale}) translate(${this.state.translateX}, ${this.state.translateY})`;
        this.mainGroup.setAttribute('transform', transform);
        
        // Actualizar la UI del zoom
        this.updateZoomUI();
        
        // this.gridManager.updateGrid(); // COMENTADO - Sin grid
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
        // this.gridManager.updateGrid(); // COMENTADO - Sin grid
    }

    /**
     * Reestablece la vista a la configuración inicial
     */
    resetView() {
        this.state.scale = 1;
        this.state.translateX = 0;
        this.state.translateY = 0;
        
        this.updateTransform();
        // this.gridManager.updateGrid(); // COMENTADO - Sin grid
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
        // this.gridManager.setVisible(this.config.gridVisible); // COMENTADO - Sin grid
    }

    setGridSpacing(spacing) {
        this.config.gridSpacing = spacing;
        // this.gridManager.updateGrid(); // COMENTADO - Sin grid
    }

    setGridColor(color) {
        this.config.gridColor = color;
        // this.gridManager.updateGrid(); // COMENTADO - Sin grid
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

    /**
     * Zoom In - Acerca el canvas al centro
     */
    zoomIn() {
        const centerX = this.state.viewBox.x + this.state.viewBox.width / 2;
        const centerY = this.state.viewBox.y + this.state.viewBox.height / 2;
        const zoomFactor = 1 + this.config.zoomStep;
        this.zoomAtPoint(centerX, centerY, zoomFactor);
    }

    /**
     * Zoom Out - Aleja el canvas desde el centro
     */
    zoomOut() {
        const centerX = this.state.viewBox.x + this.state.viewBox.width / 2;
        const centerY = this.state.viewBox.y + this.state.viewBox.height / 2;
        const zoomFactor = 1 - this.config.zoomStep;
        this.zoomAtPoint(centerX, centerY, zoomFactor);
    }

    /**
     * Actualiza la UI del zoom (porcentaje y barra)
     */
    updateZoomUI() {
        const zoomPercentage = Math.round(this.state.scale * 100);
        const zoomText = document.getElementById('zoom-percentage');
        const zoomIndicator = document.getElementById('zoom-indicator');

        if (zoomText) {
            zoomText.textContent = `${zoomPercentage}%`;
        }

        if (zoomIndicator) {
            // Calcular el porcentaje de la barra basado en el nuevo rango de zoom (50% - 150%)
            const minZoom = this.config.minZoom * 100; // 50%
            const maxZoom = this.config.maxZoom * 100; // 150%
            const currentZoom = zoomPercentage;
            
            // Normalizar el valor entre 0 y 100 para la barra visual
            const normalizedValue = Math.max(0, Math.min(100, 
                ((currentZoom - minZoom) / (maxZoom - minZoom)) * 100
            ));
            
            zoomIndicator.style.width = `${normalizedValue}%`;
        }
    }

    /**
     * Establece el zoom a un porcentaje específico
     */
    setZoomPercentage(percentage) {
        const newScale = Math.max(
            this.config.minZoom,
            Math.min(this.config.maxZoom, percentage / 100)
        );

        if (newScale !== this.state.scale) {
            // Hacer zoom al centro del canvas
            const centerX = this.state.viewBox.x + this.state.viewBox.width / 2;
            const centerY = this.state.viewBox.y + this.state.viewBox.height / 2;
            
            // Calcular el factor de zoom necesario
            const zoomFactor = newScale / this.state.scale;
            this.zoomAtPoint(centerX, centerY, zoomFactor);
        }
    }

    /**
     * Configura los event listeners para la barra de zoom interactiva
     */
    setupZoomInteractivity() {
        const zoomBarContainer = document.getElementById('zoom-bar-container');

        // Barra de zoom interactiva
        if (zoomBarContainer) {
            let isDragging = false;

            const updateZoomFromBar = (e) => {
                const rect = zoomBarContainer.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                
                // Convertir a porcentaje de zoom real (50% - 150%)
                const zoomPercentage = 50 + (percentage / 100) * (150 - 50);
                this.setZoomPercentage(zoomPercentage);
            };

            zoomBarContainer.addEventListener('mousedown', (e) => {
                isDragging = true;
                updateZoomFromBar(e);
                zoomBarContainer.style.cursor = 'grabbing';
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    updateZoomFromBar(e);
                }
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    zoomBarContainer.style.cursor = 'pointer';
                }
            });

            // Click directo en la barra
            zoomBarContainer.addEventListener('click', updateZoomFromBar);
        }
    }

    /**
     * Obtiene el porcentaje de zoom actual
     */
    getZoomPercentage() {
        return Math.round(this.state.scale * 100);
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
     * Actualiza la visualización del grid - COMPLETAMENTE DESHABILITADO
     */
    updateGrid() {
        // Grid completamente deshabilitado por solicitud del usuario
        this.clearGrid();
        return; // Salir inmediatamente sin crear puntos
    }

    /**
     * Crea solo los puntos visibles dentro del viewport
     */
    createVisibleDots() {
        const rect = this.canvas.svg.getBoundingClientRect();
        const scale = this.canvas.state.scale;
        const spacing = this.canvas.config.gridSpacing;
        
        // Obtener las dimensiones reales del contenedor
        const containerWidth = rect.width || window.innerWidth;
        const containerHeight = rect.height || window.innerHeight;
        
        // Calcular área visible en coordenadas SVG con márgenes generosos
        const topLeft = this.canvas.clientToSVG(0, 0);
        const bottomRight = this.canvas.clientToSVG(containerWidth, containerHeight);

        // Expandir área significativamente para asegurar cobertura completa
        const margin = spacing * 20; // Margen muy amplio
        const startX = Math.floor((topLeft.x - margin) / spacing) * spacing;
        const endX = Math.ceil((bottomRight.x + margin) / spacing) * spacing;
        const startY = Math.floor((topLeft.y - margin) / spacing) * spacing;
        const endY = Math.ceil((bottomRight.y + margin) / spacing) * spacing;

        // Ajustar densidad según el zoom - Optimizado para puntos más grandes
        let step = spacing;
        if (scale < 0.7) {
            step = spacing * 2; // Menos denso en zoom alejado para evitar saturación
        }
        // Para zoom >= 0.7, usar densidad completa

        // Crear puntos con lógica mejorada
        for (let x = startX; x <= endX; x += step) {
            for (let y = startY; y <= endY; y += step) {
                this.createDot(x, y);
            }
        }

        console.log(`Grid generado: ${Math.ceil((endX - startX) / step)} x ${Math.ceil((endY - startY) / step)} puntos`);
    }

    /**
     * Crea un punto individual del grid con tamaño adaptativo mejorado
     */
    createDot(x, y) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const scale = this.canvas.state.scale;
        
        // Nueva lógica de tamaño - 100% debe verse como antes se veía 150%
        let dotSize = this.canvas.config.gridDotSize;
        
        if (scale >= 1.3) {
            dotSize = this.canvas.config.gridDotSize * 1.4; // Puntos grandes en zoom alto
        } else if (scale >= 1.0) {
            dotSize = this.canvas.config.gridDotSize * 1.3; // 100% = tamaño que antes era para 150%
        } else if (scale >= 0.8) {
            dotSize = this.canvas.config.gridDotSize * 1.1; // Zoom medio
        } else if (scale >= 0.6) {
            dotSize = this.canvas.config.gridDotSize * 0.9; // Zoom alejado
        } else {
            dotSize = this.canvas.config.gridDotSize * 0.7; // Zoom muy alejado
        }
        
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y);
        dot.setAttribute('r', dotSize);
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