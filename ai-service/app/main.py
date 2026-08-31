from fastapi import FastAPI

from app.api import extraction, health, risk

app = FastAPI(title="AP AI Service", version="1.0.0")

app.include_router(health.router)
app.include_router(extraction.router)
app.include_router(risk.router)
