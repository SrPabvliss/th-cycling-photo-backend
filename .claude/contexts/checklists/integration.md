# Integration Checklist

Use when integrating new module or external service.

## Module Integration

- [ ] Module imports required dependencies
- [ ] CqrsModule imported (if using commands/queries)
- [ ] PrismaModule available (via Global)
- [ ] Required modules imported (if cross-module)
- [ ] Exports defined for shared providers

## External Service Integration

- [ ] Adapter created in `infrastructure/adapters/`
- [ ] Adapter implements interface (port)
- [ ] Error handling wraps with AppException.externalService()
- [ ] Environment variables defined
- [ ] Environment variables in .env.example
- [ ] ConfigService injected for env access

## Database Integration

- [ ] Prisma schema updated
- [ ] Migration created: `npx prisma migrate dev --name {name}`
- [ ] Migration tested locally
- [ ] Indexes added for query columns
- [ ] Relationships defined correctly

## Queue Integration (BullMQ)

- [ ] Queue registered in module
- [ ] Processor created in `infrastructure/processors/`
- [ ] Job data interface defined
- [ ] Error handling in processor
- [ ] WebSocket events for progress (if needed)
- [ ] Redis connection configured

## Testing Integration

- [ ] Test database configured
- [ ] Integration tests for repository
- [ ] E2E tests for new endpoints
- [ ] Tests cleanup data properly

## Final Verification

- [ ] Application starts without errors
- [ ] No circular dependency warnings
- [ ] All environment variables documented
- [ ] Health check endpoint works

---

## See Also

- `structure/module-setup.md` - Module configuration
- `infrastructure/prisma-setup.md` - Database setup
- `infrastructure/bullmq-setup.md` - Queue setup
