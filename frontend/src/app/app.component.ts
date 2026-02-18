import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { IconService } from './services/icon.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatSidenavModule, MatToolbarModule, MatButtonModule],
  template: `
    <mat-toolbar color="primary" class="app-toolbar">
      <span class="app-title">OpenFitLab</span>
    </mat-toolbar>
    <mat-sidenav-container class="app-sidenav-container">
      <mat-sidenav mode="side" opened class="app-sidenav">
        <nav class="app-nav">
          <a mat-button routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
        </nav>
      </mat-sidenav>
      <mat-sidenav-content>
        <main class="app-main">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .app-toolbar {
        position: relative;
        z-index: 10;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      }
      .app-title {
        font-size: 1.25rem;
        font-weight: 500;
        letter-spacing: 0.02em;
      }
      .app-sidenav-container {
        height: calc(100vh - 64px);
        background: var(--mat-sys-background);
      }
      .app-sidenav {
        width: 220px;
        border-right: 1px solid var(--mat-app-outline-variant);
        background: var(--mat-sys-surface) !important;
      }
      .app-nav {
        display: flex;
        flex-direction: column;
        padding: 0.75rem 0;
        gap: 0.25rem;
      }
      .app-nav a {
        text-align: left;
        justify-content: flex-start;
        padding-left: 24px;
        font-weight: 400;
      }
      .app-nav a.active {
        font-weight: 600;
        background: var(--mat-app-surface-container-low);
      }
      .app-main {
        padding: 0;
        background: var(--mat-sys-background);
        min-height: 100%;
      }
    `,
  ],
})
export class AppComponent implements OnInit {
  private iconService = inject(IconService);

  ngOnInit(): void {
    this.iconService.registerIcons();
  }
}
