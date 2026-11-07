// Deterministic launcher exports from the user's existing Mazda logo.
// Run locally; the committed PNGs do not require a browser on Render.
import fs from 'node:fs';
import {chromium} from '@playwright/test';
const source='data:image/png;base64,'+fs.readFileSync('public/mazdaLogo.png').toString('base64');
const icons=[
 {name:'favicon-32.png',size:32,scale:.94},
 {name:'apple-touch-icon.png',size:180,scale:.78},
 {name:'mazda-app-192.png',size:192,scale:.78},
 {name:'mazda-app-512.png',size:512,scale:.78},
 {name:'mazda-maskable-512.png',size:512,scale:.64},
];
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 const files=await page.evaluate(async({source,icons})=>{
   const logo=new Image();logo.src=source;await logo.decode();
   return icons.map(icon=>{
     const canvas=document.createElement('canvas');canvas.width=canvas.height=icon.size;
     const context=canvas.getContext('2d');context.fillStyle='#090b0e';context.fillRect(0,0,icon.size,icon.size);
     context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
     const side=icon.size*icon.scale;context.drawImage(logo,(icon.size-side)/2,(icon.size-side)/2,side,side);
     return {name:icon.name,data:canvas.toDataURL('image/png').split(',')[1]};
   });
 },{source,icons});
 for(const file of files)fs.writeFileSync('public/'+file.name,Buffer.from(file.data,'base64'));
 fs.copyFileSync('public/mazda-app-192.png','public/icon-192.png');
 fs.copyFileSync('public/mazda-app-512.png','public/icon-512.png');
 const icon192=fs.readFileSync('public/mazda-app-192.png').toString('base64');
 fs.writeFileSync('public/icon.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><title>My Garage Mazda emblem</title><image width="192" height="192" href="data:image/png;base64,${icon192}"/></svg>`);
 console.log('Exported Mazda favicon, Apple touch icon, and regular/maskable app icons.');
}finally{await browser.close();}
