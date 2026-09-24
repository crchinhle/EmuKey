import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';

import { Brand } from '../src/presentation/components/Brand';
import { UserAvatar, computeInitials } from '../src/presentation/components/Avatar';
import { SiteHeader } from '../src/presentation/components/SiteHeader';
import { AuthProvider } from '../src/application/auth/authContext';
import { antTheme, themeCssVariables } from '../src/presentation/theme';
import { ConfigProvider } from 'antd';

afterEach(cleanup);

const cssText = readFileSync('src/presentation/styles.css', 'utf8');
const homeScreenText = readFileSync('src/presentation/screens/PublicHomeScreen.tsx', 'utf8');

describe('Avatar and brand separation', () => {
  it('brand avatar uses the script font and points to public home', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Brand />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Về trang chủ EmuKey' });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.textContent).toContain('EmuKey');
    expect(cssText).toContain('brand-wordmark');
    expect(cssText).toContain('Great Vibes');
  });

  it('user avatar uses sans-serif and not a script font', () => {
    render(<UserAvatar name="Minh An" />);
    const initials = screen.getByText('MA');
    expect(initials.className).toContain('user-avatar-initials');
    expect(cssText).toContain('.user-avatar-initials');
    expect(cssText).toContain("IBM Plex Sans Variable");
    const start = cssText.indexOf('.user-avatar-initials');
    const block = cssText.slice(start, start + 400);
    expect(block).not.toContain('Great Vibes');
  });

  it('computes initials for one and multiple words', () => {
    expect(computeInitials('Minh An')).toBe('MA');
    expect(computeInitials('Minh')).toBe('M');
    expect(computeInitials('')).toBe('?');
  });
});

describe('Public Home hero and carousel', () => {
  it('hero has compact padding without a large min-height', () => {
    expect(homeScreenText).toContain('.public-home-hero');
    const heroStart = homeScreenText.indexOf('.public-home-hero {');
    const heroEnd = homeScreenText.indexOf('.public-home-featured {');
    const heroBlock = homeScreenText.slice(heroStart, heroEnd);
    expect(heroBlock).toContain('padding: 36px 48px');
    expect(heroBlock).not.toContain('min-height');
  });

  it('has reduced motion CSS to disable transitions', () => {
    expect(homeScreenText).toContain('prefers-reduced-motion: reduce');
    expect(homeScreenText).toContain('.public-home-track');
  });

  it('provides prev/next arrow controls and pause', () => {
    expect(homeScreenText).toContain('.public-home-arrow');
    expect(homeScreenText).toContain('.public-home-pause');
  });
});

describe('Public header brand navigation', () => {
  it('brand navigates to home when logged out', () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider skipBootstrap>
          <ConfigProvider theme={antTheme}>
            <div className="app-theme" style={themeCssVariables}>
              <MemoryRouter initialEntries={['/products']}>
                <SiteHeader />
              </MemoryRouter>
            </div>
          </ConfigProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );
    const home = screen.getByRole('link', { name: 'Trang chủ' });
    expect(home.getAttribute('href')).toBe('/');
  });
});
