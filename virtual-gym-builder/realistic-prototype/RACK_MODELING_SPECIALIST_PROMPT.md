# Prompt: especialista exclusivo en racks metalicos y estaciones de montaje

Trabaja exclusivamente en los racks metalicos, soportes, anclajes y la logica de asignacion de equipos dentro de `virtual-gym-builder/realistic-prototype/`.

No remodeles sacos, speed bags, double-end bags ni otros productos de golpeo. Los equipos de golpeo son objetos independientes creados por otro especialista. Tu trabajo termina en la estructura metalica, sus anclajes y los puntos donde el cliente puede montar equipos.

No modifiques checkout, catalogos comerciales, navegacion principal, paginas externas ni archivos fuera de `virtual-gym-builder/`. No hagas deploy.

## Objetivo

Construye un sistema profesional de racks comerciales modulares para gimnasios de boxeo, Muay Thai y MMA. Los racks deben parecer estructuras metalicas reales, soportar configuraciones desde una estacion hasta lineas de 10 o mas estaciones y permitir que el cliente elija un equipo diferente para cada punto de montaje.

Un rack nunca debe incluir sacos integrados en su geometria. Debe mostrarse vacio inicialmente, con ganchos, swivels o puntos de montaje visibles. El cliente agrega despues el equipo deseado a cada estacion.

## Regla central: rack y saco son objetos separados

Implementa una relacion explicita entre:

- `Rack`: estructura metalica.
- `RackStation`: punto individual de montaje.
- `MountedEquipment`: referencia opcional al equipo asignado.

Cada estacion puede estar:

- Vacia.
- Ocupada por un heavy bag.
- Ocupada por un banana bag.
- Ocupada por un angle bag.
- Ocupada por un teardrop bag.
- Ocupada por otro equipo compatible.

No todas las estaciones de un rack deben utilizar el mismo saco. Ejemplo valido para un rack lineal de 10 estaciones:

1. Heavy bag clasico.
2. Banana bag de 6 ft.
3. Estacion vacia.
4. Uppercut bag.
5. Angle bag.
6. Heavy bag corto.
7. Teardrop bag.
8. Estacion vacia.
9. Water bag.
10. Banana bag extra grande.

Cambiar el equipo de una estacion no puede cambiar las demas estaciones ni la estructura del rack.

## Sistemas permitidos

### 1. Rack lineal modular

Es el sistema principal para gimnasios comerciales.

Debe permitir:

- Cantidad configurable de estaciones, como minimo de `1` a `10`.
- Posibilidad de superar 10 estaciones si el espacio lo permite.
- Modulos consecutivos de punta a punta.
- Postes compartidos entre modulos para evitar duplicar estructura.
- Separacion configurable o calculada segun el equipo asignado.
- Estaciones vacias visibles.
- Extension y reduccion del rack sin reconstruir los equipos montados que siguen existiendo.

No modeles diez racks individuales colocados juntos. Debe ser una sola estructura modular continua con postes, vigas y arriostramiento coherentes.

### 2. Rack radial o circuit tree

Puede ofrecer tres o cuatro brazos alrededor de una columna central cuando una referencia comercial real justifique esa configuracion.

Cada brazo es una estacion independiente. No incluyas sacos por defecto.

### 3. Rack cuadrado de cuatro estaciones

Puede basarse estructuralmente en racks comerciales de acceso `360 grados`, con postes de esquina, vigas superiores, cartelas y placas atornilladas.

Cada lado tiene su propia estacion. No incrustes sacos en la estructura.

### 4. Soporte individual de heavy bag

Debe ser una estructura metalica comercial independiente, con columna, brazo en voladizo, diagonal, base estable y anclaje realista. El soporte se crea vacio y expone una estacion compatible.

### 5. Plataforma de speed bag

La plataforma de speed bag es un soporte especializado, no una estacion de heavy bag.

Debe incluir:

- Estructura metalica o montaje de pared segun el producto de referencia.
- Tambor circular.
- Mecanismo de ajuste de altura.
- Swivel como punto de montaje.
- Ningun speed bag integrado en la geometria del soporte.

El usuario selecciona despues el tamaño de speed bag que desea montar.

### 6. Sistema double-end

El double-end no pertenece a un rack de heavy bags.

Es el unico sistema de esta herramienta que puede requerir un anclaje superior al techo, combinado con un anclaje inferior al piso. La estructura/anclajes deben crearse sin incluir la pelota double-end.

Debe existir como sistema independiente con:

- Anclaje superior de techo.
- Anclaje inferior de piso.
- Punto superior compatible.
- Punto inferior compatible.
- Equipo double-end asignable o removible.
- Altura de techo y tension como parametros de planificacion.

No cuelgues heavy bags, banana bags, angle bags ni racks lineales del techo. Esos sistemas deben usar racks metalicos autoportantes, estructuras atornilladas al piso o anclajes comerciales expresamente verificados.

## Modelo de datos recomendado

Adapta los nombres a las convenciones existentes, pero conserva esta separacion conceptual:

```ts
type RackLayout = 'single' | 'linear' | 'radial' | 'square-4' | 'speed-platform' | 'double-end'

type RackStation = {
  id: string
  localPosition: [number, number, number]
  localRotation: number
  mountType: 'heavy-bag-hook' | 'speed-bag-swivel' | 'double-end-top' | 'double-end-bottom'
  mountedEquipmentId: string | null
  maxLoadKg?: number
}

type BagRack = {
  id: string
  layout: RackLayout
  stationCount: number
  stationSpacingMeters?: number
  stations: RackStation[]
  position: { x: number; z: number }
  rotation: number
}
```

No dupliques los datos completos del saco dentro de `RackStation`. Guarda una referencia al objeto montado para mantener una unica fuente de dimensiones, forma y SKU.

## Logica de asignacion obligatoria

El usuario debe poder:

1. Crear un rack vacio.
2. Elegir la cantidad de estaciones.
3. Seleccionar una estacion individual.
4. Ver si esta vacia u ocupada.
5. Elegir un equipo compatible del catalogo.
6. Montarlo en esa estacion.
7. Cambiarlo por otro equipo sin modificar las demas estaciones.
8. Quitar el equipo y dejar la estacion vacia.
9. Mover o rotar el rack completo conservando las asignaciones.
10. Ver advertencias si el equipo no cabe, supera la carga o invade el espacio de otra estacion.

El equipo montado debe heredar su transformacion mundial de la estacion, pero conservar sus propias dimensiones y geometria. Nunca deformes el saco para hacerlo caber.

## Compatibilidad

Define compatibilidad por tipo de montaje, no por nombre visual:

- `heavy-bag-hook`: heavy bag, banana, angle, uppercut, teardrop, water bag y otros sacos colgantes aprobados.
- `speed-bag-swivel`: solo speed bags compatibles.
- `double-end-top` + `double-end-bottom`: forman juntos una unica instalacion double-end.

Una estacion incompatible debe impedir la asignacion y explicar el motivo de forma breve.

## Espaciado y seguridad

No uses una distancia fija para todos los equipos.

Calcula el espaciado minimo usando:

- Diametro o ancho maximo del equipo.
- Radio de oscilacion operativo.
- Espacio de trabajo del atleta.
- Separacion respecto a postes y equipos vecinos.
- Recomendaciones del fabricante cuando existan.

Para racks lineales grandes, muestra:

- Longitud total de la estructura.
- Cantidad de estaciones.
- Separacion entre estaciones.
- Huella total.
- Area operativa recomendada.
- Conflictos entre equipos vecinos.

Si un rack de 10 estaciones no cabe en el cuarto, no lo reduzcas ni deformes. Muestra una advertencia de espacio y deja al cliente cambiar la habitacion, el espaciado o la cantidad.

## Investigacion obligatoria

Antes de modelar cada tipologia, estudia ejemplos reales de fabricantes comerciales. Usa como puntos de partida, sin copiar marcas ni logos:

- Titan Fitness: racks cuadrados de cuatro y ocho sacos.
- TKO 522CHBS: soporte comercial individual.
- ProMountings: estructuras de varias posiciones.
- Jordan Fitness: marcos comerciales de cuatro brazos.
- Jim Bradley: circuit tree y estaciones comerciales.
- Balazs Boxing: estaciones universales y plataformas.
- Valor Fitness: plataformas ajustables de speed bag.
- Meister y Exigo: anclajes double-end piso/techo.

Para cada referencia registra:

- URL.
- Dimensiones publicadas.
- Seccion del tubo.
- Tipo de acero cuando se publique.
- Placas de anclaje.
- Cartelas y diagonales.
- Capacidad por gancho.
- Patron lineal, radial o cuadrado.
- Requisitos de fijacion al piso, pared o techo.

No inventes dimensiones si el fabricante no las publica. Identifica claramente cualquier estimacion de planificacion.

## Reglas visuales y estructurales

- Usa tubo cuadrado o rectangular cuando la referencia real lo utilice.
- Añade placas base, pernos, cartelas, diagonales, uniones y tapas de tubo visibles.
- Los ganchos deben colgar bajo la viga, no dentro de ella.
- Una estacion vacia debe mostrar su gancho o swivel.
- No uses porterias genericas repetidas si el producto real comparte postes.
- No uses cilindros delgados como estructura principal cuando la referencia usa perfiles de acero robustos.
- No añadas logos ni nombres de fabricantes a los modelos.
- No agregues cadenas largas como decoracion si el equipo aun no esta asignado. El punto de montaje vacio debe ser tecnicamente coherente.
- La estructura debe tocar el piso mediante placas o patas reales; nunca debe flotar.
- Los racks lineales deben tener continuidad estructural de punta a punta.

## Interfaz esperada

Al seleccionar un rack, el inspector debe mostrar:

- Tipo de rack.
- Numero de estaciones.
- Longitud, ancho y alto.
- Capacidad por estacion cuando se conozca.
- Lista numerada de estaciones.
- Estado de cada estacion: `Empty` o nombre del equipo montado.
- Acciones `Assign`, `Replace` y `Remove` por estacion.
- Control para añadir o quitar modulos en racks lineales.

En la escena 3D:

- La estacion seleccionada debe resaltarse sin cambiar la geometria.
- Los puntos vacios deben ser faciles de identificar.
- El equipo montado debe seguir al rack cuando se mueve o rota.
- Debe poder seleccionarse el rack completo o el equipo montado sin ambiguedad.

## Persistencia y compatibilidad

- Conserva diseños existentes mediante migracion o valores por defecto.
- No destruyas asignaciones cuando se cambia una propiedad no estructural.
- Si se reduce el numero de estaciones y algunas eliminadas estan ocupadas, solicita confirmacion o conserva esos equipos como objetos independientes en el piso.
- La serializacion debe guardar racks, estaciones y referencias de equipos de manera estable.

## Validacion obligatoria

Prueba al menos estas configuraciones:

1. Rack individual vacio y con heavy bag.
2. Rack lineal de 2 estaciones con dos sacos distintos.
3. Rack lineal de 4 estaciones con una estacion vacia.
4. Rack lineal de 10 estaciones con mezcla de equipos.
5. Rack radial con tres equipos diferentes.
6. Rack cuadrado de cuatro estaciones con acceso `360 grados`.
7. Plataforma de speed bag vacia y con cada tamaño compatible.
8. Double-end con anclajes piso-techo, primero vacio y despues asignado.
9. Movimiento y rotacion del rack conservando equipos asignados.
10. Eliminacion y reemplazo independiente de una estacion.
11. Deteccion de falta de espacio y conflicto de oscilacion.
12. Persistencia despues de recargar la pagina.

Revisa Top y 3D con capturas. Compara las dimensiones contra una figura humana de `1.80 m` y contra las referencias comerciales.

## Criterios de rechazo

Rechaza el resultado si ocurre cualquiera de estos casos:

- El rack incluye sacos horneados en su geometria.
- Todas las estaciones reciben automaticamente el mismo saco.
- No se puede dejar una estacion vacia.
- Un rack de 10 estaciones son diez objetos desconectados.
- El heavy bag parece pegado a la viga.
- El double-end aparece integrado en un rack de heavy bags.
- Un sistema distinto del double-end depende del techo sin una referencia aprobada.
- Los tubos, placas o diagonales no corresponden a ninguna estructura comercial real.
- El rack cambia las proporciones del equipo montado.
- Los equipos se pierden al mover, rotar o recargar el diseño.

## Entregables

- Geometria de racks sin equipos integrados.
- Modelo de datos para racks, estaciones y asignaciones.
- UI de asignacion individual por estacion.
- Soporte para racks lineales configurables de `1` a `10+` estaciones.
- Sistema independiente de plataforma speed bag.
- Sistema independiente double-end piso-techo.
- Tabla de referencias comerciales y dimensiones verificadas.
- Capturas de todas las configuraciones de validacion.
- Resultado de TypeScript, ESLint y build.
- Lista de estimaciones y limitaciones pendientes.

No declares terminado el trabajo solo porque el rack se ve metalico. Debe funcionar como un sistema comercial modular en el que cada estacion es independiente y cada saco se agrega, cambia o elimina por separado.