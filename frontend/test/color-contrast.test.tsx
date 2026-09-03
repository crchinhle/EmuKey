import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

function relativeLuminance(color: string): number {
  const normalized = color.trim();
  const channels = normalized.startsWith('#')
    ? normalized
        .slice(1)
        .match(/.{2}/g)
        ?.map((channel) => Number.parseInt(channel, 16))
    : normalized
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number);
  if (!channels || channels.length !== 3)
    throw new Error(`Unsupported color: ${color}`);
  const [red, green, blue] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe('high-contrast color system', () => {
  it('keeps workspace card boundaries distinguishable at 3:1', () => {
    const { container } = render(<App initialEntries={['/buyer']} />);
    const theme = container.querySelector<HTMLElement>('.app-theme');
    expect(theme).toBeTruthy();

    expect(
      contrastRatio(
        theme!.style.getPropertyValue('--border'),
        theme!.style.getPropertyValue('--surface'),
      ),
    ).toBeGreaterThanOrEqual(3);
  });

  it('keeps small helper text comfortably above the AA minimum', () => {
    const { container } = render(<App initialEntries={['/buyer']} />);
    const theme = container.querySelector<HTMLElement>('.app-theme');
    expect(theme).toBeTruthy();

    expect(
      contrastRatio(
        theme!.style.getPropertyValue('--muted'),
        theme!.style.getPropertyValue('--surface'),
      ),
    ).toBeGreaterThanOrEqual(5.5);
  });
});
