#!/usr/bin/env bash
# Requires an existing GPU lease; no model polling/retry, no deploy.
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:?absolute output directory}"
[[ "$out" = /* ]]
bench=arrow-arco-espacial
mkdir -p "$out"
agent-bench fila > "$out/lease.json"
python - "$out/lease.json" <<'PY'
import json, sys
assert any(v['bench'] == 'arrow-arco-espacial' for v in json.load(open(sys.argv[1]))['vagas']), 'GPU lease required'
PY
cleanup() {
  agent-bench-web --bench "$bench" --mission arco-espacial-1107 finish > "$out/finish.json" 2>&1 || true
  agent-bench-web --bench "$bench" --mission arco-espacial-1107 hygiene > "$out/hygiene-final.json" 2>&1 || true
  if [[ -n "${preview:-}" ]]; then kill "$preview" 2>/dev/null || true; fi
}
trap cleanup EXIT
node node_modules/storybook/dist/bin/dispatcher.js dev -p 6155 --host 127.0.0.1 --no-open --disable-telemetry --ci --exact-port > "$out/storybook.log" 2>&1 &
preview=$!
python - <<'PY'
import time, urllib.request
end=time.monotonic()+60
while True:
    try:
        with urllib.request.urlopen('http://127.0.0.1:6155/index.json',timeout=2) as r: assert r.status == 200
        break
    except Exception:
        if time.monotonic()>end: raise
        time.sleep(1)
PY
agent-bench cdp "$bench" > "$out/cdp.json"
node scripts/proof-arco-spatial.mjs 'http://127.0.0.1:6155/iframe.html?id=arena-arco-espacial--diagnostico&viewMode=story' "$out" "$out/../causa.json"
