import { expect,test } from 'vitest';
import { placeCaptureLine } from './capture';
test('captures preserve frontmatter and paragraph boundaries at either end',()=>{
 const raw='---\ntags: [idea]\n---\nParagraph';
 expect(placeCaptureLine(raw,'- New','start')).toBe('---\ntags: [idea]\n---\n- New\n\nParagraph');
 expect(placeCaptureLine(raw,'- New','end')).toBe(raw+'\n- New\n');
 expect(placeCaptureLine('---\ntags: x','- New','start')).toBe('- New\n\n---\ntags: x');
});
