import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EventInterface,
  User,
  DataInterface,
  DataDuration,
  DataMovingTime,
  DataDistance,
  DataEnergy,
  DataHeartRateAvg,
  DataHeartRateMin,
  DataHeartRateMax,
  DataSpeedAvg,
  DataCadenceAvg,
  DataPowerAvg,
  DataAscent,
  DataDescent,
  DataAltitudeMax,
  DataAltitudeMin,
  DataActivityTypes,
  ActivityTypesHelper,
  ActivityTypes,
  ActivityTypeGroups,
  Privacy,
} from '@sports-alliance/sports-lib';
import { EventResolverData } from '../../resolvers/event.resolver';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { IconService } from '../../services/icon.service';

// Activity type icon mapping - must match AppActivityTypeGroupIcons from original
const ACTIVITY_TYPE_ICONS: { [key in ActivityTypeGroups]: string } = {
  [ActivityTypeGroups.Running]: 'directions_run',
  [ActivityTypeGroups.TrailRunning]: 'directions_run',
  [ActivityTypeGroups.Cycling]: 'directions_bike',
  [ActivityTypeGroups.Swimming]: 'pool',
  [ActivityTypeGroups.Performance]: 'workspace_premium',
  [ActivityTypeGroups.IndoorSports]: 'fitness_center', // This should show dumbbell for weight training
  [ActivityTypeGroups.OutdoorAdventures]: 'hiking',
  [ActivityTypeGroups.WinterSports]: 'ac_unit',
  [ActivityTypeGroups.WaterSports]: 'rowing',
  [ActivityTypeGroups.Diving]: 'scuba_diving',
  [ActivityTypeGroups.TeamRacket]: 'sports_tennis',
  [ActivityTypeGroups.Unspecified]: 'category',
};

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './event-detail.component.html',
  styleUrls: ['./event-detail.component.scss'],
})
export class EventDetailComponent implements OnInit {
  event: EventInterface | null = null;
  user: User | null = null;
  private iconService = inject(IconService);
  private rawEventData: any = null;

  constructor(private route: ActivatedRoute) {
    const data = this.route.snapshot.data['eventData'] as EventResolverData | undefined;
    if (data) {
      this.event = data.event;
      this.user = data.user;
      // Store raw data for fallback
      this.rawEventData = (this.event as any)?._rawData || null;
    }
  }

  ngOnInit(): void {
    this.iconService.registerIcons();
  }

  get mainActivityType(): string {
    if (!this.event) return '';
    
    // First try to get from activities
    const activities = this.event.getActivities();
    if (activities.length > 0 && activities[0].type) {
      return activities[0].type;
    }
    
    // Fall back to getting from event stats (Activity Types stat)
    try {
      const activityTypesStat = this.event.getStat(DataActivityTypes.type);
      if (activityTypesStat) {
        const types = (activityTypesStat as DataActivityTypes).getValue();
        if (Array.isArray(types) && types.length > 0) {
          return types[0];
        }
        // If getValue() returns a string directly
        if (typeof types === 'string') {
          return types;
        }
      }
    } catch (e) {
      // Stat doesn't exist or error accessing it
    }
    
    // Last resort: try to get from raw stats if available
    // This handles the case where stats are in the API response but not yet processed
    // The API returns "Activity Types" (with space) but the stat type might be different
    try {
      const eventAny = this.event as any;
      // Try "Activity Types" (from API)
      if (eventAny.stats) {
        const activityTypes = eventAny.stats['Activity Types'] || eventAny.stats[DataActivityTypes.type];
        if (activityTypes) {
          if (Array.isArray(activityTypes) && activityTypes.length > 0) {
            return activityTypes[0];
          }
          if (typeof activityTypes === 'string') {
            return activityTypes;
          }
        }
      }
      // Also try accessing via getStatsAsArray or getStats
      const allStats = this.event.getStatsAsArray();
      for (const stat of allStats) {
        if (stat.getType() === DataActivityTypes.type) {
          const value = (stat as DataActivityTypes).getValue();
          if (Array.isArray(value) && value.length > 0) {
            return value[0];
          }
          if (typeof value === 'string') {
            return value;
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
    
    return '';
  }

  get activityTypeIcon(): string {
    if (!this.event) return 'category';
    const activityType = this.mainActivityType;
    if (!activityType) return 'category';
    
    // Handle comma-separated activity types (take first)
    const activities = activityType.split(',').map(a => a.trim());
    const activity = activities[0];
    
    // Special cases first
    if (activity === 'Virtual Cycling' || activity === 'VirtualRide') {
      return 'computer';
    }
    if (activity === 'Virtual Running' || activity === 'VirtualRun') {
      return 'computer';
    }
    
    // Try to get the enum value - handle both enum key and enum value
    let activityTypeEnum: ActivityTypes;
    try {
      if (ActivityTypes[activity as keyof typeof ActivityTypes]) {
        activityTypeEnum = ActivityTypes[activity as keyof typeof ActivityTypes];
      } else if (Object.values(ActivityTypes).includes(activity as ActivityTypes)) {
        activityTypeEnum = activity as ActivityTypes;
      } else {
        // Try to find by matching the string value
        const found = Object.entries(ActivityTypes).find(([_, value]) => value === activity);
        if (found) {
          activityTypeEnum = found[1] as ActivityTypes;
        } else {
          activityTypeEnum = ActivityTypes.Other;
        }
      }
      
      const group = ActivityTypesHelper.getActivityGroupForActivityType(activityTypeEnum);
      return ACTIVITY_TYPE_ICONS[group] || 'category';
    } catch (e) {
      console.error('Error getting activity type icon:', e, activity);
      return 'category';
    }
  }

  get heroStats(): { value: string; unit: string; type: string }[] {
    if (!this.event) return [];
    const type = this.mainActivityType;
    const activityTypeEnum = ActivityTypes[type as keyof typeof ActivityTypes] || ActivityTypes.Other;
    const group = ActivityTypesHelper.getActivityGroupForActivityType(activityTypeEnum);

    let statTypes: string[];
    if (type === 'Virtual Cycling' || type === 'VirtualRide') {
      statTypes = [DataDuration.type, DataPowerAvg.type];
    } else if (group === ActivityTypeGroups.IndoorSports) {
      statTypes = [DataDuration.type, DataEnergy.type];
    } else {
      statTypes = [DataDistance.type, DataDuration.type];
    }

    const results: { value: string; unit: string; type: string }[] = [];
    for (const statType of statTypes) {
      try {
        const stat = this.event.getStat(statType);
        if (stat) {
          results.push({
            value: String(stat.getDisplayValue()),
            unit: stat.getDisplayUnit(),
            type: statType,
          });
        }
      } catch {
        // Stat doesn't exist, skip it
      }
    }
    return results;
  }

  // Overall tab widgets
  get overallStats(): DataInterface[] {
    if (!this.event) return [];
    const stats = Array.from(this.event.getStats().values());
    const keyStatTypes = [
      DataDuration.type,
      DataMovingTime.type,
      DataDistance.type,
      DataSpeedAvg.type,
      DataCadenceAvg.type,
      DataPowerAvg.type,
      DataAscent.type,
      DataDescent.type,
      DataAltitudeMax.type,
      DataAltitudeMin.type,
    ];
    return stats.filter(stat => keyStatTypes.includes(stat.getType()));
  }

  // Performance tab widgets
  get performanceStats(): DataInterface[] {
    if (!this.event) return [];
    const stats = Array.from(this.event.getStats().values());
    const performanceTypes = [
      DataHeartRateAvg.type,
      DataHeartRateMin.type,
      DataHeartRateMax.type,
      DataSpeedAvg.type,
      DataPowerAvg.type,
      DataCadenceAvg.type,
    ];
    return stats.filter(stat => performanceTypes.includes(stat.getType()));
  }

  // Physiological tab widgets
  get physiologicalStats(): DataInterface[] {
    if (!this.event) return [];
    const stats = Array.from(this.event.getStats().values());
    const physiologicalTypes = [
      DataEnergy.type,
      DataHeartRateAvg.type,
    ];
    return stats.filter(stat => physiologicalTypes.includes(stat.getType()));
  }

  getStatIcon(statType: string): { type: 'material' | 'svg'; name: string } | null {
    switch (statType) {
      case DataDuration.type:
        return { type: 'material', name: 'access_time' };
      case DataMovingTime.type:
        return { type: 'svg', name: 'moving-time' };
      case DataDistance.type:
        return { type: 'material', name: 'trending_flat' };
      case DataHeartRateAvg.type:
      case DataHeartRateMin.type:
      case DataHeartRateMax.type:
        return { type: 'svg', name: 'heart_pulse' };
      case DataEnergy.type:
        return { type: 'svg', name: 'energy' };
      case DataSpeedAvg.type:
        return { type: 'material', name: 'speed' };
      case DataCadenceAvg.type:
        return { type: 'material', name: 'cached' };
      case DataPowerAvg.type:
        return { type: 'material', name: 'bolt' };
      case DataAscent.type:
        return { type: 'svg', name: 'arrow_up_right' };
      case DataDescent.type:
        return { type: 'svg', name: 'arrow_down_right' };
      case DataAltitudeMax.type:
        return { type: 'material', name: 'vertical_align_top' };
      case DataAltitudeMin.type:
        return { type: 'material', name: 'vertical_align_bottom' };
      default:
        return null;
    }
  }

  getStatLabel(stat: DataInterface): string {
    return stat.getDisplayType();
  }

  getStatValue(stat: DataInterface): string {
    const value = stat.getDisplayValue();
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  getStatUnit(stat: DataInterface): string {
    return stat.getDisplayUnit();
  }

  formatDate(d: Date | number | undefined): { date: string; time: string } {
    if (d == null) return { date: '', time: '' };
    const date = d instanceof Date ? d : new Date(d);
    const dateStr = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return { date: dateStr, time: timeStr };
  }

  get privacyIcon(): string {
    if (!this.event) return 'lock';
    return this.event.privacy === Privacy.Public ? 'public' : 'lock';
  }

  hasStatIcon(statType: string): boolean {
    return this.getStatIcon(statType) !== null;
  }

  isStatInOverall(statType: string): boolean {
    return this.overallStats.some(s => s.getType() === statType);
  }

  isStatInPerformance(statType: string): boolean {
    return this.performanceStats.some(s => s.getType() === statType);
  }

  shouldShowPerformanceStat(statType: string): boolean {
    return this.hasStatIcon(statType) && !this.isStatInOverall(statType);
  }

  shouldShowPhysiologicalStat(statType: string): boolean {
    return this.hasStatIcon(statType) && !this.isStatInOverall(statType) && !this.isStatInPerformance(statType);
  }
}
