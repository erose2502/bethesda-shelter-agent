#!/bin/bash
# Bethesda Mission - Quick Deployment Script

set -e  # Exit on error

echo "🏠 Bethesda Mission - Deployment Script"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not found${NC}"
    echo "Install it with: brew install railway"
    echo "Or: npm install -g @railway/cli"
    exit 1
fi

echo -e "${GREEN}✅ Railway CLI found${NC}"
echo ""

# Function to deploy backend
deploy_backend() {
    echo -e "${BLUE}🚀 Deploying Backend...${NC}"
    cd /Users/elijah/Bethesda
    
    # Check if linked to Railway project
    if [ ! -f "railway.json" ]; then
        echo -e "${YELLOW}⚠️  Not linked to Railway project${NC}"
        echo "Run: railway link"
        exit 1
    fi
    
    # Commit and push
    git add .
    git commit -m "Deploy: Backend update $(date +%Y-%m-%d_%H:%M:%S)" || echo "No changes to commit"
    git push origin main
    
    # Deploy via Railway
    railway up
    
    echo -e "${GREEN}✅ Backend deployed!${NC}"
    echo ""
}

# Function to deploy frontend
deploy_frontend() {
    echo -e "${BLUE}🎨 Deploying Frontend...${NC}"
    cd /Users/elijah/Bethesda/src/Frontend
    
    # Build the frontend
    echo "Building React app..."
    npm run build
    
    if [ ! -d "dist" ]; then
        echo -e "${RED}❌ Build failed - dist folder not created${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Build successful${NC}"
    
    # Deploy via Railway
    railway up
    
    echo -e "${GREEN}✅ Frontend deployed!${NC}"
    echo ""
}

# Function to check deployment status
check_status() {
    echo -e "${BLUE}📊 Checking Deployment Status...${NC}"
    echo ""
    
    # Backend health check
    echo "Backend Health:"
    BACKEND_URL="https://bethesda-shelter-agent-production.up.railway.app"
    if curl -s -f "$BACKEND_URL/health" > /dev/null; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
        curl -s "$BACKEND_URL/health" | jq '.' || curl -s "$BACKEND_URL/health"
    else
        echo -e "${RED}❌ Backend health check failed${NC}"
    fi
    
    echo ""
    echo "Railway Services:"
    railway status
    echo ""
}

# Main menu
echo "What would you like to deploy?"
echo "1) Backend only"
echo "2) Frontend only"
echo "3) Both (Full deployment)"
echo "4) Check deployment status"
echo "5) Exit"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        deploy_backend
        check_status
        ;;
    2)
        deploy_frontend
        check_status
        ;;
    3)
        deploy_backend
        deploy_frontend
        check_status
        ;;
    4)
        check_status
        ;;
    5)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Visit your frontend URL to test the dashboard"
echo "2. Call +1 (518) 840-4103 to test the voice agent"
echo "3. Monitor logs: railway logs"
echo ""
