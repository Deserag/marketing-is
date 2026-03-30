import { Component } from '@angular/core';
import { CompanyManagementComponent } from '../../widget/company-management/company-management.component';
import { EventManagementComponent } from '../../widget/event-management/event-management.component';
import { ProjectManagementComponent } from '../../widget/project-management/project-management.component';
import { UserManagementComponent } from '../../widget/user-management/user-management.component';

@Component({
  selector: 'app-admin-panel-page',
  imports: [
    UserManagementComponent,
    CompanyManagementComponent,
    ProjectManagementComponent,
    EventManagementComponent,
  ],
  templateUrl: './admin-panel-page.component.html',
  styleUrl: './admin-panel-page.component.css',
})
export class AdminPanelPageComponent {}
