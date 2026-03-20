import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../entity/auth/auth.service';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, UiIconComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
})
export class AppShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly navigationCollapsed = signal(false);

  protected toggleNavigation(): void {
    this.navigationCollapsed.update((value) => !value);
  }

  protected logout(): void {
    this.auth.logout();
  }
}
