// Samples adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads, dashboard-template.md and scripts/verify-{pair-width,library-card-size,notes-cover}.ts
import { expect, test } from 'vitest';
import template from './__fixtures__/apex-dashboard-template.md';
import { parse, serialize } from './parse';

test('apex template reads all cards and an untouched round trip preserves exact bytes', () => {
 const data=parse(template);
 expect(data.columns.map(c=>[c.name,c.cards.length])).toEqual([['Memo',2],['Todo',2],['Projects',3]]);
 expect(data.columns[1]!.cards[1]!.tasks.map(t=>t.checked)).toEqual([true,false,false]);
 expect(data.columns[2]!.cards[0]!.docs.map(d=>d.path)).toEqual(['obsidian-dashboard/README.md','obsidian-dashboard/src/main.ts']);
 expect(serialize(data)).toBe(template);
 const changed=structuredClone(data); changed.columns[0]!.cards[0]!.title='Renamed';
 const output=serialize(changed);
 expect(output).toContain('### Renamed');expect(output).toContain('quickLinks:');
 expect(parse(output).columns.map(c=>c.cards.length)).toEqual([2,2,3]);
 expect(output).toMatchSnapshot();
});
const paired=(extra:string)=>['---','columns:',"  - name: A","    color: '#111111'",'    half: true',extra,"  - name: B","    color: '#222222'",'    half: true','---','','## A','','## B'].join('\n');
test('apex paired widths, folder preferences and notes covers survive an explicit edit',()=>{
 const data=parse(paired('    width: 40\n    type: projects\n    showCover: false\n    library:\n      folders: [Notes]\n      templatePaths: [A.md, B.md]\n      viewMode: gallery\n      cardSize: small'));
 expect(data.columns[0]).toMatchObject({width:40,half:true,showCover:false,libraryConfig:{folders:['Notes'],templatePaths:['A.md','B.md'],cardSize:'small'}});
 data.columns[0]!.width=60;data.columns[0]!.showCover=true;
 const round=parse(serialize(data));expect(round.columns[0]!.width).toBe(60);expect(round.columns[0]!.showCover).toBeUndefined();
 expect(round.columns[0]!.libraryConfig).toEqual(data.columns[0]!.libraryConfig);
 for(const bad of [5,95,-1,101])expect(parse(paired('    width: '+bad)).columns[0]!.width).toBeUndefined();
});
test('web shortcut open targets and nested task/doc state are preserved across a card move',()=>{
 const data=parse('---\ncolumns:\n - name: A\n   type: sticky\n - name: B\n   type: sticky\n---\n## A\n### Link\ntype: web\nopenIn: system\nurl: https://example.com\n- [x] Parent\n    - [ ] Child\n- [[Note.md]]\n## B\n');
 const card=data.columns[0]!.cards.shift()!;card.column='B';data.columns[1]!.cards.push(card);
 const round=parse(serialize(data));expect(round.columns[1]!.cards[0]).toMatchObject({openIn:'system',tasks:[{checked:true,children:[{checked:false,text:'Child'}]}],docs:[{path:'Note.md'}]});
});
