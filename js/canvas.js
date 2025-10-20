const NODE_WIDTH = 120;
const NODE_HEIGHT = 120;
const GRID_SIZE = 20;
const MAX_HISTORY = 50;
const AUTO_SAVE_DELAY = 2000;

const NODE_TYPES = {
    INICIO: 'inicio',
    FIN: 'fin',
    ASIGNACION: 'asignacion',
    DECISION: 'si',
    COMENTARIO: 'comentario'
};

const DEFAULT_CONTENT = {
    inicio: 'Inicio',
    fin: 'Fin',
    asignacion: 'Asignación',
    si: 'Decisión',
    comentario: 'Comentario'
};

const state = {
    currentDiagram: null,
    originalDiagramName: '',
    pendingNameChange: '',
    hasUnsavedChanges: false,
    nodes: [],
    connections: [],
    selectedNode: null,
    selectedConnection: null,
    isDragging: false,
    isPanning: false,
    isConnecting: false,
    connectionStart: null,
    dragOffset: { x: 0, y: 0 },
    panOffset: { x: 0, y: 0 },
    panStart: { x: 0, y: 0 },
    currentZoom: 100,
    nodeCounter: 0,
    connectionCounter: 0,
    history: [],
    historyIndex: -1
};

let dom = {
    nodeLayer: null,
    connectionLayer: null,
    canvasContainer: null,
    diagramNameInput: null,
    saveStatus: null
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoader('Cargando diagrama...');
        
        await initStorage();
        initDOMReferences();
        
        const urlParams = new URLSearchParams(window.location.search);
        const diagramId = urlParams.get('id');
        
        if (!diagramId) {
            throw new Error('No se especificó ID de diagrama');
        }
        
        await loadDiagram(diagramId);
        
        setupEventListeners();
        setupNodeMenu();
        setupZoomControls();
        setupKeyboardShortcuts();
        
        saveToHistory();
        
        hideLoader();
        showNotification('Diagrama cargado correctamente', 'success', 2000);
        
    } catch (error) {
        hideLoader();
        showNotification('Error: ' + error.message, 'error');
        console.error(error);
        setTimeout(() => window.location.href = 'index.html', 2000);
    }
});

function initDOMReferences() {
    dom.nodeLayer = document.getElementById('nodeLayer');
    dom.connectionLayer = document.getElementById('connectionLayer');
    dom.canvasContainer = document.getElementById('canvasContainer');
    dom.diagramNameInput = document.getElementById('diagramName');
    dom.saveStatus = document.getElementById('saveStatus');
    
    if (!dom.nodeLayer || !dom.connectionLayer || !dom.canvasContainer) {
        throw new Error('No se encontraron elementos del canvas');
    }
}

async function loadDiagram(id) {
    try {
        const diagram = await getDiagram(id);
        
        state.currentDiagram = diagram;
        state.originalDiagramName = diagram.name;
        state.nodes = diagram.nodes || [];
        state.connections = diagram.connections || [];
        
        if (diagram.metadata) {
            state.currentZoom = diagram.metadata.zoom || 100;
            state.panOffset.x = diagram.metadata.panX || 0;
            state.panOffset.y = diagram.metadata.panY || 0;
        }
        
        state.nodeCounter = Math.max(0, ...state.nodes.map(n => {
            const match = n.id.match(/node-(\d+)/);
            return match ? parseInt(match[1]) : 0;
        }), 0);
        
        state.connectionCounter = Math.max(0, ...state.connections.map(c => {
            const match = c.id.match(/conn-(\d+)/);
            return match ? parseInt(match[1]) : 0;
        }), 0);
        
        dom.diagramNameInput.value = diagram.name;
        
        renderAll();
        applyZoom(state.currentZoom);
        
        state.hasUnsavedChanges = false;
        
    } catch (error) {
        throw new Error('Error al cargar diagrama: ' + error.message);
    }
}

async function saveDiagram() {
    if (!state.currentDiagram) return;
    
    try {
        updateSaveStatus('saving');
        
        state.currentDiagram.name = state.originalDiagramName;
        state.currentDiagram.nodes = state.nodes;
        state.currentDiagram.connections = state.connections;
        state.currentDiagram.metadata = {
            zoom: state.currentZoom,
            panX: state.panOffset.x,
            panY: state.panOffset.y
        };
        
        const updated = await updateDiagram(state.currentDiagram);
        state.currentDiagram = updated;
        
        state.hasUnsavedChanges = false;
        updateSaveStatus('saved');
        
        return updated;
        
    } catch (error) {
        updateSaveStatus('error');
        throw error;
    }
}

const autoSave = debounce(async () => {
    if (state.hasUnsavedChanges) {
        try {
            await saveDiagram();
        } catch (error) {
            console.error('Error en auto-guardado:', error);
        }
    }
}, AUTO_SAVE_DELAY);

function markAsChanged() {
    state.hasUnsavedChanges = true;
    autoSave();
}

function updateSaveStatus(status) {
    const messages = {
        saving: 'Guardando...',
        saved: 'Guardado',
        error: 'Error al guardar'
    };
    
    dom.saveStatus.textContent = messages[status] || '';
    dom.saveStatus.className = 'save-status ' + status;
}


function createNode(type, x, y, content = '') {
    state.nodeCounter++;
    
    const node = {
        id: `node-${state.nodeCounter}`,
        type: type,
        x: x,
        y: y,
        content: content || DEFAULT_CONTENT[type] || ''
    };
    
    state.nodes.push(node);
    renderNode(node);
    
    saveToHistory();
    markAsChanged();
    
    return node;
}

function renderNode(node) {
    let nodeEl = document.getElementById(node.id);
    
    if (nodeEl) {
        nodeEl.style.left = node.x + 'px';
        nodeEl.style.top = node.y + 'px';
        
        const contentEl = nodeEl.querySelector('.node-content');
        if (contentEl) {
            contentEl.textContent = node.content;
        }
        return nodeEl;
    }
    
    nodeEl = document.createElement('div');
    nodeEl.className = `flow-node ${node.type}`;
    nodeEl.id = node.id;
    nodeEl.setAttribute('data-node-id', node.id);
    nodeEl.style.left = node.x + 'px';
    nodeEl.style.top = node.y + 'px';
    
    if (node.type === 'si') {
        nodeEl.setAttribute('data-width', NODE_WIDTH * 0.9);
        nodeEl.setAttribute('data-height', NODE_HEIGHT * 0.9);
    } else {
        nodeEl.setAttribute('data-width', NODE_WIDTH);
        nodeEl.setAttribute('data-height', NODE_HEIGHT);
    }
    
    const contentEl = document.createElement('div');
    contentEl.className = 'node-content';
    contentEl.contentEditable = (node.type !== 'inicio' && node.type !== 'fin');
    contentEl.textContent = node.content;
    contentEl.setAttribute('spellcheck', 'false');
    
    if (node.type !== 'inicio' && node.type !== 'fin') {
        contentEl.addEventListener('input', (e) => {
            node.content = e.target.textContent;
            markAsChanged();
        });
        
        contentEl.addEventListener('blur', () => {
            if (!contentEl.textContent.trim()) {
                contentEl.textContent = DEFAULT_CONTENT[node.type] || '';
                node.content = contentEl.textContent;
            }
        });
        
        contentEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                contentEl.blur();
            }
            e.stopPropagation();
        });
    }
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'node-delete-btn';
    deleteBtn.innerHTML = '<img src="icons/cerrar.svg" alt="Eliminar">';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNode(node.id);
    });
    
    const positions = node.type === 'si' ? ['top', 'right', 'left'] : ['top', 'right', 'bottom', 'left'];
    positions.forEach(pos => {
        const point = document.createElement('div');
        point.className = `connection-point ${pos}`;
        
        point.addEventListener('mousedown', (e) => handleConnectionStart(e, node, pos));
        point.addEventListener('touchstart', (e) => handleConnectionStart(e, node, pos));
        nodeEl.appendChild(point);
    });
    
    if (node.type === 'si') {
        const labelSi = document.createElement('div');
        labelSi.className = 'decision-label decision-label-yes';
        labelSi.textContent = 'Sí';
        nodeEl.appendChild(labelSi);
        
        const labelNo = document.createElement('div');
        labelNo.className = 'decision-label decision-label-no';
        labelNo.textContent = 'No';
        nodeEl.appendChild(labelNo);
    }
    
    nodeEl.addEventListener('mouseenter', () => {
        nodeEl.classList.add('show-connection-points');
    });
    
    nodeEl.addEventListener('mouseleave', () => {
        if (!state.isConnecting || (state.connectionStart && state.connectionStart.node.id !== node.id)) {
            nodeEl.classList.remove('show-connection-points');
        }
    });
    
    nodeEl.addEventListener('mousedown', (e) => handleNodeMouseDown(e, node));
    nodeEl.addEventListener('touchstart', (e) => handleNodeTouchStart(e, node));
    
    nodeEl.appendChild(contentEl);
    nodeEl.appendChild(deleteBtn);
    dom.nodeLayer.appendChild(nodeEl);
    
    return nodeEl;
}

function deleteNode(nodeId) {
    state.nodes = state.nodes.filter(n => n.id !== nodeId);
    
    const connToDelete = state.connections.filter(c => 
        c.from === nodeId || c.to === nodeId
    );
    
    connToDelete.forEach(c => deleteConnection(c.id));
    
    const nodeEl = document.getElementById(nodeId);
    if (nodeEl) {
        nodeEl.remove();
    }
    
    if (state.selectedNode && state.selectedNode.id === nodeId) {
        state.selectedNode = null;
    }
    
    saveToHistory();
    markAsChanged();
}

function renderAllNodes() {
    dom.nodeLayer.innerHTML = '';
    state.nodes.forEach(node => renderNode(node));
}

function createConnection(fromNodeId, fromPos, toNodeId, toPos) {
    const exists = state.connections.some(c => 
        c.from === fromNodeId && 
        c.to === toNodeId && 
        c.fromPosition === fromPos && 
        c.toPosition === toPos
    );
    
    if (exists) {
        showNotification('Esta conexión ya existe', 'warning', 2000);
        return null;
    }
    
    if (fromNodeId === toNodeId) {
        showNotification('No se puede conectar un nodo consigo mismo', 'warning', 2000);
        return null;
    }
    
    state.connectionCounter++;
    
    const fromNode = state.nodes.find(n => n.id === fromNodeId);
    const toNode = state.nodes.find(n => n.id === toNodeId);
    
    const fromPoint = getConnectionPointFromDOM(fromNode, fromPos);
    const toPoint = getConnectionPointFromDOM(toNode, toPos);
    
    const connection = {
        id: `conn-${state.connectionCounter}`,
        from: fromNodeId,
        to: toNodeId,
        fromPosition: fromPos,
        toPosition: toPos,
        fromOffset: {
            x: fromPoint.x - fromNode.x,
            y: fromPoint.y - fromNode.y
        },
        toOffset: {
            x: toPoint.x - toNode.x,
            y: toPoint.y - toNode.y
        }
    };
    
    state.connections.push(connection);
    renderConnection(connection);
    
    saveToHistory();
    markAsChanged();
    
    return connection;
}

function renderConnection(connection) {
    const fromNode = state.nodes.find(n => n.id === connection.from);
    const toNode = state.nodes.find(n => n.id === connection.to);
    
    if (!fromNode || !toNode) return;
    
    let fromPoint, toPoint;
    
    if (connection.fromOffset && connection.toOffset) {
        fromPoint = {
            x: fromNode.x + connection.fromOffset.x,
            y: fromNode.y + connection.fromOffset.y
        };
        toPoint = {
            x: toNode.x + connection.toOffset.x,
            y: toNode.y + connection.toOffset.y
        };
    } else {
        fromPoint = getConnectionPoint(fromNode, connection.fromPosition);
        toPoint = getConnectionPoint(toNode, connection.toPosition);
    }
    
    const pathId = `path-${connection.id}`;
    let path = document.getElementById(pathId);
    
    if (!path) {
        const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitPath.id = `hit-${pathId}`;
        hitPath.style.fill = 'none';
        hitPath.style.stroke = 'transparent';
        hitPath.style.strokeWidth = '20px';
        hitPath.style.cursor = 'pointer';
        hitPath.style.pointerEvents = 'stroke';
        hitPath.addEventListener('click', (e) => {
            e.stopPropagation();
            selectConnection(connection);
        });
        
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.id = pathId;
        path.setAttribute('data-connection-id', connection.id);
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.style.fill = 'none';
        path.style.cursor = 'pointer';
        path.style.pointerEvents = 'none';
        
        dom.connectionLayer.appendChild(hitPath);
        dom.connectionLayer.appendChild(path);
    }
    
    const pathData = createCurvedPath(fromPoint, toPoint);
    path.setAttribute('d', pathData);
    
    const hitPath = document.getElementById(`hit-${pathId}`);
    if (hitPath) {
        hitPath.setAttribute('d', pathData);
    }
    
    const strokeWidth = 2 / (state.currentZoom / 100);
    path.style.stroke = '#2C3E50';
    path.style.strokeWidth = strokeWidth + 'px';
    
    if (fromNode.type === 'comentario' || toNode.type === 'comentario') {
        const dashSize = 5 / (state.currentZoom / 100);
        path.style.strokeDasharray = `${dashSize} ${dashSize}`;
    } else {
        path.style.strokeDasharray = 'none';
    }
}

function deleteConnection(connectionId) {
    state.connections = state.connections.filter(c => c.id !== connectionId);
    
    const path = document.getElementById(`path-${connectionId}`);
    if (path) {
        path.remove();
    }
    
    const hitPath = document.getElementById(`hit-path-${connectionId}`);
    if (hitPath) {
        hitPath.remove();
    }
    
    const deleteBtn = document.getElementById(`delete-${connectionId}`);
    if (deleteBtn) {
        deleteBtn.remove();
    }
    
    if (state.selectedConnection && state.selectedConnection.id === connectionId) {
        state.selectedConnection = null;
    }
    
    saveToHistory();
    markAsChanged();
}

function renderAllConnections() {
    const defs = dom.connectionLayer.querySelector('defs');
    dom.connectionLayer.innerHTML = '';
    if (defs) {
        dom.connectionLayer.appendChild(defs);
    }
    
    state.connections.forEach(conn => renderConnection(conn));
}

function updateNodeConnections(nodeId) {
    state.connections.forEach(conn => {
        if (conn.from === nodeId || conn.to === nodeId) {
            renderConnection(conn);
            
            if (state.selectedConnection && state.selectedConnection.id === conn.id) {
                showConnectionDeleteButton(conn);
            }
        }
    });
}

function getConnectionPoint(node, position) {
    const nodeEl = document.getElementById(node.id);
    if (nodeEl) {
        const left = parseInt(nodeEl.style.left) || node.x;
        const top = parseInt(nodeEl.style.top) || node.y;
        node.x = left;
        node.y = top;
        
        const nodeWidth = parseFloat(nodeEl.getAttribute('data-width')) || NODE_WIDTH;
        const nodeHeight = parseFloat(nodeEl.getAttribute('data-height')) || NODE_HEIGHT;
        
        switch (position) {
            case 'top': 
                return { x: node.x + nodeWidth / 2, y: node.y };
            case 'right': 
                return { x: node.x + nodeWidth, y: node.y + nodeHeight / 2 };
            case 'bottom': 
                return { x: node.x + nodeWidth / 2, y: node.y + nodeHeight };
            case 'left': 
                return { x: node.x, y: node.y + nodeHeight / 2 };
        }
    }

    console.warn('No se encontró el nodo, usando fallback geométrico');
    let nodeWidth = node.type === 'si' ? NODE_WIDTH * 0.9 : NODE_WIDTH;
    let nodeHeight = node.type === 'si' ? NODE_HEIGHT * 0.9 : NODE_HEIGHT;

    switch (position) {
        case 'top': return { x: node.x + nodeWidth / 2, y: node.y };
        case 'right': return { x: node.x + nodeWidth, y: node.y + nodeHeight / 2 };
        case 'bottom': return { x: node.x + nodeWidth / 2, y: node.y + nodeHeight };
        case 'left': return { x: node.x, y: node.y + nodeHeight / 2 };
    }

    return { x: node.x + nodeWidth / 2, y: node.y + nodeHeight / 2 };
}

function getConnectionPointFromDOM(node, position) {
    const nodeEl = document.getElementById(node.id);
    if (nodeEl) {
        const pointEl = nodeEl.querySelector(`.connection-point.${position}`);
        if (pointEl) {
            const rect = pointEl.getBoundingClientRect();
            const containerRect = dom.canvasContainer.getBoundingClientRect();
            
            const screenX = rect.left + rect.width / 2;
            const screenY = rect.top + rect.height / 2;
            
            const scale = state.currentZoom / 100;
            const canvasX = (screenX - containerRect.left - state.panOffset.x) / scale;
            const canvasY = (screenY - containerRect.top - state.panOffset.y) / scale;
            
            return { x: canvasX, y: canvasY };
        }
    }
    
    return getConnectionPoint(node, position);
}

function createCurvedPath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    const curvature = Math.min(distance / 3, 100);
    
    let cp1x, cp1y, cp2x, cp2y;
    
    if (isHorizontal) {
        cp1x = from.x + curvature * Math.sign(dx);
        cp1y = from.y;
        cp2x = to.x - curvature * Math.sign(dx);
        cp2y = to.y;
    } else {
        cp1x = from.x;
        cp1y = from.y + curvature * Math.sign(dy);
        cp2x = to.x;
        cp2y = to.y - curvature * Math.sign(dy);
    }
    
    return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
}

function selectConnection(connection) {
    deselectAll();
    
    state.selectedConnection = connection;
    
    const path = document.getElementById(`path-${connection.id}`);
    if (path) {
        path.classList.add('selected');
    }
    
    showConnectionDeleteButton(connection);
}

function showConnectionDeleteButton(connection) {
    const oldBtn = document.querySelector('.connection-delete-btn');
    if (oldBtn) oldBtn.remove();
    
    const fromNode = state.nodes.find(n => n.id === connection.from);
    const toNode = state.nodes.find(n => n.id === connection.to);
    
    if (!fromNode || !toNode) return;
    
    let fromPoint, toPoint;
    
    if (connection.fromOffset && connection.toOffset) {
        fromPoint = {
            x: fromNode.x + connection.fromOffset.x,
            y: fromNode.y + connection.fromOffset.y
        };
        toPoint = {
            x: toNode.x + connection.toOffset.x,
            y: toNode.y + connection.toOffset.y
        };
    } else {
        fromPoint = getConnectionPoint(fromNode, connection.fromPosition);
        toPoint = getConnectionPoint(toNode, connection.toPosition);
    }
    
    const midX = (fromPoint.x + toPoint.x) / 2;
    const midY = (fromPoint.y + toPoint.y) / 2;
    
    const btn = document.createElement('button');
    btn.className = 'connection-delete-btn';
    btn.innerHTML = '×';
    btn.style.left = midX + 'px';
    btn.style.top = midY + 'px';
    btn.onclick = () => {
        deleteConnection(connection.id);
        deselectAll();
    };
    
    dom.nodeLayer.appendChild(btn);
}

function setupEventListeners() {
    dom.canvasContainer.addEventListener('mousedown', handleCanvasMouseDown);
    dom.canvasContainer.addEventListener('mousemove', handleCanvasMouseMove);
    dom.canvasContainer.addEventListener('mouseup', handleCanvasMouseUp);
    dom.canvasContainer.addEventListener('wheel', handleCanvasWheel);
    dom.canvasContainer.addEventListener('dragover', handleDragOver);
    dom.canvasContainer.addEventListener('drop', handleDrop);
    
    dom.canvasContainer.addEventListener('touchstart', handleCanvasTouchStart);
    dom.canvasContainer.addEventListener('touchmove', handleCanvasTouchMove);
    dom.canvasContainer.addEventListener('touchend', handleCanvasTouchEnd);
    
    dom.diagramNameInput.addEventListener('blur', handleNameBlur);
    
    document.getElementById('btnHome').addEventListener('click', handleGoHome);
    document.getElementById('btnDownload').addEventListener('click', handleDownload);
    
    window.addEventListener('beforeunload', handleBeforeUnload);
}

function handleCanvasMouseDown(e) {
    if (e.target === dom.canvasContainer || e.target === dom.nodeLayer) {
        deselectAll();
        
        if (e.button === 0) {
            state.isPanning = true;
            state.panStart.x = e.clientX - state.panOffset.x;
            state.panStart.y = e.clientY - state.panOffset.y;
            dom.canvasContainer.style.cursor = 'grabbing';
        }
    }
}

function handleCanvasMouseMove(e) {
    if (state.isPanning) {
        state.panOffset.x = e.clientX - state.panStart.x;
        state.panOffset.y = e.clientY - state.panStart.y;
        applyZoom(state.currentZoom);
    } else if (state.isDragging && state.selectedNode) {
        const rect = dom.canvasContainer.getBoundingClientRect();
        const scale = state.currentZoom / 100;
        
        const x = (e.clientX - rect.left) / scale - state.panOffset.x / scale - state.dragOffset.x;
        const y = (e.clientY - rect.top) / scale - state.panOffset.y / scale - state.dragOffset.y;
        
        state.selectedNode.x = x;
        state.selectedNode.y = y;
        
        renderNode(state.selectedNode);
        updateNodeConnections(state.selectedNode.id);
    } else if (state.isConnecting) {
        drawTemporaryConnection(e);
    }
}

function handleCanvasMouseUp(e) {
    if (state.isPanning) {
        state.isPanning = false;
        dom.canvasContainer.style.cursor = '';
        markAsChanged();
    }
    
    if (state.isDragging) {
        state.isDragging = false;
        const nodeEl = document.getElementById(state.selectedNode.id);
        if (nodeEl) {
            nodeEl.classList.remove('dragging');
        }
        saveToHistory();
        markAsChanged();
    }
}

function handleNodeMouseDown(e, node) {
    if (e.target.classList.contains('node-content')) {
        return;
    }
    
    e.stopPropagation();
    
    selectNode(node);
    
    state.isDragging = true;
    const rect = dom.canvasContainer.getBoundingClientRect();
    const scale = state.currentZoom / 100;
    
    state.dragOffset.x = (e.clientX - rect.left) / scale - state.panOffset.x / scale - node.x;
    state.dragOffset.y = (e.clientY - rect.top) / scale - state.panOffset.y / scale - node.y;
    
    const nodeEl = document.getElementById(node.id);
    if (nodeEl) {
        nodeEl.classList.add('dragging');
    }
}

function handleNodeTouchStart(e, node) {
    if (e.target.classList.contains('node-content')) {
        return;
    }
    
    e.preventDefault();
    
    selectNode(node);
    
    state.isDragging = true;
    const touch = e.touches[0];
    const rect = dom.canvasContainer.getBoundingClientRect();
    const scale = state.currentZoom / 100;
    
    state.dragOffset.x = (touch.clientX - rect.left) / scale - state.panOffset.x / scale - node.x;
    state.dragOffset.y = (touch.clientY - rect.top) / scale - state.panOffset.y / scale - node.y;
}

function handleConnectionStart(e, node, position) {
    e.stopPropagation();
    e.preventDefault();
    
    if (state.isConnecting && state.connectionStart) {
        if (state.connectionStart.node.id !== node.id) {
            createConnection(
                state.connectionStart.node.id,
                state.connectionStart.position,
                node.id,
                position
            );
        }
        
        const originNodeEl = document.getElementById(state.connectionStart.node.id);
        if (originNodeEl) {
            originNodeEl.classList.remove('show-connection-points');
        }
        
        state.isConnecting = false;
        state.connectionStart = null;
        removeTemporaryConnection();
        dom.canvasContainer.style.cursor = '';
        
    } else {
        state.isConnecting = true;
        state.connectionStart = { node, position };
        dom.canvasContainer.style.cursor = 'crosshair';
        
        const nodeEl = document.getElementById(node.id);
        if (nodeEl) {
            nodeEl.classList.add('show-connection-points');
        }
    }
}

function drawTemporaryConnection(e) {
    if (!state.connectionStart) return;
    
    const tempId = 'temp-connection';
    let tempPath = document.getElementById(tempId);
    
    if (!tempPath) {
        tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempPath.id = tempId;
        tempPath.setAttribute('marker-end', 'url(#arrowhead)');
        tempPath.style.stroke = '#00C1BA';
        tempPath.style.strokeDasharray = '5,5';
        tempPath.style.fill = 'none';
        dom.connectionLayer.appendChild(tempPath);
    }
    
    const fromPoint = getConnectionPointFromDOM(
        state.connectionStart.node,
        state.connectionStart.position
    );
    
    const rect = dom.canvasContainer.getBoundingClientRect();
    const scale = state.currentZoom / 100;
    const toPoint = {
        x: (e.clientX - rect.left) / scale - state.panOffset.x / scale,
        y: (e.clientY - rect.top) / scale - state.panOffset.y / scale
    };
    
    const pathData = createCurvedPath(fromPoint, toPoint);
    tempPath.setAttribute('d', pathData);
    
    const strokeWidth = 2 / scale;
    tempPath.style.strokeWidth = strokeWidth + 'px';
}

function removeTemporaryConnection() {
    const tempPath = document.getElementById('temp-connection');
    if (tempPath) {
        tempPath.remove();
    }
}

function handleCanvasTouchStart(e) {
    if (e.target === dom.canvasContainer || e.target === dom.nodeLayer) {
        deselectAll();
    }
}

function handleCanvasTouchMove(e) {
    if (state.isDragging && state.selectedNode && e.touches.length === 1) {
        e.preventDefault();
        
        const touch = e.touches[0];
        const rect = dom.canvasContainer.getBoundingClientRect();
        const scale = state.currentZoom / 100;
        
        const x = (touch.clientX - rect.left) / scale - state.panOffset.x / scale - state.dragOffset.x;
        const y = (touch.clientY - rect.top) / scale - state.panOffset.y / scale - state.dragOffset.y;
        
        state.selectedNode.x = x;
        state.selectedNode.y = y;
        
        renderNode(state.selectedNode);
        updateNodeConnections(state.selectedNode.id);
    }
}

function handleCanvasTouchEnd(e) {
    if (state.isDragging) {
        state.isDragging = false;
        saveToHistory();
        markAsChanged();
    }
}

function handleCanvasWheel(e) {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? -10 : 10;
    const newZoom = Math.min(250, Math.max(15, state.currentZoom + delta));
    
    const rect = dom.canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    applyZoomAtPoint(newZoom, mouseX, mouseY);
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
    
    const rect = dom.canvasContainer.getBoundingClientRect();
    const scale = state.currentZoom / 100;
    
    const cursorX = (e.clientX - rect.left - state.panOffset.x) / scale;
    const cursorY = (e.clientY - rect.top - state.panOffset.y) / scale;
    
    const nodeWidth = nodeType === 'si' ? NODE_WIDTH * 0.9 : NODE_WIDTH;
    const nodeHeight = nodeType === 'si' ? NODE_HEIGHT * 0.9 : NODE_HEIGHT;
    
    const x = cursorX - nodeWidth / 2;
    const y = cursorY - nodeHeight / 2;
    
    createNode(nodeType, x, y);
}

function selectNode(node) {
    deselectAll();
    
    state.selectedNode = node;
    
    const nodeEl = document.getElementById(node.id);
    if (nodeEl) {
        nodeEl.classList.add('selected');
    }
}

function deselectAll() {
    if (state.selectedNode) {
        const nodeEl = document.getElementById(state.selectedNode.id);
        if (nodeEl) {
            nodeEl.classList.remove('selected');
        }
        state.selectedNode = null;
    }
    
    if (state.selectedConnection) {
        const path = document.getElementById(`path-${state.selectedConnection.id}`);
        if (path) {
            path.classList.remove('selected');
        }
        state.selectedConnection = null;
    }
    
    const deleteBtn = document.querySelector('.connection-delete-btn');
    if (deleteBtn) deleteBtn.remove();
}

function setupNodeMenu() {
    const menuBtn = document.getElementById('btnMenu');
    const menu = document.getElementById('nodeMenu');
    const nodeItems = document.querySelectorAll('.node-item');
    
    menuBtn.addEventListener('click', () => {
        const isVisible = menu.style.display === 'block';
        menu.style.display = isVisible ? 'none' : 'block';
        
        if (menu.style.display === 'block') {
            menuBtn.classList.add('hidden');
        } else {
            menuBtn.classList.remove('hidden');
        }
    });
    
    nodeItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            const nodeType = item.getAttribute('data-node-type');
            e.dataTransfer.setData('nodeType', nodeType);
            e.dataTransfer.effectAllowed = 'copy';
            
            const rect = item.getBoundingClientRect();
            const offsetX = rect.width / 2;
            const offsetY = rect.height / 2;
            e.dataTransfer.setDragImage(item, offsetX, offsetY);
        });
        
        item.addEventListener('click', () => {
            const nodeType = item.getAttribute('data-node-type');
            addNodeAtCenter(nodeType);
        });
    });
}

function toggleNodeMenu() {
    const menu = document.getElementById('nodeMenu');
    const menuBtn = document.getElementById('btnMenu');
    const isVisible = menu.style.display === 'block';
    menu.style.display = isVisible ? 'none' : 'block';
    
    if (menu.style.display === 'block') {
        menuBtn.classList.add('hidden');
    } else {
        menuBtn.classList.remove('hidden');
    }
}

function addNodeAtCenter(nodeType) {
    const rect = dom.canvasContainer.getBoundingClientRect();
    const scale = state.currentZoom / 100;
    
    const centerX = (rect.width / 2) / scale - state.panOffset.x / scale - NODE_WIDTH / 2;
    const centerY = (rect.height / 2) / scale - state.panOffset.y / scale - NODE_HEIGHT / 2;
    
    createNode(nodeType, centerX, centerY);
}

function setupZoomControls() {
    const zoomSlider = document.getElementById('zoomSlider');
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    
    zoomSlider.addEventListener('input', (e) => {
        applyZoom(parseInt(e.target.value));
    });
    
    zoomSlider.addEventListener('change', () => {
        markAsChanged();
    });
    
    btnZoomIn.addEventListener('click', () => {
        applyZoom(Math.min(250, state.currentZoom + 10));
        markAsChanged();
    });
    
    btnZoomOut.addEventListener('click', () => {
        applyZoom(Math.max(50, state.currentZoom - 10));
        markAsChanged();
    });
    
    btnUndo.addEventListener('click', undo);
    btnRedo.addEventListener('click', redo);
}

function applyZoom(zoom) {
    state.currentZoom = Math.min(250, Math.max(15, zoom));
    
    const scale = state.currentZoom / 100;
    const transform = `translate(${state.panOffset.x}px, ${state.panOffset.y}px) scale(${scale})`;
    
    dom.nodeLayer.style.transform = transform;
    dom.nodeLayer.style.transformOrigin = '0 0';
    
    dom.connectionLayer.style.transform = transform;
    dom.connectionLayer.style.transformOrigin = '0 0';
    
    document.getElementById('zoomSlider').value = state.currentZoom;
    document.getElementById('zoomValue').textContent = state.currentZoom + '%';
    
    renderAllConnections();
}

function applyZoomAtPoint(newZoom, focalX, focalY) {
    const oldZoom = state.currentZoom;
    const oldScale = oldZoom / 100;
    const newScale = newZoom / 100;
    
    const canvasX = (focalX - state.panOffset.x) / oldScale;
    const canvasY = (focalY - state.panOffset.y) / oldScale;
    
    state.currentZoom = Math.min(250, Math.max(15, newZoom));
    
    state.panOffset.x = focalX - canvasX * newScale;
    state.panOffset.y = focalY - canvasY * newScale;
    
    const scale = state.currentZoom / 100;
    const transform = `translate(${state.panOffset.x}px, ${state.panOffset.y}px) scale(${scale})`;
    
    dom.nodeLayer.style.transform = transform;
    dom.nodeLayer.style.transformOrigin = '0 0';
    
    dom.connectionLayer.style.transform = transform;
    dom.connectionLayer.style.transformOrigin = '0 0';
    
    document.getElementById('zoomSlider').value = state.currentZoom;
    document.getElementById('zoomValue').textContent = state.currentZoom + '%';
    
    renderAllConnections();
}

function fitToView() {
    if (state.nodes.length === 0) {
        applyZoom(100);
        state.panOffset.x = 0;
        state.panOffset.y = 0;
        return;
    }
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    state.nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + NODE_WIDTH);
        maxY = Math.max(maxY, node.y + NODE_HEIGHT);
    });
    
    const margin = 50;
    minX -= margin;
    minY -= margin;
    maxX += margin;
    maxY += margin;
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    const containerRect = dom.canvasContainer.getBoundingClientRect();
    
    const scaleX = containerRect.width / contentWidth;
    const scaleY = containerRect.height / contentHeight;
    const optimalScale = Math.min(scaleX, scaleY);
    
    const newZoom = Math.round(optimalScale * 100);
    state.currentZoom = Math.min(250, Math.max(50, newZoom));
    
    const scale = state.currentZoom / 100;
    const scaledWidth = contentWidth * scale;
    const scaledHeight = contentHeight * scale;
    
    state.panOffset.x = (containerRect.width - scaledWidth) / 2 - minX * scale;
    state.panOffset.y = (containerRect.height - scaledHeight) / 2 - minY * scale;
    
    applyZoom(state.currentZoom);
}

function saveToHistory() {
    const snapshot = {
        nodes: JSON.parse(JSON.stringify(state.nodes)),
        connections: JSON.parse(JSON.stringify(state.connections)),
        zoom: state.currentZoom,
        pan: { ...state.panOffset }
    };
    
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snapshot);
    
    if (state.history.length > MAX_HISTORY) {
        state.history.shift();
    } else {
        state.historyIndex++;
    }
}

function undo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        restoreState(state.history[state.historyIndex]);
        showNotification('Deshecho', 'info', 1500);
    }
}

function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        restoreState(state.history[state.historyIndex]);
        showNotification('Rehecho', 'info', 1500);
    }
}

function restoreState(snapshot) {
    state.nodes = JSON.parse(JSON.stringify(snapshot.nodes));
    state.connections = JSON.parse(JSON.stringify(snapshot.connections));
    state.currentZoom = snapshot.zoom;
    state.panOffset = { ...snapshot.pan };
    
    renderAll();
    applyZoom(state.currentZoom);
    
    markAsChanged();
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeyDown);
}

function handleKeyDown(e) {
    if (e.target.classList.contains('node-content') || e.target.tagName === 'INPUT') {
        return;
    }
    
    if (e.key === 'Escape') {
        if (state.isConnecting) {
            if (state.connectionStart) {
                const originNodeEl = document.getElementById(state.connectionStart.node.id);
                if (originNodeEl) {
                    originNodeEl.classList.remove('show-connection-points');
                }
            }
            
            state.isConnecting = false;
            state.connectionStart = null;
            removeTemporaryConnection();
            dom.canvasContainer.style.cursor = '';
        }
    }
    
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveDiagram().then(() => {
            showNotification('Guardado', 'success', 2000);
        }).catch(err => {
            showNotification('Error al guardar', 'error');
        });
    }
    
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
    }
    
    if (e.key === 'Delete') {
        if (state.selectedConnection) {
            deleteConnection(state.selectedConnection.id);
        } else if (state.selectedNode) {
            deleteNode(state.selectedNode.id);
        }
    }
    
    if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        state.panOffset.x = 0;
        state.panOffset.y = 0;
        applyZoom(100);
        markAsChanged();
    }
}

function renderAll() {
    renderAllNodes();
    renderAllConnections();
}

function handleNameBlur() {
    const newName = dom.diagramNameInput.value.trim();
    
    if (newName === '' || newName === state.originalDiagramName) {
        dom.diagramNameInput.value = state.originalDiagramName;
        return;
    }
    
    state.pendingNameChange = newName;
    document.getElementById('newNamePreview').textContent = newName;
    document.getElementById('nameModal').style.display = 'block';
    
    document.getElementById('btnConfirmName').onclick = () => {
        state.originalDiagramName = state.pendingNameChange;
        markAsChanged();
        saveDiagram();
        document.getElementById('nameModal').style.display = 'none';
        showNotification('Nombre actualizado', 'success', 2000);
    };
}

function cancelNameChange() {
    dom.diagramNameInput.value = state.originalDiagramName;
    document.getElementById('nameModal').style.display = 'none';
}

function handleGoHome(e) {
    e.preventDefault();
    
    if (state.hasUnsavedChanges) {
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

async function handleDownload() {
    try {
        await saveDiagram();
        
        const json = await exportDiagram(state.currentDiagram._id);
        const filename = generateExportFilename(state.currentDiagram.name);
        
        downloadJSON(filename, json);
        
        showNotification('Diagrama descargado', 'success');
    } catch (error) {
        showNotification('Error al descargar: ' + error.message, 'error');
        console.error(error);
    }
}

function handleBeforeUnload(e) {
    if (state.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
}
