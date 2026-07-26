# Prompt: especialista exclusivo en Facilities, pads, lockers y extras realistas

Trabaja exclusivamente en rehacer y ampliar la categoria Facilities / Pads and Storage dentro de `virtual-gym-builder/realistic-prototype/`.

El trabajo anterior es demasiado simple. No aceptes cajas genericas con cuatro patas, estantes vacios sin detalle ni accesorios planos. Cada objeto debe basarse en productos comerciales reales, tener construccion legible y superar comparacion visual con referencias.

No modifiques sacos de golpeo, bag racks, ring, octagono, paredes, tatami, circulos de lucha, controles, camaras, branding, proforma ni PDF. No cambies archivos fuera de `virtual-gym-builder/`. No hagas deploy.

## Objetos existentes que debes rehacer

### Facilities

1. `Training bench`
   - Huella fija: `1.5 x 0.48 m`.
   - Altura actual de planificacion: `0.48 m`.

2. `Wall pad section`
   - Ancho modular total: `2.4 m`.
   - Dimensiones actuales: `2.4 x 0.12 x 1.8 m`.

### Pads and Storage

3. `Equipment rack`
   - Dimensiones fijas: `1.8 x 0.55 x 1.9 m`.

Mantiene esos identificadores y dimensiones de planificacion salvo evidencia comercial fiable y autorizacion explicita para cambiarlos.

## Objetos nuevos obligatorios

Agrega como minimo:

- `Pad display stand`.
- `Locker bank` modular.
- `Thai pad pair`.
- `Focus mitt pair`.
- `Kick shield`.
- `Belly pad`.
- `Headgear storage` o soporte de cabezales.
- `Glove drying rack` o rack ventilado para guantes.
- `Medicine ball storage`.
- `Resistance band station`.
- `Cleaning station` para spray, papel y residuos, apropiado para gimnasio.

Los pads de cuero pueden ser objetos independientes o contenido configurable del display stand, pero deben ser visualmente reconocibles y no simples rectangulos negros.

Lockers son obligatorios. No los omitas ni los sustituyas por un estante abierto.

## Limite comercial

Estos extras son objetos de planificacion. No son sacos vendibles en la proforma actual.

- No les agregues precio.
- No los marques como productos Atheltonic en venta.
- No los incluyas en PDF comercial.
- No cambies la allowlist de sacos vendibles.

## Investigacion obligatoria

Para cada tipologia consulta al menos tres referencias comerciales reales. Prioriza fabricantes de instalaciones deportivas, gimnasios, vestuarios y equipamiento profesional.

Registra:

- URL.
- Fabricante y modelo.
- Dimensiones publicadas.
- Materiales.
- Seccion de tubo o chapa cuando se publique.
- Capacidad.
- Tipo de apoyo, ruedas, niveladores o montaje.
- Rasgos visuales usados.
- Diferencias entre referencia y modelo neutral.

No inventes dimensiones publicadas. Marca estimaciones. No copies logos, colores exclusivos ni arte protegido.

## Regla de calidad visual

Rechaza cualquier modelo que:

- Parezca un bloque o placeholder.
- Use solo uno o dos `boxGeometry` sin detalles constructivos.
- Flote o penetre el piso/pared.
- No tenga frente y orientacion reconocibles.
- No se distinga en vista superior.
- Pierda escala junto a una persona de `1.80 m`.
- Tenga materiales completamente planos.
- Solo se vea correcto desde un angulo.
- Use accesorios como manchas o rectangulos sin grosor.

Usa geometria procedural detallada, instancing razonable o GLB con licencia comercial verificable. No compres assets ni uses descargas sin licencia clara.

## Training bench

Debe parecer un banco comercial de vestuario/gimnasio:

- Bastidor rectangular de acero powder-coated.
- Travesanos y uniones estructurales.
- Asiento acolchado o listones segun referencia.
- Espesor y radios creibles.
- Tornilleria discreta.
- Patas de goma o niveladores.
- Apoyo estable en cuatro puntos.

No lo conviertas en banco de pesas ni mueble domestico.

## Wall pad section

Debe parecer proteccion mural profesional:

- Modulos individuales con juntas regulares.
- Espuma con espesor visible.
- Vinilo lavable con costuras y pliegues sutiles.
- Radios acolchados.
- Sistema de riel o fijacion posterior realista.
- Alineacion exacta con pared.
- Advertencia si se coloca lejos de una pared.

No le agregues patas. No modifiques las paredes para hacerlo caber.

## Equipment rack

Debe ser almacenamiento general comercial, no rack para heavy bags:

- Tubo cuadrado/rectangular robusto.
- Cuatro postes y travesanos.
- Estantes de malla, bandeja o chapa perforada.
- Labios de retencion.
- Cartelas, pernos y uniones.
- Niveladores o ruedas bloqueables.
- Espaciado util para accesorios.
- Contenido generico opcional, sin duplicar productos vendibles.

Debe verse claramente mas completo que el modelo simple actual.

## Pads de cuero

### Thai pads

- Forma curva y grosor real.
- Par izquierdo/derecho.
- Dos correas traseras y asa.
- Costuras, ribete y acolchado.
- Cuero negro neutral sin logo.

### Focus mitts

- Par reconocible.
- Palma trasera, guante/agarre y correa.
- Cara frontal ligeramente curva.
- Grosor y costuras.

### Kick shield

- Escudo grande con volumen.
- Asas traseras y laterales.
- Bordes redondeados acolchados.
- No confundir con wall pad.

### Belly pad

- Perfil curvo para torso.
- Cinturon y cierre trasero.
- Acolchado frontal segmentado.

Todos deben verse como cuero/vinilo profesional. No uses logos de Fairtex, Twins, Boon u otras marcas.

## Pad display stand

Crea un expositor estable y configurable:

- Estructura metalica comercial.
- Panel perforado, brazos, ganchos o bandejas segun referencia.
- Posiciones definidas para pares y escudos.
- Pads apoyados o colgados fisicamente.
- Opcion vacio/lleno.
- Capacidad maxima coherente.
- Ningun objeto flotante.
- No aceptar heavy bags.

El inspector debe permitir mostrar/ocultar contenido por tipo sin alterar la geometria de los pads.

## Locker bank

Crea lockers modulares realistas:

- Cantidad configurable de modulos.
- Una o dos alturas basadas en referencias.
- Chapa doblada o laminate compacto con espesor.
- Puertas con holgura perimetral.
- Bisagras, manija/cerradura y ventilacion.
- Divisiones internas sugeridas sin modelar pertenencias personales.
- Zocalo o patas.
- Clearance frontal para uso.
- Frente inequívoco.

Prueba 1, 3, 6 y 10 modulos. Usa instancing o geometria compartida; no dupliques materiales innecesariamente.

## Otros extras

Cada extra debe resolver una necesidad real del gimnasio:

- Guantes: secado ventilado, no caja cerrada generica.
- Medicine balls: cunas o estantes que impidan rodar.
- Bandas: ganchos separados y longitudes visuales discretas.
- Headgear: soportes que mantengan forma y ventilacion.
- Cleaning station: organizacion segura y compacta, sin marcas quimicas.

No llenes el catalogo con decoracion sin funcion. Mantiene una biblioteca escaneable y profesional.

## Datos y arquitectura

- Crea `EquipmentKind` estables para objetos nuevos.
- Mantiene dimensiones en metros.
- Declara clearance operativo.
- Separa configuracion modular de geometria.
- Persiste cantidad de lockers y contenido del display.
- Conserva diseños existentes con valores por defecto.
- No uses `scale` no uniforme.
- No conviertas accesorios en hijos inseparables si tambien deben poder colocarse independientemente.

## Siluetas de catalogo

Cada objeto nuevo y existente debe tener silueta propia:

- Banco.
- Wall pads.
- Equipment rack.
- Display stand.
- Lockers.
- Thai pads.
- Focus mitts.
- Kick shield.
- Belly pad.
- Storage extras.

No uses el icono generico `Box` para objetos terminados.

## Interaccion

Usa el sistema de controles existente sin modificarlo:

- Seleccion.
- Movimiento sobre piso.
- Rotacion Y.
- Limites de sala.
- Persistencia.

Wall pads deben alinearse con pared. Lockers y racks deben tener clearance frontal. Los pads montados en display deben seguir al stand sin convertirse accidentalmente en objetos libres.

## Archivos permitidos

Concentra cambios en:

- Un modulo nuevo como `src/scene/FacilitiesModels.tsx`.
- Dispatch minimo en `EquipmentModel`.
- `src/domain/types.ts` para nuevos kinds/configuraciones.
- `src/catalog/equipment.ts` para registros.
- `src/components/EquipmentSilhouette.tsx` para siluetas.
- `src/state/gymStore.ts` solo para persistencia/configuracion modular.
- `src/App.tsx` y CSS solo para controles propios de estos extras.
- Tests y auditoria dedicados.

No edites componentes de sacos, racks de sacos, ring/cage ni proforma.

## Validacion visual obligatoria

Para cada objeto captura:

1. Frontal.
2. Lateral.
3. Superior.
4. Tres cuartos.
5. Junto a persona de `1.80 m`.
6. Seleccionado con huella y clearance.

Ademas:

- Display vacio y lleno.
- Cada tipo de pad por separado.
- Locker de 1, 3, 6 y 10 modulos.
- Equipment rack vacio y con contenido generico.
- Wall pads alineados en cada lado de pared.
- Vista con varios extras coexistiendo sin solaparse.
- Desktop y movil.

Compara capturas contra referencias. Si parece simple o generico, itera antes de declarar terminado.

## Validacion tecnica

- TypeScript.
- ESLint.
- Build.
- Tests de dimensiones, modularidad y persistencia.
- Playwright Top/3D en desktop y movil.
- Consola sin errores.
- Prueba con 30 extras para revisar rendimiento.
- Diff final que demuestre alcance exclusivo.

## Entregables

- Reemplazo realista de bench, wall pads y equipment rack.
- Pad display stand realista.
- Lockers modulares.
- Thai pads, focus mitts, kick shield y belly pad reconocibles.
- Extras funcionales de almacenamiento y mantenimiento.
- Siluetas propias.
- Tabla de referencias/dimensiones.
- Capturas comparativas.
- Resultados de validacion.
- Confirmacion de que ninguno se agrego a la proforma vendible.

No declares terminado el trabajo porque haya mas objetos. La calidad minima es que cada elemento se reconozca inmediatamente como equipamiento comercial real y no como geometria provisional.