# Prompt: especialista exclusivo en controles e interaccion del configurador

Trabaja exclusivamente en calibrar y corregir los controles del editor dentro de `virtual-gym-builder/realistic-prototype/`: seleccion, movimiento, rotacion, navegacion de camara y entradas de mouse, trackpad, teclado y pantalla tactil.

No remodeles ni cambies la apariencia de ningun objeto. No modifiques geometria, dimensiones comerciales, materiales, colores, luces, logos, sacos, racks, estaciones, ring, octagono, tatami, circulos de lucha, paredes ni decoracion. No cambies checkout, catalogos comerciales, navegacion principal ni archivos fuera de `virtual-gym-builder/`. No hagas deploy.

## Limite estricto de responsabilidad

Tu responsabilidad termina en como el usuario controla el configurador y como se actualizan las transformaciones permitidas de los objetos.

Puedes trabajar solamente en:

- Seleccion y deseleccion.
- Arrastre de objetos sobre el piso.
- Rotacion de objetos alrededor del eje vertical.
- Gizmos o manipuladores de movimiento y rotacion.
- Navegacion de camara en vista superior y perspectiva.
- Zoom, pan y orbitacion.
- Snapping y precision.
- Limites de movimiento dentro de la habitacion.
- Atajos de teclado relacionados con seleccion y transformacion.
- Comportamiento equivalente en mouse, trackpad y tactil.
- Indicadores y controles de interfaz estrictamente necesarios para estas acciones.
- Persistencia, cancelacion y deshacer de transformaciones.

No uses este trabajo para rediseñar paneles, equipos o la escena.

## Problema actual que debes auditar

La implementacion actual combina:

- Arrastre directo mediante interseccion con un plano horizontal.
- `TransformControls` para mover y rotar.
- `OrbitControls` para controlar la camara.
- Snapping fijo de `0.25 m` durante movimiento.
- Snapping fijo de `15 grados` durante rotacion.

Estos sistemas pueden competir por los mismos eventos de puntero. Audita especificamente:

- Si la camara se mueve mientras se arrastra un objeto.
- Si el objeto salta cuando comienza el arrastre.
- Si un clic de seleccion se interpreta como movimiento.
- Si el gizmo y el arrastre directo escriben posiciones diferentes.
- Si `pointer capture` queda activo despues de cancelar o salir del canvas.
- Si cambiar entre `Top` y `3D` pierde la seleccion de forma innecesaria.
- Si el objeto se mueve al intentar seleccionar una estacion o una pieza montada.
- Si el objeto puede atravesar paredes o quedar parcialmente fuera de la habitacion.
- Si el snapping hace dificil colocar objetos con precision.
- Si los controles son demasiado pequeños, ambiguos o imposibles de usar en tactil.
- Si las transformaciones se guardan demasiadas veces durante el movimiento o no se guardan al finalizar.

No asumas la causa. Reproduce cada fallo antes de modificarlo.

## Objetivo de experiencia

El configurador debe sentirse como una herramienta profesional de planificacion espacial:

- Un clic selecciona sin mover.
- Arrastrar mueve de forma predecible sobre el piso.
- El objeto mantiene el punto exacto agarrado bajo el cursor; no salta al centro.
- Soltar confirma una unica transformacion.
- `Escape` cancela y restaura la posicion o rotacion inicial.
- La camara nunca compite con una transformacion activa.
- Mover la camara nunca mueve accidentalmente un objeto.
- Rotar es deliberado, preciso y comprensible.
- Los objetos permanecen dentro de los limites permitidos.
- Mouse, trackpad y tactil producen resultados equivalentes.
- La interaccion sigue siendo fluida con muchos objetos.

## Arquitectura de interaccion obligatoria

Implementa una unica maquina de estados o controlador coherente para la interaccion. Adapta los nombres a las convenciones existentes, pero distingue al menos:

```ts
type InteractionState =
  | { mode: 'idle' }
  | { mode: 'selected'; objectId: string }
  | { mode: 'pending-drag'; objectId: string; pointerId: number }
  | { mode: 'dragging'; objectId: string; pointerId: number }
  | { mode: 'rotating'; objectId: string; pointerId?: number }
  | { mode: 'camera'; pointerId?: number }
```

No mantengas dos autoridades independientes transformando el mismo objeto al mismo tiempo.

Puedes conservar `TransformControls`, reemplazarlo o limitarlo a una funcion concreta, pero debes justificar la decision. Si se conserva:

- Desactiva `OrbitControls` mientras el gizmo esta activo.
- Evita que el arrastre directo y el gizmo se ejecuten simultaneamente.
- Usa una sola funcion para normalizar, limitar y confirmar transformaciones.
- Escucha correctamente los eventos de inicio y fin de arrastre.

Si el arrastre directo se convierte en la autoridad principal, el gizmo no debe duplicar el movimiento.

## Seleccion

- Un clic corto selecciona el objeto bajo el puntero sin moverlo.
- Usa un umbral de distancia antes de convertir un `pointerdown` en arrastre; no inicies movimiento con cualquier variacion de uno o dos pixeles.
- Distingue clic, doble clic, arrastre y navegacion de camara.
- Hacer clic en el piso vacio deselecciona.
- Hacer clic en un control de interfaz no debe afectar la escena.
- La seleccion de una estacion de rack o equipo montado no debe arrastrar automaticamente el rack completo.
- Elementos pequeños deben poder seleccionarse sin exigir precision irreal.
- La seleccion visual debe permanecer estable durante movimiento y rotacion.
- Cambiar de vista no debe borrar la seleccion salvo que exista una razon de producto documentada.

## Movimiento

- Los objetos se mueven solamente sobre el plano del piso: cambia `x` y `z`, nunca `y`.
- Conserva el offset entre el punto agarrado y el origen del objeto para evitar saltos.
- Usa `pointer capture` de forma segura y liberalo en `pointerup`, `pointercancel`, perdida de foco y desmontaje.
- Durante un arrastre activo, desactiva temporalmente orbitacion, pan y seleccion de otros objetos.
- No escribas en el estado persistente en cada pixel si eso degrada rendimiento.
- Muestra la posicion preliminar durante el gesto y confirma una sola operacion al finalizar.
- Si se cancela, restaura exactamente la transformacion inicial.
- La posicion guardada y la posicion visible deben coincidir despues de soltar.
- Mover un rack debe conservar sus estaciones y equipos asignados sin modificar su geometria.
- Los equipos montados que heredan transformacion no deben convertirse accidentalmente en objetos libres.

## Limites de la habitacion

No limites solo el punto central del objeto. Usa su huella completa y su rotacion actual.

- Calcula limites a partir de la caja o poligono de huella en coordenadas mundiales.
- Considera ancho, profundidad y rotacion alrededor de `Y`.
- Considera dimensiones dinamicas de racks modulares.
- Impide o corrige que una estructura quede atravesando una pared.
- Mantiene un margen minimo configurable respecto a paredes cuando corresponda.
- Si un objeto es mayor que la habitacion, no lo deformes: muestra una advertencia clara y conserva una posicion determinista.
- No implementes automaticamente un motor fisico completo ni bloquees todas las colisiones entre objetos salvo que ya exista esa politica. Mantente en controles y limites de sala.

## Snapping y precision

El snapping fijo actual debe evaluarse con usuarios y tamaños reales.

Implementa controles comprensibles para:

- Movimiento libre.
- Cuadricula fina, recomendada `0.05 m` o `0.10 m`.
- Cuadricula estandar, recomendada `0.25 m`.
- Rotacion libre o fina.
- Rotacion estandar de `15 grados`.
- Modificador temporal para precision, por ejemplo `Shift`.
- Modificador temporal para activar o desactivar snapping, segun el patron elegido.

No cambies silenciosamente el modo del usuario. El estado de snapping debe ser visible y persistente si forma parte de las preferencias del editor.

Aplica snapping respecto a una referencia consistente. Evita acumulacion de errores flotantes y deriva tras muchos movimientos o rotaciones.

## Rotacion

- Rota solamente alrededor del eje vertical `Y`.
- Usa el centro/pivote estable del objeto.
- El objeto no debe cambiar de posicion al comenzar o terminar la rotacion.
- Muestra el angulo actual en grados durante el gesto.
- Normaliza angulos a un rango consistente.
- Los botones `-15 grados` y `+15 grados` deben usar la misma funcion de confirmacion que el gizmo.
- Permite cancelacion con `Escape`.
- Al rotar cerca de una pared, recalcula los limites usando la nueva huella.
- No permitas escala mediante gizmo, teclado ni gestos.

## Camara

### Vista superior

- Debe permanecer ortografica.
- Permite pan y zoom predecibles.
- No permite inclinacion ni rotacion accidental.
- El zoom debe centrarse de forma estable bajo el cursor o usar un comportamiento documentado consistente.
- Incluye una accion clara para encuadrar toda la habitacion.

### Vista 3D

- Permite orbitar, hacer pan y zoom sin atravesar el piso.
- Mantiene un objetivo de camara estable.
- Evita angulos que coloquen la camara debajo de la escena.
- Incluye una accion clara para restablecer o encuadrar la habitacion.
- Al cambiar entre `Top` y `3D`, conserva seleccion y transformacion; solo cambia la camara.

### Conflictos

- Mientras se mueve o rota un objeto, la camara queda bloqueada.
- Mientras se usa un gesto de camara, ningun objeto puede comenzar a moverse.
- En tactil, un dedo puede seleccionar o mover segun el estado; dos dedos quedan reservados para pan/zoom/orbita de camara.
- En trackpad, scroll y pinch no deben iniciar arrastre de objetos.

## Teclado y accesibilidad

Implementa y documenta internamente atajos convencionales, siempre que no interfieran con inputs de texto:

- `V` o una tecla equivalente para modo mover.
- `R` para modo rotar.
- Flechas para desplazamiento fino del objeto seleccionado.
- `Shift` + flechas para un incremento mayor o menor, segun la convencion elegida y visible.
- `[` y `]`, o una alternativa clara, para rotacion incremental.
- `Escape` para cancelar la transformacion activa o deseleccionar si no hay transformacion.
- `Delete`/`Backspace` para eliminar, con proteccion adecuada en campos de texto.
- Atajo para encuadrar la habitacion o la seleccion.
- `Cmd/Ctrl+Z` para deshacer la ultima transformacion si el historial se implementa en este alcance.

Reglas:

- No captures atajos cuando el foco esta en `input`, `textarea`, `select` o contenido editable.
- Los botones de modo deben tener nombre accesible, tooltip y estado activo perceptible.
- Los objetivos tactiles deben tener tamaño suficiente.
- No dependas solamente del color para indicar el modo activo.
- No muestres texto instructivo permanente encima de la escena; usa tooltips y estados concisos.

## Historial y persistencia

- Cada gesto completo debe producir una sola entrada de historial si existe `undo`.
- No crees cientos de entradas durante un arrastre.
- `Escape` no debe persistir el estado provisional.
- Recargar debe conservar la ultima transformacion confirmada, no una posicion intermedia.
- Las posiciones deben serializarse con precision suficiente y sin ruido flotante innecesario.
- No cambies el formato persistido salvo que sea necesario; si cambia, agrega migracion compatible.

## Rendimiento

- No actualices todo el arbol React en cada evento de puntero si puede evitarse.
- Usa actualizacion visual imperativa temporal durante el gesto y confirma al store al finalizar, o demuestra que otra estrategia mantiene fluidez.
- Evita crear vectores, planos y raycasters innecesarios en cada frame.
- Prueba con al menos 50 objetos movibles en la escena.
- No sacrifiques exactitud de posicion por suavidad visual.

## Archivos permitidos

Concentra los cambios en:

- `src/scene/GymScene.tsx`, exclusivamente en camaras, seleccion y transformacion.
- Hooks o controladores nuevos dedicados a interaccion dentro de `src/`.
- `src/state/gymStore.ts`, exclusivamente para estado de controles, confirmacion, cancelacion, preferencias e historial.
- `src/domain/types.ts`, solo para tipos de interaccion o preferencias.
- `src/App.tsx`, exclusivamente para controles de mover, rotar, snapping, encuadre y estado de interaccion.
- `src/App.css`, exclusivamente para esos controles y sus estados accesibles.
- Pruebas dedicadas a interaccion.

No cambies componentes de geometria de equipos aunque esten en el mismo archivo. Si debes tocar `GymScene.tsx`, limita el diff a `CameraRig`, `EquipmentObject`, `SceneContent`, `GymScene` y helpers de interaccion.

## Plan de auditoria obligatorio

Antes de editar:

1. Graba o documenta el comportamiento actual en `Top` y `3D`.
2. Reproduce clic, arrastre, rotacion y navegacion con mouse.
3. Reproduce trackpad o eventos equivalentes.
4. Reproduce viewport tactil con emulacion Playwright.
5. Identifica que sistema controla cada gesto: arrastre directo, gizmo u orbitacion.
6. Escribe una matriz de conflictos y el resultado esperado.
7. Elige una unica arquitectura de eventos.

No realices cambios visuales de equipos para ocultar problemas de seleccion.

## Validacion funcional obligatoria

Prueba como minimo:

1. Clic en un objeto sin movimiento: selecciona y conserva coordenadas.
2. Movimiento menor que el umbral: sigue siendo clic.
3. Arrastre desde el borde: no salta al centro.
4. Arrastre rapido: no pierde `pointer capture`.
5. Salida del canvas durante arrastre: termina o cancela de forma controlada.
6. `Escape` durante arrastre: restaura posicion inicial.
7. Arrastre en `Top`: la camara no se desplaza.
8. Arrastre en `3D`: el objeto sigue el piso y la camara no orbita.
9. Orbitacion de camara: ningun objeto se mueve.
10. Pan y zoom: no cambian seleccion ni transformacion.
11. Rotacion libre y con snap: no cambia posicion.
12. Rotacion cerca de pared: la huella permanece dentro del cuarto.
13. Objeto grande, ring u octagono: limites calculados por huella completa.
14. Rack modular largo: limites calculados con dimensiones dinamicas.
15. Equipo montado: seleccionar no arrastra el rack por error.
16. Dos objetos superpuestos: seleccion consistente o mecanismo claro para resolver ambiguedad.
17. Cambio `Top`/`3D`: conserva seleccion.
18. Recarga: conserva ultima transformacion confirmada.
19. Teclado dentro de input: no mueve ni elimina objetos.
20. Tactil con un dedo: seleccion y movimiento correctos.
21. Tactil con dos dedos: solo controla camara.
22. Escena con 50 objetos: movimiento fluido y sin errores de consola.

## Validacion tecnica obligatoria

Antes de declarar terminado el trabajo:

- Ejecuta TypeScript.
- Ejecuta ESLint sobre todos los archivos modificados.
- Ejecuta el build de produccion.
- Ejecuta pruebas automatizadas de la maquina de estados y normalizacion de transformaciones.
- Usa Playwright para validar mouse y viewport movil.
- Revisa la consola del navegador.
- Comprueba que no existe movimiento vertical ni escalado.
- Comprueba que una operacion genera una sola confirmacion persistida.
- Presenta el diff final por archivo para demostrar que no se modificaron modelos 3D, materiales ni dimensiones comerciales.

## Entregables

- Auditoria breve de los conflictos encontrados.
- Diagrama o tabla de la maquina de estados final.
- Controles calibrados para seleccion, movimiento, rotacion y camara.
- Tabla de gestos para mouse, trackpad, teclado y tactil.
- Valores finales de umbral, snapping e incrementos, con justificacion.
- Pruebas automatizadas y resultados de Playwright.
- Resultado de TypeScript, ESLint y build.
- Confirmacion explicita de que no cambiaste el diseño de ningun objeto, equipo o estructura.

No declares terminado el trabajo porque el objeto simplemente se puede arrastrar. Debe sentirse estable, deliberado, predecible y consistente en todas las entradas, sin conflictos entre objeto, gizmo y camara.