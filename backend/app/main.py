from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.extract import router as extract_router

app = FastAPI(
    title="Rhetorical Label API",
    description="Extract paragraphs and rhetorical roles from Indian Supreme Court judgment PDFs.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173","https://rhetorical-role-labelling.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extract_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
