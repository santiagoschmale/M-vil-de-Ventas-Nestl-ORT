import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProfile } from './useProfile';

vi.mock('../../services/profile/getProfile');

describe('stores/useProfile', () => {
  it('Given initial state', () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toBeUndefined();
  });
});
