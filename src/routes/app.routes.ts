import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { financeGuard } from './guards/finance.guard';
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
        path: 'projects',
        loadComponent: () =>
          import('../page/projects-page/projects-page.component').then(
            (component) => component.ProjectsPageComponent,
          ),
      },
      {
        path: 'projects/:id',
        loadComponent: () =>
          import('../page/project-details-page/project-details-page.component').then(
            (component) => component.ProjectDetailsPageComponent,
          ),
      },
      {
        path: 'events',
        loadComponent: () =>
          import('../page/events-page/events-page.component').then(
            (component) => component.EventsPageComponent,
          ),
      },
      {
        path: 'events/:id',
        loadComponent: () =>
          import('../page/event-details-page/event-details-page.component').then(
            (component) => component.EventDetailsPageComponent,
          ),
      },
      {
        path: 'companies',
        loadComponent: () =>
          import('../page/companies-page/companies-page.component').then(
            (component) => component.CompaniesPageComponent,
          ),
      },
      {
        path: 'expenses',
        canActivate: [financeGuard],
        loadComponent: () =>
          import('../page/expenses-page/expenses-page.component').then(
            (component) => component.ExpensesPageComponent,
          ),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('../page/calendar-page/calendar-page.component').then(
            (component) => component.CalendarPageComponent,
          ),
        data: {
          mode: 'all',
        },
      },
      {
        path: 'my-calendar',
        loadComponent: () =>
          import('../page/calendar-page/calendar-page.component').then(
            (component) => component.CalendarPageComponent,
          ),
        data: {
          mode: 'mine',
        },
      },
      {
        path: 'analytics',
        pathMatch: 'full',
        redirectTo: 'ai-chat',
      },
      {
        path: 'ai-chat',
        canActivate: [financeGuard],
        loadComponent: () =>
          import('../page/analytics-page/analytics-page.component').then(
            (component) => component.AnalyticsPageComponent,
          ),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
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
