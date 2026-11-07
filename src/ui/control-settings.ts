import { ACTIONS, CONTROL_LAYOUTS, bindingLabel, readLayout, restoreLayout, saveBinding, saveLayout } from './control-layouts.ts';
import type { BindingAction } from './control-layouts.ts';
/** The production editor is also the Storybook surface. Changes apply one binding at a time. */
export function controlSettings() {
  const root=document.createElement('div');root.className='control-settings';
  const toolbar=document.createElement('div');toolbar.className='binding-toolbar';
  const label=document.createElement('label');label.textContent='Preset do P1';
  const select=document.createElement('select');select.setAttribute('aria-label','Layout de controles');
  for(const p of CONTROL_LAYOUTS){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;select.append(option);}
  label.append(select);
  const restore=document.createElement('button');restore.type='button';restore.className='secondary';restore.textContent='Restaurar preset';
  toolbar.append(label,restore);
  const note=document.createElement('p');note.className='layout-note';note.textContent='Clique numa ação e pressione uma tecla ou botão do mouse. Esc cancela.';
  const table=document.createElement('div');table.className='binding-table';table.setAttribute('aria-label','Ações do jogador 1');
  const status=document.createElement('p');status.className='binding-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary binding-cancel';cancel.textContent='Cancelar alteração';cancel.hidden=true;
  let capturing: BindingAction|null=null;
  let suppressClick: number|null=null;
  const buttons=new Map<BindingAction,HTMLButtonElement>();
  const paint=()=>{
    const layout=readLayout();select.value=layout.id;
    for(const [action,title] of ACTIONS){const button=buttons.get(action)!;const value=(layout[action]??[]).map(bindingLabel).join(' / ')||'Não atribuído';button.textContent=capturing===action?'Pressione…':value;button.setAttribute('aria-label',`${title}: ${value}`);button.setAttribute('aria-pressed',String(capturing===action));}
    root.classList.toggle('is-capturing',!!capturing);cancel.hidden=!capturing;
    root.dataset.customized=String(!!layout.customized);
  };
  const stop=(message?:string)=>{capturing=null;paint();status.classList.remove('is-error');status.textContent=message??(readLayout().customized?'Personalizado · salvo neste navegador.':'Preset ativo · salvo neste navegador.');};
  for(const [action,title] of ACTIONS){
    const row=document.createElement('div');row.className='binding-row';
    const name=document.createElement('span');name.textContent=title;
    const button=document.createElement('button');button.type='button';button.className='binding-key';button.dataset.action=action;
    button.onclick=()=>{capturing=action;paint();status.classList.remove('is-error');status.textContent=`Novo vínculo para ${title}. Esc ou Cancelar mantém o anterior.`;};
    buttons.set(action,button);row.append(name,button);table.append(row);
  }
  const assign=(code:string)=>{
    if(!capturing)return;
    const action=capturing,error=saveBinding(action,code);
    if(error){status.classList.add('is-error');status.textContent=error;return;}
    stop(`${ACTIONS.find(([key])=>key===action)![1]}: ${bindingLabel(code)} · salvo.`);buttons.get(action)?.focus();
  };
  root.addEventListener('keydown',event=>{
    if(!capturing)return;
    event.stopImmediatePropagation();
    if(event.code==='Tab'){stop('Alteração cancelada. Vínculo anterior mantido.');return;}
    event.preventDefault();if(event.repeat)return;
    if(event.code==='Escape'){const previous=capturing;stop('Alteração cancelada. Vínculo anterior mantido.');buttons.get(previous)?.focus();return;}
    assign(event.code);
  },true);
  root.addEventListener('pointerdown',event=>{
    if(!capturing||event.pointerType!=='mouse'||event.target===cancel)return;
    event.preventDefault();event.stopImmediatePropagation();suppressClick=event.button;assign(`Mouse${event.button}`);
  },true);
  const consumeClick=(event:MouseEvent)=>{const button=suppressClick;suppressClick=null;if(button===event.button){event.preventDefault();event.stopImmediatePropagation();}};
  root.addEventListener('click',consumeClick,true);
  root.addEventListener('auxclick',consumeClick,true);
  root.addEventListener('contextmenu',event=>event.preventDefault());
  root.addEventListener('focusout',event=>{if(capturing&&!root.contains(event.relatedTarget as Node))stop('Alteração cancelada. Vínculo anterior mantido.');});
  cancel.onclick=()=>stop('Alteração cancelada. Vínculo anterior mantido.');
  select.onchange=()=>{saveLayout(select.value);stop();};
  restore.onclick=()=>{const error=restoreLayout();stop(error??'Preset restaurado. Controles do P2 preservados.');};
  const aim=document.createElement('p');aim.className='layout-note';aim.textContent='Mira: ponteiro nos presets com mouse; direções no clássico. Esc sempre abre o menu.';
  root.append(toolbar,note,table,status,cancel,aim);stop();return root;
}
