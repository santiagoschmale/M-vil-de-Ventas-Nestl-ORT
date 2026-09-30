import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSnackbarProps } from './useSnackbarProps'

describe('stores/useSnackbarProps', () => {
    it('Given initial state', () => {
        const { result } = renderHook(() => useSnackbarProps());
        expect(result.current.snackbarProps).toBeUndefined();
    });

    it('call setSnackbarProps', async () => {
        const { result } = renderHook(() => useSnackbarProps());

        act(() => {
            result.current.setSnackbarProps({ message: 'test' })
        })

        expect(result.current.snackbarProps).toBeDefined();
    });
});