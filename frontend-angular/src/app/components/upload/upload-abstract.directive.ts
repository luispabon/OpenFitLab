import { Directive, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '@sports-alliance/sports-lib';
import { FileInterface } from './file.interface';
import { UPLOAD_STATUS } from './upload-status/upload.status';
import { LoggerService } from '../../services/logger.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { AppProcessingService } from '../../services/app.processing.service';

@Directive()
export abstract class UploadAbstractDirective implements OnInit {
  @Input() user!: User;
  @Input() hasProAccess = false;
  @Input() requiresPro = false;
  public isUploading = false;

  constructor(
    protected snackBar: MatSnackBar,
    protected dialog: MatDialog,
    protected processingService: AppProcessingService,
    protected router: Router,
    protected logger: LoggerService
  ) {}

  ngOnInit(): void {
    if (!this.user) {
      throw new Error('This component can only be used with a user');
    }
  }

  abstract processAndUploadFile(file: FileInterface): Promise<unknown>;

  async getFiles(event: Event): Promise<void> {
    event.stopPropagation();
    event.preventDefault();
    if (this.requiresPro && !this.hasProAccess) {
      this.snackBar.open('This feature is available for Pro users.', 'OK', { duration: 5000 });
      return;
    }
    const ev = event as { target?: { files?: FileList }; dataTransfer?: DataTransfer };
    const files = ev.target?.files || ev.dataTransfer?.files;
    const rawFiles = files ? Array.from(files) : [];
    const filesToProcess: FileInterface[] = rawFiles.map((file) => {
      const name = file.name;
      let extension = name.split('.').pop()?.toLowerCase() ?? '';
      let filename = name.split('.').shift() ?? name;
      if (extension === 'gz') {
        const parts = name.split('.');
        parts.pop();
        extension = parts.pop()?.toLowerCase() ?? '';
        filename = parts.join('.');
      }
      const jobId = this.processingService.addJob('upload', `Uploading ${name}...`);
      return {
        file,
        name,
        extension,
        filename,
        jobId,
        status: UPLOAD_STATUS.PROCESSING,
      };
    });
    if (filesToProcess.length === 0) {
      const t = ev.target as HTMLInputElement | undefined;
      if (t) t.value = '';
      return;
    }
    this.isUploading = true;
    let successfulUploads = 0;
    let failedUploads = 0;
    try {
      for (const fileItem of filesToProcess) {
        this.processingService.updateJob(fileItem.jobId!, { status: 'processing', progress: 0 });
        try {
          await this.processAndUploadFile(fileItem);
          this.processingService.completeJob(fileItem.jobId!);
          successfulUploads++;
        } catch (e: unknown) {
          this.logger.error(e);
          this.processingService.failJob(fileItem.jobId!, e instanceof Error ? e.message : 'Upload failed');
          failedUploads++;
        }
      }
    } finally {
      this.isUploading = false;
    }
    this.snackBar.open(
      `Processed ${filesToProcess.length} files: ${successfulUploads} successful, ${failedUploads} failed`,
      'OK',
      { duration: 5000 }
    );
    if (ev.dataTransfer?.items) ev.dataTransfer.items.clear();
    else if (ev.dataTransfer) ev.dataTransfer.clearData();
    const t = ev.target as HTMLInputElement | undefined;
    if (t) t.value = '';
  }
}
