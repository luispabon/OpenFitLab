// Force kalmanjs into the bundle so sports-lib's require('kalmanjs') can resolve (esbuild)
import 'kalmanjs';

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
