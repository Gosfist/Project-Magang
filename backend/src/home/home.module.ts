import { FinanceModule } from '../finance/finance.module.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { HomeController } from './home.controller.js';

@Module({ imports: [AuthModule, FinanceModule], controllers: [HomeController] })
export class HomeModule { }
