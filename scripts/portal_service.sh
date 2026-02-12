#!/usr/bin/env bash
set -euo pipefail

# Start/stop/restart frontend dev server using npm (Vite)
# Logs are stored under tradermate-portal/logs

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BASE_DIR"
LOG_DIR="$BASE_DIR/logs"
mkdir -p "$LOG_DIR"
PID_FILE="$LOG_DIR/frontend.pid"
OUT_FILE="$LOG_DIR/frontend.out"

FRONTEND_PATTERN="vite|npm.*run dev"

stop() {
  echo "Stopping frontend..."
  if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  pkill -f "vite" || true
  pkill -f "npm.*run dev" || true

  for i in {1..15}; do
    if pgrep -f "vite" >/dev/null || pgrep -f "npm.*run dev" >/dev/null; then
      sleep 1
    else
      echo "Frontend stopped"
      return 0
    fi
  done
  echo "Warning: Frontend did not stop within timeout" >&2
  return 1
}

start() {
  stop || true
  echo "Starting frontend (npm run dev)..."
  nohup npm run dev >>"$OUT_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 1
  echo "Frontend started (pid $(cat "$PID_FILE"))"
}

status() {
  if pgrep -f "vite" >/dev/null || pgrep -f "npm.*run dev" >/dev/null; then
    echo "Frontend: running"
  else
    echo "Frontend: stopped"
  fi
}

case "${1-}" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    stop && start
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 2
    ;;
esac
