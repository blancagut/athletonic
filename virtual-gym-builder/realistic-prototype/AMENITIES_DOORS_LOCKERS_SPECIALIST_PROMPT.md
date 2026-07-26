# Prompt: especialista exclusivo en exhibidor de pads, lockers y puertas

Trabaja exclusivamente en crear objetos opcionales de amenities y almacenamiento arquitectonico dentro de `virtual-gym-builder/realistic-prototype/`:

- Un stand/exhibidor donde se vean pads de cuero y accesorios de golpeo.
- Lockers comerciales.
- Puerta interior generica.
- Puerta de bano con rotulo visible `TOILET`.

No modifiques paredes, banco, wall pad section, equipment rack existente, sacos, bag racks, ring, octagono, tatami, circulos de lucha, sala, camaras ni controles. No cambies checkout, catalogos comerciales, navegacion principal ni archivos fuera de `virtual-gym-builder/`. No hagas deploy.

## Separacion de responsabilidades

Este agente crea objetos nuevos e independientes.

- El `pad display stand` no reemplaza `equipment-rack`.
- Los pads exhibidos no son sacos y no deben modificar modelos creados por el especialista de sacos.
- Los lockers no forman parte de la geometria de pared.
- Las puertas se insertan en aberturas ofrecidas por el sistema de paredes, pero no redisenan las paredes.
- La puerta `TOILET` indica acceso a un bano; no modeles el interior completo del bano en este alcance.

## Objetivo

Agregar elementos que hagan que el proyecto parezca un gimnasio comercial funcional y permitan al cliente planificar circulacion, almacenamiento y accesos.

Todos los objetos deben:

- Modelarse a escala metrica real.
- Tener huella y altura documentadas.
- Ser seleccionables y opcionales.
- Mantener posicion, rotacion y persistencia.
- Incluir espacio de uso o apertura cuando corresponda.
- Ser neutrales y sin marcas.
- Verse realistas en Top y 3D.

## Investigacion obligatoria

Busca al menos tres referencias comerciales para cada tipologia:

- Display racks para boxing/Muay Thai pads y focus mitts.
- Lockers metalicos o compact laminate para gimnasios.
- Puertas interiores comerciales.
- Puertas de restroom/toilet con señalizacion accesible.

Registra URL, dimensiones, materiales, tipo de montaje, capacidad y rasgos utilizados. No inventes especificaciones no publicadas; marca estimaciones.

## 1. Pad display stand

Crea un stand comercial dedicado a mostrar y organizar equipo de cuero para entrenamiento.

Debe poder mostrar una seleccion visual de:

- Thai pads en pares.
- Focus mitts en pares.
- Kick shields.
- Belly pads.
- Headgear o guantes como accesorios opcionales.

Reglas:

- Los elementos exhibidos son representaciones genericas de baja complejidad, sin logos ni SKUs de sacos.
- Usa cuero negro o colores comerciales neutros; no copies arte de marca.
- Cada pad debe tener grosor, correas, asa y curvatura reconocibles.
- Los pares deben colgar o apoyarse de forma fisicamente posible.
- El stand debe incluir estructura metalica, ganchos, brazos, estantes o panel perforado segun referencia.
- Ningun pad puede flotar o atravesar el soporte.
- El peso visual debe estar distribuido de forma estable.
- El usuario puede elegir stand vacio o contenido visible si la arquitectura lo permite.
- No conviertas el stand en un bag rack ni permitas colgar heavy bags.

Datos conceptuales recomendados:

```ts
type PadDisplayContents = {
  thaiPadPairs: number
  focusMittPairs: number
  kickShields: number
  bellyPads: number
  headgear: number
}
```

Limita cantidades a la capacidad fisica del stand. No deformes accesorios para hacerlos caber.

## 2. Lockers

Crea lockers modulares apropiados para un gimnasio comercial.

Ofrece como minimo:

- Modulo individual o banco de lockers configurable.
- Version de una altura o dos niveles basada en referencias reales.
- Puertas, bisagras, ventilacion, manija y cerradura creibles.
- Zocalo, patas o base elevada.
- Separaciones regulares entre modulos.
- Material de acero powder-coated o laminado compacto verificado.

Reglas:

- Los lockers deben estar cerrados por defecto.
- No modeles ropa o pertenencias personales visibles.
- No uses marcas ni numeros decorativos obligatorios.
- Permite cantidad modular sin duplicar geometria ineficientemente.
- Calcula huella total a partir del numero y ancho de modulos.
- Incluye clearance frontal para abrir y utilizar puertas.
- Si se visualiza una puerta abierta, no debe atravesar otra puerta, pared u objeto.
- La orientacion frontal debe ser inequívoca en vista superior.

## 3. Puerta interior generica

Crea una puerta comercial interior que se vincule a un `WallOpening` existente.

Debe incluir:

- Marco y jambas.
- Hoja con espesor realista.
- Bisagras.
- Manija o barra apropiada.
- Umbral solo si la referencia lo requiere.
- Sentido de apertura configurable.
- Mano izquierda/derecha configurable si se implementa.
- Arco de apertura visible en Top cuando el objeto esta seleccionado.

La hoja no puede ser una caja pegada delante de una pared. Debe ocupar una abertura real y alinearse con su lado, offset y orientacion.

## 4. Puerta TOILET

Crea una variante de puerta interior para el acceso al bano.

Requisitos:

- Rotulo legible `TOILET` en la cara de aproximacion.
- Texto centrado, plano y sin deformacion.
- Placa o señal comercial sobria.
- Contraste suficiente.
- Marco, hoja, bisagras y manija iguales en calidad a la puerta generica.
- Clearance y arco de apertura correctos.

El texto exacto visible debe ser `TOILET`. No uses `WC`, `RESTROOM`, iconos de genero ni nombres de marca como sustituto. Puedes agregar un simbolo accesible neutral solamente si no reemplaza el texto.

No modeles inodoro, lavamanos, divisiones ni interior sanitario en este alcance.

## Contrato con paredes

Las puertas deben consumir el contrato de aberturas definido por el especialista de paredes.

Cada puerta debe referenciar:

- ID de abertura.
- Lado de pared.
- Offset.
- Ancho y alto.
- Orientacion.
- Sentido de apertura.

Reglas:

- Una puerta requiere una abertura compatible.
- Una abertura no puede contener dos puertas.
- Mover la puerta a otra pared actualiza su asociacion de forma explicita.
- Eliminar la puerta puede conservar o liberar la abertura segun una regla documentada.
- Cambiar dimensiones de sala no puede dejar puertas flotando sin advertencia.
- No uses booleanos de render improvisados para ocultar un rectangulo de pared.

## Catalogo y categorias

Agrega objetos con nombres claros y estables, por ejemplo:

- `Pad display stand`
- `Locker bank`
- `Interior door`
- `Toilet door`

Ubicalos en categorias coherentes como `Pads and Storage` y `Facilities`. No mezcles puertas con `Bag Racks`.

Cada registro debe incluir:

- Dimensiones en metros.
- Huella fija o modular.
- Clearance de acceso.
- Descripcion breve.
- Silueta reconocible.

## Materiales y calidad

- Acero powder-coated para stands y lockers cuando corresponda.
- Cuero/vinilo con volumen visible para pads.
- Laminado, metal o madera comercial para puertas segun referencia.
- Metal realista en bisagras y manijas.
- Evita superficies completamente planas, materiales de juguete y colores de marca.
- No uses texturas externas sin licencia verificada.

## Interaccion

- Todos los objetos deben usar los controles existentes sin modificarlos.
- No agregues escala libre.
- Lockers y stand se mueven sobre el piso.
- Las puertas se mueven mediante asignacion a aberturas, no como objetos libres que atraviesan paredes.
- El arco de puerta es una ayuda de seleccion, no geometria permanente intrusiva.
- Clearance debe participar en advertencias de circulacion cuando exista esa infraestructura.

## Archivos permitidos

Puedes modificar solamente lo necesario para estos objetos nuevos:

- `src/domain/types.ts`, para nuevos `EquipmentKind` o tipos de puerta/contenido.
- `src/catalog/equipment.ts`, para sus registros.
- Componentes nuevos dedicados en `src/scene/`.
- Dispatch de `EquipmentModel`, solo para registrar estos objetos.
- `src/components/EquipmentSilhouette.tsx`, solo para sus siluetas.
- `src/state/gymStore.ts`, solo para persistencia y asociacion con aberturas.
- `src/App.tsx` y `src/App.css`, solo para opciones propias de estos objetos.
- Pruebas y auditoria dedicadas.

No edites la geometria interna de `Room`; solicita o consume el contrato de aberturas existente. No cambies `Bench`, `WallPads` ni `EquipmentRack`.

## Validacion obligatoria

### Pad display stand

1. Vacio.
2. Con varios tipos de pads.
3. Capacidad maxima sin intersecciones.
4. Frontal, lateral, superior y tres cuartos.
5. Junto a persona de `1.80 m`.

### Lockers

1. Un modulo.
2. Banco de varios modulos.
3. Clearance frontal visible.
4. Alineado contra cada lado de pared.
5. Modulos sin huecos ni solapamientos.

### Puertas

1. Puerta generica en cada lado de pared.
2. Apertura izquierda y derecha.
3. Arco de apertura correcto en Top.
4. Puerta `TOILET` legible desde la aproximacion.
5. Rechazo de puerta sin abertura.
6. Rechazo de dos puertas en una abertura.
7. Persistencia tras recarga.
8. Cambio de dimensiones de sala con advertencia si una abertura deja de ser valida.

Ejecuta TypeScript, ESLint, build, pruebas de persistencia y Playwright en desktop/movil. Revisa la consola y el diff final.

## Entregables

- Stand realista con pads de cuero genericos visibles.
- Lockers modulares realistas.
- Puerta interior generica.
- Puerta con rotulo exacto `TOILET`.
- Siluetas y registros de catalogo.
- Tabla de dimensiones y referencias.
- Capturas Top y 3D.
- Resultados de validacion.
- Confirmacion explicita de que no se modificaron paredes, banco, wall pads, equipment rack, sacos ni controles.

No declares terminado el trabajo porque los objetos aparezcan en el catalogo. Deben integrarse fisicamente, tener escala real, clearances correctos y comportarse como elementos comerciales funcionales.