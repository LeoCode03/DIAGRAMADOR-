# DIAGRAMADOR APP

Una aplicación web cliente completa para crear, editar y gestionar diagramas de flujo, diseñada específicamente para el aprendizaje de la lógica de programación. Funciona completamente sin servidor, con almacenamiento local usando PouchDB.

## 🚀 Características Principales

- ✅ **Sin servidor**: Funciona completamente en el navegador sin necesidad de backend
- 💾 **Almacenamiento local**: Usa PouchDB con fallback automático a localStorage
- 📱 **Responsivo**: Diseño adaptable para escritorio y dispositivos móviles
- 🎨 **Interfaz intuitiva**: Diseño limpio usando W3.CSS
- ♿ **Accesible**: Navegación por teclado, ARIA labels y diseño inclusivo
- 🔄 **Undo/Redo**: Sistema completo de deshacer y rehacer acciones
- 💾 **Autoguardado**: Guardado automático cada 2 segundos
- 📤 **Exportar/Importar**: Guarda y carga diagramas en formato JSON
- 🔍 **Zoom y Pan**: Controles completos de visualización
- 🎯 **Drag & Drop**: Arrastra nodos desde el menú al canvas

## 📋 Tipos de Nodos Disponibles

1. **Inicio**: Nodo circular que marca el inicio del diagrama
2. **Fin**: Nodo circular que marca el final del diagrama
3. **Asignación**: Nodo rectangular para operaciones y asignaciones
4. **Decisión (Si)**: Nodo romboidal para decisiones (sí/no)
5. **Comentario**: Nodo con borde punteado para anotaciones

## 🎮 Cómo Usar la Aplicación

### Instalación y Ejecución

1. Descarga o clona todos los archivos del proyecto
2. Abre el archivo `index.html` en un navegador moderno
3. No se requiere instalación ni servidor web

**Nota importante**: Para que PouchDB funcione correctamente, se recomienda servir los archivos a través de un servidor HTTP local. Puedes usar:

```bash
# Con Python 3
python -m http.server 8000

# Con Python 2
python -m SimpleHTTPServer 8000

# Con Node.js (http-server)
npx http-server
```

Luego accede a `http://localhost:8000` en tu navegador.

### Vista Inicial

En la vista inicial (`index.html`) puedes:

- **Crear un nuevo diagrama**: Haz clic en "Crear Nuevo Diagrama"
- **Abrir un diagrama existente**: Haz clic en "Abrir" en cualquier tarjeta de diagrama
- **Eliminar un diagrama**: Haz clic en "Eliminar" (se pedirá confirmación)
- **Importar un diagrama**: Usa el botón "Importar Diagrama" para cargar archivos JSON

### Editor de Diagramas (Canvas)

#### Agregar Nodos

1. Haz clic en el botón del menú (☰) para abrir el menú lateral
2. Arrastra un tipo de nodo al canvas, o haz clic en él para agregarlo al centro
3. El menú se cierra automáticamente después de agregar un nodo

#### Mover Nodos

- **Mouse**: Arrastra el nodo con el botón izquierdo
- **Táctil**: Mantén presionado y arrastra

#### Editar Texto de Nodos

- Haz doble clic en el texto del nodo
- Escribe el contenido deseado
- Haz clic fuera del nodo o presiona Esc para terminar

#### Eliminar Nodos

- Pasa el cursor sobre el nodo para ver el botón de eliminar (×)
- Haz clic en el botón para eliminar
- También puedes seleccionar el nodo y presionar la tecla `Supr` o `Delete`

#### Crear Conexiones

1. Pasa el cursor sobre un nodo para ver los puntos de conexión (círculos azules)
2. Haz clic en un punto de conexión
3. Arrastra hasta el punto de conexión del nodo destino
4. Suelta para crear la flecha

**Nota**: No se pueden crear conexiones de un nodo a sí mismo.

#### Eliminar Conexiones

1. Haz clic en una flecha para seleccionarla (se volverá azul)
2. Presiona la tecla `Supr` o `Delete`

#### Controles de Visualización

**Zoom**:
- Usa los botones **+** y **-** en el pie de página
- Arrastra la barra deslizante central
- Usa `Ctrl + Rueda del ratón`
- El zoom va del 50% al 250%

**Pan (Desplazamiento)**:
- Mantén presionado el botón central del ratón y arrastra
- Mantén presionada la tecla `Espacio` y arrastra
- En móvil: Usa dos dedos para desplazar

**Otros Controles**:
- **Restablecer Zoom**: Vuelve al 100% (icono de actualizar)
- **Ajustar Vista**: Centra y ajusta todos los nodos en pantalla (icono de ajustar)

#### Cambiar Nombre del Diagrama

1. Haz clic en el campo de nombre en el encabezado
2. Escribe el nuevo nombre
3. Presiona Enter o haz clic fuera del campo
4. Confirma el cambio en el modal que aparece

## ⌨️ Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `Ctrl + S` | Guardar diagrama manualmente |
| `Ctrl + Z` | Deshacer última acción |
| `Ctrl + Y` o `Ctrl + Shift + Z` | Rehacer acción |
| `Ctrl + 0` | Restablecer zoom al 100% |
| `Ctrl + Rueda` | Zoom in/out |
| `Supr` o `Delete` | Eliminar elemento seleccionado |
| `Espacio + Arrastrar` | Desplazar el canvas (pan) |
| `Enter` (en nombre) | Confirmar cambio de nombre |
| `Esc` (en edición) | Terminar edición de texto |

## 📁 Formato de Archivo JSON

Los diagramas se exportan en el siguiente formato:

```json
{
  "_id": "d-1697500000000",
  "type": "diagram",
  "name": "Mi Diagrama",
  "createdAt": 1697500000000,
  "updatedAt": 1697500000000,
  "schemaVersion": "1.0.0",
  "nodes": [
    {
      "id": "n-1",
      "type": "inicio",
      "x": 100,
      "y": 100,
      "width": 120,
      "height": 120,
      "content": "Inicio"
    }
  ],
  "connections": [
    {
      "id": "c-1",
      "from": "n-1",
      "fromPosition": "bottom",
      "to": "n-2",
      "toPosition": "top",
      "label": ""
    }
  ],
  "metadata": {
    "zoom": 100,
    "panX": 0,
    "panY": 0
  }
}
```

### Campos del Diagrama

- **_id**: Identificador único del diagrama
- **type**: Siempre "diagram"
- **name**: Nombre del diagrama
- **createdAt**: Timestamp de creación
- **updatedAt**: Timestamp de última actualización
- **schemaVersion**: Versión del formato (para compatibilidad futura)
- **nodes**: Array de nodos del diagrama
- **connections**: Array de conexiones entre nodos
- **metadata**: Información de visualización (zoom, posición)

### Campos de los Nodos

- **id**: Identificador único del nodo (formato: `n-{número}`)
- **type**: Tipo de nodo (`inicio`, `fin`, `asignacion`, `si`, `comentario`)
- **x, y**: Coordenadas del nodo en el canvas
- **width, height**: Dimensiones del nodo
- **content**: Texto editable del nodo

### Campos de las Conexiones

- **id**: Identificador único de la conexión (formato: `c-{número}`)
- **from**: ID del nodo de origen
- **fromPosition**: Posición del punto de anclaje de origen (`top`, `right`, `bottom`, `left`)
- **to**: ID del nodo de destino
- **toPosition**: Posición del punto de anclaje de destino
- **label**: Etiqueta opcional de la conexión

## 🛠️ Tecnologías Utilizadas

- **HTML5**: Estructura semántica
- **CSS3**: Estilos y animaciones
- **W3.CSS**: Framework CSS responsivo
- **JavaScript (Vanilla)**: Lógica de la aplicación (sin frameworks)
- **PouchDB**: Base de datos local (con fallback a localStorage)
- **SVG**: Renderizado de conexiones y flechas
- **Web Storage API**: Almacenamiento de respaldo

## 📂 Estructura del Proyecto

```
PROYECTO/
├── index.html              # Vista inicial - lista de diagramas
├── canvas.html             # Editor de diagramas
├── README.md               # Este archivo
├── INSTRUCCIONES.txt       # Guía rápida de inicio
├── CHECKLIST.txt           # Validación del proyecto
├── css/
│   └── styles.css         # Estilos personalizados
├── js/
│   ├── app.js             # Lógica de la vista inicial
│   ├── canvas.js          # Lógica del editor
│   ├── storage.js         # Gestión de persistencia
│   └── ui.js              # Utilidades de interfaz
└── icons/                  # Iconos SVG
    ├── diagrama-flujo.svg
    ├── inicio.svg
    ├── fin.svg
    ├── asignacion.svg
    ├── si.svg
    ├── comentario.svg
    ├── descargar.svg
    ├── hogar.svg
    ├── menu.svg
    ├── cerrar.svg
    ├── zoom in.svg
    ├── zoom out.svg
    ├── actualizar.svg
    ├── ajustar.svg
    ├── anterior-posterior.svg
    ├── agregar.svg
    └── despliegue.svg
```

## 💾 Almacenamiento de Datos

### PouchDB (Principal)

La aplicación usa PouchDB como método principal de almacenamiento. PouchDB es una base de datos JavaScript que funciona en el navegador y sincroniza datos localmente.

**Ventajas**:
- Búsquedas rápidas y eficientes
- Manejo automático de conflictos
- Estructura de datos más robusta
- Soporte para grandes cantidades de datos

### localStorage (Respaldo)

Si PouchDB no está disponible o falla, la aplicación automáticamente usa localStorage como respaldo.

**Limitaciones**:
- Límite de almacenamiento (~5-10MB según el navegador)
- Búsquedas más lentas
- Datos almacenados como strings

### Limpieza de Datos

Para limpiar todos los datos almacenados:

**En PouchDB**:
```javascript
// Abrir consola del navegador (F12) y ejecutar:
const db = new PouchDB('diagramas');
db.destroy();
```

**En localStorage**:
```javascript
// Abrir consola del navegador (F12) y ejecutar:
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('diagramador_')) {
    localStorage.removeItem(key);
  }
});
```

## 🌐 Compatibilidad de Navegadores

La aplicación es compatible con navegadores modernos que soporten:

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Opera 76+

**Características requeridas**:
- ES6+ (Promises, Arrow Functions, etc.)
- SVG
- Drag and Drop API
- Web Storage API
- Touch Events (para móviles)

## 📱 Soporte Móvil

La aplicación está completamente optimizada para dispositivos móviles:

- Interfaz responsiva que se adapta al tamaño de pantalla
- Soporte completo para eventos táctiles
- Menús y controles accesibles en pantallas pequeñas
- Gestos de arrastre para mover nodos
- Zoom y pan con gestos táctiles

**Recomendaciones para móvil**:
- Usa el dispositivo en orientación horizontal para mayor espacio
- Los nodos son más pequeños en móvil (100px vs 120px en escritorio)
- Usa el botón de "Ajustar vista" para centrar el diagrama

## 🔒 Privacidad y Seguridad

- **100% local**: Todos los datos se almacenan en el navegador del usuario
- **Sin servidor**: No se envía ninguna información a servidores externos
- **Sin seguimiento**: No se usan cookies de seguimiento ni analytics
- **Offline first**: Funciona sin conexión a internet

**Nota**: Si borras los datos del navegador (caché y almacenamiento local), perderás todos los diagramas guardados. Se recomienda exportar diagramas importantes regularmente.

## 🐛 Resolución de Problemas

### PouchDB no funciona

**Síntoma**: Mensaje "usando localStorage" en la consola

**Solución**: 
- Asegúrate de servir la aplicación a través de HTTP (no file://)
- Verifica que PouchDB esté cargado correctamente desde el CDN
- Revisa la consola del navegador para errores

### Los cambios no se guardan

**Síntoma**: El indicador muestra "Error al guardar"

**Solución**:
- Verifica que haya espacio de almacenamiento disponible
- Intenta exportar el diagrama y crear uno nuevo
- Limpia la caché del navegador y recarga

### Los iconos no se muestran

**Síntoma**: Imágenes rotas o espacios vacíos

**Solución**:
- Verifica que todos los archivos SVG estén en la carpeta `icons/`
- Asegúrate de que las rutas sean correctas
- Revisa la consola para errores 404

### El zoom no funciona correctamente

**Síntoma**: Los elementos se ven distorsionados

**Solución**:
- Usa el botón "Restablecer zoom"
- Recarga la página
- Verifica que uses un navegador compatible

## 🎓 Casos de Uso Educativos

Esta aplicación es ideal para:

1. **Aprendizaje de Algoritmos**: Visualizar la lógica de programas simples
2. **Diseño de Procesos**: Planificar la estructura antes de programar
3. **Documentación**: Crear diagramas explicativos de código existente
4. **Presentaciones**: Exportar y compartir diagramas en formato JSON
5. **Práctica Individual**: Crear y revisar diagramas de flujo sin conexión

## 📝 Mejoras Futuras (Opcional)

Posibles extensiones que se podrían agregar:

- Exportar a imagen (PNG/SVG)
- Temas de color personalizables
- Plantillas de diagramas comunes
- Validación de flujo lógico
- Generación de código a partir del diagrama
- Colaboración en tiempo real (requeriría servidor)
- Más tipos de nodos y conectores
- Etiquetas editables en las conexiones

## 🤝 Contribuciones

Este es un proyecto universitario de código abierto. Si deseas mejorarlo:

1. Crea un fork del proyecto
2. Realiza tus cambios
3. Prueba exhaustivamente
4. Documenta los cambios
5. Envía un pull request

## 📄 Licencia

Este proyecto es de código abierto y está disponible para uso educativo.

## 👨‍💻 Autor

Proyecto universitario - DIAGRAMADOR APP  
Curso: Programación Web  
Año: 2025

---

**¡Disfruta creando diagramas de flujo!** 🎨✨

Si encuentras algún problema o tienes sugerencias, no dudes en reportarlos.
