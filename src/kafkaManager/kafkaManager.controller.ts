import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { KafkaManagerService } from './kafkaManager.service';

interface ProduceTestEventRequest {
  readonly id: string;
}

@Controller('kafka')
export class KafkaManagerController {
  constructor(private readonly kafkaService: KafkaManagerService) {}

  @Get('schema/validate')
  @HttpCode(HttpStatus.OK)
  async validateSchema(): Promise<{ valid: true }> {
    await this.kafkaService.validateSchema();
    return { valid: true };
  }

  @Post('test-produce')
  @HttpCode(HttpStatus.ACCEPTED)
  async produceTestEvent(
    @Body() body: ProduceTestEventRequest,
  ): Promise<{ status: 'queued'; id: string }> {
    await this.kafkaService.produceTestEvent(body.id);
    return { status: 'queued', id: body.id };
  }
}

