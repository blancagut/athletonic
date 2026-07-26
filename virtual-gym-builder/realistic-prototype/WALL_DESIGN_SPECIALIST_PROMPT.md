# Prompt: especialista exclusivo en diseno realista de paredes

Trabaja exclusivamente en el sistema arquitectonico de paredes dentro de `virtual-gym-builder/realistic-prototype/`.

No remodeles ni modifiques sacos, racks, estaciones, ring, octagono, banco, wall pads, equipment rack, exhibidores, lockers, puertas, tatami, circulos de lucha, equipos montados ni controles de interaccion. No cambies checkout, catalogos comerciales, navegacion principal ni archivos fuera de `virtual-gym-builder/`. No hagas deploy.

## Limite estricto

Tu responsabilidad incluye solamente:

- Geometria y materiales de las paredes del cuarto.
- Espesor, altura, esquinas, zocalos y remates.
- Acabado interior creible para un gimnasio comercial.
- Segmentacion arquitectonica necesaria para soportar aberturas futuras.
- Visibilidad de paredes en vista superior y perspectiva.
- Reglas de ocultamiento o corte de paredes para no bloquear la edicion.
- Sombras, oclusion y rendimiento directamente relacionados con paredes.

No modeles puertas ni ventanas terminadas. Otro agente es responsable de puertas, lockers y amenities. Puedes definir un contrato de `WallOpening` o puntos de insercion para que ese agente integre puertas sin perforar paredes mediante hacks visuales.

## Problema actual

La sala se representa principalmente mediante dos cajas planas de `0.18 m`, barras cilindricas usadas como moldura y algunos postes. Esto produce paredes genericas, esquinas poco creibles y una vista 3D que no parece una instalacion comercial real.

Audita la implementacion actual de `Room` antes de editar. No cambies piso, dimensiones de sala ni controles para ocultar defectos de las paredes.

## Objetivo

Construye un sistema de paredes modular, realista y eficiente que permita visualizar un gimnasio comercial sin impedir la colocacion de equipos.

Las paredes deben:

- Tocar correctamente el piso.
- Tener espesor visible en extremos y aberturas.
- Formar esquinas limpias sin solapamientos ni huecos.
- Respetar exactamente `room.width`, `room.depth` y `room.height`.
- Mantener el interior util consistente con esas medidas.
- Verse bien desde arriba, desde dentro y desde fuera.
- Poder ocultarse con el control existente.
- Prepararse para puertas y otros elementos arquitectonicos sin modelarlos aqui.

## Investigacion obligatoria

Estudia referencias de interiores reales de gimnasios de boxeo, Muay Thai, MMA y centros de entrenamiento comerciales. Prioriza fotografias arquitectonicas y sistemas constructivos reales, no renders decorativos.

Registra:

- Tipo de pared interior.
- Espesor habitual de planificacion.
- Zocalo o proteccion inferior.
- Juntas, esquinas y remates.
- Acabado lavable y resistente a impacto.
- Tratamiento alrededor de pilares y aberturas.
- Soluciones de visibilidad usadas en configuradores 3D.

No copies marcas, murales ni graficos protegidos. No agregues logos o patrocinadores.

## Modelo arquitectonico

Distingue explicitamente:

- Dimensiones interiores utiles.
- Espesor de pared.
- Cara interior.
- Cara exterior.
- Remate superior.
- Esquinas.
- Aberturas reservadas.

El espesor debe extenderse hacia afuera del area util, salvo que la arquitectura existente documente otra convencion. No reduzcas silenciosamente el area del gimnasio.

Modelo conceptual recomendado:

```ts
type WallSide = 'north' | 'south' | 'east' | 'west'

type WallOpening = {
  id: string
  wall: WallSide
  offsetMeters: number
  widthMeters: number
  heightMeters: number
  sillMeters: number
  purpose: 'door' | 'window' | 'service'
}

type WallFinish = {
  interiorColor: string
  exteriorColor: string
  baseboardColor: string
  baseboardHeightMeters: number
}
```

No es obligatorio usar estos nombres, pero conserva la separacion entre pared, acabado y abertura. No guardes puertas dentro de la geometria de pared.

## Geometria obligatoria

- Usa segmentos de pared con dimensiones exactas, no planos sin espesor.
- Resuelve esquinas a inglete, solape controlado o postes arquitectonicos reales.
- Evita `z-fighting` entre caras, zocalos y piso.
- El zocalo debe ser rectangular o corresponder a una referencia real; no uses barras cilindricas como sustituto generico.
- Agrega remate superior solo si es visible y coherente.
- Las caras interiores deben recibir sombras con suavidad.
- Las caras exteriores no deben verse vacias o invertidas.
- Si existen aberturas, construye dintel y jambas con espesor visible.
- No agregues techo completo si bloquea la camara; queda fuera de alcance salvo un borde estructural minimo necesario.
- No agregues columnas decorativas sin justificacion constructiva.

## Acabado visual

Elige una direccion sobria de gimnasio comercial:

- Pintura interior lavable de tono neutro claro.
- Zocalo resistente a golpes y limpieza.
- Variacion muy sutil de roughness para evitar superficies plasticas.
- Esquinas y juntas discretas.
- Suciedad, grietas o desgaste solamente si son sutiles y no degradan la presentacion comercial.

No conviertas las paredes en un elemento protagonista. Deben aportar escala, profundidad y credibilidad sin competir con los equipos.

## Visibilidad y edicion

Define un comportamiento consistente:

- El control actual de paredes debe ocultar y mostrar todo el sistema.
- En vista superior, usa altura reducida, transparencia controlada, corte visual o paredes ocultables si la altura completa bloquea la planta.
- En perspectiva, evita que la pared entre camara y seleccion impida trabajar.
- No hagas paredes permanentemente transparentes como solucion facil.
- La transparencia, si se usa, debe depender de vista o relacion camara-objeto y no producir orden de render incorrecto.
- Las paredes no deben capturar clics destinados a objetos visibles detras, salvo que se implemente seleccion arquitectonica explicita.

## Integracion con puertas

Otro agente creara puertas convencionales y una puerta `TOILET`.

Tu sistema debe ofrecer una forma estable de reservar una abertura:

- La abertura pertenece a un lado de pared.
- Tiene offset, ancho, alto y antepecho.
- Recorta realmente la pared o la construye a partir de segmentos alrededor del hueco.
- Expone posicion y orientacion mundial para que una puerta independiente se alinee.
- No incrusta hoja, marco, manija, señal o animacion.
- Impide aberturas fuera de los extremos o superpuestas.

Prefiere composicion por segmentos a operaciones booleanas fragiles si ofrece mejor estabilidad y rendimiento.

## Rendimiento

- Reutiliza materiales y geometria.
- Evita una malla independiente por cada detalle cosmetico repetido.
- No recalcules toda la pared en cada frame.
- Las paredes deben actualizarse correctamente al cambiar ancho, profundidad o altura de sala.
- Prueba habitaciones pequenas y grandes.

## Archivos permitidos

Concentra cambios en:

- `src/scene/GymScene.tsx`, exclusivamente en `Room` y helpers dedicados a paredes.
- Componentes nuevos dedicados a paredes dentro de `src/scene/`.
- `src/domain/types.ts`, solo para configuracion de paredes y aberturas.
- `src/state/gymStore.ts`, solo para persistir configuracion de paredes y aberturas.
- `src/App.tsx` y `src/App.css`, solo si se necesita un control minimo de visibilidad o acabado de pared.
- Pruebas y auditoria exclusivas de paredes.

No cambies geometria de equipos aunque compartan `GymScene.tsx`.

## Validacion obligatoria

Prueba como minimo:

1. Sala rectangular pequena.
2. Sala cuadrada.
3. Sala custom grande.
4. Alturas de sala diferentes.
5. Vista superior con paredes visibles.
6. Vista superior con paredes ocultas.
7. Perspectiva desde dentro y fuera.
8. Objeto seleccionado cerca de cada pared.
9. Cuatro esquinas sin huecos ni solapamientos visibles.
10. Cambio dinamico de ancho y profundidad.
11. Abertura de prueba en cada lado, sin modelar la puerta.
12. Dos aberturas validas en una pared.
13. Rechazo de aberturas solapadas o fuera del muro.
14. Sombras sin parpadeo ni `z-fighting`.
15. Persistencia tras recargar.

Ejecuta TypeScript, ESLint, build y validacion visual con Playwright en desktop y movil. Revisa la consola del navegador.

## Entregables

- Sistema de paredes realista y modular.
- Contrato de aberturas para el agente de puertas.
- Tabla de medidas y referencias consultadas.
- Capturas Top y 3D con paredes visibles y ocultas.
- Resultados de TypeScript, ESLint y build.
- Diff final que confirme que no se modificaron equipos, puertas, lockers ni controles.

No declares terminado el trabajo solo porque las paredes son mas gruesas. Deben tener escala, esquinas, acabado, visibilidad y soporte de aberturas propios de una herramienta profesional.