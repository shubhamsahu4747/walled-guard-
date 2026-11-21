import { SiteId } from '../shared/types';

export interface SiteSelectors {
  editor: string[];
  sendButton: string[];
  fileInput: string[];
  dropZone: string[];
  assistantMessage: string[];
}

export interface SiteAdapter {
  id: SiteId;
  name: string;
  hosts: string[];
  selectors: SiteSelectors;
  getPromptText: (root?: Document | Element) => string;
  responseCss: (color: string) => string;
}
