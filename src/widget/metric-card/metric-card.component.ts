import { Component, computed, input } from '@angular/core';

export type MetricTone = 'teal' | 'amber' | 'slate' | 'rose';

@Component({
  selector: 'app-metric-card',
  templateUrl: './metric-card.component.html',
  styleUrl: './metric-card.component.css',
})
export class MetricCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly hint = input('');
  readonly tone = input<MetricTone>('teal');

  protected readonly toneClass = computed(() => `metric-card--${this.tone()}`);
}
