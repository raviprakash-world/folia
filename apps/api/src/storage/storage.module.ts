import { Module } from '@nestjs/common';
import { STORAGE_SERVICE } from './storage.interface';
import { LocalStorageService } from './local-storage.service';
import { FilesController } from './files.controller';

@Module({
  controllers: [FilesController],
  providers: [{ provide: STORAGE_SERVICE, useClass: LocalStorageService }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
