#!/bin/bash
# Railway startup script for RAH Backend
# Copy Railway environment config and start server

echo "🚀 Starting RAH Backend for Railway..."

# Copy Railway environment configuration
if [ -f ".env.railway" ]; then
    echo "📝 Using Railway environment configuration..."
    cp .env.railway .env
else
    echo "⚠️ No Railway config found, using existing .env"
fi

# Start the FastAPI server
echo "🌐 Starting FastAPI server on port ${PORT:-8000}..."
uvicorn main_minimal:app --host 0.0.0.0 --port ${PORT:-8000}