import { Routes } from '@angular/router';
import { dashboardResolver } from './resolvers/dashboard.resolver';
import { eventResolver } from './resolvers/event.resolver';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    resolve: { dashboardData: dashboardResolver },
  },
  {
    path: 'event/:id',
    loadComponent: () => import('./components/event-detail/event-detail.component').then((m) => m.EventDetailComponent),
    resolve: { eventData: eventResolver },
  },
  { path: '**', redirectTo: 'dashboard' },
];
