import * as THREE from 'three';
import { createDiaryPrint } from './diary-print.js?v=5';

const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(10+t*(-15+6*t));};
const node = (tag, className, text) => {
  const e = document.createElement(tag); if (className) e.className = className;
  if (text !== undefined) e.textContent = text; return e;
};

export function createDiaryReader({ categories, getRoom, onPage, onClose }) {
  const entries = categories.flatMap(category => (category.entries || []).map(entry => ({entry, category})))
    .sort((a,b)=>(a.entry.dateTime||'').localeCompare(b.entry.dateTime||''));
  const pages = [{entry:null}, ...entries];
  const root = node('section', 'diary-reader'); root.id = 'diary-reader'; root.hidden = true;
  root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true'); root.setAttribute('aria-label','Japanese diary');
  root.setAttribute('aria-description','Turn pages with arrow keys, A and D, or a horizontal drag. Press Escape or click outside the book to put it back.');
  root.innerHTML = `
    <svg width="0" height="0" aria-hidden="true" class="diary-contours"><defs>
      <clipPath id="diary-left-curve" clipPathUnits="objectBoundingBox"><path d="M .035 .015 C .3 -.003 .78 .001 1 .022 L 1 .98 C .78 .965 .3 1.006 .035 .986 Q .005 .985 .005 .955 L .005 .045 Q .005 .016 .035 .015 Z"/></clipPath>
      <clipPath id="diary-right-curve" clipPathUnits="objectBoundingBox"><path d="M 0 .022 C .22 .001 .7 -.003 .965 .015 Q .995 .016 .995 .045 L .995 .955 Q .995 .985 .965 .986 C .7 1.006 .22 .965 0 .98 Z"/></clipPath>
    </defs></svg>
    <div class="diary-surround"><div class="diary-presentation"><div class="diary-viewport"><div class="diary-book">
      <div class="diary-spread"></div><div class="diary-turn" aria-hidden="true" hidden></div>
    </div></div></div><button type="button" class="diary-photo-toggle" aria-label="Show diary photographs">写真</button></div>`;
  document.querySelector('#app').append(root);
  const book = root.querySelector('.diary-book'), spread = root.querySelector('.diary-spread');
  const sheet = root.querySelector('.diary-turn'), photoToggle = root.querySelector('.diary-photo-toggle'); sheet.inert = true;
  let phase='closed', elapsed=0, index=0, reduced=false, turning=false, openToken=0, ready=false;
  let lift, originalPose, rig, motion, printTexture, heldRoom, distance=1, restoreFocus, flipAnimation, gesture;
  let preparation, assetsReady=false, pageLayout='';
  let flightProgress=0, returnStart=1, rigWidthScale=1, flightOffset=0, lastPlacement;
  function setPhase(value) {
    phase=value; elapsed=0; root.dataset.phase=value;
    if(value==='reading')book.style.removeProperty('transform');
  }
  function setOpening(amount) {
    root.style.setProperty('--diary-open',String(amount));
  }

  function refreshShadow() { const light=(getRoom()||heldRoom)?.scene.getObjectByName('Window sunlight'); if(light) light.shadow.needsUpdate=true; }
  function layout() {
    const mobile=innerWidth<=700;
    const height=Math.max(280,mobile?Math.min(720,innerHeight-80):Math.min(760,innerHeight-90,(innerWidth-100)/1.45));
    const width=mobile?(innerWidth-28)*2:height*1.45;
    book.style.height=`${height}px`; book.style.width=`${width}px`;
    root.style.setProperty('--diary-height',`${height}px`);
    root.style.setProperty('--diary-font-size',`${mobile?14:THREE.MathUtils.clamp(height/43,14,18)}px`);
    const fov=getRoom()?.camera.fov||28;
    root.style.setProperty('--diary-perspective',`${innerHeight/(2*Math.tan(THREE.MathUtils.degToRad(fov/2)))}px`);
    distance=.403/(height/innerHeight*2*Math.tan(THREE.MathUtils.degToRad(fov/2)));
    rigWidthScale=width/(height*(.53/.403));
    if(motion&&originalPose)fly(flightProgress);
  }
  function prepareLift() {
    const room=getRoom(); if(!room?.diaryBinding)return;
    heldRoom=room;room.holdView(true);room.highlight(null);
    motion=room.diaryBinding;rig=lift=motion.object;originalPose=motion.rest;
    motion.restore();lastPlacement=null;
  }
  function preparePrint() {
    const previous=printTexture;printTexture=createDiaryPrint(spread,book,motion?.edges.paper);motion?.appearance(printTexture);previous?.dispose();
  }
  function bookOffset() {
    if(innerWidth>700)return 0;
    const rect=book.getBoundingClientRect();
    return (rect.left+rect.width/2-innerWidth/2)*.403/rect.height;
  }
  function makeRig() {
    if(!motion)return;
    preparePrint();flightOffset=innerWidth<=700?-.1325*rigWidthScale:0;
  }
  function fly(progress) {
    flightProgress=progress;
    const room=getRoom();if(!lift||!room||!motion)return;
    const state=motion.sample(progress),p=state.progress,arrival=ease((progress-.93)/.07);
    root.style.setProperty('--diary-presence',String(arrival));setOpening(rig.userData.frontAngle/Math.PI);
    room.camera.updateMatrixWorld(true);
    const start=originalPose.position,startScale=originalPose.scale;
    const target=new THREE.Vector3(phase==='reading'?bookOffset():flightOffset,0,-distance).applyMatrix4(room.camera.matrixWorld);
    const position=new THREE.Vector3().lerpVectors(start,target,p);position.y+=state.arc;
    const rotation=new THREE.Quaternion().slerpQuaternions(originalPose.quaternion,room.camera.quaternion,state.rotation).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-state.bank));
    const scale=new THREE.Vector3().lerpVectors(startScale,new THREE.Vector3(rigWidthScale,1,1),p);
    const placement=new THREE.Matrix4().compose(position,rotation,scale);
    if(!lastPlacement||!placement.equals(lastPlacement)){motion.place(placement);lastPlacement=placement;refreshShadow();}
  }
  function restoreOriginal() {
    motion?.restore();lift=null;originalPose=null;
    heldRoom?.holdView(false);refreshShadow();heldRoom=null;
  }
  function createPage(page,side,pageIndex) {
    const left=side==='left', el=node('section',`diary-page diary-page--${side}`);el.setAttribute('aria-label',left?'Diary photographs and vocabulary':'Diary writing');
    if(left&&page.entry){
      const contents=node('button','diary-contents','目次');contents.type='button';contents.dataset.diaryPage=0;contents.setAttribute('aria-label','Diary contents');el.append(contents);
      const album=node('div','diary-album');
      const media=page.entry.media||[];
      for(const [i,item]of media.slice(0,2).entries()){
        const figure=node('figure','diary-photo');figure.style.setProperty('--photo-angle',`${i?2.1:-2.5}deg`);
        const image=node('img');image.src=item.src;image.alt=item.label||page.entry?.title||'Diary photograph';image.draggable=false;
        figure.append(image);if(item.caption)figure.append(node('figcaption','',item.caption));album.append(figure);
      }
      el.append(album);
      if(page.entry?.glossary?.length){const words=node('section','diary-vocabulary');words.append(node('h3','','新しい言葉'));
        for(const [term,meaning]of page.entry.glossary){const line=node('div','diary-word');line.append(node('span','',term),node('span','',meaning));words.append(line);}el.append(words);
      }
    }else if(!left){
      const heading=node('header','diary-heading'), title=node('h2','diary-title',page.entry?.title||'目次');title.tabIndex=-1;
      heading.append(node('p','diary-date',page.entry?.date||'2026'),title);
      const copy=node('article','diary-copy');copy.lang='ja';
      if(page.entry){for(const text of Array.isArray(page.entry.body)?page.entry.body:[page.entry.body])copy.append(node('p','',text));}
      else for(const [i,{entry}]of entries.entries()){
        const button=node('button','diary-toc-entry');button.type='button';button.dataset.diaryPage=i+1;button.setAttribute('aria-label',entry.title);
        button.append(node('span','diary-toc-title',entry.title),node('time','diary-toc-date',entry.date),node('span','diary-toc-number',String(i*2+3).padStart(2,'0')));copy.append(button);
      }
      el.append(heading,copy);
      const nav=node('nav','diary-page-controls');nav.setAttribute('aria-label','Diary pages');
      const previous=node('button','diary-previous','←');previous.type='button';previous.dataset.diaryPage=pageIndex-1;previous.setAttribute('aria-label','Previous diary page');previous.disabled=pageIndex===0;
      const next=node('button','diary-next','→');next.type='button';next.dataset.diaryPage=pageIndex+1;next.setAttribute('aria-label','Next diary page');next.disabled=pageIndex===pages.length-1;
      nav.append(previous,next);el.append(nav);
    }
    el.append(node('span',`diary-page-number diary-${side}-number`,String(pageIndex*2+(left?1:2)).padStart(2,'0')));return el;
  }
  function fitPage() {
    const copy=spread.querySelector('.diary-copy'), words=spread.querySelector('.diary-vocabulary');
    let size=parseFloat(getComputedStyle(copy).fontSize);
    while(copy.scrollHeight>copy.clientHeight+1&&size>10){size-=.25;copy.style.fontSize=`${size}px`;}
    if(words){let size=parseFloat(getComputedStyle(words).fontSize);while(words.scrollHeight>words.clientHeight+1&&size>8){size-=.25;words.style.fontSize=`${size}px`;}}
  }
  function preparePages() {
    for(const [i,page]of pages.entries()){
      spread.replaceChildren(createPage(page,'left',i),createPage(page,'right',i));fitPage();
      const album=spread.querySelector('.diary-album');
      if(page.entry?.media?.length>2&&(page.entry.glossary?.length||0)<=8&&album.clientHeight>=240){
        const extra=node('figure','diary-photo'),image=node('img'),item=page.entry.media[2];
        extra.style.setProperty('--photo-angle','-1.4deg');image.src=item.src;image.alt=item.label||page.entry.title;image.draggable=false;
        extra.append(image);if(item.caption)extra.append(node('figcaption','',item.caption));
        album.style.setProperty('--album-height',`${album.clientHeight}px`);
        album.classList.add('has-third-photo');album.append(extra);fitPage();
      }
      page.left=spread.children[0].cloneNode(true);page.right=spread.children[1].cloneNode(true);
    }
  }
  function syncPage(notify=true) {
    const page=pages[index],photos=Boolean(page.entry)&&root.classList.contains('is-photo-side');
    book.dataset.page=index;root.classList.toggle('is-photo-side',photos);
    spread.querySelector('.diary-page--right').inert=photos&&innerWidth<=700;
    spread.querySelector('.diary-page--left').inert=!photos&&innerWidth<=700;
    photoToggle.setAttribute('aria-label',photos?'Show diary writing':'Show diary photographs');photoToggle.textContent=photos?'本文':'写真';
    photoToggle.hidden=!page.entry;
    if(notify)onPage(page.entry?{entry:page.entry,category:page.category}:null);
  }
  function renderPage(notify=true) {
    const page=pages[index];spread.replaceChildren(page.left.cloneNode(true),page.right.cloneNode(true));
    syncPage(notify);if(phase==='reading')preparePrint();
  }
  function focusPage() {
    (root.classList.contains('is-photo-side')?photoToggle:spread.querySelector('.diary-title')).focus({preventScroll:true});
  }
  function endTurn() {
    const animation=flipAnimation;flipAnimation=null;animation?.cancel();
    sheet.hidden=true;sheet.replaceChildren();turning=false;
  }
  function turnTo(target) {
    if(phase!=='reading'||turning||target<0||target>=pages.length||target===index)return;
    const focusInside=book.contains(document.activeElement), forward=target>index, destination=pages[target];
    if(reduced){index=target;renderPage();if(focusInside)focusPage();return;}
    if(!destination.entry)root.classList.remove('is-photo-side');
    turning=true;sheet.hidden=false;sheet.dataset.direction=forward?'forward':'backward';
    const front=node('div','diary-turn-front'),back=node('div','diary-turn-back');
    front.append(spread.querySelector(forward?'.diary-page--right':'.diary-page--left').cloneNode(true));
    const landing=(forward?destination.left:destination.right).cloneNode(true);
    back.append(landing);sheet.replaceChildren(front,back);
    // Reveal the complete destination under the leaf before it starts moving.
    spread.querySelector(forward?'.diary-page--right':'.diary-page--left').replaceWith((forward?destination.right:destination.left).cloneNode(true));
    spread.querySelector('.diary-page--right').inert=root.classList.contains('is-photo-side')&&innerWidth<=700;
    flipAnimation=sheet.animate([
      {transform:'rotateY(0deg) skewY(0deg)','--diary-leaf-shade':0},
      {transform:`rotateY(${forward?-82:82}deg) skewY(${forward?-2:2}deg)`,'--diary-leaf-shade':1,offset:.48},
      {transform:`rotateY(${forward?-180:180}deg) skewY(0deg)`,'--diary-leaf-shade':0},
    ],{duration:900,easing:'cubic-bezier(.38,.04,.24,1)',fill:'forwards'});
    flipAnimation.finished.then(()=>{
      spread.querySelector(forward?'.diary-page--left':'.diary-page--right').replaceWith(landing);
      index=target;syncPage();endTurn();if(focusInside)focusPage();
    }).catch(()=>{});
  }
  function finishClose(notify=true) {
    restoreOriginal();root.hidden=true;setPhase('closed');
    book.style.removeProperty('transform');
    if(notify){onClose();restoreFocus?.focus({preventScroll:true});}
  }
  function prepareAssets() {
    return preparation ||= Promise.all([
      document.fonts.load('16px "Klee One"'),
      ...[...new Set(['assets/diary/paper-fiber.jpg','assets/diary/paper.jpg',...entries.flatMap(p=>(p.entry.media||[]).slice(0,3).map(m=>m.src))])].map(src=>{
        const image=new Image();image.src=src;return image.decode().catch(()=>{});
      }),
    ]).then(()=>{assetsReady=true;}).catch(error=>{preparation=null;throw error;});
  }
  function prepareLayout() {
    const key=`${innerWidth}:${innerHeight}`;
    if(pageLayout===key)return;
    layout();preparePages();pageLayout=key;
  }
  const reader={
    async prepare(){
      await prepareAssets();
      if(phase!=='closed')return;
      // Measure real pages without exposing the dialog or changing its hidden state.
      root.style.visibility='hidden';root.style.display='grid';
      try{prepareLayout();renderPage(false);}
      finally{root.style.removeProperty('display');root.style.removeProperty('visibility');}
    },
    get isOpen(){return phase!=='closed';},
    async open(route,reducedMotion){
      reduced=reducedMotion;
      if(phase==='returning')finishClose(false);
      if(phase!=='closed'){if(ready){endTurn();root.classList.remove('is-photo-side');index=route?Math.max(0,pages.findIndex(p=>p.entry?.id===route.entryId&&p.category?.id===route.categoryId)):0;renderPage();if(phase!=='reading')preparePrint();}return;}
      restoreFocus=document.activeElement;const token=++openToken;root.hidden=false;setPhase('loading');layout();ready=false;flightProgress=0;flightOffset=0;
      root.classList.remove('is-photo-side');
      heldRoom=getRoom();heldRoom?.holdView(true);
      root.style.setProperty('--diary-presence','0');setOpening(0);
      // The room warms these assets and page layouts during the approach.
      // The prepared path stays synchronous so pickup starts on the click.
      if(!assetsReady)await prepareAssets();
      if(token!==openToken||phase==='closed')return;
      prepareLayout();index=route?Math.max(0,pages.findIndex(p=>p.entry?.id===route.entryId&&p.category?.id===route.categoryId)):0;renderPage();ready=true;
      prepareLift();makeRig();setPhase('flying');fly(0);
      if(!getRoom()){root.style.setProperty('--diary-presence','1');setOpening(1);setPhase('reading');}
      else if(reduced){fly(1);setOpening(1);setPhase('reading');}
      spread.querySelector('.diary-title').focus({preventScroll:true});
    },
    close(immediate=false){
      if(phase==='closed'||!immediate&&(phase==='returning'))return;
      openToken++;endTurn();gesture=null;
      if(immediate||reduced||phase==='loading'||!lift)finishClose();
      else{
        returnStart=phase==='flying'?flightProgress:1;
        if(phase==='reading'){
          flightOffset=bookOffset();
          // Keep the current mobile slide position when returning disables its transition.
          book.style.transform=getComputedStyle(book).transform;
          preparePrint();
        }
        setPhase('returning');fly(returnStart);
      }
    },
    update(dt,reducedMotion){
      reduced=reducedMotion;if(phase==='closed'||phase==='loading')return;elapsed+=Math.min(dt,.05);
      if(phase==='flying'){
        const t=reduced?1:Math.min(1,elapsed/(motion?.duration||2.25));fly(t);
        if(t===1)setPhase('reading');
      }else if(phase==='reading'){
        // Follow the actual CSS transform so the physical binding stays aligned
        // throughout the mobile photograph/writing transition.
        fly(1);
      }else if(phase==='returning'){
        const t=reduced?1:Math.min(1,elapsed/2.0);fly(returnStart*(1-t));if(t===1)finishClose();
      }
    },
    resize(){pageLayout='';if(phase==='closed')return;layout();if(ready){endTurn();prepareLayout();renderPage();if(phase!=='reading')preparePrint();refreshShadow();}},
  };
  root.addEventListener('click',e=>{
    if(e.target.closest('.diary-photo-toggle'))return;
    const control=e.target.closest('[data-diary-page]');
    if(control){turnTo(Number(control.dataset.diaryPage));return;}
    if(!e.target.closest('.diary-viewport'))reader.close();
  });
  photoToggle.addEventListener('click',()=>{
    const photos=root.classList.toggle('is-photo-side');spread.querySelector('.diary-page--right').inert=photos&&innerWidth<=700;
    spread.querySelector('.diary-page--left').inert=!photos&&innerWidth<=700;
    photoToggle.setAttribute('aria-label',photos?'Show diary writing':'Show diary photographs');photoToggle.textContent=photos?'本文':'写真';
  });
  book.addEventListener('pointerdown',e=>{
    if(phase!=='reading'||turning||e.button!==0||e.target.closest('button'))return;
    gesture={id:e.pointerId,x:e.clientX,y:e.clientY};book.setPointerCapture(e.pointerId);
  });
  book.addEventListener('pointerup',e=>{
    if(!gesture||gesture.id!==e.pointerId)return;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;gesture=null;
    if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)turnTo(index+(dx<0?1:-1));
  });
  book.addEventListener('pointercancel',()=>{gesture=null;});
  document.addEventListener('keydown',e=>{
    if(phase==='closed')return;
    if(!e.altKey&&!e.ctrlKey&&!e.metaKey&&['ArrowRight','ArrowLeft','a','A','d','D'].includes(e.key)){
      e.preventDefault();turnTo(index+(['ArrowRight','d','D'].includes(e.key)?1:-1));
    }
    if(e.key==='Tab'){
      const controls=[...root.querySelectorAll('.diary-spread button:not(:disabled),.diary-photo-toggle')].filter(b=>!b.closest('[inert]')&&getComputedStyle(b).display!=='none'&&b.getBoundingClientRect().width>0);
      const first=controls[0],last=controls.at(-1);if(!first||phase!=='reading'){e.preventDefault();return;}
      if(!controls.includes(document.activeElement)){e.preventDefault();(e.shiftKey?last:first).focus();}
      else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  },true);
  return reader;
}
