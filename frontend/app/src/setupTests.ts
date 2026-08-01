/**
 * Unmounts rendered components between tests. @testing-library/react only
 * auto-registers cleanup when Vitest globals are enabled; without it every
 * render in a file accumulates in the same jsdom document.
 */
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
