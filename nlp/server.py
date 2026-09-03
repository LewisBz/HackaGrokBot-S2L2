from fastapi import FastAPI
from pydantic import BaseModel

from nlp.extractor import extract

app = FastAPI(title="NLP Rutas Barranquilla")


class ExtractIn(BaseModel):
    texto: str


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/extract")
def extract_route(body: ExtractIn) -> dict[str, str | None]:
    return extract(body.texto)
