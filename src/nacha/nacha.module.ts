import { Module } from '@nestjs/common';
import { NachaController } from './nacha.controller';
import { NachaService } from './nacha.service';

@Module({
  controllers: [NachaController],
  providers: [NachaService],
  exports: [NachaService],
})
export class NachaModule {}
