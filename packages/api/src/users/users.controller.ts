import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(
    @Body() createUserDto: CreateUserDto,
    @CurrentTenant() tenantId: string,
    @Req() req: { user: { role: UserRole } },
  ) {
    return this.usersService.create(createUserDto, tenantId, req.user.role);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Return all users' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findAll(@CurrentTenant() tenantId: string) {
    return this.usersService.findAll(tenantId);
  }

  @Get('access-requests')
  @Roles(UserRole.SUPER_ADMIN)
  findAccessRequests(@CurrentTenant() tenantId: string) {
    return this.usersService.findAccessRequests(tenantId);
  }

  @Patch('access-requests/:id/approve')
  @Roles(UserRole.SUPER_ADMIN)
  approveAccessRequest(
    @Param('id') id: string,
    @Body('role') role: UserRole,
    @CurrentTenant() tenantId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.usersService.approveAccessRequest(id, role, tenantId, req.user.id);
  }

  @Patch('access-requests/:id/reject')
  @Roles(UserRole.SUPER_ADMIN)
  rejectAccessRequest(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.usersService.rejectAccessRequest(id, tenantId, req.user.id);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiResponse({ status: 200, description: 'Return the user' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.usersService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentTenant() tenantId: string,
    @Req() req: { user: { role: UserRole } },
  ) {
    return this.usersService.update(id, updateUserDto, tenantId, req.user.role);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.usersService.remove(id, tenantId);
  }

  @Patch(':id/role')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  updateRole(
    @Param('id') id: string,
    @Body('role') role: UserRole,
    @CurrentTenant() tenantId: string,
  ) {
    return this.usersService.updateRole(id, role, tenantId);
  }

  @Patch(':id/location')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign user to location' })
  @ApiResponse({ status: 200, description: 'Location assigned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  assignLocation(
    @Param('id') id: string,
    @Body('locationId') locationId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.usersService.assignLocation(id, locationId, tenantId);
  }
} 