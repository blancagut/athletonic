# SEO/SEM Classifier

Sistema rule-based para clasificar productos del marketplace en clusters SEO, keywords, intencion de busqueda, prioridad comercial, riesgo de claims y anuncios SEM para LATAM.

Prioridad geografica:

- MX
- CO
- CL

## Reglas de contenido

- No genera claims medicos.
- No usa textos como cura, elimina, trata o previene enfermedades.
- Mantiene el foco en producto, marca, gramos, sabor, formato, precio, disponibilidad y envio.
- Si el texto fuente trae lenguaje sensible, sube `riesgo_claim_medico` y recomienda una pagina mas controlada.

## Uso con un producto JSON

```bash
/Users/User/Desktop/Sups/.venv/bin/python tools/classify_seo_sem.py --input product.json --country MX
```

Input esperado:

```json
{
  "nombre": "Creatine Monohydrate 300g",
  "marca": "Example Brand",
  "descripcion": "Creatina monohidratada sin sabor.",
  "ingredientes": "creatina monohidratada",
  "categoria_original": "Sports Nutrition",
  "precio": 29.99,
  "pais_objetivo": "MX"
}
```

Tambien acepta aliases comunes como `name`, `brand`, `description`, `ingredients`, `category`, `price` y `country`.

## Uso con SQLite

Clasifica el catalogo activo desde `output/data/products.db`, escribe el lote en `output/data/seo_sem_classification.json` y ademas genera un JSON por producto en `output/data/seo_sem_products/<pais>/<marca>/`:

```bash
/Users/User/Desktop/Sups/.venv/bin/python tools/classify_seo_sem.py --db --country LATAM
```

Filtrar muestras:

```bash
/Users/User/Desktop/Sups/.venv/bin/python tools/classify_seo_sem.py --db --brand transparent_labs --limit 25 --country CO --output output/data/seo_sem_transparent_labs.json
```

Cambiar el directorio de archivos individuales:

```bash
/Users/User/Desktop/Sups/.venv/bin/python tools/classify_seo_sem.py --db --country MX --split-dir output/data/seo_sem_por_producto
```

## Output

La salida del clasificador es JSON valido. Para cada producto genera:

- `categoria_normalizada`
- `ingrediente_principal`
- `subcategoria`
- `intencion_busqueda`
- `keywords_principales`
- `keywords_longtail`
- `nivel_competencia`
- `prioridad_seo`
- `prioridad_sem`
- `riesgo_claim_medico`
- `tipo_pagina_recomendada`
- `cluster_seo`
- `variaciones_latam`
- `titulo_seo`
- `meta_description`
- `ideas_google_ads`
- `pais_objetivo`
- `lenguaje_local`
- `score_comercial`
- `score_seo`
