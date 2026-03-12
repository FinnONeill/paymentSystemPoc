import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NachaModule } from './nacha/nacha.module';
import { KafkaManagerModule } from './kafkaManager/kafkaManager.module';

@Module({
  imports: [NachaModule, KafkaManagerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
