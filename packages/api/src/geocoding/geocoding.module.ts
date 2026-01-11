import { Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { AddressController } from './address.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [PrismaModule, ConfigModule],
    controllers: [AddressController],
    providers: [GeocodingService],
    exports: [GeocodingService],
})
export class GeocodingModule { }
