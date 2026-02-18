import { Injectable } from '@angular/core';

export interface Job {
  id: string;
  type: string;
  label: string;
  status?: string;
  progress?: number;
}

@Injectable({ providedIn: 'root' })
export class AppProcessingService {
  private jobs: Map<string, Job> = new Map();
  private nextId = 0;

  addJob(type: string, label: string): string {
    const id = `job-${++this.nextId}`;
    this.jobs.set(id, { id, type, label, status: 'pending', progress: 0 });
    return id;
  }

  updateJob(id: string, update: Partial<Job>): void {
    const job = this.jobs.get(id);
    if (job) Object.assign(job, update);
  }

  completeJob(id: string): void {
    this.updateJob(id, { status: 'complete', progress: 100 });
  }

  failJob(id: string, _message?: string): void {
    this.updateJob(id, { status: 'failed' });
  }
}
