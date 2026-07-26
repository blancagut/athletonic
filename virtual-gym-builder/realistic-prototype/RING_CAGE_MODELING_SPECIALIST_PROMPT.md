# Prompt: especialista exclusivo en ring de boxeo y octagono MMA

Trabaja exclusivamente en el ring de boxeo y el octagono MMA dentro de `virtual-gym-builder/realistic-prototype/`.

No modifiques sacos, racks, estaciones de montaje, soportes, anclajes de sacos, tatami, circulos de lucha, dimensiones de la habitacion, paredes, iluminacion general, camaras, navegacion, checkout, catalogos comerciales ni archivos fuera de `virtual-gym-builder/`. No hagas deploy.

## Limite estricto de responsabilidad

Tus unicos objetos bajo responsabilidad son:

- `boxing-ring`
- `mma-cage`

Puedes modificar solamente la geometria, materiales, dimensiones verificadas, siluetas, datos descriptivos y controles directamente necesarios para esos dos objetos. No aproveches el trabajo para refactorizar otros equipos.

No remodeles ningun saco. No cambies la logica de racks. No integres sacos, racks ni estaciones al ring o al octagono.

## Objetivo

Reemplaza las representaciones provisionales del ring y del octagono por estructuras comerciales realistas, reconocibles y construidas a escala metrica. Deben verse correctas en vista 3D y superior, permitir planificar su huella real dentro del gimnasio y conservar su forma al moverse o rotarse.

No deben parecer plataformas simples con barras, cercas transparentes genericas, juguetes, escenarios de lucha libre ni estructuras flotantes.

## Investigacion obligatoria

Antes de editar cada modelo, consulta fuentes tecnicas confiables y registra las URLs utilizadas.

Para el ring de boxeo, prioriza:

- Reglamentos de World Boxing y federaciones nacionales reconocidas.
- Reglas tecnicas de competencias amateur y profesionales cuando sus medidas difieran.
- Fabricantes comerciales de rings de entrenamiento y competencia.
- Fichas tecnicas de plataformas, postes, cuerdas, tensores, protectores y escaleras.

Para el octagono MMA, prioriza:

- Reglas unificadas de MMA publicadas por comisiones atleticas.
- Especificaciones de fabricantes comerciales de jaulas MMA.
- Fichas tecnicas de paneles, postes, malla, acolchado, puertas y plataformas.

Para cada referencia registra:

- URL y fecha de consulta.
- Medida interior util.
- Huella exterior total.
- Altura de plataforma.
- Altura de cuerdas o cerca.
- Cantidad y separacion de cuerdas.
- Seccion de postes y estructura cuando se publique.
- Tipo de malla, acolchado y acceso cuando se publique.
- Diferencia entre dimensiones reglamentarias y dimensiones comerciales del producto.

No inventes dimensiones no publicadas. Marca claramente cualquier estimacion de planificacion. No uses una medida interior como si fuera la huella exterior.

## Ring de boxeo

Construye un ring profesional completo y estructuralmente legible.

Debe incluir, segun la referencia verificada:

- Plataforma elevada con espesor y bastidor creibles.
- Superficie de lona tensada y acolchada.
- Faldon o apron alrededor del area interior.
- Cuatro postes de esquina correctamente ubicados.
- Cuatro cuerdas continuas por lado, salvo que la referencia reglamentaria elegida exija otra cantidad.
- Separacion vertical correcta entre cuerdas.
- Tensores o turnbuckles en las esquinas.
- Protectores de esquina y cubiertas de tensor.
- Uniones visibles entre cuerdas y postes.
- Acceso comercial coherente, como escalones removibles, si la referencia lo contempla.
- Base apoyada completamente en el piso; ninguna pieza puede flotar.

### Reglas especificas del ring

- Distingue `area interior de combate` de `huella exterior total`.
- No coloques los postes dentro del area util si la referencia los ubica fuera de las cuerdas.
- Las cuerdas deben encontrarse con las esquinas y mantener continuidad visual.
- No representes cuerdas tensadas con barras metalicas rigidas de aspecto macizo.
- Usa curvas, segmentos o geometria apropiada para que las cuerdas parezcan flexibles y tensadas.
- Los cuatro niveles de cuerda deben mantener alturas consistentes.
- Los tensores y protectores no deben atravesar postes, cuerdas ni lona.
- La lona debe quedar por encima de la estructura, sin `z-fighting` ni huecos visibles.
- La plataforma debe mostrar grosor realista en vista lateral.
- Conserva la posibilidad existente de aplicar el logo del cliente a la lona, sin agregar marcas propias.
- El logo debe quedar plano, centrado, proporcionado y sin deformar la geometria.

## Octagono MMA

Construye una jaula MMA comercial de ocho lados, neutral y sin marcas.

Debe incluir, segun la referencia verificada:

- Ocho lados geometricamente regulares.
- Plataforma o base estructural con grosor creible.
- Superficie acolchada continua.
- Ocho postes estructurales alineados con los vertices.
- Bastidor superior e inferior continuo.
- Paneles de malla metalica realistas entre postes.
- Acolchado vertical sobre postes y elementos de contacto.
- Acolchado superior sobre el borde de la cerca cuando corresponda.
- Al menos una puerta funcional visualmente identificable.
- Bisagras, marco y cierre de puerta tecnicamente coherentes.
- Escalones o acceso exterior cuando la referencia comercial los incluya.
- Apoyo completo sobre el piso; ninguna parte puede flotar.

### Reglas especificas del octagono

- Debe tener exactamente ocho lados; no aproximes la forma con un circulo.
- Distingue diametro o ancho interior de la huella exterior total.
- La puerta debe pertenecer a un panel real y no ser una abertura sin estructura.
- La puerta no puede ocupar dos lados ni cortar un poste.
- La malla debe leerse como malla de cerramiento, no como una caja transparente ni como un plano `wireframe` rectangular.
- Evita crear miles de objetos individuales para la malla. Usa una textura, shader, geometria instanciada o solucion eficiente que conserve el patron de rombos y la transparencia.
- La malla debe proyectar una silueta creible desde vista superior y perspectiva.
- El bastidor superior e inferior debe seguir los ocho lados sin huecos.
- El acolchado debe cubrir las superficies de impacto sin ocultar toda la estructura.
- No agregues techo, cupula ni elementos que no existan en una jaula MMA abierta convencional.
- Conserva la posibilidad de mostrar el logo del cliente en la superficie si la arquitectura existente lo permite, sin marcas de terceros.

## Marca y propiedad intelectual

- No uses UFC, Bellator, ONE, PFL, Monster Energy ni ninguna otra marca, logotipo, paleta identificable o grafica protegida.
- No copies arte de lona, tipografia, patrocinadores ni esquemas visuales exclusivos.
- Los modelos deben ser comerciales genericos y neutrales.
- Puedes estudiar productos reales para comprender construccion y proporciones, pero el resultado debe estar sin marca.

## Escala y datos

- Modela en metros.
- Mantiene escala uniforme `1:1`.
- No uses escalado no uniforme para corregir proporciones.
- Las dimensiones del catalogo deben representar de forma explicita la huella exterior utilizada para planificacion.
- Si cambias una dimension existente porque una fuente fiable demuestra que es incorrecta, documenta el valor anterior, el nuevo valor y la fuente.
- Conserva compatibilidad con diseños guardados; una correccion visual no debe mover automaticamente objetos existentes.
- Muestra o reutiliza una referencia humana neutra de exactamente `1.80 m` durante la validacion, sin convertirla en parte permanente del ring o la jaula.

## Interaccion y comportamiento

- El ring y el octagono deben seguir siendo objetos independientes seleccionables.
- Deben poder moverse y rotarse con la interaccion existente.
- No permitas deformacion ni redimensionamiento libre.
- La seleccion no debe ocultar cuerdas, malla, puerta ni acolchados.
- La caja de seleccion, calculo de limites y advertencia de espacio deben usar la huella exterior completa.
- La vista superior debe permitir distinguir claramente ring y octagono.
- Conserva persistencia de posicion y rotacion.
- No cambies la logica general de arrastre salvo que exista un defecto reproducible exclusivo de estos dos objetos.

## Rendimiento y materiales

- Reutiliza geometria y materiales cuando sea razonable.
- Evita una malla MMA construida con miles de componentes React independientes.
- Usa materiales PBR sobrios: acero pintado, lona mate, acolchado vinilico y malla metalica.
- La malla debe conservar transparencia sin desaparecer desde angulos oblicuos.
- Evita parpadeo, `z-fighting`, sombras excesivamente pesadas y superficies completamente negras sin volumen.
- Mantiene una cantidad de poligonos apropiada para que varias estructuras puedan coexistir en el configurador.

## Archivos permitidos

Concentra los cambios principalmente en:

- `src/scene/GymScene.tsx`, exclusivamente en `BoxingRing`, `MmaCage` y helpers dedicados a esos modelos.
- `src/catalog/equipment.ts`, solo si las dimensiones o descripciones verificadas de `boxing-ring` y `mma-cage` deben corregirse.
- `src/components/EquipmentSilhouette.tsx`, solo para crear siluetas reconocibles de ring y octagono.
- Pruebas o documentacion de auditoria dedicadas exclusivamente a estos dos objetos.

Si necesitas un helper compartido, no cambies el comportamiento visual de otros equipos. No edites archivos de sacos ni racks.

## Validacion visual obligatoria

Captura y revisa cada objeto por separado en:

1. Vista superior.
2. Vista frontal.
3. Vista lateral.
4. Perspectiva de tres cuartos.
5. Seleccionado junto a una persona de `1.80 m`.
6. Colocado cerca de una pared para comprobar huella y altura.

### Ring: casos que deben comprobarse

- Los cuatro postes son visibles y simetricos.
- Todas las cuerdas llegan correctamente a las cuatro esquinas.
- Los tensores y protectores no se intersectan.
- El area interior y la huella exterior coinciden con los datos documentados.
- La plataforma toca el piso y tiene altura creible.
- El logo del cliente, si existe, se renderiza sin deformacion.

### Octagono: casos que deben comprobarse

- Hay exactamente ocho lados y ocho vertices.
- Todos los paneles de malla cierran el perimetro excepto la separacion funcional de la puerta.
- La puerta tiene marco, bisagras y cierre visibles.
- No hay huecos accidentales entre malla, postes y bastidores.
- El area interior y la huella exterior coinciden con los datos documentados.
- La plataforma toca el piso y tiene altura creible.
- La transparencia de la malla funciona desde todos los angulos de prueba.

## Validacion tecnica obligatoria

Antes de declarar terminado el trabajo:

- Ejecuta TypeScript.
- Ejecuta ESLint sobre todos los archivos modificados.
- Ejecuta el build de produccion.
- Revisa la consola del navegador y corrige errores o advertencias causados por tus cambios.
- Verifica seleccion, movimiento, rotacion y persistencia de ambos objetos.
- Comprueba que no cambiaste ningun saco, rack, estacion, piso, pared ni control de habitacion.
- Presenta el diff final por archivo para demostrar que el alcance se mantuvo cerrado.

## Entregables

- Ring de boxeo comercial realista y sin marca.
- Octagono MMA comercial realista y sin marca.
- Tabla de auditoria con medidas interiores, huella exterior, alturas y URLs.
- Capturas de las seis vistas requeridas para cada objeto.
- Resultado de TypeScript, ESLint y build.
- Lista breve de cualquier medida estimada que siga pendiente de confirmacion.
- Confirmacion explicita de que no se modificaron sacos, racks ni otros sistemas.

No declares el trabajo terminado solo porque compila. Ambos modelos deben superar comparacion visual y dimensional contra referencias reales, funcionar correctamente dentro del configurador y mantener el alcance limitado al ring y al octagono.