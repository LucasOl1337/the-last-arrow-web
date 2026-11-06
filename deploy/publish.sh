#!/usr/bin/env bash
# Build locally; publish an immutable release on Lucas's Hostinger. No GitHub Actions.
set -euo pipefail
cd "$(dirname "$0")/.."
TLA_BASE=/ npm run build
release="$(TZ=America/Sao_Paulo date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
ssh sennin-kvm "mkdir -p /opt/the-last-arrow/releases/$release; id the-last-arrow >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin the-last-arrow"
tar -czf - dist server src/sim src/net/protocol.ts package.json package-lock.json | ssh sennin-kvm "tar -xzf - -C /opt/the-last-arrow/releases/$release"
ssh sennin-kvm "cd /opt/the-last-arrow/releases/$release && npm ci --omit=dev --ignore-scripts --no-audit --no-fund && ln -sfn /opt/the-last-arrow/releases/$release /opt/the-last-arrow/current"
scp -q deploy/the-last-arrow.service sennin-kvm:/etc/systemd/system/the-last-arrow.service
scp -q deploy/nginx.conf sennin-kvm:/etc/nginx/sites-available/the-last-arrow
ssh sennin-kvm 'systemctl daemon-reload && systemctl enable the-last-arrow && systemctl restart the-last-arrow && nginx -t && systemctl reload nginx'
echo "Release $release · https://arrow.symbiose.si"
