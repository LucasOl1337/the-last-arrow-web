export interface KeyLayout {
  id: string; name: string; mouse: boolean;
  left: string[]; right: string[]; up: string[]; down: string[];
  jump: string[]; shoot: string[]; dash: string[]; crouch: string[];
  summary: string;
  pause?: string[];
  camera?: string[];
  mute?: string[];
  customized?: boolean;
}
export const CONTROL_LAYOUTS: readonly KeyLayout[] = [
  {id:'mouse-space',name:'Plataforma + mouse',mouse:true,left:['KeyA'],right:['KeyD'],up:[],down:['KeyS'],jump:['KeyW'],shoot:[],dash:['Space'],crouch:['KeyS'],summary:'A/D mover · W pular · S agachar · Espaço esquiva'},
  {id:'mouse-q',name:'Atirador + mouse',mouse:true,left:['KeyA'],right:['KeyD'],up:['KeyW'],down:['KeyS'],jump:['Space'],shoot:[],dash:['KeyQ'],crouch:['KeyS'],summary:'A/D mover · Espaço pular · S agachar · Q esquiva · W direção para cima'},
  {id:'mouse-r',name:'MOBA + mouse',mouse:true,left:['KeyA'],right:['KeyD'],up:[],down:['KeyS'],jump:['KeyW'],shoot:[],dash:['KeyR'],crouch:['KeyS'],summary:'A/D mover · W pular · S agachar · R esquiva'},
  {id:'mouse-h',name:'Alternativo · habilidade H',mouse:true,left:['KeyA'],right:['KeyD'],up:[],down:['KeyS'],jump:['KeyW'],shoot:[],dash:['KeyH'],crouch:['KeyS'],summary:'A/D mover · W pular · S agachar · H esquiva'},
  {id:'classic',name:'Clássico · só teclado',mouse:false,left:['KeyA'],right:['KeyD'],up:['KeyW'],down:['KeyS'],jump:['KeyK','Space'],shoot:['KeyJ'],dash:['KeyL'],crouch:[],summary:'WASD mover/mirar · K/Espaço pular · J atirar · L esquiva'},
];
export const LOCAL_P2: KeyLayout={id:'p2',name:'P2 local',mouse:false,left:['ArrowLeft'],right:['ArrowRight'],up:['ArrowUp'],down:['ArrowDown'],jump:['Numpad2','Period'],shoot:['Numpad1','Comma'],dash:['Numpad3','Slash'],crouch:[],summary:'Setas mover/mirar · Numpad 1/2/3 ou vírgula/ponto/barra'};
export const CONTROL_STORAGE='tla-control-layout-v1';
export function layoutById(id: string | null | undefined): KeyLayout { return CONTROL_LAYOUTS.find(p=>p.id===id)??CONTROL_LAYOUTS[0]; }
export const BINDING_STORAGE = 'tla-control-bindings-v1';
export const ACTIONS = [
  ['left','Ir à esquerda'], ['right','Ir à direita'], ['up','Mirar para cima'], ['down','Mirar para baixo / cair'],
  ['jump','Pular'], ['shoot','Atirar'], ['dash','Habilidade / esquiva'], ['crouch','Agachar'], ['pause','Pausar / menu'], ['camera','Alternar câmera'], ['mute','Ligar / desligar som'],
] as const;
export type BindingAction = typeof ACTIONS[number][0];
export function bindingLabel(code: string) {
  const labels: Record<string,string> = {Space:'Espaço',Escape:'Esc',Mouse0:'Mouse esquerdo',Mouse1:'Mouse central',Mouse2:'Mouse direito',Mouse3:'Mouse lateral 1',Mouse4:'Mouse lateral 2',ShiftLeft:'Shift esq.',ShiftRight:'Shift dir.',ControlLeft:'Ctrl esq.',ControlRight:'Ctrl dir.',AltLeft:'Alt esq.',AltRight:'Alt dir.',ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓'};
  return labels[code] ?? code.replace(/^Key|^Digit/,'');
}
export function bindingConflict(layout: KeyLayout, action: BindingAction, code: string): string | null {
  if (!/^(Key[A-Z]|Digit[0-9]|Numpad\w+|F[1-9][0-9]?|Mouse[0-4]|Space|Enter|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Arrow\w+|ShiftLeft|ShiftRight|ControlLeft|ControlRight|AltLeft|AltRight|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote|Escape)$/.test(code)) return 'Tecla não suportada. Escolha outra.';
  if (code === 'Escape') return action === 'pause' ? null : 'Esc fica reservado para cancelar e abrir o menu.';
  if (layoutKeys(LOCAL_P2).includes(code)) return `${bindingLabel(code)} pertence ao P2 local. Escolha outro vínculo.`;
  const other = ACTIONS.find(([key]) => key !== action && (layout[key] ?? []).includes(code) && !([key,action].every(k=>k==='down'||k==='crouch')));
  return other ? `${bindingLabel(code)} já está em «${other[1]}». Escolha outro vínculo.` : null;
}
function effectiveLayout(id: string | null): KeyLayout {
  const preset=layoutById(id);
  const layout: KeyLayout={...preset,pause:['Escape']};
  const defaults: Partial<Record<BindingAction,string[]>>={pause:['Escape'],camera:['KeyC'],mute:['KeyM']};
  for(const [action] of ACTIONS) layout[action]=[...(preset[action]??defaults[action]??[])];
  // Old presets encode mouse shooting outside shoot[]. Keep it explicit in the effective bindings.
  if(preset.mouse && !preset.shoot.length) layout.shoot=['Mouse0'];
  return layout;
}
export function readLayout(): KeyLayout {
  let id: string|null=null;try{id=localStorage.getItem(CONTROL_STORAGE);}catch{}
  const layout=effectiveLayout(id);
  try {
    const saved=JSON.parse(localStorage.getItem(BINDING_STORAGE)??'{}')[layout.id];
    if(saved && typeof saved==='object') {
      // Overrides are written together: validate the final assignment, not against old preset slots.
      const candidate={...layout};
      for(const [action] of ACTIONS) if(Array.isArray(saved[action])&&saved[action].length<=2&&saved[action].every((k:unknown)=>typeof k==='string')) candidate[action]=saved[action];
      if(ACTIONS.every(([action])=>(candidate[action]??[]).every(code=>!bindingConflict(candidate,action,code)))) {Object.assign(layout,candidate);layout.customized=true;}
    }
  } catch{}
  return layout;
}
function announce() {window.dispatchEvent(new CustomEvent('tla-layout-change'));return readLayout();}
export function saveLayout(id: string) {try{localStorage.setItem(CONTROL_STORAGE,layoutById(id).id);}catch{}return announce();}
export function saveBinding(action: BindingAction, code: string): string | null {
  const layout=readLayout(), conflict=bindingConflict(layout,action,code);if(conflict)return conflict;
  layout[action]=[code];
  try {
    const all=JSON.parse(localStorage.getItem(BINDING_STORAGE)??'{}');
    all[layout.id]=Object.fromEntries(ACTIONS.map(([key])=>[key,layout[key]]));
    localStorage.setItem(BINDING_STORAGE,JSON.stringify(all));
  } catch {return 'Não foi possível salvar neste navegador. Libere o armazenamento e tente novamente.';}
  announce();return null;
}
export function restoreLayout() {
  try {const all=JSON.parse(localStorage.getItem(BINDING_STORAGE)??'{}');delete all[readLayout().id];localStorage.setItem(BINDING_STORAGE,JSON.stringify(all));}
  catch {return 'Não foi possível restaurar neste navegador.';}
  announce();return null;
}
export function layoutKeys(layout: KeyLayout) {return [...layout.left,...layout.right,...layout.up,...layout.down,...layout.jump,...layout.shoot,...layout.dash,...layout.crouch,...(layout.pause??[]),...(layout.camera??[]),...(layout.mute??[])];}
export function layoutHint(layout: KeyLayout) {return (layout.customized ? `Personalizado · ${['left','right','jump','shoot','dash'].map(action=>(layout[action as BindingAction]??[]).map(bindingLabel).join('/')).join(' · ')}` : layout.summary)+(layout.mouse?' · Mouse mira':'');}
