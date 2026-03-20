import { Component } from '@angular/core';
import { CompanyManagementComponent } from '../../widget/company-management/company-management.component';
import { UserManagementComponent } from '../../widget/user-management/user-management.component';

@Component({
  selector: 'app-admin-panel-page',
  imports: [UserManagementComponent, CompanyManagementComponent],
  templateUrl: './admin-panel-page.component.html',
  styleUrl: './admin-panel-page.component.css',
})
export class AdminPanelPageComponent {}
