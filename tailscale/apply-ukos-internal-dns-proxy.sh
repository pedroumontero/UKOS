#!/usr/bin/env bash
# Aplica dnsmasq (solo tailscale0) + Caddy (proxy HTTPS → 3000 prod / 3001 dev) para UKOS.
# Dominios por defecto: ukos.tech (prod) y dev-ukos.tech (dev). Ejecutar en ukey-core-01 con sudo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TS_IP="$(tailscale ip -4 2>/dev/null || true)"
if [[ -z "${TS_IP}" ]]; then
  echo "tailscale ip -4 vacío: conecta el nodo primero." >&2
  exit 1
fi

UKOS_PROD_DOMAIN="${UKOS_PROD_DOMAIN:-ukos.tech}"
UKOS_DEV_DOMAIN="${UKOS_DEV_DOMAIN:-dev-ukos.tech}"

install -d /etc/dnsmasq.d /etc/systemd/system/dnsmasq.service.d /etc/systemd/system/caddy.service.d

{
  cat "${ROOT}/tailscale/dnsmasq/99-ukos-tailscale-base.conf"
  printf 'listen-address=%s\n' "${TS_IP}"
  printf 'address=/%s/%s\n' "${UKOS_PROD_DOMAIN}" "${TS_IP}"
  printf 'address=/%s/%s\n' "${UKOS_DEV_DOMAIN}" "${TS_IP}"
} >/etc/dnsmasq.d/99-ukos-tailscale.conf
rm -f /etc/dnsmasq.d/50-ukos-address.conf /etc/dnsmasq.d/99-ukos-tailscale-base.conf 2>/dev/null || true

if grep -q '^IGNORE_RESOLVCONF=' /etc/default/dnsmasq 2>/dev/null; then
  sed -i 's/^IGNORE_RESOLVCONF=.*/IGNORE_RESOLVCONF=yes/' /etc/default/dnsmasq
else
  printf '\nIGNORE_RESOLVCONF=yes\n' >>/etc/default/dnsmasq
fi

cat >/etc/systemd/system/dnsmasq.service.d/ukos-after-tailscale.conf <<'EOF'
[Unit]
After=tailscaled.service
Wants=tailscaled.service
EOF

cp "${ROOT}/tailscale/caddy/Caddyfile" /etc/caddy/Caddyfile
cat >/etc/systemd/system/caddy.service.d/ukos-bind.conf <<EOF
[Service]
Environment=CADDY_BIND_ADDR=${TS_IP}
EOF

systemctl daemon-reload
systemctl enable dnsmasq caddy
systemctl restart dnsmasq
systemctl restart caddy

echo "TS_IP=${TS_IP} PROD_DOMAIN=${UKOS_PROD_DOMAIN} DEV_DOMAIN=${UKOS_DEV_DOMAIN}"
echo "En Tailscale admin → DNS → Split DNS: nameserver ${TS_IP} para zonas ${UKOS_PROD_DOMAIN} y ${UKOS_DEV_DOMAIN}"
host -t A "${UKOS_PROD_DOMAIN}" "${TS_IP}" || true
host -t A "${UKOS_DEV_DOMAIN}" "${TS_IP}" || true
