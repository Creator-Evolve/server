import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserDto } from '../dto/user.request.dto';
import { UserService } from '../services/user.service';
import { Serialize } from 'interceptors/serialize.interceptor';
import { UserResponseDto } from '../dto/user.response.dto';
import { AuthGuard } from '@/common/guards/auth.guard';

@Controller({
  path: 'users',
  version: '1',
})
@UseGuards(AuthGuard)
@Serialize(UserResponseDto)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body() body: UserDto) {
    return this.userService.create(body);
  }

  @Get('/:id')
  async getUserById(@Param('id') id: string) {
    return this.userService.getUserByIdRouteHandler(id);
  }
}
