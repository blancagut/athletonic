from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from html import unescape
from typing import Any, Iterable, Literal


SearchIntent = Literal["informacional", "comparativa", "transaccional", "navegacional"]
CompetitionLevel = Literal["baja", "media", "alta"]
MedicalRisk = Literal["bajo", "medio", "alto"]
PageType = Literal["categoria", "comparativa", "blog", "landing_sem", "producto", "guia"]


FORBIDDEN_CLAIM_RE = re.compile(
    r"\b(cura|curar|curas|curativo|elimina|eliminar|trata|tratar|tratamiento|previene|prevenir|"
    r"enfermedad|enfermedades|diabetes|hipertension|cancer|artritis|ansiedad|depresion|insomnio|"
    r"colesterol|presion arterial|dolor cronico|antiinflamatorio|inflamacion)\b",
    re.I,
)
MEDIUM_RISK_RE = re.compile(
    r"\b(sueno|sleep|descanso|estres|stress|hormona|hormonal|digestivo|digestion|gut|immune|"
    r"inmune|joint|articulacion|articulaciones|detox|liver|higado|menopause|menopausia)\b",
    re.I,
)
COMPARISON_RE = re.compile(r"\b(vs|versus|mejor|comparar|comparativa|ranking|top)\b", re.I)
NAVIGATIONAL_RE = re.compile(r"\b(oficial|official|sitio oficial|tienda oficial)\b", re.I)
HTML_TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")
SIZE_RE = re.compile(
    r"\b\d+(?:[\.,]\d+)?\s?(?:kg|g|gr|mg|mcg|ml|l|oz|lb|lbs|capsulas|caps|tabletas|tabs|"
    r"gomitas|gummies|sticks|sobres|servings|porciones|scoops|packs?)\b",
    re.I,
)


@dataclass(frozen=True)
class ProductInput:
    nombre: str
    marca: str = ""
    descripcion: str = ""
    ingredientes: str = ""
    categoria_original: str = ""
    precio: float | int | str | None = None
    pais_objetivo: str = "LATAM"


@dataclass(frozen=True)
class CategoryRule:
    categoria: str
    ingrediente: str
    subcategoria: str
    cluster: str
    pattern: re.Pattern[str]
    nivel_competencia: CompetitionLevel
    prioridad_seo: int
    prioridad_sem: int
    riesgo_claim_medico: MedicalRisk
    tipo_pagina: PageType
    score_comercial: int
    score_seo: int
    primary_keywords: tuple[str, ...]
    longtail_keywords: tuple[str, ...]
    ad_headlines: tuple[str, ...]
    ad_descriptions: tuple[str, ...]


def _rx(value: str) -> re.Pattern[str]:
    return re.compile(value, re.I)


CATEGORY_RULES: tuple[CategoryRule, ...] = (
    CategoryRule(
        categoria="creatina",
        ingrediente="creatina",
        subcategoria="creatina monohidratada",
        cluster="creatina-muscular",
        pattern=_rx(r"creatine|creatina|creapure|kre[ -]?alkalyn"),
        nivel_competencia="alta",
        prioridad_seo=88,
        prioridad_sem=82,
        riesgo_claim_medico="bajo",
        tipo_pagina="landing_sem",
        score_comercial=91,
        score_seo=64,
        primary_keywords=(
            "creatina monohidratada",
            "comprar creatina",
            "creatina precio",
            "creatina en polvo",
            "creatina capsulas",
            "creatina para gym",
        ),
        longtail_keywords=(
            "creatina monohidratada precio",
            "comprar creatina monohidratada online",
            "creatina monohidratada 300g",
            "creatina para entrenar",
            "creatina sin sabor precio",
        ),
        ad_headlines=(
            "Comprar creatina",
            "Creatina monohidratada",
            "Creatina para gym",
            "Precio y formatos",
            "Creatina online",
        ),
        ad_descriptions=(
            "Compara gramos, formato, precio y disponibilidad antes de comprar.",
            "Creatina monohidratada con informacion clara de marca y formato.",
            "Compra online con foco en precio, presentacion y envio.",
        ),
    ),
    CategoryRule(
        categoria="proteina whey",
        ingrediente="whey protein",
        subcategoria="whey isolate",
        cluster="proteina-muscular",
        pattern=_rx(r"whey isolate|iso[- ]?100|isolate protein|hydro whey|hydrowhey"),
        nivel_competencia="alta",
        prioridad_seo=87,
        prioridad_sem=80,
        riesgo_claim_medico="bajo",
        tipo_pagina="landing_sem",
        score_comercial=90,
        score_seo=60,
        primary_keywords=(
            "whey isolate",
            "proteina whey isolate",
            "comprar whey isolate",
            "whey isolate precio",
            "proteina isolate",
            "proteina whey",
        ),
        longtail_keywords=(
            "proteina whey isolate precio",
            "comprar whey isolate online",
            "whey isolate sabor chocolate",
            "proteina isolate para gym",
            "whey isolate sin azucar",
        ),
        ad_headlines=(
            "Whey isolate",
            "Comprar whey",
            "Proteina isolate",
            "Precio y sabores",
            "Whey online",
        ),
        ad_descriptions=(
            "Revisa sabores, tamano, precio y disponibilidad antes de comprar.",
            "Proteina whey isolate con datos claros de marca y formato.",
            "Compra online comparando precio, presentacion y envio.",
        ),
    ),
    CategoryRule(
        categoria="proteina whey",
        ingrediente="whey protein",
        subcategoria="whey blend",
        cluster="proteina-muscular",
        pattern=_rx(r"\bwhey\b|protein powder|proteina whey|gold standard|nitro[ -]?tech|syntha[ -]?6"),
        nivel_competencia="alta",
        prioridad_seo=85,
        prioridad_sem=77,
        riesgo_claim_medico="bajo",
        tipo_pagina="landing_sem",
        score_comercial=88,
        score_seo=58,
        primary_keywords=(
            "proteina whey",
            "comprar proteina whey",
            "proteina whey precio",
            "whey protein",
            "proteina para gym",
            "proteina en polvo",
        ),
        longtail_keywords=(
            "comprar proteina whey online",
            "proteina whey sabor chocolate",
            "proteina whey precio online",
            "whey protein para entrenar",
            "proteina en polvo para gym",
        ),
        ad_headlines=(
            "Proteina whey",
            "Comprar proteina",
            "Whey protein",
            "Precio y sabores",
            "Proteina online",
        ),
        ad_descriptions=(
            "Compara sabores, tamanos, precio y disponibilidad en un solo lugar.",
            "Whey protein con informacion clara para elegir antes de comprar.",
            "Compra online revisando marca, formato y envio.",
        ),
    ),
    CategoryRule(
        categoria="proteina vegetal",
        ingrediente="proteina vegetal",
        subcategoria="plant based protein",
        cluster="proteina-vegetal",
        pattern=_rx(r"plant based protein|plant protein|vegan protein|proteina vegana|pea protein|soy protein|rice protein|proteina vegetal"),
        nivel_competencia="media",
        prioridad_seo=78,
        prioridad_sem=72,
        riesgo_claim_medico="bajo",
        tipo_pagina="categoria",
        score_comercial=78,
        score_seo=71,
        primary_keywords=(
            "proteina vegetal",
            "proteina vegana",
            "comprar proteina vegetal",
            "proteina vegetal precio",
            "plant based protein",
        ),
        longtail_keywords=(
            "comprar proteina vegetal online",
            "proteina vegana en polvo precio",
            "proteina vegetal sabor chocolate",
            "proteina de arveja precio",
            "plant based protein online",
        ),
        ad_headlines=(
            "Proteina vegetal",
            "Comprar vegana",
            "Precio y sabores",
            "Plant protein",
            "Proteina online",
        ),
        ad_descriptions=(
            "Revisa sabores, ingredientes, precio y formatos antes de comprar.",
            "Proteina vegetal con datos claros para comparar opciones.",
            "Compra online por marca, tamano y disponibilidad.",
        ),
    ),
    CategoryRule(
        categoria="control de peso",
        ingrediente="formula termogenica",
        subcategoria="termogenico",
        cluster="control-peso-suplementos",
        pattern=_rx(r"fat burner|thermogenic|termogenico|lipo|carnitine|cla\b|body recomp"),
        nivel_competencia="media",
        prioridad_seo=66,
        prioridad_sem=64,
        riesgo_claim_medico="medio",
        tipo_pagina="guia",
        score_comercial=72,
        score_seo=60,
        primary_keywords=(
            "termogenico",
            "control de peso suplemento",
            "fat burner",
            "comprar termogenico",
            "termogenico precio",
        ),
        longtail_keywords=(
            "comprar termogenico online",
            "fat burner precio",
            "suplemento control de peso precio",
            "termogenico capsulas",
            "formula termogenica precio",
        ),
        ad_headlines=(
            "Termogenico",
            "Control de peso",
            "Precio y formato",
            "Comprar online",
            "Capsulas o polvo",
        ),
        ad_descriptions=(
            "Compara ingredientes, formato, porciones y precio antes de comprar.",
            "Suplementos de control de peso con informacion clara de marca.",
            "Compra online revisando presentacion, precio y envio.",
        ),
    ),
    CategoryRule(
        categoria="pre entreno",
        ingrediente="pre workout blend",
        subcategoria="pre entreno con cafeina",
        cluster="pre-entreno-energia",
        pattern=_rx(r"pre[ -]?workout|preworkout|pre entreno|preentreno|pump|nitric|stim|c4\b|gorilla mode|legend"),
        nivel_competencia="alta",
        prioridad_seo=80,
        prioridad_sem=78,
        riesgo_claim_medico="bajo",
        tipo_pagina="landing_sem",
        score_comercial=88,
        score_seo=60,
        primary_keywords=(
            "pre entreno",
            "pre workout",
            "comprar pre entreno",
            "pre entreno precio",
            "pre entreno con cafeina",
            "pre entreno sin estimulantes",
        ),
        longtail_keywords=(
            "comprar pre entreno online",
            "pre workout precio",
            "pre entreno para gym",
            "pre entreno sabor frutas",
            "pre entreno con cafeina precio",
        ),
        ad_headlines=(
            "Pre entreno",
            "Comprar pre workout",
            "Precio y sabores",
            "Para entrenar",
            "Pre workout online",
        ),
        ad_descriptions=(
            "Compara cafeina, sabor, porciones, precio y disponibilidad.",
            "Pre entrenos con informacion clara de formato y marca.",
            "Compra online revisando presentacion, precio y envio.",
        ),
    ),
    CategoryRule(
        categoria="electrolitos",
        ingrediente="electrolitos",
        subcategoria="hidratacion con electrolitos",
        cluster="hidratacion-deportiva",
        pattern=_rx(r"electrolyte|electrolito|hydration|hidratacion|hydrate|liquid[ -]?iv|nuun|dripdrop|skratch"),
        nivel_competencia="media",
        prioridad_seo=82,
        prioridad_sem=84,
        riesgo_claim_medico="bajo",
        tipo_pagina="landing_sem",
        score_comercial=86,
        score_seo=73,
        primary_keywords=(
            "electrolitos",
            "hidratacion con electrolitos",
            "comprar electrolitos",
            "electrolitos precio",
            "sobres de electrolitos",
            "bebida con electrolitos",
        ),
        longtail_keywords=(
            "comprar electrolitos online",
            "sobres de electrolitos precio",
            "electrolitos para entrenar",
            "hidratacion con electrolitos sin azucar",
            "electrolitos en polvo precio",
        ),
        ad_headlines=(
            "Electrolitos",
            "Comprar hidratacion",
            "Sobres y polvo",
            "Precio y sabores",
            "Electrolitos online",
        ),
        ad_descriptions=(
            "Compara sabores, porciones, precio y disponibilidad online.",
            "Electrolitos en polvo, sticks o bebidas con datos claros.",
            "Compra online revisando formato, marca y envio.",
        ),
    ),
    CategoryRule(
        categoria="aminoacidos",
        ingrediente="aminoacidos esenciales",
        subcategoria="bcaa eaa",
        cluster="aminoacidos-entreno",
        pattern=_rx(r"\bbcaa\b|\bbcaa[s]?\b|\beaa\b|\beaa[s]?\b|amino acid|aminoacidos|essential amino"),
        nivel_competencia="media",
        prioridad_seo=70,
        prioridad_sem=64,
        riesgo_claim_medico="bajo",
        tipo_pagina="categoria",
        score_comercial=72,
        score_seo=66,
        primary_keywords=(
            "aminoacidos",
            "bcaa",
            "eaa",
            "comprar bcaa",
            "aminoacidos precio",
            "eaa precio",
        ),
        longtail_keywords=(
            "comprar aminoacidos online",
            "bcaa en polvo precio",
            "eaa para entrenar",
            "aminoacidos sabor frutas",
            "bcaa eaa precio",
        ),
        ad_headlines=(
            "Aminoacidos",
            "Comprar BCAA",
            "EAA online",
            "Precio y sabores",
            "Para entrenar",
        ),
        ad_descriptions=(
            "Compara formato, sabor, porciones y precio antes de comprar.",
            "BCAA y EAA con datos claros de marca y presentacion.",
            "Compra online revisando disponibilidad y envio.",
        ),
    ),
    CategoryRule(
        categoria="magnesio",
        ingrediente="magnesio",
        subcategoria="magnesio glicinato",
        cluster="descanso-magnesio",
        pattern=_rx(r"magnesium glycinate|magnesio glicinato|magnesium bisglycinate|bisglicinato"),
        nivel_competencia="media",
        prioridad_seo=84,
        prioridad_sem=80,
        riesgo_claim_medico="medio",
        tipo_pagina="guia",
        score_comercial=84,
        score_seo=75,
        primary_keywords=(
            "magnesio glicinato",
            "comprar magnesio glicinato",
            "magnesio para descanso",
            "magnesio precio",
            "magnesio capsulas",
        ),
        longtail_keywords=(
            "magnesio glicinato precio",
            "comprar magnesio glicinato online",
            "magnesio glicinato capsulas",
            "magnesio para descanso precio",
            "magnesio glicinato como tomar",
        ),
        ad_headlines=(
            "Magnesio glicinato",
            "Comprar magnesio",
            "Magnesio capsulas",
            "Precio y formato",
            "Magnesio online",
        ),
        ad_descriptions=(
            "Revisa tipo de magnesio, porciones, precio y disponibilidad.",
            "Magnesio glicinato con informacion clara de formato y marca.",
            "Compra online comparando presentacion, precio y envio.",
        ),
    ),
    CategoryRule(
        categoria="magnesio",
        ingrediente="magnesio",
        subcategoria="magnesio",
        cluster="descanso-magnesio",
        pattern=_rx(r"\bmagnesium\b|\bmagnesio\b|\bmag\s?(am|pm|complex|caps)\b"),
        nivel_competencia="media",
        prioridad_seo=78,
        prioridad_sem=72,
        riesgo_claim_medico="medio",
        tipo_pagina="guia",
        score_comercial=78,
        score_seo=72,
        primary_keywords=(
            "magnesio",
            "comprar magnesio",
            "magnesio precio",
            "magnesio capsulas",
            "magnesio para descanso",
        ),
        longtail_keywords=(
            "comprar magnesio online",
            "magnesio capsulas precio",
            "magnesio para descanso precio",
            "magnesio en polvo precio",
            "magnesio como tomar",
        ),
        ad_headlines=(
            "Magnesio",
            "Comprar magnesio",
            "Precio y formato",
            "Magnesio online",
            "Capsulas o polvo",
        ),
        ad_descriptions=(
            "Compara tipo, formato, porciones, precio y disponibilidad.",
            "Magnesio con informacion clara para elegir presentacion.",
            "Compra online revisando marca, tamano y envio.",
        ),
    ),
    CategoryRule(
        categoria="omega 3",
        ingrediente="omega 3",
        subcategoria="fish oil",
        cluster="omega-3-salud-diaria",
        pattern=_rx(r"omega[ -]?3|fish oil|aceite de pescado|krill oil|\bepa\b|\bdha\b|cod liver"),
        nivel_competencia="media",
        prioridad_seo=76,
        prioridad_sem=68,
        riesgo_claim_medico="medio",
        tipo_pagina="guia",
        score_comercial=74,
        score_seo=70,
        primary_keywords=(
            "omega 3",
            "comprar omega 3",
            "omega 3 precio",
            "fish oil",
            "omega 3 capsulas",
        ),
        longtail_keywords=(
            "comprar omega 3 online",
            "omega 3 capsulas precio",
            "fish oil precio",
            "omega 3 epa dha",
            "aceite de pescado omega 3",
        ),
        ad_headlines=(
            "Omega 3",
            "Comprar omega 3",
            "Fish oil",
            "Precio y capsulas",
            "Omega 3 online",
        ),
        ad_descriptions=(
            "Revisa EPA, DHA, capsulas, precio y disponibilidad online.",
            "Omega 3 con informacion clara de formato y marca.",
            "Compra online comparando presentacion, precio y envio.",
        ),
    ),
    CategoryRule(
        categoria="probioticos",
        ingrediente="probioticos",
        subcategoria="probioticos y prebioticos",
        cluster="salud-digestiva",
        pattern=_rx(r"probiotic|probiotico|prebiotic|prebiotico|synbiotic|sinbiotico|gut health|digestive|digestion|fiber|psyllium"),
        nivel_competencia="media",
        prioridad_seo=79,
        prioridad_sem=72,
        riesgo_claim_medico="medio",
        tipo_pagina="guia",
        score_comercial=76,
        score_seo=69,
        primary_keywords=(
            "probioticos",
            "comprar probioticos",
            "probioticos precio",
            "probioticos capsulas",
            "prebioticos",
        ),
        longtail_keywords=(
            "comprar probioticos online",
            "probioticos capsulas precio",
            "probioticos y prebioticos",
            "probioticos para rutina digestiva",
            "probioticos como tomar",
        ),
        ad_headlines=(
            "Probioticos",
            "Comprar probioticos",
            "Precio y formato",
            "Capsulas o polvo",
            "Probioticos online",
        ),
        ad_descriptions=(
            "Compara cepas, formato, porciones, precio y disponibilidad.",
            "Probioticos con informacion clara para elegir producto.",
            "Compra online revisando marca, presentacion y envio.",
        ),
    ),
    CategoryRule(
        categoria="packs de suplementos",
        ingrediente="varios",
        subcategoria="stack de suplementos",
        cluster="packs-suplementos",
        pattern=_rx(r"\bstack\b|bundle|combo|kit\b|pack\b|starter pack"),
        nivel_competencia="baja",
        prioridad_seo=62,
        prioridad_sem=66,
        riesgo_claim_medico="bajo",
        tipo_pagina="producto",
        score_comercial=78,
        score_seo=70,
        primary_keywords=(
            "stack de suplementos",
            "pack de suplementos",
            "comprar stack suplementos",
            "combo suplementos",
            "kit suplementos",
        ),
        longtail_keywords=(
            "comprar stack de suplementos online",
            "pack de suplementos precio",
            "combo suplementos para gym",
            "kit suplementos precio",
            "stack suplementos por marca",
        ),
        ad_headlines=(
            "Stack suplementos",
            "Packs online",
            "Precio y formato",
            "Combos por marca",
            "Compra online",
        ),
        ad_descriptions=(
            "Compara productos incluidos, precio, formato y disponibilidad.",
            "Packs de suplementos con informacion clara de marca y contenido.",
            "Compra online revisando presentacion, precio y envio.",
        ),
    ),
    CategoryRule(
        categoria="vitaminas",
        ingrediente="vitaminas y minerales",
        subcategoria="multivitaminico",
        cluster="vitaminas-diarias",
        pattern=_rx(r"multivitamin|multivitaminico|multi vitamin|daily essential|men'?s multi|women'?s multi"),
        nivel_competencia="alta",
        prioridad_seo=72,
        prioridad_sem=64,
        riesgo_claim_medico="medio",
        tipo_pagina="categoria",
        score_comercial=72,
        score_seo=58,
        primary_keywords=(
            "multivitaminico",
            "comprar multivitaminico",
            "multivitaminico precio",
            "vitaminas diarias",
            "vitaminas hombre",
            "vitaminas mujer",
        ),
        longtail_keywords=(
            "comprar multivitaminico online",
            "multivitaminico hombre precio",
            "multivitaminico mujer precio",
            "vitaminas diarias capsulas",
            "multivitaminico como tomar",
        ),
        ad_headlines=(
            "Multivitaminico",
            "Comprar vitaminas",
            "Precio y formato",
            "Vitaminas online",
            "Capsulas diarias",
        ),
        ad_descriptions=(
            "Compara ingredientes, porciones, precio y disponibilidad online.",
            "Vitaminas con informacion clara de marca y presentacion.",
            "Compra online revisando formato, precio y envio.",
        ),
    ),
    CategoryRule(
        categoria="vitaminas",
        ingrediente="vitaminas y minerales",
        subcategoria="vitamina individual",
        cluster="vitaminas-diarias",
        pattern=_rx(r"vitamin|vitamina|zinc|iron|hierro|calcium|calcio|b12|d3|vitamin c|coq10|nac\b|quercetin"),
        nivel_competencia="media",
        prioridad_seo=68,
        prioridad_sem=60,
        riesgo_claim_medico="medio",
        tipo_pagina="categoria",
        score_comercial=68,
        score_seo=66,
        primary_keywords=(
            "vitaminas",
            "comprar vitaminas",
            "vitaminas precio",
            "vitaminas y minerales",
            "suplemento vitamina",
        ),
        longtail_keywords=(
            "comprar vitaminas online",
            "vitaminas capsulas precio",
            "vitaminas y minerales precio",
            "suplemento vitamina online",
            "vitaminas como tomar",
        ),
        ad_headlines=(
            "Vitaminas",
            "Comprar vitaminas",
            "Precio y formato",
            "Capsulas o gotas",
            "Vitaminas online",
        ),
        ad_descriptions=(
            "Revisa ingrediente, formato, porciones, precio y disponibilidad.",
            "Vitaminas con informacion clara para comparar opciones.",
            "Compra online revisando marca, presentacion y envio.",
        ),
    ),
    CategoryRule(
        categoria="colageno",
        ingrediente="colageno",
        subcategoria="colageno hidrolizado",
        cluster="colageno-belleza",
        pattern=_rx(r"collagen|colageno|hydrolyzed peptide|peptidos de colageno|beauty collagen"),
        nivel_competencia="media",
        prioridad_seo=84,
        prioridad_sem=76,
        riesgo_claim_medico="medio",
        tipo_pagina="categoria",
        score_comercial=82,
        score_seo=72,
        primary_keywords=(
            "colageno",
            "colageno hidrolizado",
            "comprar colageno",
            "colageno precio",
            "colageno en polvo",
            "colageno capsulas",
        ),
        longtail_keywords=(
            "comprar colageno hidrolizado online",
            "colageno en polvo precio",
            "colageno hidrolizado precio",
            "colageno sin sabor",
            "colageno como tomar",
        ),
        ad_headlines=(
            "Colageno",
            "Comprar colageno",
            "Colageno en polvo",
            "Precio y formato",
            "Colageno online",
        ),
        ad_descriptions=(
            "Compara polvo, capsulas, sabor, porciones y precio online.",
            "Colageno con informacion clara de marca y presentacion.",
            "Compra online revisando formato, precio y envio.",
        ),
    ),
    CategoryRule(
        categoria="greens",
        ingrediente="greens blend",
        subcategoria="greens y superfoods",
        cluster="greens-superfoods",
        pattern=_rx(r"greens?|superfood|spirulina|chlorella|wheatgrass|barley grass|reds powder|moringa"),
        nivel_competencia="media",
        prioridad_seo=74,
        prioridad_sem=66,
        riesgo_claim_medico="medio",
        tipo_pagina="categoria",
        score_comercial=72,
        score_seo=69,
        primary_keywords=(
            "greens",
            "superfoods",
            "comprar greens",
            "greens en polvo",
            "greens precio",
            "super greens",
        ),
        longtail_keywords=(
            "comprar greens online",
            "greens en polvo precio",
            "super greens precio",
            "greens sabor frutas",
            "greens y superfoods",
        ),
        ad_headlines=(
            "Greens en polvo",
            "Comprar greens",
            "Superfoods",
            "Precio y sabor",
            "Greens online",
        ),
        ad_descriptions=(
            "Compara sabores, ingredientes, porciones y precio online.",
            "Greens y superfoods con informacion clara de formato.",
            "Compra online revisando marca, tamano y envio.",
        ),
    ),
    CategoryRule(
        categoria="ashwagandha",
        ingrediente="ashwagandha",
        subcategoria="adaptogeno",
        cluster="adaptogenos-rutina-diaria",
        pattern=_rx(r"ashwagandha|rhodiola|ginseng|maca|holy basil|adaptogen|adaptogeno|tongkat|reishi|cordyceps|chaga|mushroom"),
        nivel_competencia="media",
        prioridad_seo=70,
        prioridad_sem=62,
        riesgo_claim_medico="medio",
        tipo_pagina="guia",
        score_comercial=68,
        score_seo=66,
        primary_keywords=(
            "ashwagandha",
            "adaptogenos",
            "comprar ashwagandha",
            "ashwagandha precio",
            "hongos funcionales",
        ),
        longtail_keywords=(
            "comprar ashwagandha online",
            "ashwagandha capsulas precio",
            "adaptogenos precio",
            "hongos funcionales precio",
            "ashwagandha como tomar",
        ),
        ad_headlines=(
            "Ashwagandha",
            "Comprar adaptogenos",
            "Precio y formato",
            "Capsulas o polvo",
            "Compra online",
        ),
        ad_descriptions=(
            "Revisa ingrediente, formato, porciones, precio y disponibilidad.",
            "Adaptogenos con informacion clara para comparar opciones.",
            "Compra online revisando marca, presentacion y envio.",
        ),
    ),
    CategoryRule(
        categoria="snacks proteicos",
        ingrediente="proteina",
        subcategoria="barra de proteina",
        cluster="snacks-proteicos",
        pattern=_rx(r"protein bar|barra de proteina|barrita|snack|cookie|brownie|wafer"),
        nivel_competencia="media",
        prioridad_seo=76,
        prioridad_sem=78,
        riesgo_claim_medico="bajo",
        tipo_pagina="landing_sem",
        score_comercial=84,
        score_seo=70,
        primary_keywords=(
            "barras de proteina",
            "comprar barras de proteina",
            "barra proteica",
            "snacks proteicos",
            "barras de proteina precio",
        ),
        longtail_keywords=(
            "comprar barras de proteina online",
            "barra proteica chocolate",
            "snacks proteicos precio",
            "barras de proteina por caja",
            "barra proteica precio",
        ),
        ad_headlines=(
            "Barras proteicas",
            "Comprar snacks",
            "Precio por caja",
            "Sabores online",
            "Snacks proteicos",
        ),
        ad_descriptions=(
            "Compara sabores, unidades, precio y disponibilidad online.",
            "Barras y snacks proteicos con informacion clara de formato.",
            "Compra online revisando marca, caja y envio.",
        ),
    ),
    CategoryRule(
        categoria="meal replacement",
        ingrediente="mezcla nutricional",
        subcategoria="batido reemplazo de comida",
        cluster="meal-replacement",
        pattern=_rx(r"meal replacement|complete meal|huel|soylent|ka'?chava|reemplazo de comida|batido meal"),
        nivel_competencia="media",
        prioridad_seo=75,
        prioridad_sem=72,
        riesgo_claim_medico="bajo",
        tipo_pagina="categoria",
        score_comercial=79,
        score_seo=68,
        primary_keywords=(
            "meal replacement",
            "batido reemplazo de comida",
            "comprar meal replacement",
            "batidos completos",
            "meal replacement precio",
        ),
        longtail_keywords=(
            "comprar meal replacement online",
            "batido reemplazo de comida precio",
            "meal replacement sabor chocolate",
            "batidos completos precio",
            "meal replacement en polvo",
        ),
        ad_headlines=(
            "Meal replacement",
            "Batidos completos",
            "Comprar online",
            "Precio y sabores",
            "Formato en polvo",
        ),
        ad_descriptions=(
            "Compara sabores, porciones, precio y disponibilidad online.",
            "Batidos completos con datos claros de marca y formato.",
            "Compra online revisando presentacion, precio y envio.",
        ),
    ),
    CategoryRule(
        categoria="recuperacion",
        ingrediente="dispositivo de recuperacion",
        subcategoria="massage gun",
        cluster="recuperacion-dispositivos",
        pattern=_rx(r"theragun|hypervolt|massage gun|massager|percussion|compression boot|normatec|recovery device|red light"),
        nivel_competencia="media",
        prioridad_seo=68,
        prioridad_sem=70,
        riesgo_claim_medico="medio",
        tipo_pagina="comparativa",
        score_comercial=78,
        score_seo=64,
        primary_keywords=(
            "massage gun",
            "pistola de masaje",
            "dispositivo de recuperacion",
            "comprar pistola de masaje",
            "theragun precio",
        ),
        longtail_keywords=(
            "comprar massage gun online",
            "pistola de masaje precio",
            "theragun precio online",
            "dispositivo de recuperacion muscular",
            "massage gun para entrenar",
        ),
        ad_headlines=(
            "Pistola de masaje",
            "Comprar massage gun",
            "Precio y modelos",
            "Theragun online",
            "Recuperacion gym",
        ),
        ad_descriptions=(
            "Compara modelos, accesorios, precio y disponibilidad online.",
            "Dispositivos de recuperacion con informacion clara de marca.",
            "Compra online revisando modelo, garantia y envio.",
        ),
    ),
    CategoryRule(
        categoria="ropa deportiva",
        ingrediente="no aplica",
        subcategoria="apparel fitness",
        cluster="ropa-deportiva",
        pattern=_rx(r"hoodie|shirt|t[ -]?shirt|tee|shorts|leggings|jogger|bra|tank|apparel|ropa|camiseta|playera|calza"),
        nivel_competencia="alta",
        prioridad_seo=54,
        prioridad_sem=50,
        riesgo_claim_medico="bajo",
        tipo_pagina="producto",
        score_comercial=62,
        score_seo=42,
        primary_keywords=(
            "ropa deportiva",
            "ropa para gym",
            "comprar ropa deportiva",
            "shorts deportivos",
            "leggings deportivas",
        ),
        longtail_keywords=(
            "comprar ropa deportiva online",
            "ropa para gym hombre",
            "ropa para gym mujer",
            "shorts deportivos precio",
            "leggings deportivas precio",
        ),
        ad_headlines=(
            "Ropa deportiva",
            "Comprar ropa gym",
            "Precio y tallas",
            "Ropa online",
            "Marcas fitness",
        ),
        ad_descriptions=(
            "Compara tallas, colores, precio y disponibilidad online.",
            "Ropa deportiva con informacion clara de marca y modelo.",
            "Compra online revisando talla, color y envio.",
        ),
    ),
)


FALLBACK_RULE = CategoryRule(
    categoria="suplementos",
    ingrediente="no identificado",
    subcategoria="suplemento general",
    cluster="suplementos-generales",
    pattern=_rx(r".*"),
    nivel_competencia="media",
    prioridad_seo=55,
    prioridad_sem=48,
    riesgo_claim_medico="medio",
    tipo_pagina="producto",
    score_comercial=55,
    score_seo=52,
    primary_keywords=(
        "suplementos",
        "comprar suplementos",
        "suplementos precio",
        "suplementos online",
        "tienda de suplementos",
    ),
    longtail_keywords=(
        "comprar suplementos online",
        "suplementos por marca",
        "suplementos precio online",
        "suplementos para entrenar",
        "tienda de suplementos online",
    ),
    ad_headlines=(
        "Suplementos",
        "Comprar online",
        "Precio y marcas",
        "Formatos claros",
        "Suplementos online",
    ),
    ad_descriptions=(
        "Compara marca, formato, precio y disponibilidad antes de comprar.",
        "Informacion clara de presentacion, precio y envio.",
        "Compra online con foco en producto, marca y formato.",
    ),
)


COUNTRY_NAMES = {
    "MX": "Mexico",
    "CO": "Colombia",
    "CL": "Chile",
    "LATAM": "LATAM",
}


def classify_product(product: ProductInput | dict[str, Any]) -> dict[str, Any]:
    data = product if isinstance(product, ProductInput) else ProductInput(**_coerce_product_dict(product))
    text = _product_text(data)
    primary_text = _product_primary_text(data)
    normalized_text = _normalize_text(text)
    normalized_primary_text = _normalize_text(primary_text)
    rule = _match_rule(normalized_primary_text)
    if rule is FALLBACK_RULE:
        rule = _match_rule(normalized_text)
    country = _normalize_country(data.pais_objetivo)
    brand = _clean_spaces(data.marca)
    product_name = _clean_spaces(data.nombre)
    size = _extract_size(text)
    format_name = _detect_format(normalized_text)
    intent = _detect_intent(normalized_text, data.precio, brand)
    risk = _max_risk(rule.riesgo_claim_medico, _risk_from_text(normalized_text))
    score_comercial = _commercial_score(rule.score_comercial, data.precio, intent, brand)
    score_seo = _seo_score(rule.score_seo, rule.nivel_competencia, size, brand, country)
    prioridad_seo = _priority(rule.prioridad_seo, score_seo, risk, intent)
    prioridad_sem = _priority(rule.prioridad_sem, score_comercial, risk, intent)
    page_type = _recommended_page_type(rule, intent, risk, prioridad_sem, score_comercial)
    keywords_principales = _keywords(
        rule.primary_keywords,
        rule=rule,
        brand=brand,
        size=size,
        format_name=format_name,
        country=country,
        limit=10,
    )
    keywords_longtail = _keywords(
        rule.longtail_keywords,
        rule=rule,
        brand=brand,
        size=size,
        format_name=format_name,
        country=country,
        limit=15,
        longtail=True,
    )
    title = _title(rule, brand, size, page_type)
    meta = _meta_description(rule, brand, size, country)
    ads = _ads(rule, brand, country)

    return {
        "producto": product_name,
        "categoria_normalizada": rule.categoria,
        "ingrediente_principal": rule.ingrediente,
        "subcategoria": rule.subcategoria,
        "intencion_busqueda": intent,
        "keywords_principales": keywords_principales,
        "keywords_longtail": keywords_longtail,
        "nivel_competencia": rule.nivel_competencia,
        "prioridad_seo": prioridad_seo,
        "prioridad_sem": prioridad_sem,
        "riesgo_claim_medico": risk,
        "tipo_pagina_recomendada": page_type,
        "cluster_seo": rule.cluster,
        "variaciones_latam": _latam_variations(rule, brand),
        "titulo_seo": title,
        "meta_description": meta,
        "ideas_google_ads": ads,
        "pais_objetivo": country,
        "lenguaje_local": _local_language(rule, country),
        "score_comercial": score_comercial,
        "score_seo": score_seo,
    }


def classify_products(products: Iterable[ProductInput | dict[str, Any]]) -> list[dict[str, Any]]:
    return [classify_product(product) for product in products]


def output_json(data: Any, *, pretty: bool = True) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2 if pretty else None, separators=None if pretty else (",", ":"))


def _coerce_product_dict(raw: dict[str, Any]) -> dict[str, Any]:
    aliases = {
        "nombre": ("nombre", "name", "product", "producto"),
        "marca": ("marca", "brand"),
        "descripcion": ("descripcion", "description", "description_html", "body_html"),
        "ingredientes": ("ingredientes", "ingredients", "tags"),
        "categoria_original": ("categoria_original", "category", "category_original", "categoria"),
        "precio": ("precio", "price"),
        "pais_objetivo": ("pais_objetivo", "country", "pais", "target_country"),
    }
    coerced: dict[str, Any] = {}
    for target, keys in aliases.items():
        for key in keys:
            if key in raw and raw[key] is not None:
                coerced[target] = _stringify(raw[key]) if target not in {"precio"} else raw[key]
                break
    coerced.setdefault("nombre", "")
    return coerced


def _product_text(product: ProductInput) -> str:
    return " | ".join(
        part
        for part in (
            product.nombre,
            product.marca,
            _strip_html(product.descripcion),
            product.ingredientes,
            product.categoria_original,
        )
        if part
    )


def _product_primary_text(product: ProductInput) -> str:
    return " | ".join(
        part
        for part in (
            product.nombre,
            product.ingredientes,
            product.categoria_original,
        )
        if part
    )


def _strip_html(value: str) -> str:
    return _clean_spaces(unescape(HTML_TAG_RE.sub(" ", value or "")))


def _stringify(value: Any) -> str:
    if isinstance(value, list):
        return " ".join(_stringify(item) for item in value)
    if isinstance(value, dict):
        return " ".join(_stringify(item) for item in value.values())
    return str(value)


def _normalize_text(value: str) -> str:
    clean = unicodedata.normalize("NFKD", value or "")
    clean = "".join(char for char in clean if not unicodedata.combining(char))
    return _clean_spaces(clean).lower()


def _clean_spaces(value: str) -> str:
    return WHITESPACE_RE.sub(" ", str(value or "")).strip()


def _match_rule(text: str) -> CategoryRule:
    for rule in CATEGORY_RULES:
        if rule.pattern.search(text):
            return rule
    return FALLBACK_RULE


def _extract_size(text: str) -> str:
    match = SIZE_RE.search(_normalize_text(text))
    return match.group(0).replace(" ", "") if match else ""


def _detect_format(text: str) -> str:
    if re.search(r"caps|capsula|tablet|softgel", text):
        return "capsulas"
    if re.search(r"gummy|gomita", text):
        return "gomitas"
    if re.search(r"stick|sobre", text):
        return "sobres"
    if re.search(r"bar|barra|cookie|wafer", text):
        return "barra"
    if re.search(r"drink|bebida|shake|rtd", text):
        return "bebida"
    if re.search(r"powder|polvo", text):
        return "polvo"
    return "formato"


def _detect_intent(text: str, price: Any, brand: str) -> SearchIntent:
    if COMPARISON_RE.search(text):
        return "comparativa"
    if NAVIGATIONAL_RE.search(text) and brand:
        return "navegacional"
    if price not in (None, "", 0, "0") or brand:
        return "transaccional"
    return "informacional"


def _risk_from_text(text: str) -> MedicalRisk:
    if FORBIDDEN_CLAIM_RE.search(text):
        return "alto"
    if MEDIUM_RISK_RE.search(text):
        return "medio"
    return "bajo"


def _max_risk(first: MedicalRisk, second: MedicalRisk) -> MedicalRisk:
    order = {"bajo": 0, "medio": 1, "alto": 2}
    return first if order[first] >= order[second] else second


def _normalize_country(country: str | None) -> str:
    clean = _normalize_text(country or "LATAM").upper()
    aliases = {
        "MEXICO": "MX",
        "MX": "MX",
        "COL": "CO",
        "COLOMBIA": "CO",
        "CO": "CO",
        "CHILE": "CL",
        "CL": "CL",
        "LATAM": "LATAM",
        "LATINOAMERICA": "LATAM",
    }
    return aliases.get(clean, "LATAM")


def _commercial_score(base: int, price: Any, intent: SearchIntent, brand: str) -> int:
    score = base
    if price not in (None, "", 0, "0"):
        score += 4
    if brand:
        score += 3
    if intent == "transaccional":
        score += 3
    if intent == "informacional":
        score -= 8
    return _clamp(score)


def _seo_score(base: int, competition: CompetitionLevel, size: str, brand: str, country: str) -> int:
    score = base
    if competition == "alta":
        score -= 4
    elif competition == "baja":
        score += 5
    if size:
        score += 3
    if brand:
        score += 2
    if country in {"MX", "CO", "CL"}:
        score += 2
    return _clamp(score)


def _priority(base: int, score: int, risk: MedicalRisk, intent: SearchIntent) -> int:
    value = round((base * 0.65) + (score * 0.35))
    if risk == "alto":
        value -= 12
    elif risk == "medio":
        value -= 3
    if intent == "transaccional":
        value += 4
    elif intent == "comparativa":
        value += 2
    elif intent == "informacional":
        value -= 5
    return _clamp(value)


def _recommended_page_type(
    rule: CategoryRule,
    intent: SearchIntent,
    risk: MedicalRisk,
    prioridad_sem: int,
    score_comercial: int,
) -> PageType:
    if intent == "comparativa":
        return "comparativa"
    if risk == "alto":
        return "guia"
    if prioridad_sem >= 78 and score_comercial >= 82:
        return "landing_sem"
    return rule.tipo_pagina


def _keywords(
    base_keywords: tuple[str, ...],
    *,
    rule: CategoryRule,
    brand: str,
    size: str,
    format_name: str,
    country: str,
    limit: int,
    longtail: bool = False,
) -> list[str]:
    country_phrase = _country_phrase(country)
    candidates = list(base_keywords)
    if brand:
        candidates.extend(
            [
                f"{rule.subcategoria} {brand}",
                f"{brand} {rule.categoria}",
                f"comprar {brand} {rule.categoria}",
            ]
        )
    if size:
        candidates.extend(
            [
                f"{rule.subcategoria} {size}",
                f"{rule.categoria} {size} precio",
            ]
        )
    if format_name and format_name != "formato":
        candidates.append(f"{rule.categoria} en {format_name}")
    if country_phrase:
        candidates.extend(
            [
                f"{rule.categoria} {country_phrase}",
                f"comprar {rule.categoria} {country_phrase}",
            ]
        )
    if longtail:
        candidates.extend(
            [
                f"{rule.subcategoria} precio online",
                f"comprar {rule.subcategoria} por marca",
                f"{rule.categoria} envio a domicilio",
            ]
        )
    return _dedupe_clean(candidates, limit)


def _country_phrase(country: str) -> str:
    if country == "LATAM":
        return "online"
    return f"en {COUNTRY_NAMES[country]}"


def _dedupe_clean(values: Iterable[str], limit: int) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        clean = _sanitize_generated(_clean_spaces(value.lower()))
        if not clean or clean in seen:
            continue
        seen.add(clean)
        output.append(clean)
        if len(output) >= limit:
            break
    return output


def _title(rule: CategoryRule, brand: str, size: str, page_type: PageType) -> str:
    if page_type == "comparativa":
        base = f"Mejores {rule.categoria} por precio"
    elif page_type == "landing_sem":
        base = f"Comprar {rule.subcategoria}"
    else:
        base = f"{rule.subcategoria} precio y compra"
    if brand and page_type in {"producto", "landing_sem"}:
        base = f"{rule.subcategoria} {brand}"
    if size and len(base) + len(size) + 1 <= 60:
        base = f"{base} {size}"
    return _fit(_sanitize_generated(_sentence_case(base)), 60)


def _meta_description(rule: CategoryRule, brand: str, size: str, country: str) -> str:
    subject = rule.subcategoria
    if brand:
        subject = f"{subject} {brand}"
    if size:
        subject = f"{subject} {size}"
    country_label = COUNTRY_NAMES.get(country, "LATAM")
    text = f"{_sentence_case(subject)}. Revisa precio, formato y disponibilidad para {country_label}."
    return _fit(_sanitize_generated(text), 150)


def _ads(rule: CategoryRule, brand: str, country: str) -> dict[str, list[str]]:
    headlines = list(rule.ad_headlines)
    if brand:
        headlines.insert(2, f"{brand} online")
    if country != "LATAM":
        headlines.append(f"Envio {COUNTRY_NAMES[country]}")
    descriptions = list(rule.ad_descriptions)
    return {
        "headlines": _bounded_unique(headlines, 5, 30),
        "descriptions": _bounded_unique(descriptions, 3, 90),
    }


def _latam_variations(rule: CategoryRule, brand: str) -> dict[str, list[str]]:
    brand_piece = f" {brand}" if brand else ""
    return {
        "mx": _dedupe_clean(
            (
                f"{rule.categoria} precio mexico",
                f"comprar {rule.categoria} mexico",
                f"{rule.subcategoria} para que sirve",
                f"{rule.subcategoria}{brand_piece}",
            ),
            4,
        ),
        "co": _dedupe_clean(
            (
                f"{rule.categoria} precio colombia",
                f"comprar {rule.categoria} colombia",
                f"{rule.subcategoria} como tomar",
                f"{rule.subcategoria}{brand_piece}",
            ),
            4,
        ),
        "cl": _dedupe_clean(
            (
                f"{rule.categoria} precio chile",
                f"comprar {rule.categoria} chile",
                f"{rule.subcategoria} vale la pena",
                f"{rule.subcategoria}{brand_piece}",
            ),
            4,
        ),
    }


def _local_language(rule: CategoryRule, country: str) -> str:
    country_note = {
        "MX": "MX: usar precio, envio, presentacion y para que sirve.",
        "CO": "CO: usar precio, como tomar, compra online y disponibilidad.",
        "CL": "CL: usar precio, vale la pena, formato y despacho.",
        "LATAM": "MX: precio y para que sirve. CO: como tomar y compra online. CL: vale la pena y despacho.",
    }[country]
    return (
        f"{country_note} Para {rule.categoria}, hablar de marca, gramos, sabor, porciones, precio y envio. "
        "Evitar promesas de salud."
    )


def _bounded_unique(values: Iterable[str], limit: int, max_chars: int) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        clean = _fit(_sanitize_generated(_clean_spaces(value)), max_chars)
        key = clean.lower()
        if not clean or key in seen:
            continue
        seen.add(key)
        output.append(clean)
        if len(output) >= limit:
            break
    return output


def _sentence_case(value: str) -> str:
    value = _clean_spaces(value)
    return value[:1].upper() + value[1:] if value else value


def _fit(value: str, max_chars: int) -> str:
    clean = _clean_spaces(value)
    if len(clean) <= max_chars:
        return clean
    shortened = clean[:max_chars].rsplit(" ", 1)[0]
    return shortened if len(shortened) >= max_chars * 0.6 else clean[:max_chars].strip()


def _sanitize_generated(value: str) -> str:
    replacements = (
        (r"\bcuras?\b", "apoyo"),
        (r"\bcurar\b", "apoyar"),
        (r"\belimina\b", "reduce"),
        (r"\beliminar\b", "reducir"),
        (r"\btrata\b", "acompana"),
        (r"\btratamiento\b", "rutina"),
        (r"\bpreviene\b", "ayuda a cuidar"),
        (r"\bprevenir\b", "cuidar"),
        (r"\benfermedades\b", "temas de salud"),
        (r"\benfermedad\b", "tema de salud"),
    )
    clean = _clean_spaces(value)
    for pattern, replacement in replacements:
        clean = re.sub(pattern, replacement, clean, flags=re.I)
    return _clean_spaces(clean)


def _clamp(value: int) -> int:
    return max(1, min(100, int(value)))
