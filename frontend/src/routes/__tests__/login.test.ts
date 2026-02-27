import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Login from '../login.svelte';

describe('login page', () => {
  const assign = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    assign.mockClear();
    Object.defineProperty(window, 'location', {
      value: { assign },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('renders provider buttons', () => {
    render(Login);
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument();
  });

  it('calls location.assign with Google OAuth URL when Continue with Google is clicked', async () => {
    render(Login);
    await fireEvent.click(screen.getByText('Continue with Google'));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/api/auth/google');
  });

  it('calls location.assign with GitHub OAuth URL when Continue with GitHub is clicked', async () => {
    render(Login);
    await fireEvent.click(screen.getByText('Continue with GitHub'));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/api/auth/github');
  });
});
