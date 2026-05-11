import {
  BibReadingStatus,
  ColorRegion,
  ProcessingStageName,
  ProcessingStageStatus,
} from '@generated/prisma/client'
import { z } from 'zod'

const BboxTuple = z.tuple([z.number(), z.number(), z.number(), z.number()])

export const PipelineResponseV1Schema = z.object({
  schema_version: z.string(),
  image_id: z.string(),
  detections: z.array(
    z.object({
      class_name: z.string(),
      class_id: z.number().int(),
      confidence: z.number().min(0).max(1),
      bbox: BboxTuple,
    }),
  ),
  bib_readings: z.array(
    z.object({
      digits: z.string(),
      confidence: z.number().min(0).max(1),
      confidence_per_digit: z.array(z.number()),
      status: z.nativeEnum(BibReadingStatus),
      rejection_reason: z.string().nullable(),
      preprocessing_applied: z.array(z.string()),
      bbox_source: BboxTuple,
      raw_ocr_text: z.string().nullable(),
      processing_ms: z.number(),
      crop_path: z.string().nullable().optional(),
    }),
  ),
  color_analyses: z.array(
    z.object({
      region: z.nativeEnum(ColorRegion),
      primary_color: z.string(),
      secondary_color: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      bbox_source: BboxTuple,
      strategy: z.string(),
      processing_ms: z.number(),
      crop_path: z.string().nullable().optional(),
    }),
  ),
  image_width: z.number().int(),
  image_height: z.number().int(),
  processing_ms: z.number(),
  timings: z.object({
    total_ms: z.number(),
    detection_ms: z.number(),
    ocr_ms: z.number(),
    color_ms: z.number(),
  }),
  stage_results: z.array(
    z.object({
      stage: z.nativeEnum(ProcessingStageName),
      status: z.nativeEnum(ProcessingStageStatus),
      items_processed: z.number().int().nonnegative(),
      items_succeeded: z.number().int().nonnegative(),
      items_failed: z.number().int().nonnegative(),
      notes: z.array(z.string()),
    }),
  ),
  model_versions: z.object({
    detection: z.string(),
    ocr: z.string(),
    color: z.string(),
  }),
})

export type PipelineResponseV1 = z.infer<typeof PipelineResponseV1Schema>

export const HealthResponseV1Schema = z.object({
  status: z.string(),
  models_loaded: z.array(z.string()),
  ram_usage_mb: z.number(),
})
export type HealthResponseV1 = z.infer<typeof HealthResponseV1Schema>
