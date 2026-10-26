/**
 * Tiny event bus between the plugin entry (index.js: buttons, life cycle)
 * and the React UI.
 */
type Handler = (payload?: any) => void;
const handlers: {[event: string]: Set<Handler>} = {};

export type BusEvent = 'capture' | 'open-settings' | 'ui-shown' | 'ui-hidden';

export function emit(event: BusEvent, payload?: any) {
  const set = handlers[event];
  if (set) set.forEach(h => h(payload));
}

export function on(event: BusEvent, h: Handler): () => void {
  (handlers[event] = handlers[event] || new Set()).add(h);
  return () => {
    handlers[event] && handlers[event].delete(h);
  };
}
