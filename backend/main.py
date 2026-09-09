import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from tools.database import init_db
from backend.routes.applications import router as applications_router
from backend.routes.profile import router as profile_router
from backend.routes.workflows import router as workflows_router

app = FastAPI(
    title="Agentic Application Workflow API",
    version="1.0.0",
    description="Human-in-the-loop backend for job application automation and tracking.",
)

# Enable CORS for local React dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount generated documents folder so PDFs can be inspected directly in the dashboard
generated_dir = Path("generated").resolve()
generated_dir.mkdir(parents=True, exist_ok=True)
app.mount("/files/generated", StaticFiles(directory=str(generated_dir)), name="generated")

# Include Routers
app.include_router(applications_router)
app.include_router(profile_router)
app.include_router(workflows_router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Agentic Application Workflow Local Server",
        "version": "1.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", 8000))
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    uvicorn.run("backend.main:app", host=host, port=port, reload=True)
