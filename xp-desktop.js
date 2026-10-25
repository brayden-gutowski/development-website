const ASSETS='assets/xp/';
// Only native XP resources listed in icon-provenance.json may be used as icons.
const ICONS={"folder.png":"shell32-4-native.png","text-file.png":"shell32-152-native.png","notepad.png":"shell32-152-native.png","MyComputer.png":"shell32-16-native.png","RecycleBin(empty).png":"shell32-32-native.png","InternetExplorer6.png":"shell32-512-native.png","OutlookExpress.png":"shell32-265-native.png","MyPictures.png":"shell32-327-native.png","MyMusic.png":"shell32-237-native.png","ControlPanel.png":"shell32-137-native.png","Search.png":"shell32-23-native.png","Run.png":"shell32-25-native.png","Volume.png":"shell32-230-native.png","NetworkConnection.png":"shell32-19-native.png","WindowsPictureandFaxViewer.png":"shell32-226-native.png","Power.png":"shell32-329-native.png","Standby.png":"original-standby-native.png","MyDocuments.png":"shell32-235-native.png","Go.png":"shell32-290-native.png","Play.png":"shell32-246-native.png","UserAccounts.png":"shell32-220-native.png","Back.png":"original-back.png","Forward.png":"original-forward.png","Up.png":"original-up.png","Restart.png":"original-restart-native.png","User.png":"original-user.png","AllPrograms.png":"original-all-programs-native.png","windows.png":"original-windows-transparent.png","Logout.png":"shell32-logoff-native.png","StartButton.png":"original-start.png","folder-large.png":"shell32-4-native-48.png","text-file-large.png":"shell32-152-native-48.png","MyComputer-large.png":"shell32-16-native-48.png","RecycleBin(empty)-large.png":"shell32-32-native-48.png","RecycleBin(full).png":"shell32-33-native.png","RecycleBin(full)-large.png":"shell32-33-native-48.png","LocalDisk.png":"shell32-8-native.png","LocalDisk-large.png":"shell32-8-native-48.png","CDDrive.png":"shell32-12-native.png","CDDrive-large.png":"shell32-12-native-48.png","PicturePrevious.png":"shimgvw-toolbar-0-native.png","PictureNext.png":"shimgvw-toolbar-1-native.png","PictureZoomIn.png":"shimgvw-toolbar-2-native.png","PictureZoomOut.png":"shimgvw-toolbar-3-native.png","PictureBestFit.png":"shimgvw-toolbar-5-native.png","PictureActualSize.png":"shimgvw-toolbar-6-native.png"};
const iconURL=file=>{if(!ICONS[file])throw new Error('Unverified XP icon: '+file);return ASSETS+ICONS[file];};
const icon=(file,alt='',size=32)=>{const image=document.createElement('img');const large=file.replace(/\.png$/,'-large.png');image.src=iconURL(size>=48&&ICONS[large]?large:file);image.alt=alt;image.draggable=false;return image;};
const button=(label,className,action)=>{const b=document.createElement('button');b.type='button';b.className=className;b.setAttribute('aria-label',label);b.addEventListener('click',action);return b;};

export function createXPDesktop({getRoom,categories,recycledEntries=[],onExit}) {
  const recycleFolder={id:"recycle",label:"Recycle Bin",entries:recycledEntries};
  const root=document.createElement('section');root.id='xp-computer';root.className='xp-computer';root.hidden=true;root.setAttribute('aria-label','Windows XP project desktop');
  const frame=document.createElement('div');frame.className='xp-screen';
  // A fraction-of-a-pixel edge warp follows the CRT glass without making
  // pointer targets drift or turning the desktop into a heavy video filter.
  const warp=document.createElement('canvas');warp.width=warp.height=64;
  const warpContext=warp.getContext('2d'),pixels=warpContext.createImageData(64,64);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const u=x/63*2-1,v=y/63*2-1,r=u*u+v*v,i=(y*64+x)*4;
    pixels.data.set([Math.round(127.5+u*r*10),Math.round(127.5+v*r*10),128,255],i);
  }
  warpContext.putImageData(pixels,0,0);
  const optics=document.createElementNS('http://www.w3.org/2000/svg','svg');optics.classList.add('xp-effects-svg');optics.setAttribute('aria-hidden','true');
  optics.innerHTML='<defs><filter id="xp-crt-optics" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB"><feImage href="'+warp.toDataURL()+'" preserveAspectRatio="none" result="crtWarp"/><feDisplacementMap in="SourceGraphic" in2="crtWarp" scale="2" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation=".13"/></filter></defs>';
  root.append(optics);
  const canvas=document.createElement('div');canvas.className='xp-desktop';canvas.tabIndex=-1;
  const desktopIcons=document.createElement('nav');desktopIcons.className='xp-desktop-icons';desktopIcons.setAttribute('aria-label','Project folders');
  const windowsLayer=document.createElement('div');windowsLayer.className='xp-windows';
  const taskbar=document.createElement('footer');taskbar.className='xp-taskbar';
  const tasks=document.createElement('div');tasks.className='xp-tasks';
  const tray=document.createElement('div');tray.className='xp-tray';
  const clock=document.createElement('time');
  const boot=document.createElement('div');boot.className='xp-boot';boot.setAttribute('role','status');boot.setAttribute('aria-live','polite');
  const logo=document.createElement('div');logo.className='xp-boot-logo';logo.append(icon('windows.png'));
  const branding=document.createElement('div');branding.innerHTML='<small>Microsoft<sup>®</sup></small><strong>Windows<span>xp</span></strong><em>Professional</em>';
  logo.append(branding);
  const progress=document.createElement('div');progress.className='xp-boot-progress';progress.innerHTML='<span></span><span></span><span></span>';
  const bootLabel=document.createElement('p');bootLabel.className='xp-boot-status';bootLabel.textContent='';
  const copyright=document.createElement('small');copyright.className='xp-boot-copyright';copyright.textContent='Copyright © 1985–2001 Microsoft Corporation';
  const microsoft=document.createElement('strong');microsoft.className='xp-boot-microsoft';microsoft.textContent='Microsoft';
  const welcome=document.createElement('div');welcome.className='xp-welcome';welcome.textContent='welcome';
  const login=document.createElement('div');login.className='xp-login';
  const loginPrompt=document.createElement('p');loginPrompt.textContent='To begin, click your user name';
  const loginUser=button('Log on as Brayden','xp-login-user',()=>{phase='desktop';root.dataset.phase=phase;boot.hidden=true;booted=true;elapsed=4;play('startup');desktopIcons.querySelector('button')?.focus({preventScroll:true});});loginUser.append(icon('User.png'),document.createTextNode('Brayden'));
  const loginPower=button('Turn off computer','xp-login-power',()=>{shutdownDialog.hidden=false;shutdownDialog.querySelector('button').focus();});loginPower.append(icon('Power.png'),document.createTextNode('Turn off computer'));login.append(loginPrompt,loginUser,loginPower);
  boot.append(logo,progress,bootLabel,welcome,login,copyright,microsoft);
  canvas.append(desktopIcons,windowsLayer,taskbar,boot);frame.append(canvas);root.append(frame);document.querySelector('#app').append(root);
  let phase='off',powerAction=null,powerElapsed=0,elapsed=0,opened=false,booted=false,muted=false,expanded=false,z=1,virtualWidth=1024,virtualHeight=768,scale=1,activeId=null,drag=null,audioContext,preparePromise,disposed=false;
  const prepareAbort=new AbortController();
  let fileNames=new WeakMap();
  const windows=new Map(),sounds=new Map(),playing=new Set(),localFolders=new Map();
  const soundNames=['startup','open','minimize','restore','shutdown'];
  const smallScreen=()=>matchMedia('(max-width: 640px), (max-height: 640px) and (pointer: coarse)').matches;
  function play(name){
    if(muted||document.hidden||!audioContext||!sounds.has(name))return;
    const source=audioContext.createBufferSource(),gain=audioContext.createGain();gain.gain.value=name==='startup'?.22:.16;
    source.buffer=sounds.get(name);source.connect(gain).connect(audioContext.destination);playing.add(source);
    source.onended=()=>{playing.delete(source);source.disconnect();gain.disconnect();};source.start();
  }
  function stopSounds(){for(const source of playing){try{source.stop();}catch{}}playing.clear();}
  function toggleSound(){muted=!muted;if(muted)stopSounds();updateSound();}
  function updateSound(){traySound.setAttribute('aria-label',muted?'Computer volume: muted':'Computer volume: on');traySound.setAttribute('aria-pressed',String(!muted));}
  const startMenu=document.createElement('nav');startMenu.className='xp-start-menu';startMenu.addEventListener('keydown',()=>startMenu.classList.remove('is-pointer-navigation'));startMenu.hidden=true;startMenu.setAttribute('aria-label','Start menu');
  const user=document.createElement('div');user.className='xp-start-user';
  const avatar=icon('User.png');avatar.className='xp-user-avatar';user.append(avatar,document.createTextNode('Brayden'));
  const columns=document.createElement('div');columns.className='xp-start-columns';
  const programs=document.createElement('div');programs.className='xp-start-programs';
  const places=document.createElement('div');places.className='xp-start-places';
  const separator=parent=>{const line=document.createElement('hr');parent.append(line);};
  function menuItem(parent,label,file,action,detail){
    const item=button(label,'xp-start-item',()=>{startMenu.hidden=true;allPrograms.hidden=true;action();});
    item.append(icon(file));const caption=document.createElement('span');caption.textContent=label;
    if(detail){const small=document.createElement('small');small.textContent=detail;caption.append(small);}item.append(caption);item.addEventListener('pointerenter',()=>{startMenu.classList.add('is-pointer-navigation');});parent.append(item);return item;
  }
  menuItem(programs,'Internet Explorer','InternetExplorer6.png',()=>openCollection('links'),'Project websites');
  menuItem(programs,'Outlook Express','OutlookExpress.png',()=>openUtility('outlook'),'Project notes');
  menuItem(programs,'Notepad','notepad.png',()=>openCollection('documents'),'Recent project documents');
  menuItem(programs,'Windows Picture and Fax Viewer','WindowsPictureandFaxViewer.png',()=>openCollection('pictures'),'Project photographs');
  separator(programs);
  for(const category of categories){
    menuItem(programs,category.label,'folder.png',()=>openFolder(category));
    const desktopButton=desktopItem(category.label,'folder.png',()=>openFolder(category));desktopButton.dataset.xpFolder=category.id;

  }
  desktopItem('My Computer','MyComputer.png',()=>openCollection('projects'));desktopItem('Recycle Bin',recycledEntries.length?'RecycleBin(full).png':'RecycleBin(empty).png',()=>openUtility('recycle'));
  separator(programs);
  const allPrograms=document.createElement('div');allPrograms.className='xp-all-programs';allPrograms.hidden=true;allPrograms.setAttribute('aria-label','All Programs');
  menuItem(allPrograms,'Project documents','notepad.png',()=>openCollection('documents'));
  menuItem(allPrograms,'Project pictures','WindowsPictureandFaxViewer.png',()=>openCollection('pictures'));
  menuItem(allPrograms,'Internet Explorer','InternetExplorer6.png',()=>openCollection('links'));
  menuItem(allPrograms,'Outlook Express','OutlookExpress.png',()=>openUtility('outlook'));
  const allButton=button('All Programs','xp-all-button',()=>{allPrograms.hidden=!allPrograms.hidden;allButton.setAttribute('aria-expanded',String(!allPrograms.hidden));});allButton.append(document.createTextNode('All Programs '),icon('AllPrograms.png'));allButton.setAttribute('aria-expanded','false');programs.append(allButton);
  menuItem(places,'My Documents','MyDocuments.png',()=>openCollection('documents'));
  menuItem(places,'My Pictures','MyPictures.png',()=>openCollection('pictures'));
  menuItem(places,'My Music','MyMusic.png',()=>openUtility('music'));
  separator(places);
  menuItem(places,'My Computer','MyComputer.png',()=>openCollection('projects'));
  menuItem(places,'Control Panel','ControlPanel.png',()=>openUtility('settings'));
  separator(places);
  menuItem(places,'Search','Search.png',()=>openCollection('search'));
  menuItem(places,'Run…','Run.png',()=>openUtility('run'));
  columns.append(programs,places);
  const footer=document.createElement('div');footer.className='xp-start-footer';
  const logoff=button('Log Off','xp-start-logoff',()=>beginPower('logoff'));logoff.append(icon('Logout.png'),document.createTextNode('Log Off'));
  const shutdown=button('Turn off computer','xp-start-shutdown',()=>{startMenu.hidden=true;shutdownDialog.hidden=false;shutdownDialog.querySelector('button').focus();});shutdown.append(icon('Power.png'),document.createTextNode('Turn Off Computer'));footer.append(logoff,shutdown);
  startMenu.append(user,columns,footer,allPrograms);canvas.append(startMenu);
  const start=button('Start','xp-start',()=>{startMenu.hidden=!startMenu.hidden;allPrograms.hidden=true;play('open');});start.append(icon('StartButton.png'));start.setAttribute('aria-haspopup','true');
  const traySound=button('Computer volume','xp-tray-volume',toggleSound);traySound.append(icon('Volume.png'));
  const network=document.createElement('span');network.className='xp-network';network.title='Local project collection';network.setAttribute('aria-label','Local project collection');network.append(icon('NetworkConnection.png'));
  const trayToggle=button('Hide notification icons','xp-tray-toggle',()=>{const hidden=!traySound.hidden;traySound.hidden=hidden;network.hidden=hidden;trayToggle.textContent=hidden?'‹':'›';trayToggle.setAttribute('aria-label',hidden?'Show notification icons':'Hide notification icons');});trayToggle.textContent='›';taskbar.append(start,tasks,tray);tray.append(trayToggle,traySound,network,clock);updateSound();
  const shutdownDialog=document.createElement('section');shutdownDialog.className='xp-shutdown-overlay';shutdownDialog.hidden=true;shutdownDialog.setAttribute('role','dialog');shutdownDialog.setAttribute('aria-modal','true');shutdownDialog.setAttribute('aria-label','Turn off computer');
  const powerPanel=document.createElement('div');powerPanel.className='xp-power-panel';const powerTitle=document.createElement('h2');powerTitle.textContent='Turn off computer';powerTitle.append(icon('windows.png'));powerPanel.append(powerTitle);
  const powerChoices=document.createElement('div');powerChoices.className='xp-power-choices';
  for(const [label,action,file] of [['Stand By','standby','Standby.png'],['Turn Off','off','Power.png'],['Restart','restart','Restart.png']]){
    const choice=button(label,'xp-power-'+action,()=>{shutdownDialog.hidden=true;if(action==='standby'){hardClose();onExit({restoreFocus:true});getRoom()?.setDisplayState?.({powered:false,standby:true,brightness:0});return;}beginPower(action);});
    choice.append(icon(file),document.createTextNode(label));powerChoices.append(choice);
  }
  const cancel=button('Cancel shutdown','xp-power-cancel',()=>{shutdownDialog.hidden=true;(phase==='login'?loginUser:start).focus();});cancel.textContent='Cancel';powerPanel.append(powerChoices,cancel);shutdownDialog.append(powerPanel);canvas.append(shutdownDialog);
  function beginPower(action){startMenu.hidden=true;powerAction=action;powerElapsed=0;phase='shutdown';root.dataset.phase=phase;root.dataset.powerAction=action;boot.hidden=false;bootLabel.textContent=action==='restart'?'Windows is restarting…':action==='logoff'?'Logging off…':'Windows is shutting down…';play('shutdown');}
  function desktopItem(label,file,action){
    const item=selectableItem(desktopIcons,label,'xp-icon',action);
    item.append(icon(file,'',48));const caption=document.createElement('span');caption.textContent=label;item.append(caption);desktopIcons.append(item);return item;
  }
  function selectItem(container,item){for(const other of container.querySelectorAll('.xp-icon,.xp-file')){other.classList.toggle('is-selected',other===item);other.setAttribute('aria-pressed',String(other===item));}container.dispatchEvent(new CustomEvent('xpselectionchange',{detail:item}));}
  function selectDesktop(item){selectItem(desktopIcons,item);}
  function selectableItem(container,label,className,action){
    const item=button(label,className,event=>{selectItem(container,item);if(event.detail===0||event.pointerType==='touch')action();});
    item.setAttribute('aria-pressed','false');item.addEventListener('dblclick',event=>{if(event.pointerType!=='touch')action();});return item;
  }
  canvas.addEventListener('pointerdown',event=>{if(event.target===canvas||event.target.closest('.xp-desktop-icons')){activeId=null;for(const win of windows.values()){win.node.classList.remove('is-active');win.task.classList.remove('is-active');win.task.setAttribute('aria-pressed','false');}if(event.target===canvas)selectDesktop(null);}});
  desktopIcons.addEventListener('keydown',event=>{const items=[...desktopIcons.children],i=items.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();const next=items[(i+(['ArrowDown','ArrowRight'].includes(event.key)?1:-1)+items.length)%items.length];selectDesktop(next);next.focus();}});
  // Paint a tiny semantic version of the *visible* desktop in stacking order.
  // Native photographs supply their real average color; controls use their XP
  // surface colors. Occluded windows never add a second contribution.
  const lightCanvas=document.createElement('canvas');lightCanvas.width=48;lightCanvas.height=36;
  const lightContext=lightCanvas.getContext('2d',{willReadFrequently:true});
  const wallpaper=new Image();wallpaper.src=ASSETS+'bliss.png';let lastDisplayAt=-Infinity;
  function getDisplayContentState(){
    if(!opened)return {powered:false,brightness:0,color:[0,0,0],averageLuminance:0};
    const sx=48/virtualWidth,sy=36/virtualHeight;
    lightContext.setTransform(sx,0,0,sy,0,0);
    function fill(color,x,y,w,h){lightContext.fillStyle=color;lightContext.fillRect(x,y,w,h);}
    function imageFit(image,x,y,w,h,cover=false){
      if(!image?.complete||!image.naturalWidth||w<=0||h<=0)return;
      const ratio=(cover?Math.max:Math.min)(w/image.naturalWidth,h/image.naturalHeight),iw=image.naturalWidth*ratio,ih=image.naturalHeight*ratio;
      lightContext.save();lightContext.beginPath();lightContext.rect(x,y,w,h);lightContext.clip();lightContext.drawImage(image,x+(w-iw)/2,y+(h-ih)/2,iw,ih);lightContext.restore();
    }
    if(phase==='boot')fill('#000',0,0,virtualWidth,virtualHeight);
    else if(phase==='welcome'||phase==='login'||phase==='shutdown')fill('#426bc4',0,0,virtualWidth,virtualHeight);
    else {
      fill('#4879bb',0,0,virtualWidth,virtualHeight);imageFit(wallpaper,0,0,virtualWidth,virtualHeight,true);
      const visible=[...windows.values()].filter(win=>!win.node.hidden).sort((a,b)=>Number(a.node.style.zIndex)-Number(b.node.style.zIndex));
      for(const win of visible){
        const {x,y,w,h}=win.rect;fill('#ece9d8',x,y,w,h);fill(win.id===activeId?'#0865ec':'#7091bd',x,y,w,30);
        const bodyTop=win.type==='xp-picture'?30:55,bodyHeight=Math.max(0,h-bodyTop-3);
        fill('#fff',x+3,y+bodyTop,w-6,bodyHeight);
        if(win.type==='xp-explorer'){
          const toolbar=40+29+(win.body.querySelector('.xp-search-input')?.hidden?0:30);
          fill('#ece9d8',x+3,y+bodyTop,w-6,toolbar);fill('#ece9d8',x+3,y+h-23,w-6,20);
          const pane=win.body.querySelector('.xp-explorer-pane');if(pane&&!pane.hidden)fill('#9bb6e6',x+3,y+bodyTop+toolbar,pane.offsetWidth,Math.max(0,bodyHeight-toolbar-23));
        }else if(win.type==='xp-picture'){
          const tools=win.body.querySelector('.xp-picture-tools')?.offsetHeight||33;
          fill('#ece9d8',x+3,y+h-tools,w-6,tools);imageFit(win.body.querySelector('.xp-picture-viewport img'),x+6,y+bodyTop+3,w-12,Math.max(0,bodyHeight-tools-6));
        }else if(win.type==='xp-mail'){
          // Mail's toolbar/headers are beige and its selected message is blue;
          // sampling these keeps its room spill distinct from a white text file.
          for(const [selector,color] of [['.xp-mail-toolbar','#ece9d8'],['.xp-mail-folder-heading','#7091bd'],['.xp-mail-columns','#ece9d8'],['.xp-mail-row[aria-pressed="true"]','#316ac5'],['.xp-mail-headers','#ece9d8'],['.xp-status','#ece9d8']]){
            const node=win.body.querySelector(selector);if(!node?.getClientRects().length)continue;
            let dx=0,dy=0;for(let element=node;element&&element!==win.node;element=element.offsetParent){dx+=element.offsetLeft;dy+=element.offsetTop;}
            fill(color,x+dx,y+dy,node.offsetWidth,node.offsetHeight);
          }
        }else if(win.type==='xp-utility')fill('#ece9d8',x+3,y+bodyTop,w-6,bodyHeight);
      }
      fill('#2568dc',0,virtualHeight-30,virtualWidth,30);
      if(!startMenu.hidden){const h=startMenu.offsetHeight,w=startMenu.offsetWidth,y=virtualHeight-30-h;fill('#fff',0,y,w,h);fill('#428beb',0,y,w,66);fill('#d3e5fa',w*.52,y+66,w*.48,h-110);fill('#2877d8',0,virtualHeight-74,w,44);}
      if(!shutdownDialog.hidden){fill('#4773cf',virtualWidth/2-180,virtualHeight/2-100,360,200);}
    }
    lightContext.setTransform(1,0,0,1,0,0);
    const pixels=lightContext.getImageData(0,0,48,36).data,color=[0,0,0];let luminance=0;
    const linear=value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4;
    for(let i=0;i<pixels.length;i+=4){const rgb=[pixels[i]/255,pixels[i+1]/255,pixels[i+2]/255];for(let j=0;j<3;j++)color[j]+=rgb[j];luminance+=.2126*linear(rgb[0])+.7152*linear(rgb[1])+.0722*linear(rgb[2]);}
    const count=48*36;for(let j=0;j<3;j++)color[j]/=count;luminance/=count;
    const fade=phase==='shutdown'&&powerAction!=='logoff'?Math.max(0,1-Math.max(0,powerElapsed-.55)/.45):1;
    return {powered:true,brightness:Math.min(1,luminance)*fade,color,averageLuminance:luminance};
  }
  function displayState(){const now=performance.now();if(opened&&now-lastDisplayAt<100)return;lastDisplayAt=now;getRoom()?.setDisplayState?.(getDisplayContentState());}

  function desktopPoint(event){
    const point=new DOMPoint(event.clientX-parseFloat(frame.style.left),event.clientY-parseFloat(frame.style.top)).matrixTransform(new DOMMatrix(frame.style.transform).inverse());
    return {x:(point.x/point.w-parseFloat(canvas.style.left))/scale,y:(point.y/point.w-parseFloat(canvas.style.top))/scale};
  }
  function focusWindow(win){
    activeId=win.id;win.node.hidden=false;win.node.style.zIndex=String(++z);
    for(const item of windows.values()){
      const active=item.id===activeId;item.node.classList.toggle('is-active',active);item.task.classList.toggle('is-active',active);item.task.setAttribute('aria-pressed',String(active));
    }
  }
  function place(win,x,y,w,h,remember=true){
    if(remember)win.preferred={x,y,w,h};
    win.rect={x:Math.max(2,Math.min(x,virtualWidth-w-2)),y:Math.max(2,Math.min(y,virtualHeight-h-34)),w,h};
    Object.assign(win.node.style,{left:win.rect.x+'px',top:win.rect.y+'px',width:w+'px',height:h+'px'});
  }
  function minimizeWindow(win){win.node.hidden=true;win.task.classList.remove('is-active');win.task.setAttribute('aria-pressed','false');win.node.classList.remove('is-active');if(activeId===win.id){const next=[...windows.values()].filter(w=>!w.node.hidden).sort((a,b)=>Number(a.node.style.zIndex)-Number(b.node.style.zIndex)).at(-1);if(next)focusWindow(next);else activeId=null;}play('minimize');}
  function closeWindow(win){play('open');win.endInteraction();win.node.remove();win.task.remove();windows.delete(win.id);if(activeId===win.id){const next=[...windows.values()].filter(w=>!w.node.hidden).sort((a,b)=>Number(a.node.style.zIndex)-Number(b.node.style.zIndex)).at(-1);if(next)focusWindow(next);else{activeId=null;canvas.focus({preventScroll:true});}}}
  function maximize(win){
    if(win.maximized){win.maximized=false;const r=win.saved;place(win,r.x,r.y,r.w,r.h);}
    else{win.saved={...win.preferred};win.maximized=true;place(win,2,2,virtualWidth-4,virtualHeight-36);}
    win.max.textContent=win.maximized?'❐':'□';win.max.setAttribute('aria-label',(win.maximized?'Restore ':'Maximize ')+win.title);play('restore');focusWindow(win);
  }
  function updateWindowTitle(win,title){
    win.title=title;win.node.setAttribute('aria-label',title);win.node.querySelector('.xp-titlebar>span').textContent=title;win.task.lastChild.textContent=title;win.task.setAttribute('aria-label','Switch to '+title);
    win.node.querySelector('.xp-minimize').setAttribute('aria-label','Minimize '+title);win.max.setAttribute('aria-label',(win.maximized?'Restore ':'Maximize ')+title);win.node.querySelector('.xp-close').setAttribute('aria-label','Close '+title);
  }
  function createWindow(id,title,type,rect){
    if(windows.has(id)){const existing=windows.get(id);if(existing.title!==title)updateWindowTitle(existing,title);focusWindow(existing);play('restore');return {win:existing,fresh:false};}
    const windowIcon=id==='folder-recycle'?(recycledEntries.length?'RecycleBin(full).png':'RecycleBin(empty).png'):type==='xp-explorer'?'folder.png':type==='xp-notepad'?'notepad.png':type==='xp-picture'?'WindowsPictureandFaxViewer.png':type==='xp-mail'?'OutlookExpress.png':'text-file.png';
    const node=document.createElement('section');node.className='xp-window '+type;node.setAttribute('role','dialog');node.setAttribute('aria-label',title);node.dataset.xpWindow=id;
    const bar=document.createElement('header');bar.className='xp-titlebar';bar.append(icon(windowIcon));
    const name=document.createElement('span');name.textContent=title;bar.append(name);
    const actions=document.createElement('div');actions.className='xp-window-buttons';
    const win={id,title,type,node,rect,maximized:false};
    const min=button('Minimize '+title,'xp-minimize',()=>minimizeWindow(win));min.textContent='−';
    win.max=button('Maximize '+title,'xp-maximize',()=>maximize(win));win.max.textContent='□';
    const close=button('Close '+title,'xp-close',()=>closeWindow(win));close.textContent='×';actions.append(min,win.max,close);bar.append(actions);
    const menu=document.createElement('div');menu.className='xp-menubar';menu.textContent=type==='xp-notepad'?'File   Edit   Format   View   Help':'File   Edit   View   Favorites   Tools   Help';
    const body=document.createElement('div');body.className='xp-window-body';win.body=body;
    node.append(bar,menu,body);windowsLayer.append(node);
    win.task=button('Switch to '+title,'xp-task',()=>{if(!node.hidden&&activeId===id){minimizeWindow(win);}else{focusWindow(win);play('restore');}});
    win.task.append(icon(windowIcon),document.createTextNode(title));tasks.append(win.task);windows.set(id,win);
    place(win,...rect);focusWindow(win);node.addEventListener('pointerdown',()=>focusWindow(win));node.addEventListener('focusin',()=>{if(activeId!==win.id)focusWindow(win);});
    bar.addEventListener('dblclick',event=>{if(!event.target.closest('button'))maximize(win);});
    bar.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('button')||win.maximized)return;
      event.preventDefault();bar.setPointerCapture(event.pointerId);const point=desktopPoint(event);drag={win,bar,id:event.pointerId,...point,start:{...win.rect}};
    });
    bar.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId||drag.win!==win)return;const point=desktopPoint(event);place(win,drag.start.x+point.x-drag.x,drag.start.y+point.y-drag.y,win.preferred.w,win.preferred.h);});
    const end=event=>{if(drag?.id===event.pointerId&&drag.win===win){drag=null;if(bar.hasPointerCapture(event.pointerId))bar.releasePointerCapture(event.pointerId);}};bar.addEventListener('pointerup',end);bar.addEventListener('pointercancel',end);bar.addEventListener('lostpointercapture',end);
    const resize=document.createElement('div');resize.className='xp-resize-grip';resize.setAttribute('aria-label','Resize '+title);resize.setAttribute('role','separator');resize.tabIndex=0;node.append(resize);
    let sizing=null;
    resize.addEventListener('pointerdown',event=>{if(event.button!==0||win.maximized)return;event.preventDefault();event.stopPropagation();focusWindow(win);resize.setPointerCapture(event.pointerId);sizing={id:event.pointerId,...desktopPoint(event),rect:{...win.rect}};});
    resize.addEventListener('pointermove',event=>{if(!sizing||sizing.id!==event.pointerId)return;const point=desktopPoint(event);place(win,win.rect.x,win.rect.y,Math.max(230,Math.min(virtualWidth-win.rect.x-2,sizing.rect.w+point.x-sizing.x)),Math.max(140,Math.min(virtualHeight-win.rect.y-34,sizing.rect.h+point.y-sizing.y)));});
    const endResize=event=>{if(sizing?.id===event.pointerId){sizing=null;if(resize.hasPointerCapture(event.pointerId))resize.releasePointerCapture(event.pointerId);}};resize.addEventListener('pointerup',endResize);resize.addEventListener('pointercancel',endResize);resize.addEventListener('lostpointercapture',endResize);
    win.endInteraction=()=>{if(drag?.win===win)end({pointerId:drag.id});if(sizing)endResize({pointerId:sizing.id});};
    resize.addEventListener('keydown',event=>{if(win.maximized||!event.key.startsWith('Arrow'))return;event.preventDefault();const dx=event.key==='ArrowRight'?10:event.key==='ArrowLeft'?-10:0,dy=event.key==='ArrowDown'?10:event.key==='ArrowUp'?-10:0;place(win,win.rect.x,win.rect.y,Math.max(230,Math.min(virtualWidth-win.rect.x-2,win.rect.w+dx)),Math.max(140,Math.min(virtualHeight-win.rect.y-34,win.rect.h+dy)));});
    return {win,fresh:true};
  }
  function openFolder(category){openExplorer('folder-'+category.id,category.label,category);}
  function openCollection(kind){if(kind==='recycle'){openFolder(recycleFolder);return;}openExplorer('collection-'+kind,({projects:'My Computer',disk:'Local Disk (C:)',projectfolders:'Projects',cd:'CD Drive (D:)',documents:'My Documents',shared:'Shared Documents',network:'My Network Places',pictures:'My Pictures',search:'Search',links:'Project websites',recycle:'Recycle Bin'})[kind],null,kind);}
  function openExplorer(id,title,category,kind='projects'){
    if(phase!=='desktop')return;play('open');
    const w=Math.min(610,virtualWidth-20),h=Math.min(378,virtualHeight-66),x=virtualWidth>650?112:10;
    const {win,fresh}=createWindow(id,title,'xp-explorer',[Math.min(x,virtualWidth-w-8),72,w,h]);if(!fresh)return;
    const toolbar=document.createElement('div');toolbar.className='xp-explorer-toolbar';
    const workspace=document.createElement('div');workspace.className='xp-explorer-workspace';
    const pane=document.createElement('aside');pane.className='xp-explorer-pane';
    const list=document.createElement('div');list.className='xp-file-list';list.addEventListener('pointerdown',event=>{if(event.target===list)selectItem(list,null);});
    const history=[category||kind];let position=0,current=category||kind;
    const back=button('Back','xp-back',()=>{if(position>0)render(history[--position]);});back.append(icon('Back.png'),document.createTextNode('Back'));
    const forward=button('Forward','xp-forward',()=>{if(position<history.length-1)render(history[++position]);});forward.append(icon('Forward.png'));
    const up=button('Up to My Computer','xp-up',()=>navigate(typeof current==='object'?'projectfolders':current==='projectfolders'?'disk':'projects'));up.append(icon('Up.png'));
    const search=button('Search projects','xp-search',()=>{filter.hidden=!filter.hidden;if(!filter.hidden)filter.focus();});search.append(icon('Search.png'),document.createTextNode('Search'));
    const folders=button('Show or hide task pane','xp-folders',()=>{pane.hidden=!pane.hidden;folders.setAttribute('aria-pressed',String(!pane.hidden));});folders.append(icon('folder.png'),document.createTextNode('Folders'));folders.setAttribute('aria-pressed','true');toolbar.append(back,forward,up,search,folders);
    const address=document.createElement('label');address.className='xp-address';address.append(document.createTextNode('Address'),icon('folder.png'));
    const select=document.createElement('select');select.setAttribute('aria-label','Address');
    for(const [value,label] of [['projects','My Computer'],['disk','Local Disk (C:)'],['projectfolders','Projects'],['cd','CD Drive (D:)'],['documents','My Documents'],['shared','Shared Documents'],['network','My Network Places'],['pictures','My Pictures'],['links','Project websites'],['recycle','Recycle Bin'],...categories.map(c=>[c.id,c.label])]){const option=document.createElement('option');option.value=value;option.textContent=({projects:'My Computer',disk:'C:\\',cd:'D:\\',projectfolders:'C:\\Projects',recycle:'Recycle Bin'})[value]||(categories.some(c=>c.id===value)?'C:\\Projects\\'+label:label);select.append(option);}
    const go=button('Go to address','xp-go',()=>navigate([...categories,recycleFolder].find(c=>c.id===select.value)||select.value));go.append(icon('Go.png'),document.createTextNode('Go'));address.append(select,go);select.addEventListener('change',()=>go.click());
    const filter=document.createElement('input');filter.className='xp-search-input';filter.type='search';filter.placeholder='Search project names';filter.setAttribute('aria-label','Search project names');filter.hidden=kind!=='search';filter.addEventListener('input',()=>render(current));
    const metadata=new WeakMap();let selection=null;
    const group=(title)=>{const section=document.createElement('details');section.open=true;const heading=document.createElement('summary');heading.textContent=title;section.append(heading);pane.append(section);return section;};
    const fileTasks=group('File and Folder Tasks');
    const otherPlaces=group('Other Places');
    for(const [label,target,file] of [['My Documents','documents','MyDocuments.png'],['Shared Documents','shared','folder.png'],['My Computer','projects','MyComputer.png'],['My Network Places','network','NetworkConnection.png']]){const item=button(label,'xp-pane-link',()=>navigate(target));item.append(icon(file),document.createTextNode(label));otherPlaces.append(item);}
    const details=group('Details');const detailText=document.createElement('div');detailText.className='xp-file-details';details.append(detailText);
    const folderKey=()=>typeof current==='object'?current.id:current;
    function task(label,file,action){const item=button(label,'xp-pane-link',action);item.append(icon(file),document.createTextNode(label));fileTasks.append(item);}
    function localNameDialog(title,initial,save){
      const {win:dialog,fresh}=createWindow('name-'+id,title,'xp-utility',[Math.min(180,virtualWidth-300),100,Math.min(330,virtualWidth-20),170]);if(!fresh)return;
      const content=document.createElement('form');content.className='xp-utility-content';const label=document.createElement('label');label.textContent='Name: ';
      const input=document.createElement('input');input.className='xp-run-input';input.value=initial;input.required=true;input.maxLength=80;input.setAttribute('aria-label','Name');label.append(input);
      const note=document.createElement('p');note.className='xp-run-hint';note.textContent='Changes are kept in this desktop session.';
      const ok=button('Save name','xp-classic-button',()=>content.requestSubmit());ok.textContent='OK';content.addEventListener('submit',event=>{event.preventDefault();const name=input.value.trim();if(!name)return;save(name);closeWindow(dialog);render(current);});content.append(label,note,ok);dialog.body.append(content);input.focus();input.select();
    }
    function updateSelection(item){
      selection=item?metadata.get(item):null;fileTasks.replaceChildren(fileTasks.querySelector('summary'));
      if(selection){
        task('Open','folder.png',selection.open);
        if(selection.entry){
          task('Copy this file','text-file.png',()=>{const blob=new Blob([projectText(selection.entry)],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=(fileNames.get(selection.entry)||selection.entry.title)+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
          for(const [label,href] of [['Open Github',selection.entry.githubHref],['Open Game',selection.entry.href]])if(href)task(label,'InternetExplorer6.png',()=>window.open(href,'_blank','noopener,noreferrer'));
          if(folderKey()!=='recycle')task('Rename this file','text-file.png',()=>localNameDialog('Rename',fileNames.get(selection.entry)||selection.entry.title,name=>fileNames.set(selection.entry,name.replace(/\.txt$/i,''))));
        }
      }else if(!['recycle','projects','cd'].includes(folderKey()))task('Make a new folder','folder.png',()=>localNameDialog('New Folder','New Folder',name=>{const key=folderKey(),folders=localFolders.get(key)||[];folders.push({id:'local-'+Date.now(),label:name,entries:[]});localFolders.set(key,folders);}));
      fileTasks.hidden=folderKey()==='recycle'&&!selection;
      const name=selection?.name||(typeof current==='object'?current.label:select.selectedOptions[0]?.textContent.split('\\').at(-1)||title);
      detailText.replaceChildren();const heading=document.createElement('strong');heading.textContent=name;detailText.append(heading);
      const lines=selection?.type?[selection.type,'Modified: Not recorded']:selection?.entry?['Text Document',new TextEncoder().encode(projectText(selection.entry)).length+' bytes','Modified: '+(selection.entry.modifiedDate||'Not recorded')]:selection?.image?['Image','Project photograph','Modified: Not recorded']:[({projects:'System Folder',disk:'Local Disk',cd:'CD Drive'})[folderKey()]||'File Folder','Modified: Not recorded'];
      for(const line of lines){const p=document.createElement('p');p.textContent=line;detailText.append(p);}
    }
    list.addEventListener('xpselectionchange',event=>updateSelection(event.detail));
    list.addEventListener('keydown',event=>{if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const files=[...list.querySelectorAll('.xp-file')],index=files.indexOf(document.activeElement),next=files[(index+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+files.length)%files.length];if(next){selectItem(list,next);next.focus();}});
    const status=document.createElement('footer');status.className='xp-status';
    function navigate(target){history.splice(position+1);history.push(target);position++;filter.value='';render(target);}
    function render(target){
      current=target;up.disabled=target==='projects';list.replaceChildren();selection=null;back.disabled=position===0;forward.disabled=position===history.length-1;select.value=typeof target==='object'?target.id:target==='search'?'documents':target;
      function folderItem(label,target,file='folder.png',type='File Folder'){
        const open=()=>navigate(target),b=selectableItem(list,'Open '+label,'xp-file',open);b.append(icon(file,'',48),document.createTextNode(label));metadata.set(b,{name:label,type,open});list.append(b);return b;
      }
      if(target==='projects'){
        for(const [heading,label,target,file,type] of [['Hard Disk Drives','Local Disk (C:)','disk','LocalDisk.png','Local Disk'],['Devices with Removable Storage','CD Drive (D:)','cd','CDDrive.png','CD Drive']]){
          const groupHeading=document.createElement('h3');groupHeading.className='xp-drive-group';groupHeading.textContent=heading;list.append(groupHeading);folderItem(label,target,file,type);
        }
      }else if(target==='disk')folderItem('Projects','projectfolders');
      else if(target==='projectfolders')for(const c of categories)folderItem(c.label,c);
      else if(target==='cd'){const empty=document.createElement('p');empty.className='xp-drive-empty';empty.textContent='Please insert a disc into drive D:.';list.append(empty);}
      else for(const c of typeof target==='object'?[target]:categories)c.entries.forEach((entry,index)=>{
        if(!entry.title.toLowerCase().includes(filter.value.toLowerCase()))return;
        if(target==='pictures')projectImages(entry).forEach((image,i)=>{const open=()=>openPicture(c,entry,index,i),b=selectableItem(list,entry.title+' — Photo '+(i+1),'xp-file xp-thumbnail',open);metadata.set(b,{name:entry.title+' — Photo '+(i+1),image,open});const thumbnail=document.createElement('img');thumbnail.src=image.src;thumbnail.alt='';b.append(thumbnail,document.createTextNode(entry.title+' '+(i+1)));list.append(b);});
        else {if(['links','network'].includes(target)&&!entry.href&&!entry.githubHref)return;const item=document.createElement('div');item.className='xp-project-file';const name=(fileNames.get(entry)||entry.title)+'.txt',open=()=>openProject(c,entry,index),b=selectableItem(list,name,'xp-file',open);metadata.set(b,{name,entry,open});b.append(icon('text-file.png','',48),document.createTextNode(name));item.append(b);list.append(item);}
      });for(const local of localFolders.get(folderKey())||[]){const open=()=>navigate(local),item=selectableItem(list,'Open '+local.label,'xp-file',open);item.append(icon('folder.png','',48),document.createTextNode(local.label));metadata.set(item,{name:local.label,open});list.append(item);}const count=list.querySelectorAll('.xp-file').length;status.textContent=count+' object'+(count===1?'':'s');const currentTitle=typeof target==='object'?target.label:({projects:'My Computer',disk:'Local Disk (C:)',projectfolders:'Projects',cd:'CD Drive (D:)',documents:'My Documents',shared:'Shared Documents',network:'My Network Places',pictures:'My Pictures',search:'Search',links:'Project websites'})[target];updateWindowTitle(win,currentTitle||title);updateSelection(null);
    }
    workspace.append(pane,list);win.body.append(toolbar,address,filter,workspace,status);render(current);
  }
  function openUtility(kind){
    if(phase!=='desktop')return;
    if(kind==='recycle'){openFolder(recycleFolder);return;}if(kind==='outlook'){openOutlook();return;}
    const title=({recycle:'Recycle Bin',settings:'Control Panel',music:'My Music',run:'Run',outlook:'Outlook Express'})[kind];
    const {win,fresh}=createWindow('utility-'+kind,title,'xp-utility',[Math.min(180,virtualWidth-300),120,Math.min(420,virtualWidth-20),Math.min(310,virtualHeight-60)]);if(!fresh)return;
    const content=document.createElement('div');content.className='xp-utility-content';win.body.append(content);
    const text=document.createElement('p');content.append(text);
    if(kind==='settings'||kind==='music'){
      text.textContent=kind==='settings'?'Sounds and Audio Devices':'Windows XP system sounds';
      const toggle=button('Toggle system sounds','xp-classic-button',()=>{toggleSound();toggle.textContent=muted?'Enable system sounds':'Mute system sounds';});toggle.textContent=muted?'Enable system sounds':'Mute system sounds';content.append(toggle);
      const soundsList=document.createElement('div');soundsList.className='xp-sound-list';for(const name of soundNames){const sample=button('Play '+name+' sound','xp-classic-button',()=>play(name));sample.append(icon('Play.png'),document.createTextNode(name)); soundsList.append(sample);}content.append(soundsList);
    }
    if(kind==='run'){
      text.textContent='Type the name of a program, folder, or project collection, and Windows will open it for you.';
      const input=document.createElement('input');input.className='xp-run-input';input.setAttribute('aria-label','Open');input.placeholder='notepad';
      const hint=document.createElement('p');hint.textContent='notepad · explorer · pictures · music · control';hint.className='xp-run-hint';
      const run=button('Run program','xp-classic-button',()=>{const value=input.value.trim().toLowerCase();const category=categories.find(c=>c.label.toLowerCase()===value||c.id===value);if(category){openFolder(category);closeWindow(win);}else if(['notepad','explorer','pictures','iexplore'].includes(value)){openCollection(({notepad:'documents',explorer:'projects',pictures:'pictures',iexplore:'links'})[value]);closeWindow(win);}else if(['music','control'].includes(value)){openUtility(value==='music'?'music':'settings');closeWindow(win);}else {hint.textContent='Windows cannot find “'+input.value+'”. Try one of the programs listed above.';hint.setAttribute('role','alert');}});run.textContent='OK';input.addEventListener('keydown',event=>{if(event.key==='Enter')run.click();});content.append(input,hint,run);input.focus();
    }
  }
  function projectImages(entry){return [...(entry.image?[{src:entry.image,alt:entry.imageAlt||entry.title}]:[]),...(entry.detailImages||[])];}
  function openPicture(category,entry,index,imageIndex=0){
    const images=projectImages(entry);if(!images.length)return;
    const id='picture-'+category.id+'-'+index,existing=windows.get(id);
    if(existing){existing.showPicture(imageIndex);focusWindow(existing);return;}
    const pw=Math.min(330,virtualWidth-24),ph=Math.min(280,virtualHeight-70),x=virtualWidth>650?virtualWidth-pw-12:Math.min(22,virtualWidth-pw-8);
    const {win}=createWindow(id,entry.title+' — Windows Picture and Fax Viewer','xp-picture',[x,50,pw,ph]);
    const viewport=document.createElement('div');viewport.className='xp-picture-viewport';const img=document.createElement('img');img.draggable=false;viewport.append(img);
    const tools=document.createElement('div');tools.className='xp-picture-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','Picture controls');let current=imageIndex,zoom=1,fit=true;
    const label=document.createElement('span');label.className='xp-picture-caption';label.setAttribute('aria-live','polite');
    function render(){win.node.classList.add('is-loading');img.src=images[current].src;img.alt=images[current].alt||entry.title;img.style.width=fit?'':Math.round((img.naturalWidth||250)*zoom)+'px';img.classList.toggle('is-zoomed',!fit);label.textContent=(current+1)+' / '+images.length;}
    win.showPicture=i=>{current=i;fit=true;zoom=1;render();};
    for(const [name,file,action] of [['Previous picture','PicturePrevious.png',()=>{current=(current+images.length-1)%images.length;fit=true;}],['Next picture','PictureNext.png',()=>{current=(current+1)%images.length;fit=true;}],['Best fit','PictureBestFit.png',()=>{fit=true;zoom=1;}],['Actual size','PictureActualSize.png',()=>{fit=false;zoom=1;}],['Zoom in','PictureZoomIn.png',()=>{fit=false;zoom=Math.min(4,zoom*1.25);}],['Zoom out','PictureZoomOut.png',()=>{fit=false;zoom=Math.max(.25,zoom/1.25);}]]){const control=button(name,'xp-picture-tool',()=>{action();render();});control.title=name;control.append(icon(file,'',16));if(images.length===1&&name.includes('picture'))control.disabled=true;tools.append(control);}
    tools.append(label);win.body.append(viewport,tools);img.addEventListener('error',()=>win.node.classList.remove('is-loading'));img.addEventListener('load',()=>{win.node.classList.remove('is-loading');if(!fit)img.style.width=Math.round(img.naturalWidth*zoom)+'px';});render();
  }
  function projectContent(entry){
    const parts=[entry.title,entry.meta,entry.award,entry.description].filter(Boolean);
    if(entry.href)parts.push({label:'Game link',href:entry.href});
    if(entry.githubHref)parts.push({label:'Github link',href:entry.githubHref});
    if(entry.attributions?.length){
      parts.push('---------------------------\nAttributions\n----------------------------');
      for(const item of entry.attributions)parts.push((item.prefix||'')+item.sourceLabel+' — '+item.sourceHref+(item.middle||'')+(item.licenseLabel?item.licenseLabel+' — '+item.licenseHref:'')+(item.suffix||''));
    }
    return parts;
  }
  function appendProjectContent(target,entry){
    projectContent(entry).forEach((part,i)=>{
      if(i)target.append('\n\n');
      if(typeof part==='string')target.append(part);
      else {const link=document.createElement('a');link.href=part.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Here';target.append(part.label+': ',link);}
    });
  }
  function openOutlook(){
    const {win,fresh}=createWindow('utility-outlook','Outlook Express','xp-mail',[Math.min(138,virtualWidth-300),62,Math.min(740,virtualWidth-20),Math.min(570,virtualHeight-66)]);if(!fresh)return;
    const menu=win.node.querySelector('.xp-menubar');menu.replaceChildren();
    for(const label of ['File','Edit','View','Tools','Message','Help']){const caption=document.createElement('span');caption.textContent=label;menu.append(caption);}
    const messages=categories.flatMap(category=>category.entries.map((entry,index)=>({category,entry,index})));
    const toolbar=document.createElement('div');toolbar.className='xp-mail-toolbar';
    const workspace=document.createElement('div');workspace.className='xp-mail-workspace';
    const folders=document.createElement('aside');folders.className='xp-mail-folders';folders.setAttribute('aria-label','Mail folders');
    const folderTitle=document.createElement('strong');folderTitle.textContent='Folders';folders.append(folderTitle);
    const mail=document.createElement('div');mail.className='xp-mail-main';
    const folderHeading=document.createElement('div');folderHeading.className='xp-mail-folder-heading';folderHeading.textContent='Inbox';
    const messageList=document.createElement('div');messageList.className='xp-mail-list';messageList.setAttribute('aria-label','Inbox messages');
    const columns=document.createElement('div');columns.className='xp-mail-columns';for(const label of ['From','Subject','Received']){const heading=document.createElement('span');heading.textContent=label;columns.append(heading);}
    const rows=document.createElement('div');rows.className='xp-mail-rows';messageList.append(columns,rows);
    const preview=document.createElement('article');preview.className='xp-mail-preview';preview.setAttribute('aria-label','Message preview');
    const headers=document.createElement('dl');headers.className='xp-mail-headers';const message=document.createElement('pre');message.className='xp-mail-message';preview.append(headers,message);
    const status=document.createElement('footer');status.className='xp-status';
    let selected=0;
    function selectMessage(index){
      selected=index;const item=messages[index];headers.replaceChildren();message.replaceChildren();
      for(const [label,value] of [['From','Brayden Gutowski'],['To','Portfolio visitor'],['Subject',item?.entry.title||''],['Date',item?.entry.modifiedDate||'Not recorded']]){const term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=label+':';detail.textContent=value;headers.append(term,detail);}
      if(item)appendProjectContent(message,item.entry);
      [...rows.children].forEach((row,i)=>row.setAttribute('aria-pressed',String(i===index)));status.textContent=messages.length+' message'+(messages.length===1?'':'s');
    }
    function showInbox(){folderHeading.textContent='Inbox';messageList.hidden=false;preview.hidden=false;selectMessage(selected);}
    for(const [label,file,action] of [['Create Mail','text-file.png',()=>openCollection('documents')],['Reply','Back.png',()=>showInbox()],['Reply All','Back.png',()=>showInbox()],['Forward','Forward.png',()=>showInbox()],['Send/Recv','OutlookExpress.png',showInbox],['Addresses','MyDocuments.png',()=>{folders.hidden=!folders.hidden;}],['Find','Search.png',()=>{rows.querySelector('button')?.focus();}]]){const control=button(label,'xp-mail-tool',action);if(['Create Mail','Reply','Reply All','Forward'].includes(label)){control.disabled=true;control.title='Project notes are read-only';}control.append(icon(file),document.createTextNode(label));toolbar.append(control);}
    const local=document.createElement('div');local.className='xp-mail-local';local.append(icon('OutlookExpress.png'),document.createTextNode('Local Folders'));folders.append(local);
    for(const name of ['Inbox','Outbox','Sent Items','Deleted Items','Drafts']){const control=button(name,'xp-mail-folder',()=>{for(const sibling of folders.querySelectorAll('button'))sibling.classList.toggle('is-selected',sibling===control);folderHeading.textContent=name;const inbox=name==='Inbox';messageList.hidden=!inbox;preview.hidden=!inbox;status.textContent=inbox?messages.length+' message'+(messages.length===1?'':'s'):'0 messages';if(inbox)selectMessage(selected);});control.append(icon('folder.png'),document.createTextNode(name));control.classList.toggle('is-selected',name==='Inbox');folders.append(control);}
    messages.forEach((item,index)=>{const row=button(item.entry.title,'xp-mail-row',()=>selectMessage(index));for(const value of ['Brayden Gutowski',item.entry.title,item.entry.modifiedDate||'Not recorded']){const cell=document.createElement('span');cell.textContent=value;row.append(cell);}row.addEventListener('dblclick',()=>openProject(item.category,item.entry,item.index));rows.append(row);});
    mail.append(folderHeading,messageList,preview);workspace.append(folders,mail);win.body.append(toolbar,workspace,status);selectMessage(0);
  }
  function projectText(entry){return projectContent(entry).map(part=>typeof part==='string'?part:part.label+': '+part.href).join('\n\n');}
  function openProject(category,entry,index){
    play('open');const id=category.id+'-'+index;
    const w=Math.min(440,virtualWidth-20),h=Math.min(460,virtualHeight-60),left=virtualWidth>650?105:10;
    const {win,fresh}=createWindow('note-'+id,(fileNames.get(entry)||entry.title)+'.txt - Notepad','xp-notepad',[left,42,w,h]);
    if(fresh){
      const text=document.createElement('pre');text.tabIndex=0;text.setAttribute('aria-label',entry.title+' project details');
      text.textContent=projectText(entry);win.body.append(text);
      const menu=win.node.querySelector('.xp-menubar');menu.replaceChildren();for(const label of ['File','Edit','Format','View','Help']){if(label==='Format'){const format=button('Format: toggle Word Wrap','xp-menu-label',()=>{text.classList.toggle('is-nowrap');format.setAttribute('aria-pressed',String(!text.classList.contains('is-nowrap')));});format.textContent='Format';format.setAttribute('aria-pressed','true');menu.append(format);}else {const caption=document.createElement('span');caption.textContent=label;menu.append(caption);}}
    }
    if(projectImages(entry).length)openPicture(category,entry,index);
    focusWindow(win);
  }
  function layout(){
    if(!opened)return;
    const rect=expanded?{x:12,y:12,width:innerWidth-24,height:innerHeight-24}:getRoom().getScreenRect();
    root.classList.toggle('is-expanded',expanded);
    Object.assign(frame.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px',transform:expanded?'none':rect.transform||'none',transformOrigin:'0 0'});
    frame.style.setProperty('--crt-reflection-x',(rect.reflectionX??28)+'%');frame.style.setProperty('--crt-reflection-y',(rect.reflectionY??15)+'%');
    const mobile=expanded&&smallScreen();virtualWidth=mobile?Math.max(300,rect.width):1024;virtualHeight=mobile?rect.height/(rect.width/virtualWidth):768;scale=Math.min(rect.width/virtualWidth,rect.height/virtualHeight);canvas.style.left=(rect.width-virtualWidth*scale)/2+'px';canvas.style.top=(rect.height-virtualHeight*scale)/2+'px';
    canvas.style.width=virtualWidth+'px';canvas.style.height=virtualHeight+'px';canvas.style.transform='scale('+scale+')';
    for(const win of windows.values()){
      const r=win.preferred;if(win.maximized)place(win,2,2,virtualWidth-4,virtualHeight-36,false);
      else place(win,r.x,r.y,Math.min(r.w,virtualWidth-12),Math.min(r.h,virtualHeight-46),false);
    }
  }
  root.addEventListener('pointerdown',event=>{event.stopPropagation();if(!event.target.closest('.xp-start,.xp-start-menu'))startMenu.hidden=true;});
  root.addEventListener('pointerup',event=>{
    // Touch browsers may snap a tap in the narrow backdrop to the screen.
    const r=frame.getBoundingClientRect();
    if(event.target===root||expanded&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))onExit();
  });
  root.addEventListener('keydown',event=>{if(event.key==='Tab'&&phase==='login'&&shutdownDialog.hidden){event.preventDefault();(document.activeElement===loginUser?loginPower:loginUser).focus();}if(event.key==='Escape'){event.stopPropagation();if(!shutdownDialog.hidden){shutdownDialog.hidden=true;(phase==='login'?loginUser:start).focus();}else if(!startMenu.hidden){startMenu.hidden=true;start.focus();}else onExit({restoreFocus:true});}if(event.key==='Tab'&&!shutdownDialog.hidden){const buttons=[...shutdownDialog.querySelectorAll('button')];const i=buttons.indexOf(document.activeElement);if((event.shiftKey&&i===0)||(!event.shiftKey&&i===buttons.length-1)){event.preventDefault();buttons[event.shiftKey?buttons.length-1:0].focus();}}});
  const stopHidden=()=>{if(document.hidden)stopSounds();};document.addEventListener('visibilitychange',stopHidden);
  function clearWindows(){for(const win of windows.values()){win.endInteraction();win.node.remove();win.task.remove();}windows.clear();activeId=null;}
  function hardClose(silent=true){if(!opened){if(silent)stopSounds();return;}opened=false;clearWindows();localFolders.clear();fileNames=new WeakMap();phase='off';root.dataset.phase=phase;root.hidden=true;startMenu.hidden=true;shutdownDialog.hidden=true;powerAction=null;displayState();drag=null;stopSounds();if(!silent)play('shutdown');root.inert=false;root.classList.remove('is-passive');delete root.dataset.powerAction;}
  return {
    get phase(){return phase;},
    getDisplayContentState,
    async prepare(){
      if(disposed||preparePromise)return preparePromise;
      const images=['bliss.png','folder.png','text-file.png','notepad.png','windows.png','RecycleBin(full).png','RecycleBin(empty).png'].map(file=>{const img=new Image();img.src=file==='bliss.png'?ASSETS+file:iconURL(file);return img.decode().catch(()=>{});});
      audioContext=new (window.AudioContext||window.webkitAudioContext)();
      const context=audioContext;
      preparePromise=Promise.all([wallpaper.decode().catch(()=>{}),...images,...soundNames.map(async name=>{try{const response=await fetch(ASSETS+name+'.wav',{signal:prepareAbort.signal});if(!response.ok)return;const buffer=await context.decodeAudioData(await response.arrayBuffer());if(!disposed)sounds.set(name,buffer);}catch{/* A muted or unavailable device must not block the desktop. */}})]);
      await preparePromise;
    },
    open(){
      if(disposed)return;
      if(opened){root.inert=false;root.classList.remove('is-passive');expanded=smallScreen();layout();canvas.focus({preventScroll:true});return;}root.inert=false;root.classList.remove('is-passive');opened=true;powerAction=null;shutdownDialog.hidden=true;elapsed=0;booted=false;expanded=smallScreen();phase='boot';root.dataset.phase=phase;root.hidden=false;boot.hidden=false;
      audioContext?.resume().catch(()=>{});layout();canvas.focus({preventScroll:true});
    },
    close(silent=false){hardClose(silent);},
    defocus(){if(!opened)return;root.inert=true;root.classList.add('is-passive');startMenu.hidden=true;shutdownDialog.hidden=true;expanded=false;for(const win of windows.values())win.endInteraction();stopSounds();layout();},
    update(dt,reducedMotion){
      if(!opened)return;displayState();if(powerAction){powerElapsed+=dt;if(powerElapsed>1){const action=powerAction;powerAction=null;clearWindows();if(action==='off'){hardClose();onExit({restoreFocus:true});return;}delete root.dataset.powerAction;if(action==='logoff'){phase='login';root.dataset.phase=phase;bootLabel.textContent='';boot.hidden=false;loginUser.focus({preventScroll:true});layout();return;}elapsed=0;booted=false;}else return;}if(phase==='login'){layout();return;}elapsed+=dt;
      const welcomeAt=reducedMotion?.55:2.5,readyAt=reducedMotion?1:3.6;
      phase=elapsed< welcomeAt?'boot':elapsed<readyAt?'welcome':'desktop';root.dataset.phase=phase;
      root.classList.toggle('reduced-motion',reducedMotion);bootLabel.textContent='';boot.hidden=phase==='desktop';
      if(phase==='desktop'&&!booted){booted=true;play('startup');desktopIcons.querySelector('button')?.focus({preventScroll:true});}
      const now=new Date();clock.textContent=now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});clock.dateTime=now.toISOString();clock.title=now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});layout();
    },
    dispose(){if(disposed)return;disposed=true;prepareAbort.abort();hardClose();clearWindows();localFolders.clear();fileNames=new WeakMap();sounds.clear();stopSounds();audioContext?.close().catch(()=>{});audioContext=null;document.removeEventListener('visibilitychange',stopHidden);root.remove();},
  };
}
