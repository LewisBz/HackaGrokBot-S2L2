# HackaGrokBot-S2L2

Demo de rutas de bus en Barranquilla. Este PR es la pieza de Lewis (Persona 3): extraer origen, destino y restricción de texto libre.

## NLP (Lewis)

Entrada: texto libre en español.
Salida, siempre este JSON:

```json
{"origen":"Centro","destino":"Soledad","restriccion":null}
```

Campo que no aparezca → `null`.

### Usar la función

```python
from nlp.extractor import extract

extract("quiero ir del centro a soledad")
# {"origen": "Centro", "destino": "Soledad", "restriccion": None}
```

### Endpoint para Peñata

```bash
pip install -r requirements.txt
uvicorn nlp.server:app --reload --port 8000
```

```http
POST /extract
Content-Type: application/json

{"texto":"de la plaza de la paz al aeropuerto, sin pasar por el mercado"}
```

```json
{"origen":"Plaza de la Paz","destino":"Aeropuerto","restriccion":"Mercado"}
```

`GET /health` → `{"ok": true}`

### Tests

```bash
python -m unittest tests.test_extractor -v
```

Lugares reconocidos de entrada: Centro, Soledad, Plaza de la Paz, Aeropuerto, Mercado, Boston, Riomar, Prado, Uninorte.
