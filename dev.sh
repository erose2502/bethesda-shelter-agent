#!/bin/bash
# Local Development Startup Script

set -e

echo "🏠 Bethesda Mission - Local Development"
echo "======================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ]; then
    echo -e "${YELLOW}⚠️  Not in project root. Please cd to /Users/elijah/Bethesda${NC}"
    exit 1
fi

# Function to start backend
start_backend() {
    echo -e "${BLUE}🚀 Starting Backend API...${NC}"
    
    # Activate virtual environment and load .env
    source .venv/bin/activate
    set -a
    source .env
    set +a
    # Start FastAPI server
    python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!
    
    echo -e "${GREEN}✅ Backend running on http://localhost:8000${NC}"
    echo "   - Health: http://localhost:8000/health"
    echo "   - Docs: http://localhost:8000/docs"
    echo ""
}

# Function to start LiveKit agent
start_livekit() {
    echo -e "${BLUE}📞 Starting LiveKit Voice Agent...${NC}"
    
    # Activate virtual environment and load .env
    source .venv/bin/activate
    set -a
    source .env
    set +a
    # Start LiveKit agent
    python src/livekit_agent.py start &
    LIVEKIT_PID=$!
    
    echo -e "${GREEN}✅ LiveKit agent running${NC}"
    echo "   - Phone: +1 (518) 840-4103"
    echo ""
}

# Function to start frontend
start_frontend() {
    echo -e "${BLUE}🎨 Starting Frontend Dashboard...${NC}"
    
    cd src/Frontend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    # Start dev server
    npm run dev &
    FRONTEND_PID=$!
    
    cd ../..
    
    echo -e "${GREEN}✅ Frontend running on http://localhost:5173${NC}"
    echo ""
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down services...${NC}"
    
    # Kill all background processes
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$LIVEKIT_PID" ]; then
        kill $LIVEKIT_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes
    pkill -f "uvicorn src.main:app" 2>/dev/null || true
    pkill -f "livekit_agent.py" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

# Trap CTRL+C and cleanup
trap cleanup SIGINT SIGTERM

# Check what to start
echo "What would you like to start?"
echo "1) Full stack (Backend + LiveKit + Frontend)"
echo "2) Backend + LiveKit only"
echo "3) Backend only"
echo "4) Frontend only"
echo "5) Exit"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        start_backend
        sleep 2
        start_livekit
        sleep 2
        start_frontend
        echo ""
        echo -e "${GREEN}🎉 All services running!${NC}"
        echo ""
        echo "📊 Dashboard: http://localhost:5173"
        echo "🔧 API Docs: http://localhost:8000/docs"
        echo "📞 Phone: +1 (518) 840-4103"
        echo ""
        echo "Press CTRL+C to stop all services"
        ;;
    2)
        start_backend
        sleep 2
        start_livekit
        echo ""
        echo -e "${GREEN}🎉 Backend services running!${NC}"
        echo ""
        echo "🔧 API: http://localhost:8000"
        echo "📞 Phone: +1 (518) 840-4103"
        echo ""
        echo "Press CTRL+C to stop all services"
        ;;
    3)
        start_backend
        echo ""
        echo -e "${GREEN}🎉 Backend running!${NC}"
        echo ""
        echo "🔧 API: http://localhost:8000"
        echo "📖 Docs: http://localhost:8000/docs"
        echo ""
        echo "Press CTRL+C to stop"
        ;;
    4)
        start_frontend
        echo ""
        echo -e "${GREEN}🎉 Frontend running!${NC}"
        echo ""
        echo "📊 Dashboard: http://localhost:5173"
        echo ""
        echo "⚠️  Note: Backend must be running separately for API calls"
        echo ""
        echo "Press CTRL+C to stop"
        ;;
    5)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

# Wait for user to press CTRL+C
wait
