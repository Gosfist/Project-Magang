import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { HomeController } from './home.controller.js';

@Module({ imports: [AuthModule], controllers: [HomeController] })
export class HomeModule { }
