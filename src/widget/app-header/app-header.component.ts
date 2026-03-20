import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-main-header',
  imports: [DatePipe],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.css',
})
export class AppHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly userName = input('');
  readonly navigationCollapsed = input(false);
  readonly toggleNavigation = output<void>();

  protected readonly today = new Date();
}
