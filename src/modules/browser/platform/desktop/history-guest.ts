import { bundledMain, desktopRemote } from '../../../../host/desktop/electron-main';

/** Electron restore() requires a guest that has never loaded a page. Suppress the
 * bootstrap URL, then hand the attached guest to BrowserPage so its normal security
 * policy is installed before restoring any history entry. */
export const HISTORY_GUEST_SOURCE = String.raw`
const {webContents}=require('electron');
exports.prepare=(owners,token,ready)=>{
 let disposed=false;const offs=[];
 const dispose=()=>{if(disposed)return;disposed=true;for(const off of offs.splice(0))off();};
 for(const id of owners){
  const owner=webContents.fromId(id);if(!owner||owner.isDestroyed())continue;
  let instance;
  const before=(_event,_prefs,params)=>{if(params.partition===token){instance=params.instanceId;params.src='';}};
  const attached=(_event,guest)=>{if(instance===undefined||guest.viewInstanceId!==instance)return;dispose();ready(guest.id);};
  owner.on('will-attach-webview',before);owner.on('did-attach-webview',attached);
  offs.push(()=>{if(!owner.isDestroyed()){owner.removeListener('will-attach-webview',before);owner.removeListener('did-attach-webview',attached);}});
 }
 return {dispose};
};`;

export function prepareHistoryGuest(broker: Window, element: HTMLElement, ready: (id: number) => void): () => void {
	const brokerId = desktopRemote(broker).getCurrentWebContents().id;
	const owner = element.win;
	const ownerId =
		owner === broker
			? brokerId
			: (owner as Window & { electronWindow: { webContents: { id: number } } }).electronWindow.webContents.id;
	const runtime = bundledMain<{
		prepare(owners: number[], token: string, ready: (id: number) => void): { dispose(): void };
	}>(broker, HISTORY_GUEST_SOURCE);
	const binding = runtime.prepare([...new Set([brokerId, ownerId])], element.getAttribute('partition')!, ready);
	return () => binding.dispose();
}
