/**
 * app.js
 * Lógica principal para la vista inicial (index.html)
 */

// Estado global
let diagrams = [];

/**
 * Inicialización de la aplicación
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoader('Iniciando aplicación...');
        
        // Inicializar almacenamiento
        await initStorage();
        
        // Cargar diagramas
        await loadDiagrams();
        
        // Configurar event listeners
        setupEventListeners();
        
        hideLoader();
    } catch (error) {
        hideLoader();
        showNotification('Error al iniciar la aplicación: ' + error.message, 'error');
        console.error(error);
    }
});

/**
 * Carga todos los diagramas
 */
async function loadDiagrams() {
    try {
        diagrams = await listDiagrams();
        renderDiagrams();
    } catch (error) {
        showNotification('Error al cargar diagramas', 'error');
        console.error(error);
    }
}

/**
 * Renderiza la lista de diagramas
 */
function renderDiagrams() {
    const emptyState = document.getElementById('emptyState');
    const diagramList = document.getElementById('diagramList');
    const container = document.getElementById('diagramsContainer');
    
    if (diagrams.length === 0) {
        // Mostrar estado vacío
        emptyState.style.display = 'flex';
        diagramList.style.display = 'none';
    } else {
        // Mostrar lista
        emptyState.style.display = 'none';
        diagramList.style.display = 'block';
        
        // Limpiar contenedor
        container.innerHTML = '';
        
        // Renderizar cada diagrama
        diagrams.forEach(diagram => {
            const card = createDiagramCard(diagram);
            container.appendChild(card);
        });
    }
}

/**
 * Crea una tarjeta de diagrama
 */
function createDiagramCard(diagram) {
    const card = document.createElement('div');
    card.className = 'diagram-card fade-in';
    card.setAttribute('data-id', diagram._id);
    
    const nodeCount = diagram.nodes ? diagram.nodes.length : 0;
    const connectionCount = diagram.connections ? diagram.connections.length : 0;
    
    card.innerHTML = `
        <div class="diagram-card-header">
            <img src="icons/diagrama-flujo.svg" alt="" class="diagram-card-icon">
            <h3 class="diagram-card-title" title="${diagram.name}">${diagram.name}</h3>
        </div>
        <div class="diagram-card-date">
            Última modificación: ${formatDate(diagram.updatedAt)}
        </div>
        <div class="w3-text-grey w3-small" style="margin-bottom: 15px;">
            ${nodeCount} nodo${nodeCount !== 1 ? 's' : ''} • ${connectionCount} conexión${connectionCount !== 1 ? 'es' : ''}
        </div>
        <div class="diagram-card-actions">
            <button class="w3-button w3-round" style="background-color: #00C1BA; color: white;" 
                    onclick="openDiagram('${diagram._id}')"
                    aria-label="Abrir diagrama ${diagram.name}">
                Abrir
            </button>
            <button class="w3-button w3-white w3-border w3-round delete-btn" style="border-color: #95A5A6; color: #5A6C7D;" 
                    onclick="confirmDeleteDiagram('${diagram._id}', '${diagram.name.replace(/'/g, "\\'")}', '${diagram._rev || ''}')"
                    aria-label="Eliminar diagrama ${diagram.name}">
                Eliminar
            </button>
        </div>
    `;
    
    return card;
}

/**
 * Configura los event listeners
 */
function setupEventListeners() {
    // Botones de crear diagrama
    const btnCreateDiagram = document.getElementById('btnCreateDiagram');
    const btnCreateDiagramEmpty = document.getElementById('btnCreateDiagramEmpty');
    
    if (btnCreateDiagram) {
        btnCreateDiagram.addEventListener('click', handleCreateDiagram);
    }
    
    if (btnCreateDiagramEmpty) {
        btnCreateDiagramEmpty.addEventListener('click', handleCreateDiagram);
    }
    
    // Botón de importar
    const btnImport = document.getElementById('btnImportDiagram');
    const fileInput = document.getElementById('fileInput');
    
    if (btnImport) {
        btnImport.addEventListener('click', () => {
            fileInput.click();
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileImport);
    }
    
    // Prevenir cierre del modal al hacer clic fuera
    const confirmModal = document.getElementById('confirmModal');
    if (confirmModal) {
        confirmModal.addEventListener('click', (event) => {
            // No hacer nada si se hace clic en el fondo del modal
            // Solo cerrar con los botones explícitos
            event.stopPropagation();
        });
    }
}

/**
 * Maneja la creación de un nuevo diagrama
 */
async function handleCreateDiagram() {
    try {
        showLoader('Creando diagrama...');
        
        const diagram = await createDiagram();
        
        hideLoader();
        showNotification('Diagrama creado correctamente', 'success', 2000);
        
        // Navegar al canvas
        window.location.href = `canvas.html?id=${diagram._id}`;
    } catch (error) {
        hideLoader();
        showNotification('Error al crear diagrama: ' + error.message, 'error');
        console.error(error);
    }
}

/**
 * Abre un diagrama existente
 */
function openDiagram(id) {
    window.location.href = `canvas.html?id=${id}`;
}

/**
 * Confirma la eliminación de un diagrama
 */
function confirmDeleteDiagram(id, name, rev) {
    showConfirmModal(
        `¿Está seguro que desea eliminar el diagrama "${name}"? Esta acción no se puede deshacer.`,
        () => deleteDiagramById(id, rev)
    );
}

/**
 * Elimina un diagrama por su ID
 */
async function deleteDiagramById(id, rev) {
    try {
        showLoader('Eliminando diagrama...');
        
        await deleteDiagram(id, rev);
        
        // Recargar lista
        await loadDiagrams();
        
        hideLoader();
        showNotification('Diagrama eliminado correctamente', 'success', 2000);
    } catch (error) {
        hideLoader();
        showNotification('Error al eliminar diagrama: ' + error.message, 'error');
        console.error(error);
    }
}

/**
 * Maneja la importación de archivos
 */
async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Verificar que sea un archivo JSON
    if (!file.name.endsWith('.json')) {
        showNotification('Por favor seleccione un archivo JSON válido', 'error');
        return;
    }
    
    try {
        showLoader('Importando diagrama...');
        
        const content = await readFileContent(file);
        
        // Intentar parsear el JSON
        let diagram;
        try {
            diagram = JSON.parse(content);
        } catch (error) {
            throw new Error('El archivo no contiene JSON válido');
        }
        
        // Verificar si ya existe
        const exists = await diagramExists(diagram._id);
        
        if (exists) {
            // Preguntar al usuario qué hacer
            hideLoader();
            showOptionsDialog(
                'Diagrama existente',
                `Ya existe un diagrama con el mismo identificador. ¿Qué desea hacer?`,
                [
                    { text: 'Crear una copia', value: 'create', class: 'w3-button w3-block w3-margin-bottom' },
                    { text: 'Reemplazar el existente', value: 'replace', class: 'w3-button w3-block w3-margin-bottom' },
                    { text: 'Cancelar', value: 'cancel', class: 'w3-button', style: 'background-color: #FF6B6B; color: white; width: 25%; margin: 0 auto; display: block; border-radius: 8px;' }
                ],
                async (mode) => {
                    if (mode !== 'cancel') {
                        try {
                            showLoader('Importando diagrama...');
                            await importDiagram(content, mode);
                            await loadDiagrams();
                            hideLoader();
                            showNotification('Diagrama importado correctamente', 'success');
                        } catch (error) {
                            hideLoader();
                            showNotification('Error al importar: ' + error.message, 'error');
                        }
                    }
                }
            );
        } else {
            // No existe, importar directamente
            await importDiagram(content, 'create');
            await loadDiagrams();
            hideLoader();
            showNotification('Diagrama importado correctamente', 'success');
        }
        
        // Limpiar input
        event.target.value = '';
    } catch (error) {
        hideLoader();
        showNotification('Error al importar diagrama: ' + error.message, 'error');
        console.error(error);
        event.target.value = '';
    }
}

/**
 * Lee el contenido de un archivo
 */
function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Error al leer el archivo'));
        reader.readAsText(file);
    });
}

/**
 * Maneja la advertencia antes de salir con cambios sin guardar
 */
window.addEventListener('beforeunload', (event) => {
    // Esta función se puede extender si se necesita verificar cambios pendientes
    // Por ahora no es necesario en la vista inicial
});

// Verificar si se llegó desde el canvas para mostrar mensaje
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('from') === 'canvas') {
    // Opcional: mostrar algún mensaje o animación
}
