// Apply the actual siTela measurement/judgment contract using this mission's isolated browser.
// checa_tela.py launches its own default browser: here only transport is replaced to respect the brief.
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const source = await readFile(`${process.env.HOME}/.agents/skills/sitela/scripts/checa_tela.py`, 'utf8');
const measurement = source.match(/MEDIR_JS = r"""([\s\S]*?)"""/)[1];
export async function checkScreen(page, principal) {
  const measures = await page.evaluate(`(${measurement})(${JSON.stringify([principal, null, 140])})`);
  const size = page.viewportSize(); measures.largura = size.width;
  measures.rolagens_ate_principal = measures.principal_topo < size.height * 0.85 ? 0 : Math.ceil((measures.principal_topo - size.height * 0.85 + 1) / size.height);
  const result = spawnSync('/usr/bin/python', ['-c', `import runpy,json,sys,os; m=runpy.run_path(os.path.expanduser('~/.agents/skills/sitela/scripts/checa_tela.py')); print(json.dumps(m['julgar'](json.loads(sys.argv[1]),int(sys.argv[2]))))`, JSON.stringify(measures), String(size.height)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return { medidas: measures, falhas: JSON.parse(result.stdout), passou: JSON.parse(result.stdout).length === 0 };
}
