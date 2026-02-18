import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { User } from '@sports-alliance/sports-lib';
import { LOCAL_USER } from '../constants/single-user';

@Injectable({ providedIn: 'root' })
export class AppAuthService {
  readonly user$: Observable<User | null> = of(LOCAL_USER);
  redirectUrl = '';
}
