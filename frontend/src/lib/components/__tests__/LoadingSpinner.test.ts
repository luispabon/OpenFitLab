import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import LoadingSpinner from '../LoadingSpinner.svelte';

describe('LoadingSpinner', () => {
  it('renders an SVG element', () => {
    const { container } = render(LoadingSpinner);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('has animate-spin class on SVG', () => {
    const { container } = render(LoadingSpinner);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('animate-spin');
  });
});
