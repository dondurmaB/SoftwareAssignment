#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run.sh  —  Start CollabDocs backend + frontend with one command
# Usage:
#   chmod +x run.sh && ./run.sh            # start both
#   ./run.sh --install                     # install deps then start
#   ./run.sh --backend-only
#   ./run.sh --frontend-only
# ─────────────────────────────────────────────────────────────────────────────
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_VENV_DIR="$BACKEND_DIR/.venv"
BACKEND_PYTHON="$BACKEND_VENV_DIR/bin/python"
BACKEND_PIP="$BACKEND_VENV_DIR/bin/pip"

INSTALL=false; BACKEND_ONLY=false; FRONTEND_ONLY=false
for arg in "$@"; do
  case $arg in --install) INSTALL=true;; --backend-only) BACKEND_ONLY=true;; --frontend-only) FRONTEND_ONLY=true;; esac
done

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}  $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERR]${NC}  $1"; exit 1; }

command -v python3 >/dev/null 2>&1 || error "python3 required"
command -v node >/dev/null 2>&1 || error "node required"
command -v npm >/dev/null 2>&1 || error "npm required"

# Set up backend .env if missing
if [ ! -f "$BACKEND_DIR/.env" ]; then
  warn "No backend/.env found — copying from .env.example"
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  warn "Edit backend/.env if you want openai or lmstudio. The default AI provider is mock."
fi

# Install deps
if [ "$INSTALL" = true ]; then
  if [ ! -x "$BACKEND_PYTHON" ]; then
    info "Creating backend virtual environment…"
    python3 -m venv "$BACKEND_VENV_DIR"
  fi
  info "Installing backend deps…"
  "$BACKEND_PIP" install -r "$BACKEND_DIR/requirements.txt" -q
  success "Backend deps installed"
  info "Installing frontend deps…"
  (cd "$FRONTEND_DIR" && npm install --silent)
  success "Frontend deps installed"
fi

if [ ! -x "$BACKEND_PYTHON" ]; then
  error "Backend virtualenv not found. Run: ./run.sh --install"
fi

# Check deps
"$BACKEND_PYTHON" -c "import fastapi" 2>/dev/null || error "FastAPI not found in backend/.venv. Run: ./run.sh --install"

cleanup() { info "Shutting down…"; kill $BACKEND_PID 2>/dev/null || true; kill $FRONTEND_PID 2>/dev/null || true; exit 0; }
trap cleanup SIGINT SIGTERM

if [ "$FRONTEND_ONLY" != true ]; then
  info "Starting backend on http://localhost:8000 …"
  (
    cd "$BACKEND_DIR"
    "$BACKEND_PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  ) &
  BACKEND_PID=$!
  sleep 2
  success "Backend running (PID $BACKEND_PID)"
fi

if [ "$BACKEND_ONLY" != true ]; then
  info "Starting frontend on http://localhost:5173 …"
  (
    cd "$FRONTEND_DIR"
    npm run dev
  ) &
  FRONTEND_PID=$!
  sleep 2
  success "Frontend running (PID $FRONTEND_PID)"
fi

echo ""
echo -e "${GREEN}────────────────────────────────────────${NC}"
echo -e "${GREEN}  CollabDocs is running!${NC}"
echo -e "${GREEN}────────────────────────────────────────${NC}"
echo -e "  App      : ${BLUE}http://localhost:5173${NC}"
echo -e "  API      : ${BLUE}http://localhost:8000${NC}"
echo -e "  API docs : ${BLUE}http://localhost:8000/docs${NC}"
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop"
echo -e "${GREEN}────────────────────────────────────────${NC}"
wait
