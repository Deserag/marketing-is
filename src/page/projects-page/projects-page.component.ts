import { Component, inject } from '@angular/core';
import { AuthService } from '../../entity/auth/auth.service';
import { ProjectManagementComponent } from '../../widget/project-management/project-management.component';

@Component({
  selector: 'app-projects-page',
  imports: [ProjectManagementComponent],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.css',
})
export class ProjectsPageComponent {
  protected readonly auth = inject(AuthService);
}
