import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('../page/login-page/login-page.component').then(
        (component) => component.LoginPageComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../widget/app-shell/app-shell.component').then(
        (component) => component.AppShellComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../page/dashboard-page/dashboard-page.component').then(
            (component) => component.DashboardPageComponent,
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('../page/users-page/users-page.component').then(
            (component) => component.UsersPageComponent,
          ),
      },
      {
        path: 'admin-panel',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('../page/admin-panel-page/admin-panel-page.component').then(
            (component) => component.AdminPanelPageComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
