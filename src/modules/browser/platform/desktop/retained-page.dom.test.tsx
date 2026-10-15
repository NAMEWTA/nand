import { it, expect, vi } from 'vitest';
import { RetainedPage } from './retained-page';
it('retains guest parent and page identity through hide, move, resize and final release',()=>{
 const one=document.body.appendChild(document.createElement('div')),two=document.body.appendChild(document.createElement('div'));
 for(const el of [one,two]){vi.spyOn(el,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);vi.spyOn(el,'getBoundingClientRect').mockReturnValue({left:20,top:40,width:400,height:300} as DOMRect);}
 const a=new RetainedPage(document,'a'),b=new RetainedPage(document,'b'),guest=a.element.appendChild(document.createElement('webview')),parent=guest.parentNode,root=a.element.parentNode;
 a.mount(one);expect(a.element.classList.contains('is-visible')).toBe(true);a.unmount();expect(a.element.inert).toBe(true);
 a.mount(two);expect(guest.parentNode).toBe(parent);expect(a.element.parentNode).toBe(root);expect(a.element.style.width).toBe('400px');
 two.hidden=true;a.mount(two);expect(a.element.classList.contains('is-visible')).toBe(false);a.dispose();expect(document.querySelector('[data-nand-browser-retained-root]')).not.toBeNull();b.dispose();expect(document.querySelector('[data-nand-browser-retained-root]')).toBeNull();one.remove();two.remove();
});
