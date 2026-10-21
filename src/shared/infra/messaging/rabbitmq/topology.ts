const EXCHANGE = 'picks.events';

const ROUTING_KEYS = {
  PICK_CREATED: 'pick.created',
  PICK_CREATED_RETRY: 'pick.created.retry',
  PICK_CREATED_DEAD: 'pick.created.dead',
  PICK_COMPLETED: 'pick.completed',
  PICK_FAILED: 'pick.failed',
  PICK_AUDIT_RETRY: 'pick.audit.retry',
  PICK_AUDIT_DEAD: 'pick.audit.dead',
  // Distinct from PICK_CREATED/COMPLETED/FAILED so a redelivered audit message triggers exactly once.
  PICK_AUDIT_REDELIVER: 'pick.audit.redeliver',
} as const;

// Exact-match keys only — a `#`/`*` wildcard would also catch the retry/dead keys and double-process.
const AUDIT_BINDING_KEYS = [
  ROUTING_KEYS.PICK_CREATED,
  ROUTING_KEYS.PICK_COMPLETED,
  ROUTING_KEYS.PICK_FAILED,
  ROUTING_KEYS.PICK_AUDIT_REDELIVER,
] as const;

const QUEUES = {
  INVENTORY: 'picks.inventory',
  INVENTORY_RETRY: 'picks.inventory.retry',
  INVENTORY_DLQ: 'picks.inventory.dlq',
  AUDIT: 'picks.audit',
  AUDIT_RETRY: 'picks.audit.retry',
  AUDIT_DLQ: 'picks.audit.dlq',
} as const;

export { EXCHANGE, ROUTING_KEYS, QUEUES, AUDIT_BINDING_KEYS };
