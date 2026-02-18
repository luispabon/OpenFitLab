import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import {
  EventInterface,
  User,
  EventImporterJSON,
  EventImporterFIT,
  EventImporterGPX,
  EventImporterTCX,
  EventImporterSuuntoJSON,
  EventImporterSuuntoSML,
  EventUtilities,
  ActivityParsingOptions,
  EventJSONInterface,
  ActivityJSONInterface,
  StreamInterface,
} from '@sports-alliance/sports-lib';
import { environment } from '../../environments/environment';
import { uploadFileToApi } from '@openfitlab/shared';
import type { AppEventInterface } from '@openfitlab/shared';
import { EventJSONSanitizer } from '../utils/event-json-sanitizer';
import { AppEventUtilities } from '../utils/app.event.utilities';
import { AppFileService } from './app.file.service';
import { LoggerService } from './logger.service';

const API = environment.apiUrl || '';

@Injectable({ providedIn: 'root' })
export class ApiEventService {
  private http = inject(HttpClient);
  private fileService = inject(AppFileService);
  private logger = inject(LoggerService);

  getEventsOnceBy(
    _user: User,
    whereClauses: { fieldPath: string; opStr: string; value: number }[],
    _orderByField: string,
    _asc: boolean,
    limitCount: number
  ): Observable<EventInterface[]> {
    let params: { startDate?: string; endDate?: string; limit: string } = { limit: String(limitCount || 50) };
    for (const w of whereClauses) {
      if (w.fieldPath === 'startDate' && w.opStr === '>=') params.startDate = String(w.value);
      if (w.fieldPath === 'startDate' && w.opStr === '<=') params.endDate = String(w.value);
    }
    return this.http.get<unknown[]>(`${API}/events`, { params }).pipe(
      map((rows) => this.mapEventsFromApi(rows)),
      catchError((e) => {
        this.logger.error('getEventsOnceBy', e);
        return of([]);
      })
    );
  }

  getEventsBy(
    user: User,
    where: { fieldPath: string; opStr: string; value: number }[],
    orderBy: string,
    asc: boolean,
    limit: number
  ): Observable<EventInterface[]> {
    return this.getEventsOnceBy(user, where, orderBy, asc, limit);
  }

  getEventAndActivities(user: User, eventID: string): Observable<AppEventInterface | null> {
    return this.http.get<{ event: unknown; activities: unknown[] }>(`${API}/events/${eventID}`).pipe(
      map((res) => this.buildEventWithActivities(eventID, res.event, res.activities)),
      catchError((e) => {
        this.logger.error('getEventAndActivities', e);
        return of(null);
      })
    );
  }

  getEventActivitiesAndSomeStreams(user: User, eventID: string, streamTypes?: string[]): Observable<EventInterface | null> {
    return this.getEventAndActivities(user, eventID).pipe(
      switchMap((event) => {
        if (!event) return of(null);
        return this.attachStreamsToEventWithActivities(user, event, streamTypes);
      }),
      map((e) => e ?? null)
    );
  }

  attachStreamsToEventWithActivities(
    user: User,
    event: AppEventInterface,
    streamTypes?: string[]
  ): Observable<EventInterface> {
    const ev = event as unknown as EventInterface;
    const eventID = event.getID();
    if (!eventID) return of(ev);
    
    const activities = ev.getActivities();
    if (activities.length === 0) return of(ev);
    
    // First try to get streams from database
    const streamRequests = activities.map((activity) => {
      const activityID = activity.getID();
      if (!activityID) return of([]);
      
      let url = `${API}/events/${eventID}/activities/${activityID}/streams`;
      if (streamTypes && streamTypes.length > 0) {
        const params = new URLSearchParams();
        streamTypes.forEach(type => params.append('types', type));
        url += `?${params.toString()}`;
      }
      
      return this.http.get<unknown[]>(url).pipe(
        map((streamsJson) => {
          if (!Array.isArray(streamsJson)) return [];
          return streamsJson.map((s: unknown) => {
            try {
              const { sanitizedJson } = EventJSONSanitizer.sanitize(s);
              return EventImporterJSON.getStreamFromJSON(sanitizedJson as never);
            } catch (err) {
              this.logger.warn('Failed to parse stream', s, err);
              return null;
            }
          }).filter((s): s is any => s !== null);
        }),
        catchError((e) => {
          this.logger.warn('Failed to fetch streams from API', e);
          return of([]);
        })
      );
    });
    
    return from(Promise.all(streamRequests.map(r => r.toPromise()))).pipe(
      switchMap((streamsArrays) => {
        // Check if we got any streams from DB
        const hasDbStreams = streamsArrays.some(arr => arr && arr.length > 0);
        
        if (hasDbStreams) {
          // Attach DB streams
          activities.forEach((activity, idx) => {
            const streams = streamsArrays[idx] || [];
            if (streams.length > 0) {
              activity.clearStreams();
              activity.addStreams(streams);
            }
          });
          return of(ev);
        }
        
        // No DB streams found - fallback to parsing from files
        if ((event.originalFiles && event.originalFiles.length > 0) || (event.originalFile && event.originalFile.path)) {
          return from(this.calculateStreamsFromFiles(event)).pipe(
            map((fullEvent) => {
              if (!fullEvent) return ev;
              // Merge streams from files with existing activities
              const fileActivities = fullEvent.getActivities();
              activities.forEach((activity) => {
                const fileActivity = fileActivities.find(a => a.getID() === activity.getID());
                if (fileActivity) {
                  // Get streams from file activity - try common stream types
                  const commonStreamTypes = ['Heart Rate', 'Distance', 'Time', 'Duration', 'Speed', 'Power', 'Cadence', 'Latitude Degrees', 'Longitude Degrees'];
                  const streamsToAdd: StreamInterface[] = [];
                  commonStreamTypes.forEach((type) => {
                    try {
                      const stream = fileActivity.getStream(type);
                      if (stream) {
                        streamsToAdd.push(stream);
                      }
                    } catch (e) {
                      // Stream doesn't exist, skip
                    }
                  });
                  if (streamsToAdd.length > 0) {
                    activity.clearStreams();
                    activity.addStreams(streamsToAdd);
                  }
                }
              });
              return ev;
            }),
            catchError((e) => {
              this.logger.error('attachStreamsToEventWithActivities: error parsing from files', e);
              return of(ev);
            })
          );
        }
        
        // No streams available
        return of(ev);
      }),
      catchError((e) => {
        this.logger.error('attachStreamsToEventWithActivities: error attaching streams', e);
        return of(ev);
      })
    );
  }

  private async calculateStreamsFromFiles(event: AppEventInterface): Promise<EventInterface | null> {
    const files = event.originalFiles?.length ? event.originalFiles : event.originalFile ? [event.originalFile] : [];
    if (files.length === 0) return null;
    const parsed = await Promise.all(
      files.map((f: { path: string; originalFilename?: string }) => this.fetchAndParseOneFile(f))
    );
    const valid = parsed.filter((e: EventInterface | null): e is EventInterface => !!e);
    if (valid.length === 0) return null;
    if (valid.length === 1) return valid[0];
    return EventUtilities.mergeEvents(valid);
  }

  private async fetchAndParseOneFile(fileMeta: { path: string; originalFilename?: string }): Promise<EventInterface | null> {
    try {
      const path =
        fileMeta.path.startsWith('http') ? fileMeta.path : fileMeta.path.startsWith('/') ? fileMeta.path : `${API}/${fileMeta.path}`;
      const arrayBuffer = await this.http.get(path, { responseType: 'arraybuffer' }).toPromise();
      if (!arrayBuffer) return null;
      const decompressed = await this.fileService.decompressIfNeeded(arrayBuffer, fileMeta.originalFilename);
      const ext = (fileMeta.originalFilename?.split('.').pop() || 'bin').toLowerCase();
      const gz = ext === 'gz' ? (fileMeta.originalFilename?.split('.').slice(0, -1).pop() || 'bin').toLowerCase() : ext;
      const options = new ActivityParsingOptions({ generateUnitStreams: false });
      let ev: EventInterface | null = null;
      if (gz === 'fit') {
        ev = await EventImporterFIT.getFromArrayBuffer(decompressed, options);
      } else if (gz === 'gpx') {
        ev = await EventImporterGPX.getFromString(new TextDecoder().decode(decompressed), options);
      } else if (gz === 'tcx') {
        ev = await EventImporterTCX.getFromXML(new DOMParser().parseFromString(new TextDecoder().decode(decompressed), 'application/xml'), options);
      } else if (gz === 'json') {
        const json = JSON.parse(new TextDecoder().decode(decompressed));
        const { sanitizedJson } = EventJSONSanitizer.sanitize(json);
        ev = await EventImporterSuuntoJSON.getFromJSONString(JSON.stringify(sanitizedJson));
      } else if (gz === 'sml') {
        ev = await EventImporterSuuntoSML.getFromXML(new TextDecoder().decode(decompressed));
      }
      if (ev && !ev.getActivities().some((a) => a.hasStreamData('Time'))) {
        ev.getActivities().forEach((a) => AppEventUtilities.enrich(a, ['Time', 'Duration']));
      }
      return ev;
    } catch (e) {
      this.logger.error('fetchAndParseOneFile', e);
      return null;
    }
  }

  async writeAllEventData(
    user: User,
    file: File
  ): Promise<void> {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    await uploadFileToApi(base, user.uid, file);
  }

  deleteAllEventData(_user: User, eventID: string): Promise<boolean> {
    return this.http
      .delete(`${API}/events/${eventID}`, { observe: 'response' })
      .toPromise()
      .then((r) => r?.status === 204)
      .catch(() => false);
  }

  getEventCount(user: User): Promise<number> {
    return this.getEventsOnceBy(user, [], 'startDate', false, 10000)
      .pipe(map((list) => list.length))
      .toPromise()
      .then((n) => n ?? 0) as Promise<number>;
  }

  private mapEventsFromApi(rows: unknown[]): EventInterface[] {
    const results: EventInterface[] = [];
    (rows || []).forEach((r: unknown, index: number) => {
      try {
        const row = r as Record<string, unknown>;
        const eventId = (row['id'] as string) ?? `unknown-${index}`;
        const { sanitizedJson, unknownTypes } = EventJSONSanitizer.sanitize(row);
        if (unknownTypes.length > 0) {
          this.logger.warn(`Event ${eventId} has unknown data types:`, unknownTypes);
        }
        const event = EventImporterJSON.getEventFromJSON(sanitizedJson as EventJSONInterface);
        event.setID(eventId);
        if (row['originalFiles']) (event as AppEventInterface).originalFiles = row['originalFiles'] as AppEventInterface['originalFiles'];
        if (row['originalFile']) (event as AppEventInterface).originalFile = row['originalFile'] as AppEventInterface['originalFile'];
        results.push(event);
      } catch (error) {
        const eventId = (r as Record<string, unknown>)?.['id'] as string ?? `unknown-${index}`;
        console.error(`Failed to map event ${eventId} from API:`, error);
        console.error('Event data:', r);
        this.logger.error(`Failed to map event ${eventId} from API`, { event: r, error });
      }
    });
    return results;
  }

  private buildEventWithActivities(eventID: string, eventRow: unknown, activitiesRow: unknown[]): AppEventInterface {
    if (!eventRow || typeof eventRow !== 'object') {
      throw new Error('Event payload is missing or invalid');
    }
    const { sanitizedJson } = EventJSONSanitizer.sanitize(eventRow);
    if (!sanitizedJson || typeof sanitizedJson !== 'object') {
      throw new Error('Event JSON could not be sanitized');
    }
    const event = EventImporterJSON.getEventFromJSON(sanitizedJson as EventJSONInterface).setID(eventID) as AppEventInterface;
    const raw = eventRow as Record<string, unknown>;
    if (raw['originalFiles']) event.originalFiles = raw['originalFiles'] as AppEventInterface['originalFiles'];
    if (raw['originalFile']) event.originalFile = raw['originalFile'] as AppEventInterface['originalFile'];
    const ev = event as unknown as EventInterface;
    ev.clearActivities();
    const activities = Array.isArray(activitiesRow) ? activitiesRow : [];
    for (const a of activities) {
      if (a == null || typeof a !== 'object') continue;
      try {
        // Ensure required fields exist before sanitization
        const activityData: Record<string, unknown> = { ...(a as Record<string, unknown>) };
        // Ensure stats exists (even if empty)
        if (!activityData['stats'] || typeof activityData['stats'] !== 'object' || activityData['stats'] === null) {
          activityData['stats'] = {};
        }
        // Ensure arrays exist
        if (!Array.isArray(activityData['laps'])) activityData['laps'] = [];
        if (!Array.isArray(activityData['events'])) activityData['events'] = [];
        if (!Array.isArray(activityData['intensityZones'])) activityData['intensityZones'] = [];
        // Ensure creator exists
        if (!activityData['creator'] || typeof activityData['creator'] !== 'object' || activityData['creator'] === null) {
          activityData['creator'] = { name: '', isRecognized: false };
        }
        
        const { sanitizedJson: aSanitized } = EventJSONSanitizer.sanitize(activityData);
        if (!aSanitized || typeof aSanitized !== 'object') {
          this.logger.warn('buildEventWithActivities: activity sanitization returned invalid result', a);
          continue;
        }
        const activity = EventImporterJSON.getActivityFromJSON(aSanitized as ActivityJSONInterface);
        const aRow = a as Record<string, unknown>;
        if (aRow['id']) activity.setID(String(aRow['id']));
        ev.addActivity(activity);
      } catch (err) {
        this.logger.warn('buildEventWithActivities: skip invalid activity', a, err);
      }
    }
    return event;
  }
}
