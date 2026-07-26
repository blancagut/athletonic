# Prompt: especialista exclusivo en sacos de golpeo 3D

Trabaja exclusivamente en los modelos 3D de sacos de golpeo dentro de `virtual-gym-builder/realistic-prototype/`. No modifiques checkout, catalogos comerciales, navegacion, paginas externas, otros equipos ni archivos fuera de esta carpeta. No hagas deploy.

## Mision

Sustituye las aproximaciones procedurales poco realistas por sacos profesionales reconocibles, correctamente orientados y construidos a escala metrica real. Cada modelo debe verse creible junto a una persona de `1.80 m`; no puede parecer una capsula, salchicha, cilindro generico, objeto flotante ni pieza pegada a un rack.

## Modelos bajo tu responsabilidad

- Heavy bag clasico
- Muay Thai banana bag y variante extra grande `200 x 55 cm`
- Teardrop bag
- Double-end bags: `25 x 18`, `30 x 20`, `35 x 22 cm`
- Speed bags: `18 x 13`, `20 x 15`, `23 x 18`, `25 x 20`, `28 x 22 cm`
- HB2 Classic Heavy Bag: `diametro 33 cm x 90 cm`
- HB3 Extra Large Heavy Bag: `diametro 40 cm x 100 cm`
- HB5 4FT Heavy Bag: `diametro 34 cm x 121 cm`
- HB6 6FT Muay Thai Banana Bag: `diametro 36 cm x 180 cm`
- HB7 7FT Pole Bag: `diametro 59 cm x 270 cm total`
- HB10 Bowling Bag: `50 cm maximo x 122 cm`
- HB11 Uppercut Bag: `50 cm maximo x 58 cm`
- HB12 Angle Heavy Bag: `50 cm maximo x 147 cm`
- HB13 Super Angle Heavy Bag: `50 cm maximo x 137 cm`
- HB15 Super Tear Drop: `38 cm maximo x 93 cm`
- HB16 Water Heavy Bag: `46 cm maximo x 58 cm`
- UC1 Uppercut & Hook Wall Unit: `58 cm ancho x 70 cm alto`
- Maddox III dummy: `165 cm alto`; la base de `75 cm` es solo una estimacion de planificacion.

Todos deben ser cuero negro sin logos ni marcas. Puedes estudiar productos reales para comprender su forma, pero no copies logotipos, texturas de marca ni arte protegido.

## Proceso obligatorio para cada saco

1. Busca al menos tres fotografias del producto real: frontal, lateral y tres cuartos. Prioriza fabricante, distribuidores autorizados y fotografias de clientes.
2. Registra la URL, dimensiones publicadas y rasgos observables antes de modelar.
3. Determina explicitamente cual extremo es superior. Verifica correas, cremallera, argollas, costuras y punto de anclaje para evitar invertir el modelo.
4. Modela en metros. La geometria nunca puede compensar errores de escala mediante `scale` no uniforme.
5. Coloca temporalmente una figura humana neutra de exactamente `1.80 m` al lado del saco y captura vistas frontal, lateral y perspectiva.
6. Compara altura del cuerpo, diametro, altura de montaje y espacio libre al piso contra la referencia humana.
7. Comprueba que el saco tenga soporte fisicamente legible: cuerpo, correas, argolla, swivel/cadena y viga o anclaje. Debe existir aire visible entre cuerpo y estructura.
8. Ejecuta TypeScript, ESLint y pruebas visuales de Top/3D antes de considerar terminado el modelo.

## Reglas de geometria

- No uses `capsuleGeometry` para heavy bags; redondea ambos extremos y produce aspecto de salchicha.
- Usa perfiles `LatheGeometry` medidos para formas de revolucion o modelos GLB/PBR con licencia comercial verificable.
- Los heavy bags cilindricos deben tener fondo casi plano, pequeno radio perimetral, paredes rectas con deformacion sutil, hombro superior y tapa/costura visible.
- Los banana bags son largos y estrechos, no cilindros gruesos escalados.
- HB12 y HB13 tienen el hombro/anillo de mayor diametro en la parte superior y el tramo estrecho hacia abajo. La argolla y las correas definen inequívocamente la parte superior.
- Bowling, uppercut, angle, super-angle, teardrop y water bag necesitan perfiles propios; no reutilices un cilindro cambiando escala.
- Double-end bags deben estar tensados arriba y abajo mediante elastico y anclajes reales.
- Speed bags deben colgar de un swivel bajo un tambor circular ajustable; no pueden flotar.
- Añade costuras, paneles y correas como geometria discreta. Evita ruido decorativo que no exista en el producto.
- El cuero negro debe conservar volumen mediante roughness, clearcoat moderado, iluminacion lateral y variacion sutil; nunca mediante logos.

## Montaje y proporciones

- La altura de un saco incluye solo el cuerpo cuando la ficha lo indique. Correas y cadenas se modelan aparte.
- Deja una separacion visible entre la parte superior del cuerpo y el gancho. Como referencia visual, una cadena comercial suele ocupar aproximadamente `25-45 cm`, pero verifica cada producto.
- No dejes el cuerpo tocando la viga, poste o rack.
- Los sacos de racks multiestacion deben mantener separacion suficiente para balanceo y acceso del atleta.
- Muestra siempre la figura de `1.80 m` cuando el objeto esta seleccionado para que el cliente entienda escala y altura de golpeo.

## Calidad visual minima

Rechaza el modelo si ocurre cualquiera de estos casos:

- Parece una salchicha, capsula, juguete o bloque.
- Esta invertido.
- No coincide con las dimensiones del catalogo.
- Flota o toca directamente el rack.
- No se distingue de otro SKU por su silueta.
- La superficie negra pierde toda la forma.
- Una persona de `1.80 m` se ve desproporcionada junto al saco.
- Solo se ve bien desde un angulo.

## Entregables

- Cambios de geometria limitados principalmente a `src/scene/ProductBagModels.tsx` y componentes de saco en `src/scene/GymScene.tsx`.
- Tabla de auditoria por SKU: dimensiones, URLs consultadas, orientacion, altura de montaje y diferencias respecto a la referencia.
- Capturas frontal, lateral y perspectiva con humano de `1.80 m`.
- Resultado de `npm run lint`, TypeScript y build.
- Lista explicita de modelos que siguen siendo provisionales y por que.

No declares un saco terminado solo porque compila. Debe superar comparacion visual contra las fotografias reales y contra la figura humana de `1.80 m`.