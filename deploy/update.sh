#!/usr/bin/env bash
# Оновлення сайту до свіжого main. Запускати на сервері від root: bash update.sh
set -euo pipefail
APP_DIR=/opt/lessi

git -C "$APP_DIR" fetch --quiet origin main
git -C "$APP_DIR" reset --hard --quiet origin/main
chown -R lessi:lessi "$APP_DIR"
sudo -u lessi npm ci --omit=dev --silent --prefix "$APP_DIR"
systemctl restart lessi
sleep 2
curl -fsS -o /dev/null -w "після оновлення: HTTP %{http_code}\n" http://127.0.0.1:3000/health
git -C "$APP_DIR" log --oneline -1
