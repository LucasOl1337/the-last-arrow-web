export interface KeyLayout {
  id: string; name: string; mouse: boolean;
  left: string[]; right: string[]; up: string[]; down: string[];
  jump: string[]; shoot: string[]; dash: string[]; crouch: string[];
  summary: string;
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
export function readLayout(): KeyLayout {try{return layoutById(localStorage.getItem(CONTROL_STORAGE));}catch{return CONTROL_LAYOUTS[0];}}
export function saveLayout(id: string) {const layout=layoutById(id);try{localStorage.setItem(CONTROL_STORAGE,layout.id);}catch{}window.dispatchEvent(new CustomEvent('tla-layout-change',{detail:layout.id}));return layout;}
export function layoutKeys(layout: KeyLayout) {return [...layout.left,...layout.right,...layout.up,...layout.down,...layout.jump,...layout.shoot,...layout.dash,...layout.crouch];}
export function layoutHint(layout: KeyLayout) {return layout.summary+(layout.mouse?' · Mouse mira · Segure/solte clique esquerdo':'');}
