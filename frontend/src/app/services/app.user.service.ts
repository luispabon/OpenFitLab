import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { User } from '@sports-alliance/sports-lib';
import { LOCAL_USER, LOCAL_UID } from '../constants/single-user';

@Injectable({ providedIn: 'root' })
export class AppUserService {
  getUserByID(uid: string): Observable<User | null> {
    return uid === LOCAL_UID ? of(LOCAL_USER) : of(null);
  }

  updateUserProperties(_user: User, _updates: { settings?: unknown }): Promise<void> {
    if (_updates.settings && LOCAL_USER.settings) {
      Object.assign(LOCAL_USER.settings, _updates.settings);
    }
    return Promise.resolve();
  }

  getUserChartDataTypesToUse(user: User): string[] {
    if (!user.settings?.chartSettings?.dataTypeSettings) return [];
    return Object.keys(user.settings.chartSettings.dataTypeSettings).filter(
      (key) => (user.settings!.chartSettings as { dataTypeSettings: Record<string, { enabled: boolean }> }).dataTypeSettings[key]?.enabled === true
    );
  }
}
