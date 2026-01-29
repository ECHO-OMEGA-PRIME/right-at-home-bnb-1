"""
RIGHT AT HOME BNB - MINIMAL API Server for Railway
Reduced imports to identify startup issue
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure basic logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger("RightAtHomeBnB")

# Initialize FastAPI app
app = FastAPI(
    title="Right at Home BnB API",
    description="Property management system for Steven Palma's 22 Midland TX rentals",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/")
async def root():
    return {
        "name": "Right at Home BnB API",
        "owner": "Steven Palma",
        "location": "Midland, TX",
        "properties": 22,
        "status": "operational",
        "made_by": "ECHO OMEGA PRIME",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "api": "online",
        "database": "minimal_mode",
        "made_by": "ECHO OMEGA PRIME",
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(
        "main_minimal:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )