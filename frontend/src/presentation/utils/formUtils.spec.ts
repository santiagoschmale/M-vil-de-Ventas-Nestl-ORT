import { describe, it, expect, vi } from 'vitest';
import { formGetOrEmpty, splitOrDefault } from './formUtils';

describe('form utils', () => {
  it('splitOrDefault', () => {
    const test = splitOrDefault(null);
    expect(test.length).toBe(0);
  });

  it('splitOrDefault', () => {
    const test = splitOrDefault('test2,test1');
    expect(test.length).toBe(2);
  });

  it('call formGetOrEmpty', async () => {
    const test = formGetOrEmpty(null);
    expect(test).toBe('');
  });

  it('call formGetOrEmpty', async () => {
    const test = formGetOrEmpty('test');
    expect(test).toBe('test');
  });
});
