/**
 * canvas.js
 * Lógica principal para el editor de diagramas (canvas.html)
 */

// ==================== ESTADO GLOBAL ====================
let currentDiagram = null;
let nodes = [];
let connections = [];
let selectedNode = null;
let selectedNodes = []; // Array para selección múltiple
let selectedConnection = null;
let isDragging = false;
let isPanning = false;
let isConnecting = false;
let isSelecting = false; // Para selección de área
let selectionStart = { x: 0, y: 0 };
let selectionBox = null;
let connectionStart = null;
let hoveredNode = null; // Nodo sobre el que se hace hover durante la conexión
let isDraggingArrowHead = false; // Para arrastrar la cabeza de una flecha
let draggingConnection = null; // Conexión cuya cabeza se está arrastrando
let dragOffset = { x: 0, y: 0 };
let panOffset = { x: 0, y: 0 };
let panStart = { x: 0, y: 0 };
let currentZoom = 100;
let nodeCounter = 0;
let connectionCounter = 0;
let hasUnsavedChanges = false;
let originalDiagramName = '';
let pendingNameChange = '';
let clickCount = 0;
let clickTimer = null;
let isFitViewActive = false; // Para toggle entre ajuste y 100%

// Historial para undo/redo
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

// Referencias a elementos del DOM
let nodeLayer, connectionLayer, canvasContainer;
let diagramNameInput, saveStatus;

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoader('Cargando diagrama...');
        
        // Inicializar almacenamiento
        await initStorage();
        
        // Obtener referencias a elementos
        nodeLayer = document.getElementById('nodeLayer');
        connectionLayer = document.getElementById('connectionLayer');
        canvasContainer = document.getElementById('canvasContainer');
        diagramNameInput = document.getElementById('diagramName');
        saveStatus = document.getElementById('saveStatus');
        
        // Obtener ID del diagrama de la URL
        const urlParams = new URLSearchParams(window.location.search);
        const diagramId = urlParams.get('id');
        
        if (!diagramId) {
            throw new Error('No se especificó un ID de diagrama');
        }
        
        // Cargar diagrama
        await loadDiagram(diagramId);
        
        // Configurar event listeners
        setupEventListeners();
        
        // Configurar menú de nodos
        setupNodeMenu();
        
        // Configurar controles de zoom
        setupZoomControls();
        
        // Inicializar historial
        saveToHistory();
        
        hideLoader();
        
    } catch (error) {
        hideLoader();
        showNotification('Error al cargar el diagrama: ' + error.message, 'error');
        console.error(error);
        
        // Volver al inicio después de 2 segundos
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
});

// ==================== CARGA Y GUARDADO ====================

/**
 * Carga un diagrama desde la base de datos
 */
async function loadDiagram(id) {
    try {
        currentDiagram = await getDiagram(id);
        
        // Cargar datos
        nodes = currentDiagram.nodes || [];
        connections = currentDiagram.connections || [];
        
        // Actualizar contadores
        nodeCounter = Math.max(0, ...nodes.map(n => {
            const match = n.id.match(/n-(\d+)/);
            return match ? parseInt(match[1]) : 0;
        }), 0);
        
        connectionCounter = Math.max(0, ...connections.map(c => {
            const match = c.id.match(/c-(\d+)/);
            return match ? parseInt(match[1]) : 0;
        }), 0);
        
        // Configurar nombre
        diagramNameInput.value = currentDiagram.name;
        originalDiagramName = currentDiagram.name;
        
        // Cargar metadata
        if (currentDiagram.metadata) {
            currentZoom = currentDiagram.metadata.zoom || 100;
            panOffset.x = currentDiagram.metadata.panX || 0;
            panOffset.y = currentDiagram.metadata.panY || 0;
        }
        
        // Renderizar
        renderAllNodes();
        renderAllConnections();
        applyZoom(currentZoom);
        applyPan();
        
        hasUnsavedChanges = false;
        updateSaveStatus('saved');
        
    } catch (error) {
        console.error('Error al cargar diagrama:', error);
        throw error;
    }
}

/**
 * Guarda el diagrama en la base de datos
 */
async function saveDiagram() {
    try {
        updateSaveStatus('saving');
        
        // Actualizar datos
        currentDiagram.nodes = nodes;
        currentDiagram.connections = connections;
        currentDiagram.name = diagramNameInput.value || 'Diagrama';
        currentDiagram.metadata = {
            zoom: currentZoom,
            panX: panOffset.x,
            panY: panOffset.y
        };
        
        // Guardar
        currentDiagram = await updateDiagram(currentDiagram);
        
        hasUnsavedChanges = false;
        updateSaveStatus('saved');
        
        return true;
    } catch (error) {
        console.error('Error al guardar diagrama:', error);
        updateSaveStatus('error');
        showNotification('Error al guardar el diagrama', 'error');
        return false;
    }
}

/**
 * Guardado automático con debounce
 */
const autoSave = debounce(async () => {
    if (hasUnsavedChanges) {
        await saveDiagram();
    }
}, 2000);

/**
 * Marca que hay cambios sin guardar
 */
function markAsChanged() {
    hasUnsavedChanges = true;
    updateSaveStatus('unsaved');
    autoSave();
}

/**
 * Actualiza el indicador de estado de guardado
 */
function updateSaveStatus(status) {
    saveStatus.className = 'save-status';
    
    switch (status) {
        case 'saving':
            saveStatus.textContent = 'Guardando...';
            saveStatus.classList.add('saving');
            break;
        case 'saved':
            saveStatus.textContent = 'Guardado';
            break;
        case 'unsaved':
            saveStatus.textContent = 'Sin guardar';
            break;
        case 'error':
            saveStatus.textContent = 'Error al guardar';
            saveStatus.classList.add('error');
            break;
    }
}

// ==================== CONFIGURACIÓN DE EVENT LISTENERS ====================

function setupEventListeners() {
    // Botón de inicio
    document.getElementById('btnHome').addEventListener('click', handleGoHome);
    
    // Botón de descarga
    document.getElementById('btnDownload').addEventListener('click', handleDownload);
    
    // Cambio de nombre
    diagramNameInput.addEventListener('blur', handleNameBlur);
    diagramNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            diagramNameInput.blur();
        }
    });
    
    // Canvas - eventos de mouse
    canvasContainer.addEventListener('mousedown', handleCanvasMouseDown);
    canvasContainer.addEventListener('mousemove', handleCanvasMouseMove);
    canvasContainer.addEventListener('mouseup', handleCanvasMouseUp);
    canvasContainer.addEventListener('dblclick', handleCanvasDoubleClick);
    canvasContainer.addEventListener('wheel', handleCanvasWheel, { passive: false });
    
    // Canvas - eventos táctiles
    canvasContainer.addEventListener('touchstart', handleCanvasTouchStart, { passive: false });
    canvasContainer.addEventListener('touchmove', handleCanvasTouchMove, { passive: false });
    canvasContainer.addEventListener('touchend', handleCanvasTouchEnd);
    
    // Drop de nodos desde el menú
    canvasContainer.addEventListener('dragover', handleDragOver);
    canvasContainer.addEventListener('drop', handleDrop);
    
    // Teclado
    document.addEventListener('keydown', handleKeyDown);
    
    // Advertencia antes de salir
    window.addEventListener('beforeunload', handleBeforeUnload);
}

/**
 * Configura el menú de nodos
 */
function setupNodeMenu() {
    const btnMenu = document.getElementById('btnMenu');
    const nodeMenu = document.getElementById('nodeMenu');
    const nodeItems = document.querySelectorAll('.node-item');
    
    // Solo abrir el menú con el botón
    btnMenu.addEventListener('click', () => {
        toggleNodeMenu();
    });
    
    // Configurar drag de items del menú
    nodeItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            const nodeType = item.getAttribute('data-node-type');
            e.dataTransfer.setData('nodeType', nodeType);
            e.dataTransfer.effectAllowed = 'copy';
            
            // Crear una imagen de arrastre personalizada con el SVG del nodo
            const img = item.querySelector('img');
            if (img) {
                const dragIcon = img.cloneNode(true);
                dragIcon.style.width = '80px';
                dragIcon.style.height = '80px';
                dragIcon.style.position = 'absolute';
                dragIcon.style.top = '-1000px'; // Ocultar fuera de la vista
                document.body.appendChild(dragIcon);
                
                e.dataTransfer.setDragImage(dragIcon, 40, 40);
                
                // Eliminar el elemento temporal después de un momento
                setTimeout(() => {
                    document.body.removeChild(dragIcon);
                }, 0);
            }
        });
        
        // Click para agregar en el centro
        item.addEventListener('click', () => {
            const nodeType = item.getAttribute('data-node-type');
            addNodeAtCenter(nodeType);
            // No cerrar el menú al agregar un nodo
        });
    });
}

/**
 * Alterna la visibilidad del menú de nodos
 */
function toggleNodeMenu() {
    const nodeMenu = document.getElementById('nodeMenu');
    const menuBtn = document.getElementById('btnMenu');
    
    // Solo cerrar el menú cuando está abierto
    if (nodeMenu.style.display === 'block') {
        nodeMenu.style.display = 'none';
        menuBtn.classList.remove('hidden');
    } else {
        // Abrir el menú
        nodeMenu.style.display = 'block';
        menuBtn.classList.add('hidden');
    }
}

// ==================== GESTIÓN DE NODOS ====================

/**
 * Crea un nuevo nodo
 */
function createNode(type, x, y, content = '') {
    nodeCounter++;
    
    const node = {
        id: `n-${nodeCounter}`,
        type: type,
        x: x,
        y: y,
        width: 120,
        height: 120,
        content: content || getDefaultNodeContent(type)
    };
    
    nodes.push(node);
    renderNode(node);
    markAsChanged();
    saveToHistory();
    
    return node;
}

/**
 * Obtiene el contenido por defecto según el tipo de nodo
 */
function getDefaultNodeContent(type) {
    const defaults = {
        'inicio': 'Inicio',
        'fin': 'Fin',
        'asignacion': 'Variable = valor',
        'si': '¿Condición?',
        'comentario': 'Comentario'
    };
    return defaults[type] || 'Nodo';
}

/**
 * Renderiza un nodo en el canvas
 */
function renderNode(node) {
    const nodeEl = document.createElement('div');
    nodeEl.className = `flow-node ${node.type}`;
    nodeEl.id = node.id;
    nodeEl.style.left = node.x + 'px';
    nodeEl.style.top = node.y + 'px';
    nodeEl.setAttribute('data-node-id', node.id);
    
    // Usar el SVG directamente sin bordes ni contenedor visible
    let iconSrc = `icons/${node.type}.svg`;
    
    // Para nodo de decisión (si), mostrar puntos derecha, izquierda y top (que se ve abajo por la rotación)
    let connectionPointsHTML = '';
    if (node.type === 'si') {
        connectionPointsHTML = `
            <div class="connection-point right" data-position="right">
                <span class="connection-label-si">Sí</span>
            </div>
            <div class="connection-point left" data-position="left">
                <span class="connection-label-si">No</span>
            </div>
            <div class="connection-point top" data-position="top"></div>
        `;
    } else {
        connectionPointsHTML = `
            <div class="connection-point top" data-position="top"></div>
            <div class="connection-point right" data-position="right"></div>
            <div class="connection-point bottom" data-position="bottom"></div>
            <div class="connection-point left" data-position="left"></div>
        `;
    }
    
    nodeEl.innerHTML = `
        <div class="node-delete-btn" onclick="deleteNode('${node.id}')">
            <img src="icons/cerrar.svg" alt="Eliminar">
        </div>
        <img src="${iconSrc}" alt="" class="node-svg-direct">
        <div class="node-content" contenteditable="true">${node.content}</div>
        ${connectionPointsHTML}
    `;
    
    // Event listeners del nodo
    nodeEl.addEventListener('mousedown', (e) => handleNodeMouseDown(e, node));
    nodeEl.addEventListener('touchstart', (e) => handleNodeTouchStart(e, node), { passive: false });
    
    // Doble clic para editar
    nodeEl.addEventListener('dblclick', (e) => {
        if (!e.target.classList.contains('node-content')) {
            e.stopPropagation();
            const contentEl = nodeEl.querySelector('.node-content');
            contentEl.focus();
            // Seleccionar todo el texto
            const range = document.createRange();
            range.selectNodeContents(contentEl);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    });
    
    // Edición de contenido
    const contentEl = nodeEl.querySelector('.node-content');
    contentEl.addEventListener('input', () => {
        node.content = contentEl.textContent;
        markAsChanged();
    });
    
    contentEl.addEventListener('blur', () => {
        saveToHistory();
    });
    
    // Puntos de conexión
    const connectionPoints = nodeEl.querySelectorAll('.connection-point');
    connectionPoints.forEach(point => {
        point.addEventListener('mousedown', (e) => handleConnectionPointMouseDown(e, node, point.getAttribute('data-position')));
        point.addEventListener('touchstart', (e) => handleConnectionPointTouchStart(e, node, point.getAttribute('data-position')), { passive: false });
    });
    
    nodeLayer.appendChild(nodeEl);
}

/**
 * Renderiza todos los nodos
 */
function renderAllNodes() {
    nodeLayer.innerHTML = '';
    nodes.forEach(node => renderNode(node));
}

/**
 * Elimina un nodo
 */
function deleteNode(nodeId) {
    // Eliminar el nodo
    nodes = nodes.filter(n => n.id !== nodeId);
    
    // Eliminar conexiones relacionadas
    connections = connections.filter(c => c.from !== nodeId && c.to !== nodeId);
    
    // Eliminar del DOM
    const nodeEl = document.getElementById(nodeId);
    if (nodeEl) {
        nodeEl.remove();
    }
    
    // Re-renderizar conexiones
    renderAllConnections();
    
    markAsChanged();
    saveToHistory();
}

/**
 * Agrega un nodo en el centro del canvas
 */
function addNodeAtCenter(nodeType) {
    const rect = canvasContainer.getBoundingClientRect();
    const centerX = (rect.width / 2 - 60 - panOffset.x) / (currentZoom / 100);
    const centerY = (rect.height / 2 - 60 - panOffset.y) / (currentZoom / 100);
    
    createNode(nodeType, centerX, centerY);
}

// ==================== MANEJO DE EVENTOS DE NODOS ====================

function handleNodeMouseDown(e, node) {
    if (e.target.classList.contains('node-content') || 
        e.target.classList.contains('connection-point') ||
        e.target.closest('.connection-point') ||
        e.target.closest('.node-delete-btn')) {
        return;
    }
    
    e.stopPropagation();
    e.preventDefault();
    
    // Un solo clic selecciona el nodo y muestra puntos de conexión
    selectNode(node);
    
    isDragging = true;
    selectedNode = node;
    
    const nodeEl = document.getElementById(node.id);
    nodeEl.classList.add('dragging');
    
    const rect = nodeEl.getBoundingClientRect();
    const canvasRect = canvasContainer.getBoundingClientRect();
    
    dragOffset.x = (e.clientX - canvasRect.left) / (currentZoom / 100) - node.x;
    dragOffset.y = (e.clientY - canvasRect.top) / (currentZoom / 100) - node.y;
}

/**
 * Selecciona un nodo y muestra sus puntos de conexión
 */
function selectNode(node) {
    // Deseleccionar todos los nodos primero
    document.querySelectorAll('.flow-node.selected').forEach(n => n.classList.remove('selected'));
    
    // Seleccionar el nodo actual
    const nodeEl = document.getElementById(node.id);
    if (nodeEl) {
        nodeEl.classList.add('selected');
    }
    
    selectedNode = node;
}

function handleNodeTouchStart(e, node) {
    if (e.target.classList.contains('node-content') || 
        e.target.classList.contains('connection-point') ||
        e.target.closest('.connection-point')) {
        return;
    }
    
    e.stopPropagation();
    e.preventDefault();
    
    const touch = e.touches[0];
    isDragging = true;
    selectedNode = node;
    
    const nodeEl = document.getElementById(node.id);
    nodeEl.classList.add('dragging');
    
    const rect = nodeEl.getBoundingClientRect();
    const canvasRect = canvasContainer.getBoundingClientRect();
    
    dragOffset.x = (touch.clientX - canvasRect.left) / (currentZoom / 100) - node.x;
    dragOffset.y = (touch.clientY - canvasRect.top) / (currentZoom / 100) - node.y;
}

// ==================== GESTIÓN DE CONEXIONES ====================

/**
 * Calcula las mejores posiciones de conexión basándose en la posición relativa de los nodos
 */
function calculateBestConnectionPositions(fromNode, toNode) {
    const fromCenterX = fromNode.x + fromNode.width / 2;
    const fromCenterY = fromNode.y + fromNode.height / 2;
    const toCenterX = toNode.x + toNode.width / 2;
    const toCenterY = toNode.y + toNode.height / 2;
    
    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;
    
    let fromPosition, toPosition;
    
    // Determinar la dirección predominante
    if (Math.abs(dx) > Math.abs(dy)) {
        // Movimiento horizontal predominante
        if (dx > 0) {
            // El nodo destino está a la derecha
            fromPosition = 'right';
            toPosition = 'left';
        } else {
            // El nodo destino está a la izquierda
            fromPosition = 'left';
            toPosition = 'right';
        }
    } else {
        // Movimiento vertical predominante
        if (dy > 0) {
            // El nodo destino está abajo
            fromPosition = 'bottom';
            toPosition = 'top';
        } else {
            // El nodo destino está arriba
            fromPosition = 'top';
            toPosition = 'bottom';
        }
    }
    
    return { fromPosition, toPosition };
}

/**
 * Crea una nueva conexión
 */
function createConnection(fromNodeId, fromPosition, toNodeId, toPosition, label = '') {
    connectionCounter++;
    
    const connection = {
        id: `c-${connectionCounter}`,
        from: fromNodeId,
        fromPosition: fromPosition,
        to: toNodeId,
        toPosition: toPosition,
        label: label
    };
    
    connections.push(connection);
    renderConnection(connection);
    markAsChanged();
    saveToHistory();
    
    return connection;
}

/**
 * Ajusta un punto de conexión para que la línea termine en el borde del círculo
 * en lugar del centro, evitando espacios entre la flecha y el punto de conexión
 */
function adjustPointForConnectionCircle(point, direction, offset = 8) {
    const adjusted = { ...point };
    
    switch (direction) {
        case 'top':
            adjusted.y += offset; // Mover hacia abajo
            break;
        case 'bottom':
            adjusted.y -= offset; // Mover hacia arriba
            break;
        case 'left':
            adjusted.x += offset; // Mover hacia la derecha
            break;
        case 'right':
            adjusted.x -= offset; // Mover hacia la izquierda
            break;
    }
    
    return adjusted;
}

/**
 * Renderiza una conexión
 */
function renderConnection(connection) {
    const fromNode = nodes.find(n => n.id === connection.from);
    const toNode = nodes.find(n => n.id === connection.to);
    
    if (!fromNode || !toNode) return;
    
    let fromPoint = getConnectionPoint(fromNode, connection.fromPosition);
    let toPoint = getConnectionPoint(toNode, connection.toPosition);
    
    // Ajustar los puntos para que las flechas lleguen hasta el borde de los círculos de conexión
    fromPoint = adjustPointForConnectionCircle(fromPoint, connection.fromPosition);
    toPoint = adjustPointForConnectionCircle(toPoint, connection.toPosition);
    
    // Crear path SVG
    const pathId = `path-${connection.id}`;
    let existingPath = document.getElementById(pathId);
    
    const pathData = createCurvePath(fromPoint, toPoint);
    
    if (existingPath) {
        existingPath.setAttribute('d', pathData);
    } else {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('id', pathId);
        path.setAttribute('d', pathData);
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.setAttribute('data-connection-id', connection.id);
        path.style.stroke = '#2C3E50';
        path.style.strokeWidth = '2';
        path.style.fill = 'none';
        
        path.addEventListener('click', () => selectConnection(connection));
        
        connectionLayer.appendChild(path);
    }
    
    // Crear o actualizar círculo arrastrable en la cabeza de la flecha
    const arrowHeadId = `arrowhead-handle-${connection.id}`;
    let arrowHeadHandle = document.getElementById(arrowHeadId);
    
    if (!arrowHeadHandle) {
        arrowHeadHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        arrowHeadHandle.setAttribute('id', arrowHeadId);
        arrowHeadHandle.setAttribute('r', '8');
        arrowHeadHandle.setAttribute('data-connection-id', connection.id);
        arrowHeadHandle.style.fill = '#3498db';
        arrowHeadHandle.style.stroke = 'white';
        arrowHeadHandle.style.strokeWidth = '2';
        arrowHeadHandle.style.cursor = 'move';
        arrowHeadHandle.style.opacity = '0';
        arrowHeadHandle.style.transition = 'opacity 0.2s';
        
        // Eventos para arrastrar
        arrowHeadHandle.addEventListener('mouseenter', () => {
            arrowHeadHandle.style.opacity = '1';
        });
        arrowHeadHandle.addEventListener('mouseleave', () => {
            arrowHeadHandle.style.opacity = '0';
        });
        arrowHeadHandle.addEventListener('mousedown', (e) => handleArrowHeadMouseDown(e, connection));
        
        connectionLayer.appendChild(arrowHeadHandle);
    }
    
    // Posicionar el círculo en la punta de la flecha
    arrowHeadHandle.setAttribute('cx', toPoint.x);
    arrowHeadHandle.setAttribute('cy', toPoint.y);
}

/**
 * Renderiza todas las conexiones
 */
function renderAllConnections() {
    // Limpiar paths y handles existentes
    const paths = connectionLayer.querySelectorAll('path');
    paths.forEach(path => path.remove());
    
    const handles = connectionLayer.querySelectorAll('circle[id^="arrowhead-handle-"]');
    handles.forEach(handle => handle.remove());
    
    // Re-renderizar todas
    connections.forEach(connection => renderConnection(connection));
}

/**
 * Obtiene las coordenadas de un punto de conexión de un nodo
 * Los puntos de conexión están posicionados en el centro de los círculos visibles (16px de diámetro)
 */
function getConnectionPoint(node, position) {
    const halfWidth = node.width / 2;
    const halfHeight = node.height / 2;
    
    let x = node.x + halfWidth;
    let y = node.y + halfHeight;
    
    // Los puntos de conexión están en el centro de los círculos (8px desde el borde)
    switch (position) {
        case 'top':
            x = node.x + halfWidth;  // Centrado horizontalmente
            y = node.y;              // En el borde superior
            break;
        case 'right':
            x = node.x + node.width; // En el borde derecho
            y = node.y + halfHeight; // Centrado verticalmente
            break;
        case 'bottom':
            x = node.x + halfWidth;  // Centrado horizontalmente
            y = node.y + node.height; // En el borde inferior
            break;
        case 'left':
            x = node.x;              // En el borde izquierdo
            y = node.y + halfHeight; // Centrado verticalmente
            break;
    }
    
    return { x, y };
}

/**
 * Calcula el punto de conexión más cercano a una posición dada
 */
function getClosestConnectionPoint(node, mouseX, mouseY) {
    const positions = ['top', 'right', 'bottom', 'left'];
    
    // Para nodos tipo 'si', usar right, left y top (top se ve abajo por la rotación de 45°)
    const validPositions = node.type === 'si' ? ['right', 'left', 'top'] : positions;
    
    let closestPosition = validPositions[0];
    let minDistance = Infinity;
    
    validPositions.forEach(position => {
        const point = getConnectionPoint(node, position);
        const distance = Math.sqrt(
            Math.pow(point.x - mouseX, 2) + 
            Math.pow(point.y - mouseY, 2)
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            closestPosition = position;
        }
    });
    
    return closestPosition;
}

/**
 * Crea un path curvo entre dos puntos
 */
function createCurvePath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    
    // Determinar si la conexión es más horizontal o vertical
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    
    let cx1, cy1, cx2, cy2;
    
    if (isHorizontal) {
        // Curva horizontal - los puntos de control se mueven horizontalmente
        const offset = Math.abs(dx) * 0.5;
        cx1 = from.x + (dx > 0 ? offset : -offset);
        cy1 = from.y;
        cx2 = to.x - (dx > 0 ? offset : -offset);
        cy2 = to.y;
    } else {
        // Curva vertical - los puntos de control se mueven verticalmente
        const offset = Math.abs(dy) * 0.5;
        cx1 = from.x;
        cy1 = from.y + (dy > 0 ? offset : -offset);
        cx2 = to.x;
        cy2 = to.y - (dy > 0 ? offset : -offset);
    }
    
    return `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`;
}

/**
 * Selecciona una conexión
 */
function selectConnection(connection) {
    // Deseleccionar anteriores
    const paths = connectionLayer.querySelectorAll('path');
    paths.forEach(p => p.classList.remove('selected'));
    
    // Remover botón de eliminar anterior si existe
    const existingBtn = document.getElementById('connection-delete-btn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    // Seleccionar actual
    const path = document.getElementById(`path-${connection.id}`);
    if (path) {
        path.classList.add('selected');
        selectedConnection = connection;
        
        // Crear botón de eliminar en el punto medio de la conexión
        const fromNode = nodes.find(n => n.id === connection.from);
        const toNode = nodes.find(n => n.id === connection.to);
        
        if (fromNode && toNode) {
            const fromPoint = getConnectionPoint(fromNode, connection.fromPosition);
            const toPoint = getConnectionPoint(toNode, connection.toPosition);
            
            // Calcular punto medio
            const midX = (fromPoint.x + toPoint.x) / 2;
            const midY = (fromPoint.y + toPoint.y) / 2;
            
            // Crear botón de eliminar
            const deleteBtn = document.createElement('button');
            deleteBtn.id = 'connection-delete-btn';
            deleteBtn.className = 'connection-delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Eliminar conexión';
            deleteBtn.style.left = midX + 'px';
            deleteBtn.style.top = midY + 'px';
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteConnection(connection.id);
                deleteBtn.remove();
            });
            
            nodeLayer.appendChild(deleteBtn);
        }
    }
}

/**
 * Elimina una conexión
 */
function deleteConnection(connectionId) {
    connections = connections.filter(c => c.id !== connectionId);
    
    const path = document.getElementById(`path-${connectionId}`);
    if (path) {
        path.remove();
    }
    
    // Eliminar también el handle de la cabeza
    const handle = document.getElementById(`arrowhead-handle-${connectionId}`);
    if (handle) {
        handle.remove();
    }
    
    selectedConnection = null;
    markAsChanged();
    saveToHistory();
}

/**
 * Maneja el inicio del arrastre de la cabeza de una flecha
 */
function handleArrowHeadMouseDown(e, connection) {
    e.stopPropagation();
    e.preventDefault();
    
    isDraggingArrowHead = true;
    draggingConnection = connection;
    canvasContainer.style.cursor = 'move';
}

/**
 * Maneja el inicio de creación de conexión
 */
function handleConnectionPointMouseDown(e, node, position) {
    e.stopPropagation();
    e.preventDefault();
    
    // Cambiar a sistema de clics
    if (!isConnecting) {
        // Primer clic: iniciar conexión
        isConnecting = true;
        connectionStart = { node: node, position: position };
        canvasContainer.style.cursor = 'crosshair';
    } else if (connectionStart) {
        // Segundo clic en un punto de conexión: completar conexión
        const targetNode = node;
        const targetPosition = position;
        
        if (targetNode.id !== connectionStart.node.id) {
            createConnection(
                connectionStart.node.id,
                connectionStart.position,
                targetNode.id,
                targetPosition
            );
        }
        
        // Resetear estado
        isConnecting = false;
        connectionStart = null;
        canvasContainer.style.cursor = '';
        removeTemporaryConnection();
        
        // Remover hover-target si existe
        if (hoveredNode) {
            const hoveredEl = document.getElementById(hoveredNode.id);
            if (hoveredEl) {
                hoveredEl.classList.remove('hover-target');
            }
            hoveredNode = null;
        }
    }
}

function handleConnectionPointTouchStart(e, node, position) {
    e.stopPropagation();
    e.preventDefault();
    
    // Sistema de clics para touch
    if (!isConnecting) {
        isConnecting = true;
        connectionStart = { node: node, position: position };
    } else if (connectionStart) {
        const targetNode = node;
        const targetPosition = position;
        
        if (targetNode.id !== connectionStart.node.id) {
            createConnection(
                connectionStart.node.id,
                connectionStart.position,
                targetNode.id,
                targetPosition
            );
        }
        
        isConnecting = false;
        connectionStart = null;
        removeTemporaryConnection();
        
        if (hoveredNode) {
            const hoveredEl = document.getElementById(hoveredNode.id);
            if (hoveredEl) {
                hoveredEl.classList.remove('hover-target');
            }
            hoveredNode = null;
        }
    }
}

// ==================== MANEJO DE EVENTOS DEL CANVAS ====================

function handleCanvasMouseDown(e) {
    // Verificar si es sobre el fondo del canvas
    const isCanvasBackground = e.target === canvasContainer || e.target === nodeLayer || e.target.closest('.connection-layer');
    
    if (isCanvasBackground) {
        e.preventDefault();
        
        // Si está en modo de conexión, cancelar
        if (isConnecting) {
            isConnecting = false;
            connectionStart = null;
            canvasContainer.style.cursor = '';
            removeTemporaryConnection();
            
            if (hoveredNode) {
                const hoveredEl = document.getElementById(hoveredNode.id);
                if (hoveredEl) {
                    hoveredEl.classList.remove('hover-target');
                }
                hoveredNode = null;
            }
            return;
        }
        
        // Deseleccionar nodos
        document.querySelectorAll('.flow-node.selected').forEach(n => n.classList.remove('selected'));
        selectedNode = null;
        
        // Iniciar panning (arrastre del canvas)
        isPanning = true;
        panStart.x = e.clientX - panOffset.x;
        panStart.y = e.clientY - panOffset.y;
        canvasContainer.classList.add('panning');
        canvasContainer.style.cursor = 'grabbing';
    } else if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        // Botón central o Shift + clic izquierdo para pan (mantener compatibilidad)
        e.preventDefault();
        isPanning = true;
        panStart.x = e.clientX - panOffset.x;
        panStart.y = e.clientY - panOffset.y;
        canvasContainer.classList.add('panning');
    } 
    
    if (e.target === canvasContainer || e.target === nodeLayer) {
        // Deseleccionar todo al hacer clic en el canvas vacío
        selectedNode = null;
        selectedConnection = null;
        
        const selectedPaths = connectionLayer.querySelectorAll('path.selected');
        selectedPaths.forEach(p => p.classList.remove('selected'));
        
        // Remover botón de eliminar conexión si existe
        const connectionDeleteBtn = document.getElementById('connection-delete-btn');
        if (connectionDeleteBtn) {
            connectionDeleteBtn.remove();
        }
    }
}

function handleCanvasMouseMove(e) {
    if (isPanning) {
        panOffset.x = e.clientX - panStart.x;
        panOffset.y = e.clientY - panStart.y;
        applyPan();
        markAsChanged();
    } else if (isDraggingArrowHead && draggingConnection) {
        // Arrastrar la cabeza de la flecha
        const rect = canvasContainer.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - panOffset.x) / (currentZoom / 100);
        const mouseY = (e.clientY - rect.top - panOffset.y) / (currentZoom / 100);
        
        // Actualizar la posición temporal del handle
        const handle = document.getElementById(`arrowhead-handle-${draggingConnection.id}`);
        if (handle) {
            handle.setAttribute('cx', mouseX);
            handle.setAttribute('cy', mouseY);
        }
        
        // Actualizar la línea temporal
        const fromNode = nodes.find(n => n.id === draggingConnection.from);
        if (fromNode) {
            let fromPoint = getConnectionPoint(fromNode, draggingConnection.fromPosition);
            fromPoint = adjustPointForConnectionCircle(fromPoint, draggingConnection.fromPosition);
            
            const path = document.getElementById(`path-${draggingConnection.id}`);
            if (path) {
                const pathData = createCurvePath(fromPoint, { x: mouseX, y: mouseY });
                path.setAttribute('d', pathData);
            }
        }
        
        // Detectar hover sobre nodos para reconexión
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const nodeEl = target ? target.closest('.flow-node') : null;
        
        if (nodeEl) {
            const nodeId = nodeEl.getAttribute('data-node-id');
            const node = nodes.find(n => n.id === nodeId);
            
            if (node && node.id !== draggingConnection.from) {
                if (!hoveredNode || hoveredNode.id !== node.id) {
                    if (hoveredNode) {
                        const prevEl = document.getElementById(hoveredNode.id);
                        if (prevEl) prevEl.classList.remove('hover-target');
                    }
                    
                    hoveredNode = node;
                    nodeEl.classList.add('hover-target');
                }
            }
        } else {
            if (hoveredNode) {
                const prevEl = document.getElementById(hoveredNode.id);
                if (prevEl) prevEl.classList.remove('hover-target');
                hoveredNode = null;
            }
        }
    } else if (isDragging && selectedNode) {
        const rect = canvasContainer.getBoundingClientRect();
        const x = (e.clientX - rect.left) / (currentZoom / 100) - dragOffset.x;
        const y = (e.clientY - rect.top) / (currentZoom / 100) - dragOffset.y;
        
        selectedNode.x = x;
        selectedNode.y = y;
        
        const nodeEl = document.getElementById(selectedNode.id);
        if (nodeEl) {
            nodeEl.style.left = selectedNode.x + 'px';
            nodeEl.style.top = selectedNode.y + 'px';
        }
        
        // Actualizar conexiones relacionadas
        updateNodeConnections(selectedNode.id);
        markAsChanged();
    } else if (isConnecting && connectionStart) {
        // Detectar si el mouse está sobre un nodo
        const target = e.target;
        const nodeEl = target.closest('.flow-node');
        
        if (nodeEl) {
            const nodeId = nodeEl.getAttribute('data-node-id');
            const node = nodes.find(n => n.id === nodeId);
            
            // Si es un nodo diferente al de origen
            if (node && node.id !== connectionStart.node.id) {
                // Si es un nodo diferente al que teníamos en hover
                if (!hoveredNode || hoveredNode.id !== node.id) {
                    // Remover highlight del nodo anterior
                    if (hoveredNode) {
                        const prevNodeEl = document.getElementById(hoveredNode.id);
                        if (prevNodeEl) {
                            prevNodeEl.classList.remove('hover-target');
                        }
                    }
                    
                    // Añadir highlight al nuevo nodo y mostrar sus puntos de conexión
                    hoveredNode = node;
                    nodeEl.classList.add('hover-target');
                    
                    // Mostrar los puntos de conexión del nodo destino
                    const connectionPoints = nodeEl.querySelectorAll('.connection-point');
                    connectionPoints.forEach(point => {
                        point.style.display = 'flex';
                    });
                }
            }
        } else {
            // El mouse no está sobre ningún nodo, remover highlight
            if (hoveredNode) {
                const prevNodeEl = document.getElementById(hoveredNode.id);
                if (prevNodeEl) {
                    prevNodeEl.classList.remove('hover-target');
                    
                    // Ocultar puntos de conexión si el nodo no está seleccionado
                    if (!prevNodeEl.classList.contains('selected')) {
                        const connectionPoints = prevNodeEl.querySelectorAll('.connection-point');
                        connectionPoints.forEach(point => {
                            point.style.display = 'none';
                        });
                    }
                }
                hoveredNode = null;
            }
        }
        
        // Mostrar línea temporal mientras se crea la conexión
        drawTemporaryConnection(e);
    }
}

function handleCanvasDoubleClick(e) {
    // Doble clic en el canvas vacío - sin acción especial
    const isCanvasBackground = e.target === canvasContainer || e.target === nodeLayer || e.target.closest('.connection-layer');
    
    if (isCanvasBackground) {
        e.preventDefault();
    }
}

function handleCanvasMouseUp(e) {
    if (isPanning) {
        isPanning = false;
        canvasContainer.classList.remove('panning');
        canvasContainer.style.cursor = '';
    } else if (isDraggingArrowHead && draggingConnection) {
        // Finalizar arrastre de cabeza de flecha
        const rect = canvasContainer.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - panOffset.x) / (currentZoom / 100);
        const mouseY = (e.clientY - rect.top - panOffset.y) / (currentZoom / 100);
        
        if (hoveredNode && hoveredNode.id !== draggingConnection.from) {
            // Reconectar a un nuevo nodo
            const closestPoint = getClosestConnectionPoint(hoveredNode, mouseX, mouseY);
            
            if (closestPoint) {
                draggingConnection.to = hoveredNode.id;
                draggingConnection.toPosition = closestPoint;
                renderConnection(draggingConnection);
                markAsChanged();
                saveToHistory();
            }
        } else {
            // No hay nodo destino válido, eliminar la conexión
            deleteConnection(draggingConnection.id);
        }
        
        // Limpiar estado
        if (hoveredNode) {
            const hoveredEl = document.getElementById(hoveredNode.id);
            if (hoveredEl) {
                hoveredEl.classList.remove('hover-target');
            }
            hoveredNode = null;
        }
        
        isDraggingArrowHead = false;
        draggingConnection = null;
        canvasContainer.style.cursor = '';
    } else if (isDragging && selectedNode) {
        const nodeEl = document.getElementById(selectedNode.id);
        if (nodeEl) {
            nodeEl.classList.remove('dragging');
        }
        isDragging = false;
        saveToHistory();
    }
    // Nota: La conexión ahora se completa con un clic en el punto de destino,
    // no con mouseup. Ver handleConnectionPointMouseDown
}

function handleCanvasTouchStart(e) {
    if (e.touches.length === 2) {
        // Gesto de pellizcar para zoom (se puede implementar)
        e.preventDefault();
    }
}

function handleCanvasTouchMove(e) {
    if (isDragging && selectedNode && e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvasContainer.getBoundingClientRect();
        
        const x = (touch.clientX - rect.left) / (currentZoom / 100) - dragOffset.x;
        const y = (touch.clientY - rect.top) / (currentZoom / 100) - dragOffset.y;
        
        selectedNode.x = x;
        selectedNode.y = y;
        
        const nodeEl = document.getElementById(selectedNode.id);
        if (nodeEl) {
            nodeEl.style.left = selectedNode.x + 'px';
            nodeEl.style.top = selectedNode.y + 'px';
        }
        
        updateNodeConnections(selectedNode.id);
        markAsChanged();
    } else if (isConnecting && connectionStart && e.touches.length === 1) {
        // Detectar hover en modo de conexión para touch
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const nodeEl = target ? target.closest('.flow-node') : null;
        
        if (nodeEl) {
            const nodeId = nodeEl.getAttribute('data-node-id');
            const node = nodes.find(n => n.id === nodeId);
            
            if (node && node.id !== connectionStart.node.id) {
                // Nuevo nodo en hover
                if (!hoveredNode || hoveredNode.id !== node.id) {
                    // Remover hover anterior
                    if (hoveredNode) {
                        const prevEl = document.getElementById(hoveredNode.id);
                        if (prevEl) prevEl.classList.remove('hover-target');
                    }
                    
                    // Agregar hover al nuevo nodo
                    hoveredNode = node;
                    nodeEl.classList.add('hover-target');
                }
            }
        } else {
            // No hay nodo bajo el cursor, limpiar hover
            if (hoveredNode) {
                const prevEl = document.getElementById(hoveredNode.id);
                if (prevEl) prevEl.classList.remove('hover-target');
                hoveredNode = null;
            }
        }
    }
}

function handleCanvasTouchEnd(e) {
    if (isDragging && selectedNode) {
        const nodeEl = document.getElementById(selectedNode.id);
        if (nodeEl) {
            nodeEl.classList.remove('dragging');
        }
        isDragging = false;
        saveToHistory();
    }
    // Nota: La conexión ahora se completa con un clic en el punto de destino,
    // no con touchend. Ver handleConnectionPointTouchStart
}

function handleCanvasWheel(e) {
    // Zoom con scroll (sin necesidad de Ctrl)
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? -10 : 10;
    const newZoom = Math.min(250, Math.max(50, currentZoom + delta));
    
    applyZoom(newZoom);
    isFitViewActive = false; // Resetear cuando se usa scroll
    markAsChanged();
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function handleDrop(e) {
    e.preventDefault();
    
    const nodeType = e.dataTransfer.getData('nodeType');
    if (!nodeType) return;
    
    const rect = canvasContainer.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / (currentZoom / 100);
    const y = (e.clientY - rect.top - panOffset.y) / (currentZoom / 100);
    
    createNode(nodeType, x, y);
    // No cerrar el menú después de arrastrar un nodo
}

/**
 * Actualiza todas las conexiones de un nodo
 */
function updateNodeConnections(nodeId) {
    connections.forEach(connection => {
        if (connection.from === nodeId || connection.to === nodeId) {
            // Recalcular las posiciones óptimas de conexión
            const fromNode = nodes.find(n => n.id === connection.from);
            const toNode = nodes.find(n => n.id === connection.to);
            
            if (fromNode && toNode) {
                const bestPositions = calculateBestConnectionPositions(fromNode, toNode);
                connection.fromPosition = bestPositions.fromPosition;
                connection.toPosition = bestPositions.toPosition;
            }
            
            renderConnection(connection);
        }
    });
}

/**
 * Dibuja una conexión temporal mientras se arrastra
 */
function drawTemporaryConnection(e) {
    const tempId = 'temp-connection';
    let tempPath = document.getElementById(tempId);
    
    if (!tempPath) {
        tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempPath.setAttribute('id', tempId);
        tempPath.style.stroke = '#00C1BA';
        tempPath.style.strokeWidth = '2';
        tempPath.style.strokeDasharray = '5,5';
        tempPath.style.fill = 'none';
        connectionLayer.appendChild(tempPath);
    }
    
    let fromPoint = getConnectionPoint(connectionStart.node, connectionStart.position);
    // Ajustar el punto de inicio para que salga del borde del círculo
    fromPoint = adjustPointForConnectionCircle(fromPoint, connectionStart.position);
    
    const rect = canvasContainer.getBoundingClientRect();
    const toPoint = {
        x: (e.clientX - rect.left - panOffset.x) / (currentZoom / 100),
        y: (e.clientY - rect.top - panOffset.y) / (currentZoom / 100)
    };
    
    const pathData = createCurvePath(fromPoint, toPoint);
    tempPath.setAttribute('d', pathData);
}

/**
 * Elimina la conexión temporal
 */
function removeTemporaryConnection() {
    const tempPath = document.getElementById('temp-connection');
    if (tempPath) {
        tempPath.remove();
    }
}

// ==================== CONTROLES DE ZOOM Y PAN ====================

function setupZoomControls() {
    const zoomSlider = document.getElementById('zoomSlider');
    const zoomValue = document.getElementById('zoomValue');
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnFitView = document.getElementById('btnFitView');
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    
    zoomSlider.addEventListener('input', (e) => {
        const zoom = parseInt(e.target.value);
        applyZoom(zoom);
        isFitViewActive = false; // Resetear cuando el usuario cambia el zoom manualmente
    });
    
    zoomSlider.addEventListener('change', () => {
        markAsChanged();
    });
    
    btnZoomIn.addEventListener('click', () => {
        const newZoom = Math.min(250, currentZoom + 10);
        applyZoom(newZoom);
        isFitViewActive = false; // Resetear
        markAsChanged();
    });
    
    btnZoomOut.addEventListener('click', () => {
        const newZoom = Math.max(50, currentZoom - 10);
        applyZoom(newZoom);
        isFitViewActive = false; // Resetear
        markAsChanged();
    });
    
    btnFitView.addEventListener('click', () => {
        if (isFitViewActive) {
            // Si ya está ajustado, volver a 100%
            applyZoom(100);
            panOffset.x = 0;
            panOffset.y = 0;
            applyPan();
            isFitViewActive = false;
            showNotification('Zoom restaurado a 100%', 'info', 1500);
        } else {
            // Ajustar a los nodos
            fitToView();
            isFitViewActive = true;
        }
        markAsChanged();
    });
    
    btnUndo.addEventListener('click', undo);
    btnRedo.addEventListener('click', redo);
}

/**
 * Aplica el zoom al canvas
 */
function applyZoom(zoom) {
    currentZoom = Math.min(250, Math.max(50, zoom));
    
    const scale = currentZoom / 100;
    nodeLayer.style.transform = `scale(${scale})`;
    connectionLayer.style.transform = `scale(${scale})`;
    
    // Actualizar UI
    const zoomSlider = document.getElementById('zoomSlider');
    const zoomValue = document.getElementById('zoomValue');
    
    zoomSlider.value = currentZoom;
    zoomValue.textContent = currentZoom + '%';
    
    // Actualizar grosor de líneas para mantener apariencia
    const strokeWidth = 2 / scale;
    const paths = connectionLayer.querySelectorAll('path');
    paths.forEach(path => {
        path.style.strokeWidth = strokeWidth;
    });
}

/**
 * Aplica el desplazamiento al canvas
 */
function applyPan() {
    nodeLayer.style.left = panOffset.x + 'px';
    nodeLayer.style.top = panOffset.y + 'px';
    connectionLayer.style.left = panOffset.x + 'px';
    connectionLayer.style.top = panOffset.y + 'px';
}

/**
 * Ajusta la vista para mostrar todos los nodos
 */
function fitToView() {
    if (nodes.length === 0) {
        applyZoom(100);
        panOffset.x = 0;
        panOffset.y = 0;
        applyPan();
        return;
    }
    
    // Encontrar límites
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
    });
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    const containerRect = canvasContainer.getBoundingClientRect();
    const padding = 50;
    
    const scaleX = (containerRect.width - padding * 2) / contentWidth;
    const scaleY = (containerRect.height - padding * 2) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 2.5); // Max 250%
    
    const newZoom = Math.round(scale * 100);
    applyZoom(Math.min(250, Math.max(50, newZoom)));
    
    // Centrar contenido
    panOffset.x = (containerRect.width - contentWidth * (currentZoom / 100)) / 2 - minX * (currentZoom / 100);
    panOffset.y = (containerRect.height - contentHeight * (currentZoom / 100)) / 2 - minY * (currentZoom / 100);
    applyPan();
    
    markAsChanged();
}

// ==================== HISTORIAL (UNDO/REDO) ====================

/**
 * Guarda el estado actual en el historial
 */
function saveToHistory() {
    const state = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        connections: JSON.parse(JSON.stringify(connections)),
        zoom: currentZoom,
        pan: { ...panOffset }
    };
    
    // Eliminar estados futuros si estamos en medio del historial
    history = history.slice(0, historyIndex + 1);
    
    // Agregar nuevo estado
    history.push(state);
    
    // Limitar tamaño del historial
    if (history.length > MAX_HISTORY) {
        history.shift();
    } else {
        historyIndex++;
    }
}

/**
 * Deshacer última acción
 */
function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        restoreState(history[historyIndex]);
        showNotification('Cambio deshecho', 'info', 1500);
    }
}

/**
 * Rehacer acción
 */
function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        restoreState(history[historyIndex]);
        showNotification('Cambio rehecho', 'info', 1500);
    }
}

/**
 * Restaura un estado del historial
 */
function restoreState(state) {
    nodes = JSON.parse(JSON.stringify(state.nodes));
    connections = JSON.parse(JSON.stringify(state.connections));
    currentZoom = state.zoom;
    panOffset = { ...state.pan };
    
    renderAllNodes();
    renderAllConnections();
    applyZoom(currentZoom);
    applyPan();
    
    markAsChanged();
}

// ==================== MANEJO DE TECLADO ====================

function handleKeyDown(e) {
    // Escape: Cancelar modo de conexión
    if (e.key === 'Escape') {
        if (isConnecting) {
            isConnecting = false;
            connectionStart = null;
            canvasContainer.style.cursor = '';
            removeTemporaryConnection();
            
            if (hoveredNode) {
                const hoveredEl = document.getElementById(hoveredNode.id);
                if (hoveredEl) {
                    hoveredEl.classList.remove('hover-target');
                }
                hoveredNode = null;
            }
        }
    }
    
    // Ctrl+S: Guardar
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveDiagram();
        showNotification('Diagrama guardado', 'success', 2000);
    }
    
    // Ctrl+Z: Deshacer
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
    }
    
    // Ctrl+Y o Ctrl+Shift+Z: Rehacer
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
    }
    
    // Ctrl+0: Reset zoom
    if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        applyZoom(100);
        markAsChanged();
    }
    
    // Delete o Supr: Eliminar seleccionado
    if (e.key === 'Delete' || e.key === 'Supr') {
        if (selectedConnection) {
            deleteConnection(selectedConnection.id);
        } else if (selectedNode && document.activeElement.className !== 'node-content') {
            deleteNode(selectedNode.id);
        }
    }
    
    // Espacio: Activar modo pan
    if (e.key === ' ' && !isPanning && document.activeElement.tagName !== 'INPUT' && 
        !document.activeElement.isContentEditable) {
        e.preventDefault();
        canvasContainer.classList.add('panning');
    }
}

document.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
        canvasContainer.classList.remove('panning');
    }
});

// ==================== OTRAS FUNCIONES ====================

/**
 * Maneja el cambio de nombre del diagrama
 */
function handleNameBlur() {
    const newName = diagramNameInput.value.trim();
    
    if (newName === '' || newName === originalDiagramName) {
        diagramNameInput.value = originalDiagramName;
        return;
    }
    
    pendingNameChange = newName;
    document.getElementById('newNamePreview').textContent = newName;
    document.getElementById('nameModal').style.display = 'block';
    
    document.getElementById('btnConfirmName').onclick = () => {
        originalDiagramName = pendingNameChange;
        markAsChanged();
        saveDiagram();
        document.getElementById('nameModal').style.display = 'none';
        showNotification('Nombre actualizado', 'success', 2000);
    };
}

/**
 * Cancela el cambio de nombre
 */
function cancelNameChange() {
    diagramNameInput.value = originalDiagramName;
    document.getElementById('nameModal').style.display = 'none';
}

/**
 * Maneja el botón de volver al inicio
 */
function handleGoHome(e) {
    e.preventDefault();
    
    if (hasUnsavedChanges) {
        showConfirmModal(
            '¿Desea guardar los cambios antes de salir?',
            async () => {
                await saveDiagram();
                window.location.href = 'index.html';
            },
            () => {
                window.location.href = 'index.html';
            }
        );
    } else {
        window.location.href = 'index.html';
    }
}

/**
 * Maneja la descarga del diagrama
 */
async function handleDownload() {
    try {
        // Guardar primero
        await saveDiagram();
        
        // Exportar
        const json = await exportDiagram(currentDiagram._id);
        const filename = generateExportFilename(currentDiagram.name);
        
        downloadJSON(filename, json);
        
        showNotification('Diagrama descargado correctamente', 'success');
    } catch (error) {
        showNotification('Error al descargar el diagrama: ' + error.message, 'error');
        console.error(error);
    }
}

/**
 * Advertencia antes de salir
 */
function handleBeforeUnload(e) {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
}
