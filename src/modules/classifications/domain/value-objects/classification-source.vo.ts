/**
 * Source of a cyclist classification.
 *
 * - `manual` – classified by a human operator
 * - `ai`     – classified by an AI pipeline
 */
export const ClassificationSource = {
  MANUAL: 'manual',
  AI: 'ai',
} as const

export type ClassificationSourceType =
  (typeof ClassificationSource)[keyof typeof ClassificationSource]
