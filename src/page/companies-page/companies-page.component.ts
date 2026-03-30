import { Component, inject } from '@angular/core';
import { AuthService } from '../../entity/auth/auth.service';
import { CompanyManagementComponent } from '../../widget/company-management/company-management.component';

@Component({
  selector: 'app-companies-page',
  imports: [CompanyManagementComponent],
  templateUrl: './companies-page.component.html',
  styleUrl: './companies-page.component.css',
})
export class CompaniesPageComponent {
  protected readonly auth = inject(AuthService);
}
