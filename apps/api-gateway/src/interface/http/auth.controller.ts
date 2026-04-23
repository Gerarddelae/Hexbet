import { Controller, Post, Body, Logger } from '@nestjs/common';
import { IsString, IsEmail } from 'class-validator';
import { JwtAuthAdapter } from '../../infrastructure/adapters/jwt-auth.adapter';

export class GenerateTokenDto {
  @IsString()
  userId!: string;

  @IsEmail()
  email!: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly jwtAuthAdapter: JwtAuthAdapter) {}

  @Post('token')
  async generateToken(@Body() dto: GenerateTokenDto): Promise<{ token: string }> {
    this.logger.log(`Generating token for user: ${dto.userId}`);
    const token = await this.jwtAuthAdapter.generateToken({
      userId: dto.userId,
      email: dto.email,
    });
    return { token };
  }
}