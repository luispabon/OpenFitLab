import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Login from '../login.svelte';

describe('login page', () => {
  it('renders provider buttons', async () => {
    const { getByText } = render(Login);
    expect(getByText('Continue with Google')).toBeTruthy();
    expect(getByText('Continue with GitHub')).toBeTruthy();
  });
});
