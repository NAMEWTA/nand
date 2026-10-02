// Element context fields follow Orca grab-guest-element-context-script / browser-grab-payload (MIT).
// Executed only in the guest; never exposes a host callback or Node bridge.
export const GRAB_ELEMENT_FUNCTION = `function(){
 const e=this,r=e.getBoundingClientRect(),s=getComputedStyle(e),styles={};
 for(const k of ['display','position','width','height','margin','padding','color','backgroundColor','border','borderRadius','fontFamily','fontSize','fontWeight','lineHeight','textAlign'])styles[k]=s[k];
 const parts=[];let n=e;for(let i=0;n&&n.nodeType===1&&i<6;i++,n=n.parentElement){let p=n.tagName.toLowerCase();if(n.id){parts.unshift(p+'#'+CSS.escape(n.id));break}const siblings=n.parentElement?[...n.parentElement.children].filter(x=>x.tagName===n.tagName):[];if(siblings.length>1)p+=':nth-of-type('+(siblings.indexOf(n)+1)+')';parts.unshift(p)}
 const clone=(e.parentElement||e).cloneNode(true);for(const input of clone.querySelectorAll('input,textarea')){input.removeAttribute('value');if(input.tagName==='TEXTAREA')input.textContent=''}
 let source=null;const key=Object.keys(e).find(k=>k.startsWith('__reactFiber$'));let fiber=key?e[key]:null;for(let i=0;fiber&&i<12;i++,fiber=fiber.return){const d=fiber._debugSource;if(d&&typeof d.fileName==='string'){source=d.fileName+':'+(d.lineNumber||1);break}}
 return {url:location.href,title:document.title,selector:parts.join(' > '),text:(e.innerText||e.textContent||'').slice(0,2000),html:clone.outerHTML.slice(0,6000),styles,source:source?source.slice(0,1000):null,rect:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight},screenshot:null};
}`;
