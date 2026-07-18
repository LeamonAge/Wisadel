import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, currentUser } from '../shared/auth.guard';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('sanity')
  account(@Req() request: Request) {
    return this.billing.account(currentUser(request).sub);
  }

  @Get('sanity/ledger')
  ledger(@Req() request: Request) {
    return this.billing.ledger(currentUser(request).sub);
  }
}
