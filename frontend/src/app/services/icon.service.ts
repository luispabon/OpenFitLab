import { Injectable } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

interface IconConfig {
  name: string;
  path: string;
}

@Injectable({
  providedIn: 'root'
})
export class IconService {
  private readonly ICONS: IconConfig[] = [
    { name: 'heart_pulse', path: 'assets/icons/heart-pulse.svg' },
    { name: 'energy', path: 'assets/icons/energy.svg' },
    { name: 'moving-time', path: 'assets/icons/moving-time.svg' },
    { name: 'arrow_up_right', path: 'assets/icons/arrow-up-right.svg' },
    { name: 'arrow_down_right', path: 'assets/icons/arrow-down-right.svg' },
  ];

  constructor(
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {}

  public registerIcons(): void {
    this.ICONS.forEach(icon => {
      this.matIconRegistry.addSvgIcon(
        icon.name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.path)
      );
    });
  }
}
