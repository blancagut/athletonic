from __future__ import annotations

import json
import re
import unittest

from seo_sem_classifier import classify_product


FORBIDDEN_RE = re.compile(r"\b(cura|elimina|trata|previene|enfermedad|enfermedades)\b", re.I)


class SeoSemClassifierTest(unittest.TestCase):
    def test_creatine_product_is_transactional(self) -> None:
        result = classify_product(
            {
                "nombre": "Creatine Monohydrate 300g",
                "marca": "Transparent Labs",
                "descripcion": "Creatina monohidratada sin sabor.",
                "ingredientes": "creatina monohidratada",
                "categoria_original": "Sports Nutrition",
                "precio": 29.99,
                "pais_objetivo": "MX",
            }
        )

        self.assertEqual(result["categoria_normalizada"], "creatina")
        self.assertEqual(result["intencion_busqueda"], "transaccional")
        self.assertGreaterEqual(result["prioridad_sem"], 80)
        self.assertLessEqual(len(result["titulo_seo"]), 60)
        self.assertLessEqual(len(result["meta_description"]), 150)
        self.assertEqual(len(result["ideas_google_ads"]["headlines"]), 5)
        self.assertLessEqual(max(len(item) for item in result["ideas_google_ads"]["headlines"]), 30)

    def test_sensitive_source_text_raises_risk_without_ad_claims(self) -> None:
        result = classify_product(
            {
                "nombre": "Magnesium Glycinate",
                "marca": "Example Brand",
                "descripcion": "Texto fuente dice que trata insomnio, debe marcar riesgo.",
                "ingredientes": "magnesium glycinate",
                "categoria_original": "Sleep",
                "precio": 19.99,
                "pais_objetivo": "CL",
            }
        )

        self.assertEqual(result["riesgo_claim_medico"], "alto")
        generated_copy = json.dumps(
            {
                "titulo_seo": result["titulo_seo"],
                "meta_description": result["meta_description"],
                "ideas_google_ads": result["ideas_google_ads"],
                "keywords_principales": result["keywords_principales"],
                "keywords_longtail": result["keywords_longtail"],
            },
            ensure_ascii=False,
        )
        self.assertIsNone(FORBIDDEN_RE.search(generated_copy))


if __name__ == "__main__":
    unittest.main()
