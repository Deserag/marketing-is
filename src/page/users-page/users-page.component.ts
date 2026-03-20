import { Component, inject } from '@angular/core';
import { AuthService } from '../../entity/auth/auth.service';
import { UserManagementComponent } from '../../widget/user-management/user-management.component';

@Component({
  selector: 'app-users-page',
  imports: [UserManagementComponent],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.css',
})
export class UsersPageComponent {
  protected readonly auth = inject(AuthService);
}
