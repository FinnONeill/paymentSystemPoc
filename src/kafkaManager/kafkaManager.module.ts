import { Module } from '@nestjs/common';
import { KafkaManagerController } from './kafkaManager.controller';
import { KafkaManagerService } from './kafkaManager.service';

@Module({
  controllers: [KafkaManagerController],
  providers: [KafkaManagerService],
})
export class KafkaManagerModule {}

