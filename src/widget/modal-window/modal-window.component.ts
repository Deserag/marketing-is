import { Component, input, output } from '@angular/core';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

@Component({
  selector: 'app-modal-window',
  imports: [UiIconComponent],
  templateUrl: './modal-window.component.html',
  styleUrl: './modal-window.component.css',
})
export class ModalWindowComponent {
  readonly opened = input(false);
  readonly title = input.required<string>();
  readonly description = input('');
  readonly close = output<void>();

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }
}
