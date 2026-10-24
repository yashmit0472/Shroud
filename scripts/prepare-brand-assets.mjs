import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(new URL('../web/package.json',import.meta.url));
const sharp=require('sharp');
const root=new URL('../web/',import.meta.url);
const source=new URL('public/brand/shroud-logo-source.png',root);
await mkdir(new URL('public/brand/',root),{recursive:true});
for(const [path,size] of [['public/brand/shroud-logo.png',512],['public/brand/shroud-google-logo.png',120],['public/brand/shroud-icon-32.png',32],['app/icon.png',512],['app/apple-icon.png',180]]){
 await sharp(source.pathname.replace(/^\/([A-Za-z]:)/,'$1')).resize(size,size,{fit:'contain'}).png().toFile(new URL(path,root).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
}
// ICO entries declare 32 bits per pixel, so embedded PNGs must contain RGBA,
// even when the approved source image has a fully opaque RGB background.
const sizes=[16,32,48,256],images=await Promise.all(sizes.map(size=>sharp(source.pathname.replace(/^\/([A-Za-z]:)/,'$1')).resize(size,size).ensureAlpha().png().toBuffer()));
const header=Buffer.alloc(6+16*images.length);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);
let offset=header.length;
images.forEach((image,index)=>{const position=6+16*index;header[position]=sizes[index]===256?0:sizes[index];header[position+1]=header[position];header.writeUInt16LE(1,position+4);header.writeUInt16LE(32,position+6);header.writeUInt32LE(image.length,position+8);header.writeUInt32LE(offset,position+12);offset+=image.length;});
await writeFile(new URL('app/favicon.ico',root),Buffer.concat([header,...images]));
for(const path of ['app/opengraph-image.png','app/twitter-image.png']){
 await sharp(source.pathname.replace(/^\/([A-Za-z]:)/,'$1')).resize(1200,630,{fit:'contain',background:'#101010'}).png().toFile(new URL(path,root).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
}
console.log('Prepared Shroud logo, Google upload, browser and Apple icons, and social preview images.');
