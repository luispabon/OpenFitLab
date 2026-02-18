export {
  EVENT_DUPLICATE_THRESHOLD_MS,
  generateEventID,
  generateActivityID,
  generateIDFromParts,
} from './id-generator';

export type { OriginalFileMetaData, AppEventInterface } from './app-event.interface';

export {
  writeEventToApi,
  uploadFileToApi,
  type OriginalFileInput,
  type WriteEventToApiResult,
  type UploadFileToApiResult,
} from './api-event-writer';
