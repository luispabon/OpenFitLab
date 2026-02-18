import { ActivityInterface, EventInterface, EventUtilities } from '@sports-alliance/sports-lib';

export class AppEventUtilities {
  static mergeEventsWithId(events: EventInterface[], idGenerator: () => string): EventInterface {
    const merged = EventUtilities.mergeEvents(events);
    merged.setID(idGenerator());
    return merged;
  }

  static enrich(activity: ActivityInterface, streamsToEnrich: string[]): void {
    if (streamsToEnrich.includes('Time')) this.enrichTimeStream(activity);
    if (streamsToEnrich.includes('Duration')) this.enrichDurationStream(activity);
  }

  private static enrichTimeStream(activity: ActivityInterface): void {
    if (activity.hasStreamData('Time')) return;
    try {
      const a = activity as unknown as { generateTimeStream?: () => unknown; addStream?: (s: unknown) => void };
      if (a.generateTimeStream && a.addStream) a.addStream(a.generateTimeStream());
    } catch (e) {
      console.warn('[AppEventUtilities] enrichTimeStream', e);
    }
  }

  private static enrichDurationStream(activity: ActivityInterface): void {
    if (activity.hasStreamData('Duration')) return;
    try {
      const a = activity as unknown as { generateDurationStream?: () => unknown; addStream?: (s: unknown) => void };
      if (a.generateDurationStream && a.addStream) a.addStream(a.generateDurationStream());
    } catch (e) {
      console.warn('[AppEventUtilities] enrichDurationStream', e);
    }
  }
}
