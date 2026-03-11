import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NachaModule } from './nacha/nacha.module';

@Module({
  imports: [NachaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
