#!/usr/bin/env bash
# Aplica dnsmasq (Tailscale + LAN) + Caddy (proxy HTTPS) para UKOS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TS_IP="$(tailscale ip -4 2>/dev/null || true)"
if [[ -z "${TS_IP}" ]]; then
  echo "tailscale ip -4 vacío: conecta el nodo primero." >&2
  exit 1
fi

LAN_IP="$(ip -4 addr show enp6s18 2>/dev/null | awk '/inet / {print $2}' | cut -d/ -f1)"
if [[ -z "${LAN_IP}" ]]; then
  echo "Sin IPv4 en enp6s18" >&2
  exit 1
fi

UKOS_PROD_DOMAIN="${UKOS_PROD_DOMAIN:-ukos.tech}"
UKOS_DEV_DOMAIN="${UKOS_DEV_DOMAIN:-dev-ukos.tech}"

install -d /etc/dnsmasq.d /etc/systemd/system/dnsmasq.service.d /etc/systemd/system/caddy.service.d
install -d /etc/systemd/resolved.conf.d

# Upstream público para systemd-resolved: evita que Tailscale MagicDNS quede sin "default resolvers"
# (log tailscaled: "no upstream resolvers set, returning SERVFAIL") cuando el admin solo define Split DNS.
if [[ ! -f /etc/systemd/resolved.conf.d/10-ukos-global-upstream.conf ]]; then
  cat >/etc/systemd/resolved.conf.d/10-ukos-global-upstream.conf <<'EOF'
[Resolve]
DNS=1.1.1.1 8.8.8.8
FallbackDNS=1.0.0.1
Domains=~.
EOF
fi

# Este nodo debe usar el stub de systemd-resolved (no /etc/resolv.conf plano sólo a 100.100.100.100).
if systemctl is-active --quiet systemd-resolved.service; then
  if [[ ! /etc/resolv.conf -ef /run/systemd/resolve/stub-resolv.conf ]]; then
    ln -sf /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
  fi
  systemctl restart systemd-resolved.service
fi

# Resolución local estable en el propio servidor (evita depender de rutas split -> misma IP vía stub).
HOSTS_MARK="# UKOS: managed by apply-ukos-internal-dns-proxy.sh"
if ! grep -qF "${HOSTS_MARK}" /etc/hosts 2>/dev/null; then
  {
    printf '\n%s\n' "${HOSTS_MARK}"
    printf '%s %s %s\n' "${TS_IP}" "${UKOS_PROD_DOMAIN}" "${UKOS_DEV_DOMAIN}"
  } >>/etc/hosts
fi

{
  cat "${ROOT}/tailscale/dnsmasq/99-ukos-tailscale-base.conf"
  # Solo IP Tailscale: duplicar con LAN hace que clientes tailnet a veces intenten 192.168.x primero (lentitud/timeouts).
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
After=network-online.target tailscaled.service
Wants=network-online.target tailscaled.service
EOF

cp "${ROOT}/tailscale/caddy/Caddyfile" /etc/caddy/Caddyfile
cat >/etc/systemd/system/caddy.service.d/ukos-bind.conf <<EOF
[Service]
Environment=CADDY_BIND_ADDR=${TS_IP}
Environment=CADDY_LAN_BIND_ADDR=${LAN_IP}
EOF

systemctl daemon-reload
systemctl enable dnsmasq caddy
systemctl restart dnsmasq
systemctl restart caddy

echo "TS_IP=${TS_IP} LAN_IP=${LAN_IP} PROD_DOMAIN=${UKOS_PROD_DOMAIN} DEV_DOMAIN=${UKOS_DEV_DOMAIN}"
echo "Tailscale admin → Split DNS: ${UKOS_PROD_DOMAIN} y ${UKOS_DEV_DOMAIN} → ${TS_IP} (ya configurado en tu tailnet)."
echo "Tailscale admin → DNS global: añade al menos 1.1.1.1 y 8.8.8.8 como nameservers generales (corrige SERVFAIL sin tocar Split DNS)."
echo "En cada cliente: Tailscale → Use Tailscale DNS / Accept DNS = ON, o activa 'Override local DNS' en admin si quieres forzarlo."
host -t A "${UKOS_PROD_DOMAIN}" "${LAN_IP}" || true
host -t A "${UKOS_DEV_DOMAIN}" "${LAN_IP}" || true
