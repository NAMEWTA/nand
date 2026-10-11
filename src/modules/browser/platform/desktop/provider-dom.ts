/** Projected public DOM evidence; absent identities are never manufactured from positions. */
export interface ProviderDomMessage {
 id: string;
	selector?: string;
	copy?: { root: string; button: string };
 parentId?: string;
 parentKnown: boolean;
 role: 'user' | 'assistant';
 text: string;
 html: string;
 partial: boolean;
}
export interface ProviderDom {
 url: string;
 conversationId?: string;
 composer?: { selector: string; value: string };
 submit?: { selector: string; shared: boolean; signature: string };
 newConversation?: string;
 generating: boolean;
 loginRequired: boolean;
 challenge: boolean;
 messages: ProviderDomMessage[];
 messageRootCount: number;
 messageIdentitiesComplete: boolean;
 interrupted: boolean;
}
