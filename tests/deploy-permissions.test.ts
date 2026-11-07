import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('publish normalizes only public dist files before tar, including an agent umask077 build', () => {
  const script = readFileSync(new URL('../deploy/publish.sh', import.meta.url), 'utf8');
  const dirs = 'find dist -type d -exec chmod 755 {} +';
  const files = 'find dist -type f -exec chmod 644 {} +';
  assert.ok(script.includes(dirs) && script.includes(files));
  assert.ok(script.indexOf(files) < script.indexOf('tar -czf'));
  const root = mkdtempSync(join(tmpdir(), 'arrow-permissions-'));
  try {
    mkdirSync(join(root,'dist/assets'),{recursive:true,mode:0o700});
    writeFileSync(join(root,'dist/index.html'),'public',{mode:0o600});
    writeFileSync(join(root,'dist/assets/app.js'),'public',{mode:0o600});
    writeFileSync(join(root,'private.txt'),'private',{mode:0o600});
    execFileSync('bash',['-euc',`${dirs}\n${files}`],{cwd:root});
    assert.equal(statSync(join(root,'dist')).mode & 0o777,0o755);
    assert.equal(statSync(join(root,'dist/assets')).mode & 0o777,0o755);
    assert.equal(statSync(join(root,'dist/index.html')).mode & 0o777,0o644);
    assert.equal(statSync(join(root,'dist/assets/app.js')).mode & 0o777,0o644);
    assert.equal(statSync(join(root,'private.txt')).mode & 0o777,0o600);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
