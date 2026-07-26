# Prompt: especialista exclusivo en Facilities y almacenamiento existente

Trabaja exclusivamente en hacer realistas estos tres objetos existentes dentro de `virtual-gym-builder/realistic-prototype/`:

1. `Training bench` - huella fija `1.5 x 0.48 m`.
2. `Wall pad section` - seccion acolchada modular de `2.4 m`.
3. `Equipment rack` - `1.8 x 0.55 x 1.9 m`.

No modifiques paredes, puertas, lockers, exhibidores de pads, sacos, bag racks, ring, octagono, piso, sala, controles, camaras ni otros equipos. No cambies archivos fuera de `virtual-gym-builder/`. No hagas deploy.

## Objetivo

Sustituye los modelos provisionales por objetos comerciales creibles, de escala real y claramente reconocibles. Conserva las dimensiones de planificacion indicadas salvo que una fuente comercial fiable demuestre un error; cualquier cambio debe documentarse y no puede deformar diseños existentes.

Cada objeto debe:

- Apoyarse correctamente en piso o pared.
- Mostrar una construccion posible.
- Tener materiales PBR sobrios.
- Mantener una silueta reconocible en vista superior.
- Poder seleccionarse, moverse y rotarse con los controles existentes.
- Conservar escala uniforme y dimensiones en metros.
- Permanecer neutral y sin marcas.

## Investigacion obligatoria

Busca al menos tres referencias comerciales por tipologia. Prioriza fabricantes de equipamiento para gimnasios y vestuarios profesionales.

Registra:

- URL.
- Dimensiones publicadas.
- Materiales.
- Tipo de estructura.
- Puntos de apoyo o montaje.
- Capacidad, si se publica.
- Rasgos visibles usados en el modelo.

No inventes especificaciones. Identifica estimaciones de planificacion.

## 1. Training bench

Mantiene huella fija de `1.5 x 0.48 m`. La altura actual de planificacion es `0.48 m`; verifica si corresponde a bancos comerciales comparables.

Debe parecer un banco robusto de gimnasio o vestuario, no una tabla sobre cuatro barras.

Incluye, segun la referencia elegida:

- Asiento acolchado o listones comerciales apropiados.
- Espesor visible del asiento.
- Bordes redondeados discretos.
- Bastidor de acero rectangular o patas comerciales coherentes.
- Travesanos o refuerzos para estabilidad.
- Patas de goma, placas o niveladores.
- Tornilleria o uniones visibles sin exceso de detalle.
- Separacion correcta entre asiento y piso.

No conviertas el banco en banco de pesas ajustable, banco con respaldo, grada ni mobiliario domestico. Es un banco simple para entrenamiento/vestuario con huella fija.

## 2. Wall pad section

Mantiene un ancho modular total de `2.4 m`. Verifica altura `1.8 m` y profundidad `0.12 m` contra sistemas comerciales de proteccion mural para gimnasios.

Debe incluir:

- Paneles modulares individuales con separacion estrecha y regular.
- Nucleo acolchado con grosor creible.
- Cubierta de vinilo o material comercial lavable.
- Costuras, pliegues y radios discretos.
- Sistema de fijacion oculto o riel superior/inferior basado en una referencia real.
- Cara posterior o separadores que expliquen su montaje.
- Base alineada con el piso o altura de montaje documentada.

Reglas:

- No debe flotar delante de la pared.
- No debe penetrar la pared.
- Debe alinearse con una pared usando una regla de montaje, no colocacion aproximada.
- Si no esta junto a una pared, muestra advertencia de montaje en vez de inventar patas.
- No cambies la geometria general de paredes; usa el contrato de pared existente.
- No agregues logos, dianas ni graficos.

## 3. Equipment rack

Mantiene dimensiones `1.8 x 0.55 x 1.9 m`.

Este objeto es almacenamiento general para equipo de entrenamiento. No es un rack para colgar heavy bags y no pertenece al sistema `Bag Racks`.

Debe incluir:

- Estructura de acero tubular cuadrada o rectangular.
- Postes, travesanos, cartelas o uniones realistas.
- Estantes de malla, chapa perforada, listones o bandejas comerciales.
- Labios o retenedores para evitar que el equipo caiga.
- Patas, niveladores o ruedas bloqueables segun referencia.
- Capacidad visual para guardar guantes, paos, escudos, bandas, medicine balls u otros accesorios.
- Separacion vertical util entre niveles.

No integres copias completas de sacos ni productos catalogados. Puedes usar contenido generico de baja complejidad para demostrar almacenamiento, pero debe ser opcional y no confundirse con inventario comercial seleccionable.

No conviertas este rack en exhibidor retail; otro agente creara el stand dedicado a pads de cuero.

## Materiales

- Acero pintado o powder-coated con roughness creible.
- Vinilo acolchado con costuras discretas.
- Goma en patas y apoyos.
- Madera solamente cuando la referencia la justifique.
- Evita colores dominantes o acabados de juguete.
- Mantiene contraste suficiente para leer volumen.

## Datos y seleccion

- Conserva los `EquipmentKind` existentes: `bench`, `wall-pads`, `equipment-rack`.
- No dupliques estas entidades con nombres nuevos.
- Conserva posicion, rotacion y persistencia de diseños existentes.
- Actualiza caja de seleccion y huella solo si la geometria verificada lo exige.
- No agregues escala editable.
- Las siluetas del catalogo deben reconocer los tres objetos sin usar el icono generico de caja.

## Archivos permitidos

Concentra cambios en:

- Componentes `Bench`, `WallPads` y `EquipmentRack` y helpers exclusivos.
- Un archivo nuevo dedicado a modelos Facilities si mejora separacion.
- `src/catalog/equipment.ts`, solo para esos tres registros.
- `src/components/EquipmentSilhouette.tsx`, solo para esas tres siluetas.
- Pruebas y auditoria de esos tres objetos.

No edites `Room`, modelos de sacos, racks de sacos, ring, octagono o controles.

## Validacion visual obligatoria

Para cada objeto captura:

1. Vista frontal.
2. Vista lateral.
3. Vista superior.
4. Perspectiva de tres cuartos.
5. Junto a una persona de `1.80 m`.
6. Seleccionado con su huella visible.

Ademas:

- Banco: comprueba que las cuatro esquinas o apoyos toquen el piso.
- Wall pads: comprueba alineacion real con cada lado de pared y advertencia fuera de pared.
- Equipment rack: comprueba estabilidad, acceso a estantes y ausencia de piezas flotantes.

## Validacion tecnica

- TypeScript.
- ESLint de archivos modificados.
- Build de produccion.
- Consola del navegador sin errores nuevos.
- Movimiento, rotacion, limites y persistencia.
- Verificacion dimensional automatizada o documentada.
- Playwright en Top y 3D, desktop y movil.
- Diff final que demuestre alcance exclusivo.

## Entregables

- Tres modelos realistas terminados.
- Tres siluetas de catalogo reconocibles.
- Tabla de dimensiones, materiales y referencias.
- Capturas requeridas.
- Resultados de validacion.
- Confirmacion explicita de que no se modificaron paredes, puertas, lockers, exhibidores ni otros equipos.

No declares terminado el trabajo porque los objetos tengan mas piezas. Deben corresponder a productos comerciales posibles, verse proporcionados y mantener exactamente su funcion de planificacion.