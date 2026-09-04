from __future__ import annotations

import re
import unicodedata

PLACES: list[tuple[str, list[str]]] = [
    ("Plaza de la Paz", ["plaza de la paz", "plaza la paz"]),
    ("Aeropuerto", ["aeropuerto", "aeropuerto ernesto cortissoz"]),
    ("Mercado", ["mercado", "mercado publico", "el mercado"]),
    ("Riomar", ["riomar", "rio mar"]),
    ("Boston", ["boston"]),
    ("Soledad", ["soledad"]),
    ("Centro", ["el centro", "centro"]),
    ("Prado", ["el prado", "prado"]),
    ("Uninorte", ["universidad del norte", "uninorte", "la universidad", "universidad"]),
    ("Playa", ["la playa", "playa", "puerto colombia"]),
    ("Buenavista", ["buenavista", "centro comercial buenavista"]),
    ("Terminal de Transportes", ["terminal", "terminal de transportes"]),
    ("Villa Santos", ["villa santos"]),
    ("Villa Country", ["villa country"]),
    ("Alto Prado", ["alto prado"]),
    ("Ciudad Jardín", ["ciudad jardin", "ciudad jardín"]),
    ("El Recreo", ["el recreo", "recreo"]),
    ("Las Flores", ["las flores"]),
    ("Calle 72", ["calle 72", "la 72"]),
    ("Calle 84", ["calle 84", "la 84"]),
    ("Portal de Soledad", ["portal de soledad", "portal soledad"]),
    ("Pacho Galán", ["pacho galan", "pacho galán"]),
    ("Pedro Ramayá", ["pedro ramaya", "pedro ramayá"]),
    ("Estadio Metropolitano", ["estadio metropolitano", "el estadio", "estadio", "metropolitano"]),
    ("Joaquín Barrios Polo", ["joaquin barrios", "joaquín barrios polo", "barrios polo"]),
    ("Buenos Aires", ["buenos aires"]),
    ("La Ocho", ["la ocho", "la 8"]),
    ("La Catorce", ["la catorce", "la 14"]),
    ("La Veintiuna", ["la veintiuna", "la 21"]),
    ("Atlántico", ["atlantico", "atlántico"]),
    ("Chiquinquirá", ["chiquinquira", "chiquinquirá"]),
    ("La Arenosa", ["la arenosa", "arenosa"]),
    ("Parque Cultural del Caribe", ["parque cultural", "parque del caribe"]),
    ("Barrio Abajo", ["barrio abajo"]),
    ("La Catedral", ["la catedral", "catedral"]),
    ("Alfredo Correa de Andréis", ["alfredo correa", "correa de andreis"]),
    ("Esthercita Forero", ["esthercita forero", "esthercita"]),
    ("Joe Arroyo", ["joe arroyo", "retorno joe arroyo"]),
]


AVOID_PREFIXES = [
    "sin pasar por",
    "no pasar por",
    "sin pasar",
    "evitando",
    "evitar",
]

VIA_PREFIXES = [
    "que pase por",
    "que pasen por",
    "pasa por",
    "pasen por",
    "pase por",
]

STREET_RE = re.compile(
    r"^(?:la|el|calle|carrera|cra|cll|kr|av|avenida)\s+\d+[\w\-#\s]*$",
    re.IGNORECASE,
)

# Direcciones libres tipo "Cra 51 #82-10 Barranquilla"
ADDRESS_CHUNK_RE = re.compile(
    r"(?:calle|carrera|cra|cll|kr|av|avenida)\s+\d+[\w\-#]*(?:\s+#?[\w\-]+)*(?:\s+barranquilla)?",
    re.IGNORECASE,
)


def _strip_accents(text: str) -> str:
    nfkd = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in nfkd if unicodedata.category(ch) != "Mn")


def _norm(text: str) -> str:
    text = _strip_accents(text.lower())
    text = re.sub(r"[¿?¡!.,;:]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _find_places(text_norm: str) -> list[tuple[int, int, str]]:
    hits: list[tuple[int, int, str]] = []
    for canonical, aliases in PLACES:
        for alias in aliases:
            alias_n = _norm(alias)
            for match in re.finditer(rf"(?<!\w){re.escape(alias_n)}(?!\w)", text_norm):
                hits.append((match.start(), match.end(), canonical))

    hits.sort(key=lambda h: (h[0], -(h[1] - h[0])))
    chosen: list[tuple[int, int, str]] = []
    occupied: list[tuple[int, int]] = []
    for start, end, canonical in hits:
        if any(not (end <= occupied_start or start >= occupied_end) for occupied_start, occupied_end in occupied):
            continue
        chosen.append((start, end, canonical))
        occupied.append((start, end))
    chosen.sort(key=lambda h: h[0])
    return chosen


def _street_label(tail: str) -> str | None:
    token = tail.strip()
    token = re.split(r"\s+(?:me\s+sirve|por\s+fa|gracias)\b", token, maxsplit=1)[0].strip()
    token = token.split()[0:3]
    candidate = " ".join(token)
    if STREET_RE.match(candidate):
        return candidate
    m = re.match(r"(?:la|el|calle|carrera|cra|cll)\s+\d+\w*", tail.strip())
    return m.group(0) if m else None


def extract(texto: str | None) -> dict[str, str | None]:
    if not texto or not str(texto).strip():
        return {"origen": None, "destino": None, "restriccion": None}

    norm = _norm(str(texto))
    restriccion = None
    norm_od = norm

    for prefix in AVOID_PREFIXES:
        prefix_n = _norm(prefix)
        match = re.search(rf"{re.escape(prefix_n)}\s+", norm)
        if not match:
            continue
        tail = norm[match.end() :]
        places_in_tail = _find_places(tail)
        if places_in_tail:
            restriccion = places_in_tail[0][2]
            norm_od = norm[: match.start()].strip()
        break
    else:
        for prefix in VIA_PREFIXES:
            prefix_n = _norm(prefix)
            match = re.search(rf"{re.escape(prefix_n)}\s+", norm)
            if not match:
                continue
            tail = norm[match.end() :]
            places_in_tail = _find_places(tail)
            if places_in_tail:
                restriccion = places_in_tail[0][2]
            else:
                street = _street_label(tail)
                if street:
                    restriccion = street
            if restriccion:
                norm_od = norm[: match.start()].strip()
            break

    places = _find_places(norm_od)
    origen = None
    destino = None

    if len(places) >= 2:
        origen, destino = places[0][2], places[1][2]
    elif len(places) == 1:
        if re.search(r"\b(a|al|hacia|hasta)\b", norm_od):
            destino = places[0][2]
        elif re.search(r"\b(de|del|desde)\b", norm_od):
            origen = places[0][2]
        else:
            destino = places[0][2]

    # Fallback: "de <texto> a <texto>" para direcciones arbitrarias (Nominatim)
    if origen is None or destino is None:
        m = re.search(
            r"\b(?:de|del|desde)\s+(.+?)\s+(?:a|al|hacia|hasta)\s+(.+)$",
            norm_od,
        )
        if m:
            left, right = m.group(1).strip(), m.group(2).strip()
            # Preferir chunk de direccion si existe
            al = ADDRESS_CHUNK_RE.search(left)
            ar = ADDRESS_CHUNK_RE.search(right)
            if origen is None:
                origen = al.group(0).strip() if al else left
            if destino is None:
                destino = ar.group(0).strip() if ar else right
            # Capitalizar places conocidos si coinciden
            for canonical, aliases in PLACES:
                for alias in aliases:
                    if _norm(alias) == _norm(origen or ""):
                        origen = canonical
                    if _norm(alias) == _norm(destino or ""):
                        destino = canonical

    return {"origen": origen, "destino": destino, "restriccion": restriccion}
