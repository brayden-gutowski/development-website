import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=file=>readFileSync(new URL('../'+file,import.meta.url));
const sha=data=>createHash('sha256').update(data).digest('hex');
test('Every XP illustration icon and cursor is pinned to its original runtime bytes',()=>{
 const manifest=JSON.parse(read('assets/xp/icon-provenance.json'));
 const source=read('xp-desktop.js').toString(),css=read('xp-desktop.css').toString();
 assert.deepEqual(JSON.parse(source.match(/const ICONS=(\{[^\n]+\});/)[1]),manifest.mapping);
 const known=new Map([...manifest.icons,...manifest.cursors].map(item=>[item.file,item]));
 for(const item of known.values()){assert.equal(sha(read('assets/xp/'+item.file)),item.sha256,item.file);assert.match(item.url,/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[a-f0-9]{40}\//,'Assets must be pinned to an immutable commit');}
 for(const [,cursor] of css.matchAll(/assets\/xp\/([^']+\.cur)/g))assert.ok(known.has(cursor),'Runtime cursor needs provenance: '+cursor);
 for(const file of Object.values(manifest.mapping))assert.ok(known.has(file));
 const ani=read('assets/xp/hand.ani'),position=ani.indexOf('icon'),length=ani.readUInt32LE(position+4);
 assert.deepEqual(read('assets/xp/hand-native.cur'),ani.subarray(position+8,position+8+length),'Hand cursor preserves original pixel and hotspot bytes');
 assert.equal(read('assets/xp/hand-native.cur').readUInt16LE(2),2);
});
