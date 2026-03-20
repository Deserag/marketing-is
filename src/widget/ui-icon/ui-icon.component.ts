import { Component, input } from '@angular/core';

export type UiIconName =
  | 'dashboard'
  | 'users'
  | 'admin'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'logout'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'chevron-down';

@Component({
  selector: 'app-ui-icon',
  templateUrl: './ui-icon.component.html',
  styleUrl: './ui-icon.component.css',
})
export class UiIconComponent {
  readonly name = input.required<UiIconName>();
  readonly size = input(20);
  readonly strokeWidth = input(1.9);
}
