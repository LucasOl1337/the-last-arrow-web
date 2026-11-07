#!/usr/bin/env bash
# Deterministic, one-shot render job. Does NOT claim visual approval or deploy.
# Standalone (may wait for GPU; background it through the coordinator):
#   bash scripts/proof-arco-rig.sh /absolute/output
# Existing camera lease (NO second queue entry):
#   ARCO_RIG_BENCH=arrow-camera bash scripts/proof-arco-rig.sh /absolute/output --with-lease
set -euo pipefail
cd "$(dirname "$0")/.."
root="$PWD"
bench="${ARCO_RIG_BENCH:-arrow-arco-rig}"
out="${1:?absolute output directory required}"
[[ "$out" = /* ]] || { echo 'Output must be absolute' >&2; exit 1; }
mkdir -p "$out"
if [[ "${2:-}" != --with-lease ]]; then
  [[ "$bench" = arrow-arco-rig ]] || { echo 'Shared existing bench requires --with-lease' >&2; exit 1; }
  AGENT_BENCH_OWNER=pi-arco-rig agent-bench ensure "$bench" > "$out/bench-ensure.json"
  trap 'agent-bench stop arrow-arco-rig >/dev/null' EXIT
  agent-bench fila "$bench" rodar -- bash "$root/scripts/proof-arco-rig.sh" "$out" --with-lease
  exit
fi
agent-bench fila > "$out/lease.json"
python - "$out/lease.json" "$bench" <<'PY'
import json, sys
assert any(v['bench'] == sys.argv[2] for v in json.load(open(sys.argv[1]))['vagas']), 'No GPU lease'
PY
# Filesystem-only baseline in tmp; no editing a shared checkout/worktree.
before="$(mktemp -d /tmp/arco-rig-before.XXXXXX)"
pids=()
cleanup() {
  agent-bench-web --bench "$bench" --mission arco-rig-1107 finish > "$out/finish.json" 2>&1 || true
  agent-bench-web --bench "$bench" --mission arco-rig-1107 hygiene > "$out/hygiene-final.json" 2>&1 || true
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  rm -rf "$before"
}
trap cleanup EXIT
# Same story fixture + baseline production implementation for honest A/B.
git archive 02b128f00166b56bfcaa2ef65d2eb8fdc8a7cef8 | tar -x -C "$before"
ln -s "$root/node_modules" "$before/node_modules"
cp src/render/arco-rig.stories.ts "$before/src/render/arco-rig.stories.ts"
# Strict ports: fail rather than silently measuring another process.
node node_modules/storybook/dist/bin/dispatcher.js dev -p 6153 --host 127.0.0.1 --no-open --disable-telemetry --ci --exact-port > "$out/after-preview.log" 2>&1 &
pids+=("$!")
(cd "$before"; exec node "$root/node_modules/storybook/dist/bin/dispatcher.js" dev -p 6154 --host 127.0.0.1 --no-open --disable-telemetry --ci --exact-port) > "$out/before-preview.log" 2>&1 &
pids+=("$!")
python - <<'PY'
import time, urllib.request
end = time.monotonic() + 90
for port in (6153, 6154):
    while True:
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/index.json', timeout=2) as r:
                assert r.status == 200
            break
        except Exception:
            if time.monotonic() > end: raise
            time.sleep(1)
PY
agent-bench cdp "$bench" > "$out/cdp.json"
ARCO_RIG_BENCH="$bench" node scripts/proof-arco-rig.mjs \
  'http://127.0.0.1:6154/iframe.html?id=arena-arco-rig--hold-release&viewMode=story' \
  'http://127.0.0.1:6153/iframe.html?id=arena-arco-rig--hold-release&viewMode=story' "$out"
