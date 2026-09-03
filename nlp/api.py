from fastapi import FastAPI
from pydantic import BaseModel, Field

from nlp.extract import extract

app = FastAPI(
    title="HackaGrokBot NLP",
    description="Módulo NLP de ruteo de buses en Barranquilla.",
    version="0.1.0",
)


class ExtractRequest(BaseModel):
    mensaje: str = Field(..., min_length=1)


class ExtractResponse(BaseModel):
    origen: str | None
    destino: str | None
    restriccion: str | None
    falta_info: bool | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract", response_model=ExtractResponse, response_model_exclude_none=True)
def extract_endpoint(body: ExtractRequest) -> dict:
    return extract(body.mensaje)
