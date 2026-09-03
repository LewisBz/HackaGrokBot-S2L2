from nlp.extract import extract


def test_universidad_centro_via_51():
    msg = (
        "Estoy saliendo de la universidad y necesito llegar al centro, "
        "el bus que pasa por la 51 me sirve?"
    )
    assert extract(msg) == {
        "origen": "universidad",
        "destino": "centro",
        "restriccion": "que pase por la 51",
    }


def test_aeropuerto_playa():
    assert extract("¿Cómo llego del aeropuerto a la playa?") == {
        "origen": "aeropuerto",
        "destino": "playa",
        "restriccion": None,
    }


def test_falta_info_hola():
    assert extract("hola") == {
        "origen": None,
        "destino": None,
        "restriccion": None,
        "falta_info": True,
    }


def test_falta_info_quiero_un_bus():
    assert extract("quiero un bus") == {
        "origen": None,
        "destino": None,
        "restriccion": None,
        "falta_info": True,
    }


def test_empty():
    assert extract("")["falta_info"] is True
