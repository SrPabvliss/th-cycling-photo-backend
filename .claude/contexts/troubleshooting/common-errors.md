# Common Errors

## Prisma Errors

### P2002 - Unique Constraint

```
Unique constraint failed on the fields: (`email`)
```

**Cause**: Trying to insert duplicate value in unique column.

**Fix**:
```typescript
try {
  await this.prisma.user.create({ data });
} catch (error) {
  if (error.code === 'P2002') {
    throw AppException.businessRule('user.email_exists');
  }
  throw error;
}
```

### P2025 - Record Not Found

```
An operation failed because it depends on one or more records that were required but not found.
```

**Cause**: Update/delete on non-existent record.

**Fix**:
```typescript
const event = await this.repository.findById(id);
if (!event) {
  throw AppException.notFound('event', id);
}
```

### P2003 - Foreign Key Constraint

```
Foreign key constraint failed on the field: `event_id`
```

**Cause**: Referenced record doesn't exist.

**Fix**: Validate parent exists before creating child.

---

## NestJS Errors

### Cannot Resolve Dependencies

```
Nest can't resolve dependencies of the EventsController (?). 
Please make sure that the argument EventWriteRepository at index [0] is available
```

**Cause**: Provider not registered in module.

**Fix**:
```typescript
@Module({
  providers: [
    EventWriteRepository,  // Add missing provider
    CreateEventHandler,
  ],
})
```

### Circular Dependency

```
A circular dependency has been detected
```

**Cause**: Module A imports Module B which imports Module A.

**Fix**: 
- Use `forwardRef()`
- Or restructure to avoid circular imports

```typescript
@Module({
  imports: [forwardRef(() => PhotosModule)],
})
export class EventsModule {}
```

---

## Validation Errors

### Validation Failed

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "fields": {
      "name": ["must be longer than or equal to 5 characters"]
    }
  }
}
```

**Cause**: DTO validation failed.

**Fix**: Check input matches DTO constraints.

### Transform Not Working

```
Expected Date, received string
```

**Cause**: Missing `@Type()` decorator.

**Fix**:
```typescript
@IsDate()
@Type(() => Date)  // Add this
date: Date;
```

---

## TypeScript Errors

### Type 'X' is not assignable to type 'Y'

**Common in**: Entity ↔ Prisma mapping.

**Fix**: Check Mapper methods have correct types.

### Property 'X' does not exist on type 'Y'

**Cause**: Accessing property not in type definition.

**Fix**: 
- Add property to interface
- Or use type assertion (carefully)

---

## Test Errors

### Cannot find module '@/...'

**Cause**: Path alias not configured in Jest.

**Fix** in `jest.config.js`:
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/$1',
}
```

### Database Connection in Tests

```
Can't reach database server at `localhost:5432`
```

**Cause**: Test database not running.

**Fix**:
```bash
# Start test database
docker-compose up -d postgres-test

# Or use .env.test
NODE_ENV=test npx prisma migrate deploy
```

---

## Runtime Errors

### Cannot Read Property 'X' of Undefined

**Common in**: Missing null checks.

**Fix**:
```typescript
// Bad
const name = event.name;

// Good
const name = event?.name;

// Or with AppException
if (!event) {
  throw AppException.notFound('event', id);
}
```

### Maximum Call Stack Exceeded

**Cause**: Infinite recursion, often in circular references.

**Fix**: Check for circular object references, especially in mappers.

---

## BullMQ Errors

### Connection Refused (Redis)

```
connect ECONNREFUSED 127.0.0.1:6379
```

**Cause**: Redis not running.

**Fix**:
```bash
docker-compose up -d redis
```

### Job Stalled

**Cause**: Job took too long, worker crashed.

**Fix**: Increase timeout or handle in smaller chunks.

---

## See Also

- `infrastructure/prisma-setup.md` - Prisma error handling
- `conventions/error-handling.md` - AppException usage
- `infrastructure/bullmq-setup.md` - Queue errors
