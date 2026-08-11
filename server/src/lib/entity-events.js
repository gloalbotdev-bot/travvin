/**
 * In-process entity change bus for SSE (M6).
 */
import { EventEmitter } from 'node:events';

export const entityEvents = new EventEmitter();
entityEvents.setMaxListeners(200);

/**
 * @param {string} entityType
 * @param {{ type: 'create'|'update'|'delete', id: string, data?: object }} event
 */
export function publishEntityChange(entityType, event) {
  entityEvents.emit(entityType, event);
}
