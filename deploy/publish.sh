#!/usr/bin/env bash
# Build locally; publish an immutable release on Lucas's Hostinger. No GitHub Actions.
set -euo pipefail
cd "$(dirname "$0")/.."
# Do not interrupt someone else's active match. Initial install has no API yet.
rooms=$(ssh sennin-kvm "if systemctl is-active --quiet the-last-arrow; then curl -fsS http://127.0.0.1:8890/health; else printf '{\"rooms\":0}'; fi" | node -e "let s='';for await(const b of process.stdin)s+=b;const n=JSON.parse(s).rooms;if(!Number.isInteger(n))process.exit(1);console.log(n)")
if [ "$rooms" != 0 ]; then echo "Há $rooms sala(s) ativa(s); publicação adiada sem derrubar jogadores." >&2; exit 2; fi
TLA_BASE=/ npm run build
node --input-type=module -e "import {execFileSync} from 'node:child_process';import{writeFileSync}from'node:fs';writeFileSync('dist/version.json',JSON.stringify({revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}))"
release="$(TZ=America/Sao_Paulo date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
ssh sennin-kvm "mkdir -p /opt/the-last-arrow/releases/$release; id the-last-arrow >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin the-last-arrow"
tar -czf - dist server src/sim src/net/protocol.ts package.json package-lock.json | ssh sennin-kvm "tar -xzf - -C /opt/the-last-arrow/releases/$release"
ssh sennin-kvm "cd /opt/the-last-arrow/releases/$release && npm ci --omit=dev --ignore-scripts --no-audit --no-fund && ln -sfn /opt/the-last-arrow/releases/$release /opt/the-last-arrow/current"
scp -q deploy/the-last-arrow.service sennin-kvm:/etc/systemd/system/the-last-arrow.service
scp -q deploy/nginx.conf sennin-kvm:/etc/nginx/sites-available/the-last-arrow
ssh sennin-kvm 'systemctl daemon-reload && systemctl enable the-last-arrow && systemctl restart the-last-arrow && nginx -t && systemctl reload nginx'
echo "Release $release · https://arrow.symbiose.si"
