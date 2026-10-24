import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const icon=await readFile(new URL('../web/app/favicon.ico',import.meta.url));
assert.equal(icon.readUInt16LE(0),0,'ICO reserved field');
assert.equal(icon.readUInt16LE(2),1,'ICO image type');
const count=icon.readUInt16LE(4),sizes=[];
assert.ok(count>0&&icon.length>=6+16*count,'ICO directory is complete');
for(let i=0;i<count;i++){
 const position=6+16*i,width=icon[position]||256,height=icon[position+1]||256;
 const length=icon.readUInt32LE(position+8),offset=icon.readUInt32LE(position+12);
 assert.ok(offset>=6+16*count&&length>=33&&offset+length<=icon.length,'ICO image data is in bounds');
 const png=icon.subarray(offset,offset+length);
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Embedded image is a PNG');
 assert.equal(png.subarray(12,16).toString(),'IHDR','PNG has an image header');
 assert.equal(png.readUInt32BE(16),width,'PNG width matches ICO entry');
 assert.equal(png.readUInt32BE(20),height,'PNG height matches ICO entry');
 assert.equal(icon.readUInt16LE(position+6),32,'ICO declares 32 bits per pixel');
 assert.equal(png[24],8,'PNG uses 8 bits per channel');
 assert.equal(png[25],6,'ICO PNG must be RGBA for the Next.js/Turbopack decoder');
 sizes.push(width);
}
assert.deepEqual(sizes,[16,32,48,256],'Required browser icon sizes');
console.log(`${count} favicon variants passed RGBA, dimensions, and ICO format checks.`);
