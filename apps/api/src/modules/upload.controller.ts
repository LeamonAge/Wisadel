import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../shared/auth.guard';
import { ImageStorageService } from '../shared/image-storage.service';

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Controller('uploads')
@UseGuards(AuthGuard)
export class UploadController {
  constructor(private readonly images: ImageStorageService) {}

  @Post('images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  async image(@UploadedFile() file?: UploadedImage) {
    if (!file) throw new BadRequestException('请选择图片');
    return { url: await this.images.save(file.buffer, file.mimetype) };
  }

  @Post('files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  async file(@UploadedFile() file?: UploadedImage) {
    if (!file) throw new BadRequestException('请选择文件');
    return this.images.saveFile(file.buffer, file.mimetype || 'application/octet-stream', file.originalname || 'attachment');
  }
}
