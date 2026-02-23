import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DashboardToast from '../dashboard/DashboardToast.svelte';

describe('DashboardToast', () => {
  it('renders message when non-null', () => {
    render(DashboardToast, { props: { message: 'Upload complete' } });
    expect(screen.getByText('Upload complete')).toBeInTheDocument();
  });

  it('renders nothing when message is null', () => {
    render(DashboardToast, {
      props: { message: null },
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has role="alert" when message is shown', () => {
    render(DashboardToast, { props: { message: 'Hi' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Hi');
  });
});
