/**
 * Allowed statuses for an Event through its lifecycle.
 *
 * - `draft`      – Event created, no photos uploaded yet
 * - `uploading`  – Photos are being uploaded
 * - `processing` – AI processing in progress
 * - `completed`  – All photos have been processed
 */
export const EventStatus = {
	DRAFT: 'draft',
	UPLOADING: 'uploading',
	PROCESSING: 'processing',
	COMPLETED: 'completed',
} as const

export type EventStatusType = (typeof EventStatus)[keyof typeof EventStatus]
