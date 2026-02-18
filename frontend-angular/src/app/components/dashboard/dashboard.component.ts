import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EventInterface } from '@sports-alliance/sports-lib';
import { User } from '@sports-alliance/sports-lib';
import { DashboardResolverData } from '../../resolvers/dashboard.resolver';
import { UploadActivitiesComponent } from '../upload/upload-activities/upload-activities.component';
import { LOCAL_USER } from '../../constants/single-user';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, UploadActivitiesComponent, MatButtonModule, MatTableModule, MatProgressSpinnerModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  events: EventInterface[] = [];
  user: User | null = null;
  isLoading = false;

  constructor(private route: ActivatedRoute) {
    const data = this.route.snapshot.data['dashboardData'] as DashboardResolverData | undefined;
    if (data) {
      this.events = data.events ?? [];
      this.user = data.user ?? null;
    }
    if (!this.user) this.user = LOCAL_USER;
  }

  get displayedColumns(): string[] {
    return ['name', 'startDate', 'actions'];
  }

  get dataSource(): MatTableDataSource<EventInterface> {
    return new MatTableDataSource(this.events);
  }

  formatDate(ev: EventInterface): string {
    const d = ev.startDate;
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleString();
  }
}
