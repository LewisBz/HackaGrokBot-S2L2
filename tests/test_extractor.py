import unittest

from nlp.extractor import extract


class TestExtract(unittest.TestCase):
    def test_centro_soledad(self) -> None:
        self.assertEqual(
            extract("quiero ir del centro a soledad"),
            {"origen": "Centro", "destino": "Soledad", "restriccion": None},
        )

    def test_plaza_aeropuerto_sin_mercado(self) -> None:
        self.assertEqual(
            extract("de la plaza de la paz al aeropuerto, sin pasar por el mercado"),
            {
                "origen": "Plaza de la Paz",
                "destino": "Aeropuerto",
                "restriccion": "Mercado",
            },
        )

    def test_boston_riomar(self) -> None:
        self.assertEqual(
            extract("hay bus de boston a riomar?"),
            {"origen": "Boston", "destino": "Riomar", "restriccion": None},
        )

    def test_empty(self) -> None:
        self.assertEqual(
            extract(""),
            {"origen": None, "destino": None, "restriccion": None},
        )


if __name__ == "__main__":
    unittest.main()
