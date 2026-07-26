# Prompt: especialista exclusivo en proforma y motor PDF beta

Trabaja exclusivamente en implementar el flujo de proforma, calculo comercial y PDF descargable dentro de `virtual-gym-builder/realistic-prototype/`.

No remodeles la escena 3D, sacos, racks, ring, octagono, paredes, piso, Facilities, lockers, controles ni camaras. No modifiques checkout, carrito, cuenta, catalogos comerciales protegidos ni archivos fuera de `virtual-gym-builder/`. No hagas deploy.

## Regla comercial absoluta

Por ahora Atheltonic vende exclusivamente sacos de golpeo.

La proforma puede incluir solamente productos vendibles de estas familias:

- Heavy bags.
- Muay Thai banana bags.
- Teardrop bags.
- Double-end bags.
- Speed bags.
- HB2, HB3, HB5, HB6, HB7, HB10, HB11, HB12, HB13, HB15 y HB16.
- Otros sacos que Atheltonic marque expresamente como vendibles en el catalogo aprobado.

No son vendibles y nunca deben aparecer como lineas facturables:

- Ring de boxeo.
- Octagono o cage MMA.
- Racks y estructuras metalicas.
- Speed-bag platform.
- Double-end floor/ceiling anchors.
- Tatami o circulos de lucha.
- Training bench.
- Wall pads.
- Equipment rack.
- Pad display stand.
- Lockers.
- Puertas.
- Paredes, instalaciones, clearances o servicios de construccion.

Estos objetos sirven solo para planificacion visual. No les asignes precio cero, no los presentes como obsequios y no los mezcles en el subtotal. Si se menciona el diseño, usa una nota separada: `Planning objects are not included in this proforma.`

## Objetivo

Construye un flujo funcional de extremo a extremo:

1. Leer los sacos colocados en el diseño.
2. Contar correctamente sacos libres y sacos montados en racks, sin duplicarlos.
3. Crear lineas de proforma editables.
4. Obtener precios solo de una fuente aprobada.
5. Calcular subtotal, descuentos autorizados, impuestos, envio y total.
6. Capturar datos del cliente y condiciones.
7. Mostrar una previsualizacion profesional.
8. Generar un PDF real.
9. Descargar el PDF desde el navegador.
10. Volver a abrir el archivo generado y verificar contenido, paginas y totales.

No implementes un boton falso, una captura HTML disfrazada de PDF ni un documento estatico.

## Precios e integridad

El prototipo actual no contiene precios aprobados en `EquipmentDefinition`. No inventes precios.

Crea una fuente de datos separada y explicita, por ejemplo:

```ts
type SellableBagOffer = {
  kind: EquipmentKind
  sku: string
  displayName: string
  currency: string
  unitPriceMinor: number | null
  taxable: boolean
  active: boolean
}
```

Reglas:

- Usa enteros en unidades menores para calculos monetarios.
- Una linea sin precio aprobado debe mostrar `Price required` y bloquear la emision final.
- Valores de prueba pertenecen exclusivamente a fixtures de tests y nunca al bundle de produccion.
- No extraigas precios de buscadores, competidores ni texto visual.
- No alteres datos comerciales protegidos ni ejecutes `reseal`.
- Si en el futuro se conecta una API aprobada, mantenla detras de una interfaz de proveedor de precios.
- No permitas descuentos arbitrarios sin marcar su origen/autorizacion.

## Modelo de datos recomendado

Adapta los nombres a la arquitectura existente, pero conserva estas responsabilidades:

```ts
type ProformaStatus = 'draft' | 'ready' | 'generated'

type ProformaLine = {
  id: string
  equipmentKind: EquipmentKind
  sku: string
  description: string
  quantity: number
  unitPriceMinor: number | null
  discountMinor: number
  taxRateBasisPoints: number
}

type ProformaCustomer = {
  companyName: string
  contactName: string
  email: string
  phone?: string
  billingAddress: string
  shippingAddress?: string
  taxId?: string
}

type ProformaDocument = {
  version: 1
  number: string
  issueDate: string
  validUntil: string
  currency: string
  customer: ProformaCustomer
  lines: ProformaLine[]
  shippingMinor: number
  notes: string
  status: ProformaStatus
}
```

La proforma no es una factura, orden pagada ni confirmacion de compra. Incluye una leyenda clara: `PROFORMA - NOT A TAX INVOICE`.

## Extraccion desde el diseño

Implementa una funcion pura y probada que derive cantidades:

- Cuenta cada saco independiente una vez.
- Cuenta cada saco montado una vez aunque dos anclajes double-end referencien el mismo ID.
- No cuenta el rack que contiene el saco.
- No cuenta objetos no vendibles.
- Agrupa por SKU/oferta, no solo por nombre visible.
- Conserva opcion de separar variantes si sus SKUs difieren.
- Permite cambiar cantidad en la proforma sin duplicar objetos 3D.
- Permite volver a sincronizar desde el diseño mediante una accion explicita; no sobrescribe cambios manuales silenciosamente.

Mantiene una lista central `SELLABLE_BAG_KINDS` o equivalente. Usa politica allowlist, no blacklist: cualquier `EquipmentKind` nuevo queda excluido hasta ser aprobado como saco vendible.

## Motor de calculo

Implementa funciones puras para:

- Importe bruto por linea.
- Descuento por linea.
- Neto por linea.
- Impuesto por linea.
- Subtotal.
- Descuento total.
- Impuesto total.
- Envio.
- Total final.

Reglas:

- Dinero en enteros, nunca `number` decimal acumulado.
- Redondeo documentado y consistente.
- Cantidad entera positiva con limite razonable.
- No permitir totales negativos.
- Moneda unica por documento.
- Formato de moneda mediante `Intl.NumberFormat`.
- Fechas ISO internamente y formato legible en PDF.
- Numero de proforma estable y no regenerado en cada render.
- `validUntil` debe ser igual o posterior a `issueDate`.

Prueba casos con cero impuesto, multiples tasas, descuento, envio, grandes cantidades y precios faltantes.

## Interfaz

Agrega una accion clara como `Create proforma` o `Quote bags` sin convertirla en checkout.

El flujo debe incluir:

- Resumen de sacos detectados.
- Lineas con SKU, descripcion, cantidad, precio unitario y total.
- Indicacion visible de precio faltante.
- Datos del cliente.
- Moneda.
- Fecha y validez.
- Envio e impuestos.
- Notas.
- Previsualizacion.
- Boton `Download PDF` habilitado solo cuando el documento es valido.
- Estado de generacion y error recuperable.

No muestres ring, cage ni Facilities dentro del selector de lineas. No uses cards anidadas. Mantiene una interfaz compacta de documento comercial.

## Branding Atheltonic y BETA

Usa el activo oficial existente:

- `/athletonic-logo.svg`

Crea ademas un distintivo profesional BETA como activo propio dentro de `public/`, por ejemplo:

- `/athletonic-beta-badge.svg`

Requisitos del badge:

- Debe decir exactamente `BETA`.
- Debe combinar con el branding Atheltonic sin alterar el logo oficial.
- Debe ser vectorial, limpio, legible en pantalla y PDF.
- No incrustes fuentes remotas.
- No uses logos de terceros.
- Incluye un enlace secundario `Download beta badge` para descargar el SVG, ya que el activo debe poder bajarse.
- El PDF debe mostrar el badge cerca del titulo, no encima de datos importantes.
- Incluye pie: `Generated with Atheltonic Gym Configurator - Beta`.

No modifiques el SVG oficial. Combina logo y badge como elementos separados.

## PDF real

Usa una biblioteca mantenida y apropiada, preferiblemente `pdf-lib`, `jsPDF` o `@react-pdf/renderer`, despues de revisar compatibilidad con Vite/React y licencias.

El PDF debe contener:

- Logo Atheltonic.
- Badge BETA.
- Titulo `PROFORMA`.
- Leyenda `NOT A TAX INVOICE`.
- Numero, fecha de emision y fecha de validez.
- Datos de Atheltonic configurables, sin inventar direccion legal o tax ID.
- Datos del cliente.
- Tabla de sacos vendibles.
- SKU, descripcion, cantidad, precio unitario y total por linea.
- Subtotal, descuento, impuestos, envio y total.
- Moneda.
- Notas y condiciones.
- Nota de que estructuras y objetos de planificacion no estan incluidos.
- Numeracion `Page X of Y` si ocupa varias paginas.

Reglas de layout:

- Evita cortes de filas entre paginas.
- Repite encabezado de tabla en paginas nuevas.
- No superpongas textos.
- Nombres largos deben envolver sin salir de la celda.
- Alinea cifras monetarias a la derecha.
- El PDF debe funcionar con 1, 10, 30 y 100 lineas.
- Genera un nombre estable como `Atheltonic-Proforma-{number}.pdf`.

No rasterices toda la pagina. Texto y tablas deben permanecer nitidos y seleccionables cuando la biblioteca lo permita.

## Persistencia y privacidad

- Guarda borradores localmente con versionado.
- No mezcles la proforma dentro de `GymDesign` si puede evolucionar de forma independiente.
- Permite limpiar datos del cliente.
- No envies datos personales a servidores externos.
- No incluyas datos del cliente en logs.
- No persistas un PDF Blob completo; regeneralos desde datos estructurados.

## Archivos permitidos

Concentra cambios en:

- Modulos nuevos `src/proforma/`.
- Componentes nuevos de UI para proforma.
- Tipos y store independientes para borradores.
- `src/App.tsx` y `src/App.css` solo para integrar el flujo.
- `public/athletonic-beta-badge.svg`.
- Tests dedicados.
- `package.json` y lockfile para la biblioteca PDF elegida.

No cambies modelos 3D ni catalogo de dimensiones. Si necesitas mapear productos, crea una capa comercial separada.

## Validacion obligatoria

Prueba como minimo:

1. Diseño sin sacos: proforma vacia y descarga bloqueada.
2. Un heavy bag libre.
3. Varios sacos iguales agrupados.
4. Sacos distintos en un rack multiestacion.
5. Double-end referenciado por dos anclajes, contado una sola vez.
6. Ring y cage presentes, pero ausentes de la proforma.
7. Bench, wall pads, equipment rack y lockers ausentes.
8. Precio faltante bloquea PDF final.
9. Cantidades, descuento, impuesto y envio calculados exactamente.
10. Documento de multiples paginas.
11. Texto largo sin solapamiento.
12. Descarga del PDF con nombre correcto.
13. Descarga independiente del badge SVG.
14. Recarga y restauracion de borrador.
15. Limpieza de datos del cliente.

Ejecuta:

- TypeScript.
- ESLint.
- Tests unitarios del filtro vendible y calculos.
- Build de produccion.
- Playwright para crear y descargar el PDF.
- Parser PDF o inspeccion programatica para comprobar texto, paginas y totales.
- Consola del navegador sin errores.

## Entregables

- Motor funcional de proforma.
- Allowlist explicita de sacos vendibles.
- Fuente de precios aprobados con estados faltantes.
- UI de borrador y previsualizacion.
- PDF descargable profesional.
- Badge `BETA` descargable.
- Tests de calculo, filtrado y PDF.
- Capturas de pantalla y un PDF de QA generado con fixtures de prueba claramente aislados.
- Confirmacion de que ring, cage, racks y Facilities nunca se facturan.

No declares terminado el trabajo porque aparezca un boton de descarga. El PDF debe abrir, contener totales verificados, excluir todo lo no vendible y funcionar de extremo a extremo.