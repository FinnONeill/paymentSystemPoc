import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Header,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  /**
   * POST /nacha/validate/file
   * Accepts a NACHA file upload (multipart/form-data, field name "file").
   * Returns { valid: true, file } if the file parses and validates, or { valid: false, error } otherwise.
   */
  @Post('validate/file')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  validateFile(
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ):
    | { valid: true; file: NachaFile }
    | { valid: false; error: string } {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded. Send as multipart/form-data with field name "file".');
    }
    const content = file.buffer.toString('utf-8');
    return this.nachaService.validateFileContent(content);
  }
}
