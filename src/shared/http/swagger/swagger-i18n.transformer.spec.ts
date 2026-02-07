import type { OpenAPIObject } from '@nestjs/swagger'
import { type SwaggerTranslations, translateDocument } from './swagger-i18n.transformer'

const translations: SwaggerTranslations = {
  meta: {
    title: 'Título traducido',
    description: 'Descripción traducida',
  },
  tags: {
    Events: 'Eventos',
  },
  translations: {
    'Create a new event': 'Crear un nuevo evento',
    'Event created successfully': 'Evento creado exitosamente',
    'Event UUID': 'UUID del evento',
    'Name of the cycling event': 'Nombre del evento ciclista',
  },
}

function makeDoc(overrides: Partial<OpenAPIObject> = {}): OpenAPIObject {
  return {
    openapi: '3.0.0',
    info: { title: 'Original Title', description: 'Original Description', version: '1.0.0' },
    paths: {},
    ...overrides,
  }
}

describe('translateDocument', () => {
  it('should translate info.title and info.description', () => {
    const result = translateDocument(makeDoc(), translations)

    expect(result.info.title).toBe('Título traducido')
    expect(result.info.description).toBe('Descripción traducida')
  })

  it('should translate tag names', () => {
    const doc = makeDoc({ tags: [{ name: 'Events' }] })
    const result = translateDocument(doc, translations)

    expect(result.tags).toEqual([{ name: 'Eventos' }])
  })

  it('should translate operation summaries', () => {
    const doc = makeDoc({
      paths: {
        '/events': {
          post: {
            summary: 'Create a new event',
            responses: {},
          },
        },
      },
    })
    const result = translateDocument(doc, translations)

    expect(result.paths['/events'].post.summary).toBe('Crear un nuevo evento')
  })

  it('should translate operation tag references', () => {
    const doc = makeDoc({
      paths: {
        '/events': {
          get: {
            tags: ['Events'],
            summary: 'List',
            responses: {},
          },
        },
      },
    })
    const result = translateDocument(doc, translations)

    expect(result.paths['/events'].get.tags).toEqual(['Eventos'])
  })

  it('should translate response descriptions', () => {
    const doc = makeDoc({
      paths: {
        '/events': {
          post: {
            responses: {
              '201': { description: 'Event created successfully' },
            },
          },
        },
      },
    })
    const result = translateDocument(doc, translations)

    expect(result.paths['/events'].post.responses['201'].description).toBe(
      'Evento creado exitosamente',
    )
  })

  it('should translate parameter descriptions', () => {
    const doc = makeDoc({
      paths: {
        '/events/{id}': {
          get: {
            parameters: [{ name: 'id', in: 'path', description: 'Event UUID' }],
            responses: {},
          },
        },
      },
    })
    const result = translateDocument(doc, translations)

    expect(result.paths['/events/{id}'].get.parameters[0].description).toBe('UUID del evento')
  })

  it('should translate schema property descriptions in components', () => {
    const doc = makeDoc({
      components: {
        schemas: {
          CreateEventDto: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the cycling event' },
            },
          },
        },
      },
    })
    const result = translateDocument(doc, translations)

    const schema = result.components?.schemas?.CreateEventDto as Record<string, unknown>
    const props = schema.properties as Record<string, { description: string }>
    expect(props.name.description).toBe('Nombre del evento ciclista')
  })

  it('should leave untranslated strings intact', () => {
    const doc = makeDoc({
      paths: {
        '/health': {
          get: {
            summary: 'Health check',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    })
    const result = translateDocument(doc, translations)

    expect(result.paths['/health'].get.summary).toBe('Health check')
    expect(result.paths['/health'].get.responses['200'].description).toBe('OK')
  })

  it('should not mutate the original document', () => {
    const doc = makeDoc({
      tags: [{ name: 'Events' }],
      paths: {
        '/events': {
          post: {
            summary: 'Create a new event',
            responses: { '201': { description: 'Event created successfully' } },
          },
        },
      },
    })

    const originalJson = JSON.stringify(doc)
    translateDocument(doc, translations)

    expect(JSON.stringify(doc)).toBe(originalJson)
  })

  it('should handle empty translations gracefully', () => {
    const emptyTranslations: SwaggerTranslations = {
      meta: { title: '', description: '' },
      tags: {},
      translations: {},
    }

    const doc = makeDoc({
      paths: {
        '/events': {
          post: {
            summary: 'Create a new event',
            responses: { '201': { description: 'Event created successfully' } },
          },
        },
      },
    })

    const result = translateDocument(doc, emptyTranslations)

    expect(result.info.title).toBe('')
    expect(result.paths['/events'].post.summary).toBe('Create a new event')
    expect(result.paths['/events'].post.responses['201'].description).toBe(
      'Event created successfully',
    )
  })
})
