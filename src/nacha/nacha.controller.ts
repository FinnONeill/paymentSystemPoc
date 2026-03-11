import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { NachaService } from './nacha.service';
import type { NachaFile } from './types';

@Controller('nacha')
export class NachaController {
  constructor(private readonly nachaService: NachaService) {}

  /**
   * GET /nacha/sample
   * Returns a sample NACHA file as plain text.
   */
  @Get('sample')
  @Header('Content-Type', 'text/plain')
  getSample(): string {
    return this.nachaService.getSampleNachaFile();
  }

  /**
   * POST /nacha/serialize
   * Accepts a NachaFile JSON body and returns the NACHA file as plain text.
   */
  @Post('serialize')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain')
  serialize(@Body() file: NachaFile): string {
    return this.nachaService.serialize(file);
  }

  /**
   * POST /nacha/parse
   * Accepts raw NACHA text in body (e.g. { "content": "..." }) and returns parsed NachaFile JSON.
   */
  @Post('parse')
  @HttpCode(HttpStatus.OK)
  parse(@Body() body: { content: string }): NachaFile {
    return this.nachaService.parse(body.content);
  }

  /**
   * GET /nacha/validate/routing/:routingNumber
   * Validates a 9-digit routing number.
   */
  @Get('validate/routing/:routingNumber')
  validateRouting(@Param('routingNumber') routingNumber: string): {
    valid: boolean;
  } {
    return this.nachaService.validateRoutingNumber(routingNumber);
  }
}
