import * as THREE from 'three';
import { createDiaryBinding } from './diary-animation.js?v=13';
import { createDiaryPrint } from './diary-print.js?v=5';

const clamp=THREE.MathUtils.clamp;
const mobileLayout=()=>innerWidth<760&&innerHeight>=innerWidth;
const ease=t=>{t=clamp(t,0,1);return t*t*t*(10+t*(-15+6*t));};
const element=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};

// Each shelf book owns its own binding, clip, material and rest transform.
// These are the same solids on the shelf, in flight, and in the reader.
export function createReviewBindings(asset,room,source,covers,textures){
  return covers.map((entry,i)=>{
    const original=source.getObjectByName(['Cube007','Cube008','Cube009'][i]);
    if(!original)throw new Error('Review book is missing from the room');
    room.scene.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(original),size=box.getSize(new THREE.Vector3());
    const rest={position:box.getCenter(new THREE.Vector3()).add(new THREE.Vector3(0,0,-size.z/2)),
      quaternion:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2),
      scale:new THREE.Vector3(size.z/.269,size.y/.410,Math.min(size.x,.065)/.041),size};
    textures[i].colorSpace=THREE.SRGBColorSpace;textures[i].flipY=false;textures[i].anisotropy=4;
    const binding=createDiaryBinding(asset,room,original,{cover:textures[i],action:'books',name:`Review book: ${entry.id}`,rest,closedPaperInset:.075});
    // Reviews open directly to one spread; the diary's extra turning leaves
    // would repeat that same review three times during the opening.
    binding.meshes.filter(mesh=>/^Turning[_ ]leaf/.test(mesh.name)).forEach(mesh=>{mesh.visible=false;});
    binding.id=entry.id;return binding;
  });
}

export function createBookReader({entries,getRoom,onBook,onClose}){
  const root=element('section','review-reader');root.id='book-reader';root.hidden=true;
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Japanese book reviews');
  root.setAttribute('aria-description','Choose a floating book or use Next book. Arrow keys also change books. Escape or clicking outside puts the books back.');
  root.innerHTML=`<svg width="0" height="0" aria-hidden="true" class="diary-contours"><defs>
    <clipPath id="review-left-curve" clipPathUnits="objectBoundingBox"><path d="M .035 .015 C .3 -.003 .78 .001 1 .022 L 1 .98 C .78 .965 .3 1.006 .035 .986 Q .005 .985 .005 .955 L .005 .045 Q .005 .016 .035 .015 Z"/></clipPath>
    <clipPath id="review-right-curve" clipPathUnits="objectBoundingBox"><path d="M 0 .022 C .22 .001 .7 -.003 .965 .015 Q .995 .016 .995 .045 L .995 .955 Q .995 .985 .965 .986 C .7 1.006 .22 .965 0 .98 Z"/></clipPath>
    </defs></svg>`;
  const surface=element('div','review-book-surface'),spread=element('div','review-spread');surface.append(spread);root.append(surface);
  const selectors=entries.map((entry,i)=>{
    const button=element('button','review-floating-cover');button.type='button';button.dataset.bookIndex=i;
    button.setAttribute('aria-label',`Open ${entry.title}`);
    const image=element('img');image.src=entry.image;image.alt='';image.draggable=false;button.append(image);root.append(button);return button;
  });
  const close=element('button','review-close','×');close.type='button';close.setAttribute('aria-label','Put books back');root.append(close);
  const details=element('button','review-details-toggle','表紙・ことば');details.type='button';details.setAttribute('aria-label','Show book cover and vocabulary');root.append(details);
  document.querySelector('#app').append(root);
  let phase='closed',elapsed=0,index=0,reduced=false,clock=0,heldRoom,bindings=[],poses=[],starts=[],opening=[],startOpening=[];
  let prepared,assetsReady=false,layoutKey='',printLayout='',pages=[],textures=[],restoreFocus,token=0,pendingIndex=null;
  let height=600,width=790,centerX=0,centerY=0,distance=1,units=1,gesture,showDetails=false;
  let slots=[],targets=[],queuedOpen=null,pendingClose=false,reflow=null;
  let paths=[],motionClock=0;
  const imageSources=new Map();
  const rotationAxis=new THREE.Vector3(0,0,1);
  const pose=b=>({position:b.rest.position.clone(),quaternion:b.rest.quaternion.clone(),scale:b.rest.scale.clone()});
  function shadow(){const sun=heldRoom?.scene.getObjectByName('Window sunlight');if(sun)sun.shadow.needsUpdate=true;}
  function setPhase(value){phase=value;elapsed=0;root.dataset.phase=value;selectors.forEach(b=>b.disabled=value!=='reading');details.disabled=value!=='reading';if(['flying','switching','returning'].includes(value)&&bindings.length)prepareFlight();}
  function buildPage(entry,side){
    const left=side==='left',page=element('section',`diary-page diary-page--${side} review-page review-page--${side}`);
    page.setAttribute('aria-label',left?'Book cover and new words':'Book review');
    if(left){
      const art=element('figure','diary-photo review-cover-art');art.style.setProperty('--photo-angle','0deg');
      const image=element('img');image.src=entry.image;image.alt=entry.imageAlt;image.draggable=false;art.append(image);page.append(art);
      const words=element('section','review-vocabulary');words.append(element('h3','','新しい言葉'));
      for(const [term,meaning]of entry.glossary||[]){const row=element('div','diary-word');row.append(element('span','',term),element('span','',meaning));words.append(row);}page.append(words);
    }else{
      const header=element('header','review-heading');header.append(element('p','review-date',entry.dateTime.replaceAll('-',' / ')));
      const title=element('h2','review-title',entry.title);title.tabIndex=-1;header.append(title);
      const rating=element('p','review-stars','★'.repeat(entry.rating)+'☆'.repeat(5-entry.rating));rating.setAttribute('aria-label',`${entry.rating} out of 5 stars`);header.append(rating);page.append(header);
      const copy=element('article','review-copy');copy.lang='ja';for(const text of entry.body)copy.append(element('p','',text));page.append(copy);
      const footer=element('nav','review-navigation');footer.setAttribute('aria-label','Review books');
      const previous=element('button','review-previous','←');previous.type='button';previous.dataset.step=-1;previous.setAttribute('aria-label','Previous book');
      const count=element('span','review-count',`${entries.indexOf(entry)+1} / ${entries.length}`);
      const next=element('button','review-next','次の本 →');next.type='button';next.dataset.step=1;next.setAttribute('aria-label','Next book');footer.append(previous,count,next);page.append(footer);
    }
    return page;
  }
  function renderPage(){
    spread.replaceChildren(...pages[index].map(p=>p.cloneNode(true)));root.dataset.book=entries[index].id;
    selectors.forEach((button,i)=>{button.hidden=i===index;button.setAttribute('aria-current',String(i===index));});
  }
  function layout(){
    const mobile=mobileLayout();
    height=mobile?Math.max(320,Math.min(650,innerHeight-205)):Math.min(700,innerHeight-120,(innerWidth-330)/(.53/.403));
    width=mobile?(innerWidth-36)*2:height*(.53/.403);centerX=mobile?18+(showDetails?width/2:0):(innerWidth+210)/2;centerY=mobile?145+height/2:innerHeight/2;
    root.classList.toggle('is-mobile',mobile);root.classList.toggle('has-room',Boolean(getRoom()));
    root.classList.toggle('is-short',innerHeight<525);
    surface.style.cssText=`width:${width}px;height:${height}px;left:${centerX-width/2}px;top:${centerY-height/2}px`;
    root.style.setProperty('--review-font',`${mobile?14.5:clamp(height/38,14,18)}px`);
    const fov=heldRoom?.camera.fov||28;distance=.403/(height/innerHeight*2*Math.tan(THREE.MathUtils.degToRad(fov/2)));
    units=.403/height;
    for(let i=0;i<selectors.length;i++){
      const slot=slots[i],sideHeight=mobile?96:height*.31,sideWidth=sideHeight*.269/.410;
      const x=mobile?innerWidth/2+(slot===0?-sideWidth*.8:sideWidth*.8):(centerX-width/2)/2;
      const y=mobile?64:centerY+(slot===0?-.22:.22)*height;
      selectors[i].style.cssText=`width:${sideWidth+12}px;height:${sideHeight+12}px;left:${x-sideWidth/2-6}px;top:${y-sideHeight/2-6}px`;
    }
  }
  function preparePages(){
    const key=`${innerWidth}:${innerHeight}`;if(key===layoutKey)return;
    layout();pages=entries.map(entry=>{
      spread.replaceChildren(buildPage(entry,'left'),buildPage(entry,'right'));
      const copy=spread.querySelector('.review-copy');let font=parseFloat(getComputedStyle(copy).fontSize);
      while(copy.scrollHeight>copy.clientHeight+1&&font>11.5){font-=.25;copy.style.font=`400 ${font}px/1.85 "Klee One",serif`;}
      if(copy.scrollHeight>copy.clientHeight+1)copy.style.overflowY='auto';
      return [...spread.children].map(p=>p.cloneNode(true));
    });
    layoutKey=key;renderPage();
  }
  function printPages(){
    const room=getRoom();if(!room?.reviewBooks?.length)return;
    bindings=room.reviewBooks;
    textures.forEach(t=>t.dispose());textures=pages.map((page,i)=>{
      spread.replaceChildren(...page.map(p=>p.cloneNode(true)));
      const texture=createDiaryPrint(spread,surface,bindings[i].edges.paper,{tape:false,images:imageSources});bindings[i].appearance(texture);return texture;
    });printLayout=layoutKey;renderPage();
  }
  function destination(i){
    const active=i===index,mobile=mobileLayout(),slot=slots[i];
    const smallScale=mobile?96/height:.31;
    const pixelX=active?centerX:mobile?innerWidth/2+(slot===0?-.8:.8)*(96*.269/.410):(centerX-width/2)/2;
    const pixelY=active?centerY:mobile?64:centerY+(slot===0?-.22:.22)*height;
    const scale=new THREE.Vector3(active?(mobile?width/height/(.53/.403):1):smallScale,active?1:smallScale,active?.65:.6);
    const localRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,active?0:slot===0?.12:-.12,active?0:slot===0?-.07:.06));
    const position=new THREE.Vector3((pixelX-innerWidth/2)*units,(innerHeight/2-pixelY)*units,-distance);
    if(!active)position.sub(new THREE.Vector3(.1345*scale.x,0,0).applyQuaternion(localRotation));
    const camera=heldRoom.camera;camera.updateMatrixWorld(true);position.applyMatrix4(camera.matrixWorld);
    const target={position,quaternion:camera.quaternion.clone().multiply(localRotation),scale};
    if(!reflow)return targets[i]=target;
    const from=reflow.from[i],p=ease(reflow.time/.65);
    return targets[i]={position:from.position.clone().lerp(target.position,p),quaternion:from.quaternion.clone().slerp(target.quaternion,p),scale:from.scale.clone().lerp(target.scale,p)};
  }
  function place(i,p,open){
    poses[i]=p;opening[i]=open;const b=bindings[i];
    // The Blender hinge already contains easing. Traverse its opening segment
    // once rather than compressing it inside another eased clip timeline.
    b.sample(open<=0?0:open>=1?1:.19+.69*open);
    b.place(new THREE.Matrix4().compose(p.position,p.quaternion,p.scale));
  }
  function snapshot(){starts=poses.map(p=>({position:p.position.clone(),quaternion:p.quaternion.clone(),scale:p.scale.clone()}));startOpening=[...opening];}
  function offset(p,z){
    const camera=heldRoom.camera,position=p.position.clone().applyMatrix4(camera.matrixWorldInverse),ratio=(position.z+z)/position.z;
    position.multiplyScalar(ratio).applyMatrix4(camera.matrixWorld);
    // Preserve the apparent size and position while stepping into a depth lane.
    return {...p,position,scale:p.scale.clone().multiplyScalar(ratio)};
  }
  function drift(i,time){
    const angle=time*.85+i*2;
    return new THREE.Vector3(.006*Math.cos(angle),.009*Math.sin(angle),.0025*Math.sin(time*.63+i*1.7)).applyQuaternion(heldRoom.camera.quaternion);
  }
  const sway=(i,time)=>Math.sin(time*.6+i)*.018;
  function hovering(i,p){
    if(!reduced){
      const motion=drift(i,clock),local=motion.clone().applyQuaternion(heldRoom.camera.quaternion.clone().invert()),angle=sway(i,clock);
      p.position.add(motion);p.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(rotationAxis,angle));
      selectors[i].style.transform=`translate(${local.x/units}px,${-local.y/units}px) rotate(${angle}rad)`;
    }else selectors[i].style.removeProperty('transform');
    return p;
  }
  function prepareFlight(){
    motionClock=clock;const camera=heldRoom.camera;camera.updateMatrixWorld(true);
    const project=position=>{const v=position.clone().applyMatrix4(camera.matrixWorldInverse);return new THREE.Vector3(v.x/-v.z,v.y/-v.z,-v.z);};
    paths=bindings.map((book,i)=>{
      const from=starts[i],target=phase==='returning'?book.rest:destination(i),a=project(from.position),d=project(target.position);
      let b,c;
      if(phase==='flying'){
        b=project(from.position.clone().add(new THREE.Vector3(0,0,-1.3-(2-i)*.3)));
        c=d.clone().add(new THREE.Vector3((i-1)*.045,.045*(i%2?1:-1),.35+(2-i)*.12));
      }else if(phase==='returning'){
        b=a.clone().add(new THREE.Vector3((i-1)*.035,.07,.4+(2-i)*.12));
        c=project(target.position.clone().add(new THREE.Vector3(0,0,-1.3-(2-i)*.3)));
      }else if(i===index||startOpening[i]>.5){
        const incoming=i===index,mobile=mobileLayout();
        const lane=incoming?Math.min(.5,distance*.45):-Math.max(.36,distance*.45);
        b=project(offset(from,lane).position);c=project(offset(target,lane).position);
        // A narrow reader pulls the next cover below its waiting neighbor.
        b.y+=incoming&&mobile?-.22:.045;c.y+=incoming&&mobile?-.08:.035;
        if(incoming&&mobile){b.x+=.1;c.x+=.04;}
      }else{b=a.clone().lerp(d,1/3);c=a.clone().lerp(d,2/3);}
      return {from,target,mobile:mobileLayout(),fromDepth:a.z,curve:new THREE.CubicBezierCurve3(a,b,c,d),startWeight:phase==='flying'||startOpening[i]>.5?0:1,endWeight:phase==='returning'||i===index?0:1};
    });
  }
  function follow(i,t,target){
    const path=paths[i],lead=phase==='flying'?(i-1)*.12:phase==='returning'?(1-i)*.12:i===index?-.14:startOpening[i]>.5?.14:0;
    const time=clamp(t+lead*Math.sin(Math.PI*t),0,1);
    // A quick, soft pull with a long deceleration, rather than equal-speed stops
    // at control points. Orientation follows one turn through the whole sweep.
    const p=time*time*(6+time*(-8+3*time)),point=path.curve.getPoint(p);
    const position=new THREE.Vector3(point.x*point.z,point.y*point.z,-point.z).applyMatrix4(heldRoom.camera.matrixWorld);
    const turn=phase==='flying'?ease((p-.12)/.78):ease(p);
    const quaternion=path.from.quaternion.clone().slerp(target.quaternion,turn),scale=path.from.scale.clone().lerp(target.scale,p);
    position.addScaledVector(target.position.clone().sub(path.target.position),p);
    if(phase==='switching'&&i===index){
      const depth=-position.clone().applyMatrix4(heldRoom.camera.matrixWorldInverse).z,targetDepth=-target.position.clone().applyMatrix4(heldRoom.camera.matrixWorldInverse).z;
      const growth=path.mobile?ease((p-.22)/.78):p;
      scale.copy(path.from.scale).divideScalar(path.fromDepth).lerp(target.scale.clone().divideScalar(targetDepth),growth).multiplyScalar(depth);
    }else if(phase==='switching'&&startOpening[i]>.5){
      scale.copy(path.from.scale).lerp(target.scale,ease(p/.85));
    }
    const weight=THREE.MathUtils.lerp(path.startWeight,path.endWeight,p),wave=Math.sin(Math.PI*p)**2;
    position.addScaledVector(drift(i,clock),weight+wave*2).addScaledVector(drift(i,motionClock),-path.startWeight*(1-p));
    const bank=(i===index?.16:slots[i]===0?-.25:.22)*Math.sin(Math.PI*p);
    const flutter=Math.sin(time*7+i*1.8)*wave*.045;
    quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(wave*Math.sin(time*5+i)*.09,flutter,bank+flutter+(weight+wave*2)*sway(i,clock)-path.startWeight*(1-p)*sway(i,motionClock))));
    return {position,quaternion,scale,progress:p};
  }
  function finishClose(notify=true){
    const reopen=queuedOpen;queuedOpen=null;pendingClose=false;reflow=null;
    bindings.forEach(b=>b.restore());shadow();heldRoom?.holdView(false);heldRoom=null;root.hidden=true;root.style.setProperty('--review-presence','0');setPhase('closed');
    if(reopen){void reader.open(reopen.route,reopen.reducedMotion);}
    else if(notify){onClose();restoreFocus?.focus({preventScroll:true});}
  }
  function select(target,notify=true){
    target=(target+entries.length)%entries.length;
    if(phase!=='reading'){pendingIndex=target;return;}
    if(target===index)return;
    snapshot();reflow=null;slots[index]=slots[target];slots[target]=-1;index=target;showDetails=false;details.textContent='表紙・ことば';details.setAttribute('aria-label','Show book cover and vocabulary');renderPage();layout();if(notify)onBook(entries[index]);
    root.style.setProperty('--review-presence','0');setPhase('switching');
    if(reduced||!bindings.length){settle();}
  }
  function settle(){
    bindings.forEach((_,i)=>place(i,i===index?destination(i):hovering(i,destination(i)),i===index?1:0));shadow();
    root.style.setProperty('--review-presence',reflow?'0':'1');setPhase('reading');spread.querySelector('.review-title').focus({preventScroll:true});
  }
  const reader={
    get isOpen(){return phase!=='closed';},
    async prepare(){
      prepared ||= Promise.all([document.fonts.load('16px "Klee One"'),...['assets/diary/paper-fiber.jpg',...entries.map(e=>e.image)].map(src=>{const image=new Image();image.src=src;imageSources.set(src,image);return image.decode();})]).then(()=>{assetsReady=true;}).catch(e=>{prepared=null;throw e;});
      await prepared;if(phase!=='closed')return;
      root.style.visibility='hidden';root.style.display='block';
      try{preparePages();printPages();}finally{root.style.removeProperty('display');root.style.removeProperty('visibility');}
    },
    async open(route,reducedMotion){
      pendingClose=false;
      reduced=reducedMotion;const target=Math.max(0,entries.findIndex(e=>e.id===route?.entryId));
      if(phase==='returning'){queuedOpen={route,reducedMotion};return;}
      if(phase!=='closed'){select(target);return;}
      const current=++token;restoreFocus=document.activeElement;root.hidden=false;root.style.setProperty('--review-presence','0');setPhase('loading');
      heldRoom=getRoom();heldRoom?.holdView(true);heldRoom?.highlight(null);
      if(!assetsReady)await (prepared||reader.prepare());if(current!==token)return;
      index=target;slots=entries.map((_,i)=>i===index?-1:i<index?i:i-1);showDetails=false;details.textContent='表紙・ことば';details.setAttribute('aria-label','Show book cover and vocabulary');preparePages();renderPage();layout();
      if(heldRoom?.reviewBooks?.length){bindings=heldRoom.reviewBooks;if(!textures.length||printLayout!==layoutKey)printPages();poses=bindings.map(pose);opening=bindings.map(()=>0);bindings.forEach(b=>b.restore());snapshot();}
      else bindings=[];
      onBook(entries[index]);setPhase('flying');
      if(reduced||!bindings.length)settle();
    },
    close(immediate=false){
      if(immediate){queuedOpen=null;pendingClose=false;}
      if(phase==='closed'||phase==='returning'&&!immediate)return;
      if(!immediate&&!reduced&&['flying','switching'].includes(phase)){pendingClose=true;return;}
      token++;pendingIndex=null;gesture=null;
      if(immediate||reduced||phase==='loading'||!bindings.length){finishClose();return;}
      snapshot();root.style.setProperty('--review-presence','0');setPhase('returning');
    },
    update(dt,reducedMotion){
      reduced=reducedMotion;if(phase==='closed'||phase==='loading')return;
      const step=Math.min(dt,.05);elapsed+=step;if(!reduced)clock+=step;
      if(reflow)reflow.time=reduced?.65:Math.min(.65,reflow.time+step);
      if(phase==='reading'){
        bindings.forEach((b,i)=>{if(i===index&&!reflow)return;place(i,i===index?destination(i):hovering(i,destination(i)),i===index?1:0);});
        if(reflow?.time>=.65){reflow=null;root.style.setProperty('--review-presence','1');}
        if(pendingIndex!==null){const target=pendingIndex;pendingIndex=null;select(target);}return;
      }
      const returning=phase==='returning',flying=phase==='flying',duration=flying?2.15:returning?1.95:1.6,t=reduced?1:clamp(elapsed/duration,0,1);
      bindings.forEach((b,i)=>{
        const target=returning?b.rest:destination(i);
        const flight=follow(i,t,target),p=flight.progress;
        const open=returning?startOpening[i]*(1-clamp(p/.4,0,1)):i===index?clamp((p-.35)/.6,0,1):startOpening[i]*(1-clamp(p/.4,0,1));
        place(i,flight,open);
      });shadow();
      const end=duration,done=reduced||elapsed>=end;
      if(reflow?.time>=.65)reflow=null;
      if(!returning)root.style.setProperty('--review-presence',reflow?'0':String(ease((elapsed-end+.12)/.12)));
      if(done){if(returning)finishClose();else{settle();if(pendingClose){pendingClose=false;reader.close();}}}
    },
    resize(){
      layoutKey='';if(phase==='closed'||phase==='loading')return;
      const from=targets.map(p=>({position:p.position.clone(),quaternion:p.quaternion.clone(),scale:p.scale.clone()}));preparePages();printPages();
      if(from.length&&phase!=='returning'){reflow={from,time:0};root.style.setProperty('--review-presence','0');}
    },
  };
  root.addEventListener('click',e=>{
    if(e.target===details){showDetails=!showDetails;details.textContent=showDetails?'レビュー':'表紙・ことば';details.setAttribute('aria-label',showDetails?'Show book review':'Show book cover and vocabulary');layout();if(phase==='reading')settle();return;}
    const selection=e.target.closest('[data-book-index]'),next=e.target.closest('[data-step]');
    if(selection){select(Number(selection.dataset.bookIndex));return;}
    if(next){select(index+Number(next.dataset.step));return;}
    if(e.target===close||!e.target.closest('.review-book-surface'))reader.close();
  });
  surface.addEventListener('pointerdown',e=>{if(phase==='reading'&&e.button===0&&!e.target.closest('button'))gesture={id:e.pointerId,x:e.clientX,y:e.clientY};});
  surface.addEventListener('pointerup',e=>{if(!gesture||e.pointerId!==gesture.id)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;gesture=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4)select(index+(dx<0?1:-1));});
  surface.addEventListener('pointercancel',()=>{gesture=null;});
  root.addEventListener('keydown',e=>{
    if(!e.altKey&&!e.metaKey&&!e.ctrlKey&&['ArrowRight','ArrowLeft','a','A','d','D'].includes(e.key)){e.preventDefault();select(index+(['ArrowRight','d','D'].includes(e.key)?1:-1));}
    if(e.key==='Tab'){
      const controls=[...root.querySelectorAll('button:not(:disabled):not([hidden])')].filter(b=>b.getClientRects().length),first=controls[0],last=controls.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  return reader;
}
