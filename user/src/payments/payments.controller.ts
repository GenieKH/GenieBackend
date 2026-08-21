import { Controller, Post, Body, Headers, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  private getUserId(req: any): string {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return req.user.userId;
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  initiateCheckout(@Req() req: any, @Body('propertyId') propertyId: string) {
    const userId = this.getUserId(req);
    return this.paymentsService.initiateCheckout(userId, propertyId);
  }

  @Post('webhook')
  handleWebhook(@Headers('x-signature') signature: string, @Body() payload: any) {
    return this.paymentsService.handleWebhook(payload, signature || '');
  }
}

