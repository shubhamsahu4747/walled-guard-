import { SiteAdapter } from './types';
import { chatgptAdapter } from './chatgpt';
import { perplexityAdapter } from './perplexity';

const adapters: SiteAdapter[] = [chatgptAdapter, perplexityAdapter];

export function findAdapterByHostname(hostname: string): SiteAdapter | null {
  const cleanHost = hostname.toLowerCase().replace(/:\d+$/, '');
  for (const adapter of adapters) {
    if (adapter.hosts.some((h) => cleanHost === h || cleanHost.endsWith('.' + h))) {
      return adapter;
    }
  }
  return null;
}

export function findAdapterById(id: string): SiteAdapter | null {
  return adapters.find((a) => a.id === id) || null;
}

export function getAllAdapters(): SiteAdapter[] {
  return [...adapters];
}
