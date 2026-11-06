import { CONTROL_LAYOUTS, layoutHint, readLayout, saveLayout } from './control-layouts.ts';
/** Production settings, reused by the menu and Storybook. No extra configuration screen. */
export function controlSettings() {
  const root=document.createElement('div');root.className='control-settings';
  const label=document.createElement('label');label.textContent='Layout de controles';
  const select=document.createElement('select');select.setAttribute('aria-label','Layout de controles');
  for(const p of CONTROL_LAYOUTS){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;select.append(option);}
  select.value=readLayout().id;label.append(select);
  const summary=document.createElement('p');summary.className='layout-summary';summary.setAttribute('role','status');
  const note=document.createElement('p');note.className='layout-note';note.textContent='Habilidade = esquiva que pega flechas. Escolha salva neste navegador. Mouse controla só seu arqueiro.';
  const update=()=>{summary.textContent=layoutHint(readLayout());};
  select.onchange=()=>{saveLayout(select.value);update();};update();root.append(label,summary,note);return root;
}
