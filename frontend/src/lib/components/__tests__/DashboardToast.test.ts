import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import WorkoutsToast from '../workouts/WorkoutsToast.svelte';

describe('WorkoutsToast', () => {
  it('renders message when non-null', () => {
    render(WorkoutsToast, { props: { message: 'Upload complete' } });
    expect(screen.getByText('Upload complete')).toBeInTheDocument();
  });

  it('renders nothing when message is null', () => {
    render(WorkoutsToast, {
      props: { message: null },
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has role="alert" when message is shown', () => {
    render(WorkoutsToast, { props: { message: 'Hi' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Hi');
  });
});
