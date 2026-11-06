export class OnlinePanel {
  readonly element = document.createElement('section');
  private status = document.createElement('p');
  private input = document.createElement('input');
  private invite = document.createElement('input');
  private copy = document.createElement('button');
  constructor(actions: {create:()=>void;join:(room:string)=>void;back:()=>void}, code = '') {
    this.element.className='menu-layer';this.element.hidden=true;
    const panel=document.createElement('div');panel.className='overlay-panel online-panel';panel.setAttribute('aria-label','Jogar online');
    const title=document.createElement('h2');title.textContent='Duelo online';
    const hint=document.createElement('p');hint.textContent='Dois jogadores, cada um no seu aparelho. Crie uma sala e envie o convite.';
    this.status.setAttribute('role','status');
    const field=document.createElement('label');field.textContent='Código da sala';this.input.maxLength=8;this.input.autocomplete='off';this.input.value=code;this.input.placeholder='Ex.: 12AB34CD';field.append(this.input);
    const make=(text:string,fn:()=>void)=>{const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=text;b.onclick=fn;return b;};
    const create=make('Criar sala',actions.create);create.className='primary';
    const join=make('Entrar na sala',()=>actions.join(this.input.value.trim().toUpperCase()));
    this.invite.readOnly=true;this.invite.setAttribute('aria-label','Link do convite');this.invite.hidden=true;
    this.copy=make('Copiar convite',()=>{void navigator.clipboard.writeText(this.invite.value).then(()=>this.status.textContent='Convite copiado. Envie para seu amigo.').catch(()=>{this.invite.select();this.status.textContent='Selecione e copie o link acima.';});});this.copy.hidden=true;
    panel.append(title,hint,create,field,join,this.status,this.invite,this.copy,make('Voltar ao menu',actions.back));this.element.append(panel);
  }
  show(message='') {this.element.hidden=false;this.status.textContent=message;}
  hide() {this.element.hidden=true;}
  waiting(room:string) {
    const url=new URL(location.href);url.search='';url.searchParams.set('room',room);
    this.input.value=room;this.invite.value=url.href;this.invite.hidden=false;this.copy.hidden=false;
    this.show('Sala '+room+' · esperando o outro jogador.');
  }
  reset() {this.invite.hidden=true;this.copy.hidden=true;}
}
