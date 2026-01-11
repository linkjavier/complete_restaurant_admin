import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('address')
@Controller('address')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AddressController {
    constructor(private readonly geocodingService: GeocodingService) { }

    @Post('validate')
    @ApiOperation({ summary: 'Validate delivery address and assign closest branch' })
    @ApiResponse({ status: 201, description: 'Address validated and branch assigned' })
    async validateAddress(@Body('address') address: string, @Req() req: any) {
        const tenantId = req.tenantId || req.user.tenantId;
        return this.geocodingService.validateAndAssignLocation(address, tenantId);
    }
}
