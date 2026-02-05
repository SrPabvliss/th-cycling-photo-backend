import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OpenAPIObject } from '@nestjs/swagger'

export interface SwaggerTranslations {
  meta: { title: string; description: string }
  tags: Record<string, string>
  translations: Record<string, string>
}

export function loadSwaggerTranslations(lang: string): SwaggerTranslations {
  const filePath = join(__dirname, '..', '..', '..', 'i18n', lang, 'swagger.json')
  const raw = readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as SwaggerTranslations
}

export function translateDocument(
  doc: OpenAPIObject,
  translations: SwaggerTranslations,
): OpenAPIObject {
  const translated: OpenAPIObject = JSON.parse(JSON.stringify(doc))
  const { meta, tags, translations: t } = translations

  const tr = (text: string | undefined): string | undefined =>
    text !== undefined ? (t[text] ?? text) : undefined

  // Info
  translated.info.title = meta.title
  translated.info.description = meta.description

  // Tags
  if (translated.tags) {
    for (const tag of translated.tags) {
      if (tags[tag.name]) tag.name = tags[tag.name]
    }
  }

  // Paths
  if (translated.paths) {
    for (const pathItem of Object.values(translated.paths)) {
      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const) {
        const operation = pathItem[method]
        if (!operation) continue

        operation.summary = tr(operation.summary)
        operation.description = tr(operation.description)

        // Translate tag references in operations
        if (operation.tags) {
          operation.tags = operation.tags.map((tag: string) => tags[tag] ?? tag)
        }

        // Parameters
        if (operation.parameters) {
          for (const param of operation.parameters) {
            if ('description' in param) param.description = tr(param.description)
          }
        }

        // Request body
        if (operation.requestBody && 'content' in operation.requestBody) {
          for (const mediaType of Object.values(operation.requestBody.content)) {
            if (mediaType.schema && 'description' in mediaType.schema) {
              mediaType.schema.description = tr(mediaType.schema.description)
            }
          }
        }

        // Responses
        if (operation.responses) {
          for (const response of Object.values(operation.responses)) {
            if (response && 'description' in response) {
              response.description = tr(response.description) ?? response.description
            }
          }
        }
      }
    }
  }

  // Component schemas
  translateSchemas(translated.components?.schemas, t)

  return translated
}

function translateSchemas(
  schemas: Record<string, unknown> | undefined,
  t: Record<string, string>,
): void {
  if (!schemas) return

  for (const schema of Object.values(schemas)) {
    translateSchemaObject(schema as Record<string, unknown>, t)
  }
}

function translateSchemaObject(schema: Record<string, unknown>, t: Record<string, string>): void {
  if (!schema || typeof schema !== 'object') return

  if (typeof schema.description === 'string') {
    schema.description = t[schema.description] ?? schema.description
  }

  if (schema.properties && typeof schema.properties === 'object') {
    for (const prop of Object.values(schema.properties as Record<string, unknown>)) {
      translateSchemaObject(prop as Record<string, unknown>, t)
    }
  }

  if (schema.items && typeof schema.items === 'object') {
    translateSchemaObject(schema.items as Record<string, unknown>, t)
  }

  if (schema.allOf && Array.isArray(schema.allOf)) {
    for (const item of schema.allOf) translateSchemaObject(item as Record<string, unknown>, t)
  }

  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    for (const item of schema.oneOf) translateSchemaObject(item as Record<string, unknown>, t)
  }

  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    for (const item of schema.anyOf) translateSchemaObject(item as Record<string, unknown>, t)
  }
}
