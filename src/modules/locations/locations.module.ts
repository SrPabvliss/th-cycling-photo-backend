import { GetCantonsByProvinceHandler } from '@locations/application/queries/get-cantons-by-province/get-cantons-by-province.handler'
import { GetProvincesHandler } from '@locations/application/queries/get-provinces/get-provinces.handler'
import { LocationValidator } from '@locations/application/services'
import { LOCATION_READ_REPOSITORY } from '@locations/domain/ports'
import { LocationReadRepository } from '@locations/infrastructure/repositories/location-read.repository'
import { LocationsController } from '@locations/presentation/controllers/locations.controller'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

const QueryHandlers = [GetProvincesHandler, GetCantonsByProvinceHandler]

@Module({
  imports: [CqrsModule],
  controllers: [LocationsController],
  providers: [
    ...QueryHandlers,
    { provide: LOCATION_READ_REPOSITORY, useClass: LocationReadRepository },
    LocationValidator,
  ],
  exports: [LOCATION_READ_REPOSITORY, LocationValidator],
})
export class LocationsModule {}
