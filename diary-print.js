import * as THREE from 'three';

const fiber=new Image();fiber.src='assets/diary/paper-fiber.jpg';

// Paint the already-laid-out diary pages. Browser glyph positions preserve the
// loaded Japanese handwriting and line wrapping on the animated 3D surfaces.
export function createDiaryPrint(spread, book, edgeColor=[190,187,175],{tape=true,images}={}) {
  const previous=book.style.transform;book.style.transform='none';
  const photos=[...spread.querySelectorAll('.diary-photo')],transforms=photos.map(p=>p.style.transform);
  photos.forEach(p=>{p.style.transform='none';});
  const canvases=[];
  try {
    for(const page of spread.children){
      const bounds=page.getBoundingClientRect(),height=960,width=Math.round(height*bounds.width/bounds.height),scale=height/bounds.height;
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d');ctx.scale(scale,scale);
      const w=bounds.width,h=bounds.height,left=page.classList.contains('diary-page--left');
      ctx.fillStyle='#ecdfb7';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='multiply';
      if(fiber.complete&&fiber.naturalWidth){const tile=document.createElement('canvas');tile.width=tile.height=512;tile.getContext('2d').drawImage(fiber,0,0,512,512);ctx.fillStyle=ctx.createPattern(tile,'repeat');ctx.fillRect(0,0,w,h);}
      const gradient=ctx.createLinearGradient(0,0,w,0);
      for(const [stop,color]of left?[[0,'#a87e3412'],[.2,'#fff4c900'],[.88,'#bc98552b'],[1,'#76562a6b']]:[[0,'#73502770'],[.05,'#b3975528'],[.16,'#fff4c900'],[.95,'#bb95431a'],[1,'#9c7a3b30']])gradient.addColorStop(stop,color);
      ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';
      const rect=el=>{const r=el.getBoundingClientRect();return {x:r.left-bounds.left,y:r.top-bounds.top,w:r.width,h:r.height};};
      const copy=page.querySelector('.diary-copy');
      if(copy&&!copy.querySelector('.diary-toc-entry')){
        const r=rect(copy),style=getComputedStyle(copy),font=parseFloat(style.fontSize),line=parseFloat(style.lineHeight);ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();ctx.fillStyle='#8a9b9b45';
        for(let y=r.y-font*.2+line-1;y<r.y+r.h;y+=line)ctx.fillRect(r.x,y,r.w,1);ctx.restore();
      }
      for(const row of page.querySelectorAll('.diary-word,.diary-toc-entry')){const r=rect(row);ctx.save();ctx.strokeStyle=row.classList.contains('diary-word')?'#9b7b4424':'#92724c66';ctx.lineWidth=1;if(row.classList.contains('diary-toc-entry'))ctx.setLineDash([1,2]);ctx.beginPath();ctx.moveTo(r.x,r.y+r.h-1);ctx.lineTo(r.x+r.w,r.y+r.h-1);ctx.stroke();ctx.restore();}
      for(const photo of page.querySelectorAll('.diary-photo')){
        const r=rect(photo),angle=parseFloat(photo.style.getPropertyValue('--photo-angle'))*Math.PI/180;
        ctx.save();ctx.translate(r.x+r.w/2,r.y+r.h/2);ctx.rotate(angle);ctx.translate(-r.w/2,-r.h/2);
        if(tape){ctx.shadowColor='#503c2f3d';ctx.shadowBlur=6;ctx.shadowOffsetX=1;ctx.shadowOffsetY=3;ctx.fillStyle='#f5ecd9';ctx.fillRect(0,0,r.w,r.h);ctx.shadowColor='transparent';}
        const img=photo.querySelector('img'),asset=images?.get(img.getAttribute('src'))||img,ir=rect(img);
        const fit=Math.min(ir.w/asset.naturalWidth,ir.h/asset.naturalHeight),iw=asset.naturalWidth*fit,ih=asset.naturalHeight*fit;
        ctx.filter=tape?'saturate(.88) sepia(.07)':'none';ctx.drawImage(asset,ir.x-r.x+(ir.w-iw)/2,ir.y-r.y+(ir.h-ih)/2,iw,ih);ctx.filter='none';
        if(tape)for(const [x,y,rotation]of [[-12,-7,-28],[r.w-32,r.h-9,-24]]){ctx.save();ctx.translate(x+21,y+8);ctx.rotate(rotation*Math.PI/180);ctx.fillStyle='#cfbd8d99';ctx.fillRect(-21,-8,42,16);ctx.restore();}
        ctx.restore();
      }
      const walker=document.createTreeWalker(page,NodeFilter.SHOW_TEXT),range=document.createRange();let text;
      while((text=walker.nextNode())){
        if(!text.textContent.trim())continue;
        const el=text.parentElement,style=getComputedStyle(el),size=parseFloat(style.fontSize);
        ctx.save();ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;ctx.fillStyle=style.color;ctx.globalAlpha=Number(style.opacity);ctx.textBaseline='alphabetic';
        const photo=el.closest('.diary-photo');if(photo){const r=rect(photo),angle=parseFloat(photo.style.getPropertyValue('--photo-angle'))*Math.PI/180;ctx.translate(r.x+r.w/2,r.y+r.h/2);ctx.rotate(angle);ctx.translate(-r.x-r.w/2,-r.y-r.h/2);}
        for(let i=0;i<text.length;i++){
          range.setStart(text,i);range.setEnd(text,i+1);const r=range.getBoundingClientRect(),character=text.textContent[i];if(!r.width)continue;
          const ascent=ctx.measureText(character).fontBoundingBoxAscent||size*.88;
          ctx.fillText(character,r.left-bounds.left,r.top-bounds.top+ascent);
        }ctx.restore();
      }
      canvases.push(canvas);
    }
  }finally{photos.forEach((p,i)=>{p.style.transform=transforms[i];});book.style.transform=previous;}
  const [left,right]=canvases,atlas=document.createElement('canvas');atlas.width=right.width*2;atlas.height=1000;
  const ctx=atlas.getContext('2d');ctx.drawImage(right,0,0,right.width,960);ctx.drawImage(left,right.width,0,right.width,960);
  ctx.fillStyle=`rgb(${edgeColor.join(',')})`;ctx.fillRect(0,960,atlas.width,40);
  for(let y=961;y<1000;y+=3){ctx.fillStyle=`rgb(${edgeColor.map(c=>Math.max(0,c-7)).join(',')})`;ctx.fillRect(0,y,atlas.width,1);}
  const texture=new THREE.CanvasTexture(atlas);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.anisotropy=4;
  return texture;
}
