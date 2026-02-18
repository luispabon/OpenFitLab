import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { EventInterface } from '@sports-alliance/sports-lib';
import { AppProcessingService } from '../../../services/app.processing.service';
import { ApiEventService } from '../../../services/api-event.service';
import { LoggerService } from '../../../services/logger.service';
import { UploadAbstractDirective } from '../upload-abstract.directive';
import { FileInterface } from '../file.interface';

@Component({
  selector: 'app-upload-activities',
  standalone: true,
  templateUrl: './upload-activities.component.html',
  styleUrls: ['./upload-activities.component.css'],
})
export class UploadActivitiesComponent extends UploadAbstractDirective implements OnInit {
  private eventService = inject(ApiEventService);

  constructor(
    snackBar: MatSnackBar,
    dialog: MatDialog,
    processingService: AppProcessingService,
    router: Router,
    logger: LoggerService
  ) {
    super(snackBar, dialog, processingService, router, logger);
  }

  override ngOnInit(): void {
    super.ngOnInit();
  }

  override async processAndUploadFile(fileItem: FileInterface): Promise<EventInterface> {
    try {
      // Simply upload the file - backend will handle parsing
      await this.eventService.writeAllEventData(this.user, fileItem.file);
      this.logger.log('Successfully uploaded file:', fileItem.filename);
      // Return a minimal event object for compatibility
      // The actual event will be created by the backend
      return {} as EventInterface;
    } catch (e) {
      this.snackBar.open(
        `Could not upload ${fileItem.filename}.${fileItem.extension}: ${e instanceof Error ? e.message : String(e)}`,
        'OK',
        { duration: 3000 }
      );
      throw e;
    }
  }
}
