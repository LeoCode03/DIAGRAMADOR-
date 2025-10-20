# DIAGRAMADOR APP

Una aplicación web cliente para crear y editar diagramas de flujo, diseñada  para el aprendizaje de la lógica de programación. Funciona completamente sin servidor.

## Tipos de Nodos Disponibles

1. **Inicio**: Nodo circular que marca el inicio del diagrama
2. **Fin**: Nodo circular que marca el final del diagrama
3. **Asignación**: Nodo rectangular para operaciones y asignaciones
4. **Decisión (Si)**: Nodo romboidal para decisiones (sí/no)
5. **Comentario**: Nodo con borde punteado para anotaciones

### Editor de Diagramas
#### Agregar Nodos

1. Haz clic en el botón del menú (☰) para abrir el menú lateral
2. Arrastra un tipo de nodo al canvas, o haz clic en él para agregarlo

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


### Campos del Diagrama

- **_id**: Identificador único del diagrama
- **type**: Siempre "diagram"
- **name**: Nombre del diagrama
- **createdAt**: Timestamp de creación
- **updatedAt**: Timestamp de última actualización
- **nodes**: Array de nodos del diagrama
- **connections**: Array de conexiones entre nodos
- **metadata**: Información de visualización (zoom, posición)

## 🛠️ Tecnologías Utilizadas

- **HTML5**: Estructura semántica
- **CSS3**: Estilos y animaciones
- **W3.CSS**: Framework CSS responsivo
- **JavaScript**: Lógica de la aplicación (sin frameworks)
- **PouchDB**: Base de datos local (con fallback a localStorage)
- **SVG**: Renderizado de conexiones y flechas
- **Web Storage API**: Almacenamiento de respaldo
