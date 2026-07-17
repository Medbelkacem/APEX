/** Names of the BullMQ queues used across the platform. */
export const QUEUE_EMAIL = 'email';
export const QUEUE_PDF = 'pdf';
export const QUEUE_STATEMENTS = 'statements';

/** Default job options: retry with exponential backoff (DRS reliability req). */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 1000,
  // Keep failed jobs so they can be inspected (acts as a dead-letter store).
  removeOnFail: false,
};
