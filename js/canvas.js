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
    
    nodeEl.innerHTML = `
        <div class="node-delete-btn" onclick="deleteNode('${node.id}')">
            <img src="icons/cerrar.svg" alt="Eliminar">
        </div>
        <img src="${iconSrc}" alt="" class="node-svg-direct">
        <div class="node-content" contenteditable="true">${node.content}</div>
        <div class="connection-point top" data-position="top"></div>
        <div class="connection-point right" data-position="right"></div>
        <div class="connection-point bottom" data-position="bottom"></div>
        <div class="connection-point left" data-position="left"></div>
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
        e.target.classList.contains('connection-point')) {
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
 * Renderiza una conexión
 */
function renderConnection(connection) {
    const fromNode = nodes.find(n => n.id === connection.from);
    const toNode = nodes.find(n => n.id === connection.to);
    
    if (!fromNode || !toNode) return;
    
    const fromPoint = getConnectionPoint(fromNode, connection.fromPosition);
    const toPoint = getConnectionPoint(toNode, connection.toPosition);
    
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
}

/**
 * Renderiza todas las conexiones
 */
function renderAllConnections() {
    // Limpiar paths existentes
    const paths = connectionLayer.querySelectorAll('path');
    paths.forEach(path => path.remove());
    
    // Re-renderizar todas
    connections.forEach(connection => renderConnection(connection));
}

/**
 * Obtiene las coordenadas de un punto de conexión de un nodo
 */
function getConnectionPoint(node, position) {
    const halfWidth = node.width / 2;
    const halfHeight = node.height / 2;
    
    let x = node.x + halfWidth;
    let y = node.y + halfHeight;
    
    switch (position) {
        case 'top':
            y = node.y;
            break;
        case 'right':
            x = node.x + node.width;
            break;
        case 'bottom':
            y = node.y + node.height;
            break;
        case 'left':
            x = node.x;
            break;
    }
    
    return { x, y };
}

/**
 * Crea un path curvo entre dos puntos
 */
function createCurvePath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    
    // Usar curvas bezier para conexiones suaves
    const curvature = 0.3;
    const cx1 = from.x + dx * curvature;
    const cy1 = from.y;
    const cx2 = to.x - dx * curvature;
    const cy2 = to.y;
    
    return `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`;
}

/**
 * Selecciona una conexión
 */
function selectConnection(connection) {
    // Deseleccionar anteriores
    const paths = connectionLayer.querySelectorAll('path');
    paths.forEach(p => p.classList.remove('selected'));
    
    // Seleccionar actual
    const path = document.getElementById(`path-${connection.id}`);
    if (path) {
        path.classList.add('selected');
        selectedConnection = connection;
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
    
    selectedConnection = null;
    markAsChanged();
    saveToHistory();
}

/**
 * Maneja el inicio de creación de conexión
 */
function handleConnectionPointMouseDown(e, node, position) {
    e.stopPropagation();
    e.preventDefault();
    
    isConnecting = true;
    connectionStart = { node: node, position: position };
    
    canvasContainer.style.cursor = 'crosshair';
}

function handleConnectionPointTouchStart(e, node, position) {
    e.stopPropagation();
    e.preventDefault();
    
    isConnecting = true;
    connectionStart = { node: node, position: position };
}

// ==================== MANEJO DE EVENTOS DEL CANVAS ====================

function handleCanvasMouseDown(e) {
    // Verificar si es sobre el fondo del canvas
    const isCanvasBackground = e.target === canvasContainer || e.target === nodeLayer || e.target.closest('.connection-layer');
    
    if (isCanvasBackground) {
        e.preventDefault();
        
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
    }
}

function handleCanvasMouseMove(e) {
    if (isPanning) {
        panOffset.x = e.clientX - panStart.x;
        panOffset.y = e.clientY - panStart.y;
        applyPan();
        markAsChanged();
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
        // Mostrar línea temporal mientras se crea la conexión
        drawTemporaryConnection(e);
    }
}

function handleCanvasDoubleClick(e) {
    // Doble clic en el canvas vacío para iniciar selección múltiple
    const isCanvasBackground = e.target === canvasContainer || e.target === nodeLayer || e.target.closest('.connection-layer');
    
    if (isCanvasBackground) {
        e.preventDefault();
        showNotification('Mantén presionado y arrastra para seleccionar múltiples nodos (próximamente)', 'info', 2000);
    }
}

function handleCanvasMouseUp(e) {
    if (isPanning) {
        isPanning = false;
        canvasContainer.classList.remove('panning');
        canvasContainer.style.cursor = '';
    } else if (isDragging && selectedNode) {
        const nodeEl = document.getElementById(selectedNode.id);
        if (nodeEl) {
            nodeEl.classList.remove('dragging');
        }
        isDragging = false;
        saveToHistory();
    } else if (isConnecting && connectionStart) {
        // Verificar si se soltó sobre un punto de conexión
        const target = e.target;
        if (target.classList.contains('connection-point')) {
            const nodeEl = target.closest('.flow-node');
            if (nodeEl) {
                const targetNodeId = nodeEl.getAttribute('data-node-id');
                const targetPosition = target.getAttribute('data-position');
                
                // No permitir conexiones del mismo nodo a sí mismo
                if (targetNodeId !== connectionStart.node.id) {
                    createConnection(
                        connectionStart.node.id,
                        connectionStart.position,
                        targetNodeId,
                        targetPosition
                    );
                }
            }
        }
        
        isConnecting = false;
        connectionStart = null;
        removeTemporaryConnection();
        canvasContainer.style.cursor = 'default';
    }
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
    } else if (isConnecting && connectionStart) {
        const touch = e.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (target && target.classList.contains('connection-point')) {
            const nodeEl = target.closest('.flow-node');
            if (nodeEl) {
                const targetNodeId = nodeEl.getAttribute('data-node-id');
                const targetPosition = target.getAttribute('data-position');
                
                if (targetNodeId !== connectionStart.node.id) {
                    createConnection(
                        connectionStart.node.id,
                        connectionStart.position,
                        targetNodeId,
                        targetPosition
                    );
                }
            }
        }
        
        isConnecting = false;
        connectionStart = null;
    }
}

function handleCanvasWheel(e) {
    // Zoom con scroll (sin necesidad de Ctrl)
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? -10 : 10;
    const newZoom = Math.min(250, Math.max(50, currentZoom + delta));
    
    applyZoom(newZoom);
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
    
    const fromPoint = getConnectionPoint(connectionStart.node, connectionStart.position);
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
    });
    
    zoomSlider.addEventListener('change', () => {
        markAsChanged();
    });
    
    btnZoomIn.addEventListener('click', () => {
        const newZoom = Math.min(250, currentZoom + 10);
        applyZoom(newZoom);
        markAsChanged();
    });
    
    btnZoomOut.addEventListener('click', () => {
        const newZoom = Math.max(50, currentZoom - 10);
        applyZoom(newZoom);
        markAsChanged();
    });
    
    btnFitView.addEventListener('click', () => {
        fitToView();
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
