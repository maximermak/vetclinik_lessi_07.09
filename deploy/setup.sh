#!/usr/bin/env bash
#
# Первинне розгортання сайту «Лессі» на чистий сервер Debian/Ubuntu.
#
#   bash setup.sh              # без домену: сайт по HTTP на IP сервера
#   bash setup.sh lessivet.com # з доменом: Caddy сам візьме сертифікат
#
# Скрипт ідемпотентний — можна ганяти повторно, нічого не зламається.
# Секрети сюди не передаються: .env кладеться окремо (див. README).

set -euo pipefail

DOMAIN="${1:-}"
REPO="https://github.com/maximermak/vetclinik_lessi_07.09.git"
APP_DIR=/opt/lessi
APP_USER=lessi
NODE_MAJOR=22

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }

[ "$(id -u)" -eq 0 ] || { echo "Запускати від root"; exit 1; }

say "Базові пакети"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git ufw debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]; then
  say "Node.js $NODE_MAJOR"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi
echo "Node $(node -v), npm $(npm -v)"

if ! command -v caddy >/dev/null; then
  say "Caddy"
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

say "Користувач і код"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
# тека належить користувачу lessi, а git тут працює від root —
# без винятку він відмовляється чіпати «чужий» репозиторій
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
# init+fetch, а не clone: useradd --create-home уже поклав у теку
# скелетні дотфайли, і clone на непорожній теці падає
git init --quiet "$APP_DIR"
git -C "$APP_DIR" remote add origin "$REPO" 2>/dev/null \
  || git -C "$APP_DIR" remote set-url origin "$REPO"
git -C "$APP_DIR" fetch --quiet --depth 1 origin main
git -C "$APP_DIR" reset --hard --quiet FETCH_HEAD

# .env не чіпаємо, якщо він уже є: там живі токени
if [ ! -f "$APP_DIR/.env" ]; then
  cat > "$APP_DIR/.env" <<'ENV'
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
PORT=3000
GOOGLE_MAPS_API_KEY=
SITE_URL=
ENV
  echo "Створено порожній .env — заповніть його, інакше заявки нікуди не підуть"
fi
chmod 600 "$APP_DIR/.env"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

say "Залежності"
sudo -u "$APP_USER" npm ci --omit=dev --silent --prefix "$APP_DIR"

say "systemd"
install -m 644 "$APP_DIR/deploy/lessi.service" /etc/systemd/system/lessi.service
systemctl daemon-reload
systemctl enable --quiet lessi
systemctl restart lessi

say "Caddy"
if [ -n "$DOMAIN" ]; then
  # www веде на основний домен 301-м, щоб не було двох адрес однієї сторінки
  cat > /etc/caddy/Caddyfile <<CADDY
www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}

$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
else
  # Домену ще немає — сертифікат брати нема на що, тож просто HTTP на IP
  cat > /etc/caddy/Caddyfile <<'CADDY'
{
	auto_https off
}

:80 {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
fi
systemctl reload caddy 2>/dev/null || systemctl restart caddy

say "Фаєрвол"
ufw allow 22/tcp  >/dev/null
ufw allow 80/tcp  >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

say "Готово"
systemctl --no-pager --lines=0 status lessi | head -4
curl -fsS -o /dev/null -w "локальна перевірка: HTTP %{http_code}\n" http://127.0.0.1:3000/health
