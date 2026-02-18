import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  log(...args: unknown[]): void {
    console.log(...args);
  }
  warn(...args: unknown[]): void {
    console.warn(...args);
  }
  error(...args: unknown[]): void {
    console.error(...args);
  }
  captureMessage(_message: string, _context?: unknown): void {}
}
