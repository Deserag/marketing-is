import { Component, inject } from '@angular/core';
import { AuthService } from '../../entity/auth/auth.service';
import { EventManagementComponent } from '../../widget/event-management/event-management.component';

@Component({
  selector: 'app-events-page',
  imports: [EventManagementComponent],
  templateUrl: './events-page.component.html',
  styleUrl: './events-page.component.css',
})
export class EventsPageComponent {
  protected readonly auth = inject(AuthService);
}
