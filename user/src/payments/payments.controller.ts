import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  private getUserId(headers: Record<string, string>): string {
    const userId = headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException('x-user-id header is missing');
    }
    return userId;
  }

  @Post('checkout')
  initiateCheckout(@Headers() headers: Record<string, string>, @Body('propertyId') propertyId: string) {
    const userId = this.getUserId(headers);
    return this.paymentsService.initiateCheckout(userId, propertyId);
  }

  @Post('webhook')
  handleWebhook(@Headers('x-signature') signature: string, @Body() payload: any) {
    return this.paymentsService.handleWebhook(payload, signature || '');
  }
}
