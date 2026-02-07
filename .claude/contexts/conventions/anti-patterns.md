# Anti-Patterns

Quick reference of common mistakes. Each pattern file has detailed anti-patterns.

## Architecture

❌ **Logic in wrong layer:**
```typescript
// Handler with business logic
async execute(command: CreateEventCommand) {
  if (command.date < new Date()) {  // Should be in Entity
    throw new Error('Invalid date');
  }
}

// Repository with business logic
async save(event: Event) {
  if (event.status === 'COMPLETED') {  // Should be in Entity
    await this.notify();
  }
}

// Controller with logic
@Post()
async create(@Body() dto: CreateEventDto) {
  if (!dto.name) {  // Should be in DTO validation
    throw new BadRequestException();
  }
}
```

✅ **Logic in correct layer:**
```typescript
// Entity has business logic
static create(data: CreateEventData): Event {
  if (data.date < new Date()) {
    throw AppException.businessRule('event.date_in_past');
  }
}
```

---

## Controllers

❌ **Missing @SuccessMessage:**
```typescript
@Post()
// BAD: No success message for response envelope
async create(@Body() dto: CreateEventDto) {
  return this.commandBus.execute(command);
}
```

✅ **With @SuccessMessage:**
```typescript
@Post()
@SuccessMessage('success.CREATED')
async create(@Body() dto: CreateEventDto) {
  return this.commandBus.execute(command);
}
```

---

## CQRS

❌ **Fat handlers:**
```typescript
async execute(command: CreateEventCommand) {
  // 50+ lines of logic
  // Multiple validations
  // Multiple repository calls
  // Data transformations
}
```

✅ **Thin handlers:**
```typescript
async execute(command: CreateEventCommand) {
  const event = Event.create(command);
  return { id: (await this.repository.save(event)).id };
}
```

---

## Queries

❌ **Overfetching:**
```typescript
return this.prisma.event.findMany({
  include: {
    photos: {
      include: {
        detected_cyclists: true,
        detected_colors: true,
      },
    },
  },
});
```

✅ **Specific select:**
```typescript
return this.prisma.event.findMany({
  select: {
    id: true,
    name: true,
    status: true,
  },
});
```

---

## Repositories

❌ **Mapping inside repository:**
```typescript
async save(event: Event): Promise<Event> {
  const data = {
    id: event.id,
    name: event.name,
    // ... 20 lines of mapping
  };
}
```

✅ **Mapper functions:**
```typescript
async save(event: Event): Promise<Event> {
  const data = EventMapper.toPersistence(event);
  const saved = await this.prisma.event.upsert({
    where: { id: event.id },
    create: data,
    update: data,
  });
  return EventMapper.toEntity(saved);
}
```

---

## Exceptions

❌ **Generic errors:**
```typescript
throw new Error('Invalid date');
throw new BadRequestException('Not found');
```

✅ **AppException factory methods:**
```typescript
throw AppException.businessRule('event.date_in_past');
throw AppException.notFound('Event', id);
```

---

## Validation

❌ **Validation in handler:**
```typescript
async execute(command: CreateEventCommand) {
  if (!command.name || command.name.length < 3) {
    throw new Error('Name too short');
  }
}
```

✅ **Validation in correct layer:**
```typescript
// DTO for HTTP validation
export class CreateEventDto {
  @IsString()
  @MinLength(3)
  name: string;
}

// Entity for business validation
static create(data: CreateEventData): Event {
  if (data.date < new Date()) {
    throw AppException.businessRule('event.date_in_past');
  }
}
```

---

## Testing

❌ **Tests without assertions:**
```typescript
it('should create event', async () => {
  await handler.execute(command);
  // No expect!
});
```

❌ **Testing implementation details:**
```typescript
expect(repository.save).toHaveBeenCalledWith(
  expect.objectContaining({
    _status: 'DRAFT',  // Testing private field
  })
);
```

✅ **Testing behavior:**
```typescript
it('should create event in DRAFT status', async () => {
  const result = await handler.execute(command);
  const event = await repository.findById(result.id);
  expect(event.status).toBe('DRAFT');
});
```

---

## Git

❌ **Bad commit messages:**
```
fix stuff
wip
asdfasdf
fixed the bug
feat(events): add event creation  # Missing ticket!
```

❌ **Bad branch names:**
```
feat/TTV-123-create-event-command  # No description needed
my-feature
fix-bug
```

✅ **Correct format:**
```bash
# Commits: type(scope): [ticket] subject
feat(events): [TTV-1001] add event creation command
fix(photos): [TTV-1023] prevent duplicate uploads

# Branches: type/ticket
feat/TTV-1001
fix/TTV-1023
```

---

## File Organization

❌ **Technical-first structure:**
```
src/
├── controllers/
├── services/
├── repositories/
└── entities/
```

✅ **Feature-first structure:**
```
src/modules/events/
├── domain/
├── application/
├── infrastructure/
└── presentation/
```

---

## See Also

- `patterns/*.md` - Detailed patterns with anti-patterns
- `testing/*.md` - Testing anti-patterns
- `conventions/*.md` - Convention violations
