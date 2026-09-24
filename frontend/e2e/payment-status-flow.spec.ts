import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('Payment status downstream flow', () => {
  test('polls the exact order license, gates retrieval on trust, and never retrieves on reload', async ({ page }) => {
    const orderId = '00000000-0000-4000-8000-000000000502';
    const licenseId = '00000000-0000-4000-8000-000000000401';
    const activationKey = `0x${'aa'.repeat(32)}`;
    let licenseReads = 0;
    let retrievals = 0;
    let consumed = false;

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'browser-test-token',
          user: {
            displayName: 'Browser Customer',
            email: 'browser@example.com',
            id: '00000000-0000-4000-8000-000000000004',
            role: 'CUSTOMER',
            status: 'ACTIVE',
          },
        }),
      });
    });
    await page.route(`**/api/v1/orders/${orderId}`, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          billingCycleSnapshot: 'MONTHLY',
          createdAt: '2026-09-30T00:00:00.000Z',
          currency: 'VND',
          customerUserId: '00000000-0000-4000-8000-000000000004',
          durationMonthsSnapshot: 1,
          entitlementsSnapshot: {},
          id: orderId,
          licenseId,
          maxActiveDevicesSnapshot: 3,
          orderNumber: 'ORD-BROWSER-0502',
          orderStatus: 'PAYMENT_ACCEPTED',
          orderType: 'NEW_PURCHASE',
          paymentDueAt: '2026-10-02T00:00:00.000Z',
          planCommitmentSnapshot: `0x${'bb'.repeat(32)}`,
          planId: '00000000-0000-4000-8000-000000000301',
          planNameSnapshot: 'Business',
          planVersionSnapshot: 1,
          priceVndSnapshot: 120000,
          productId: '00000000-0000-4000-8000-000000000201',
          productNameSnapshot: 'SecureDesk Pro',
          providerNameSnapshot: 'Emukey Provider',
          providerUserId: '00000000-0000-4000-8000-000000000005',
          publicLicenseId: 'EMU-BROWSER-LICENSE',
          serviceTermsAcceptedAt: '2026-09-30T00:01:00.000Z',
          targetLicenseId: null,
        }),
      });
    });
    await page.route(`**/api/v1/licenses/${licenseId}`, async (route) => {
      licenseReads += 1;
      const ready = licenseReads > 1;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          activationKeyAvailable: !consumed,
          activationKeyTrustStatus: ready ? 'TRUSTED' : 'PENDING_FINALITY',
          blockNumber: ready ? 42 : null,
          confirmationCount: ready ? 2 : 0,
          createdAt: '2026-09-30T00:01:00.000Z',
          entitlementVersion: 1,
          expiresAt: '2027-09-30T00:01:00.000Z',
          finality: ready ? 'CONFIRMED' : 'PENDING',
          id: licenseId,
          keyVersion: 1,
          maxActiveDevices: 3,
          originOrderId: orderId,
          periodStart: '2026-09-30T00:01:00.000Z',
          plan: { commitment: `0x${'bb'.repeat(32)}`, name: 'Business', version: 1 },
          productName: 'SecureDesk Pro',
          provider: { displayName: 'Emukey Provider', organizationName: 'Emukey Software' },
          publicLicenseId: 'EMU-BROWSER-LICENSE',
          status: ready ? 'ACTIVE' : 'PENDING_ONCHAIN',
          transactionHash: ready ? `0x${'cc'.repeat(32)}` : null,
          updatedAt: '2026-09-30T00:01:00.000Z',
        }),
      });
    });
    await page.route(`**/api/v1/licenses/${licenseId}/activation-key/retrieve`, async (route) => {
      retrievals += 1;
      if (consumed) {
        await route.fulfill({
          contentType: 'application/json',
          status: 404,
          body: JSON.stringify({ error: { code: 'ACTIVATION_KEY_UNAVAILABLE' } }),
        });
        return;
      }
      consumed = true;
      await route.fulfill({
        contentType: 'application/json',
        status: 201,
        body: JSON.stringify({ activationKey, keyVersion: 1 }),
      });
    });

    await page.goto(`/buyer/orders/${orderId}/payment`);
    await expect(page.getByText('Thanh toán đã được xác nhận.').first()).toBeVisible();
    await expect(page.getByText('Đang kích hoạt bản quyền', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nhận mã kích hoạt' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Bản quyền đã sẵn sàng' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Nhận mã kích hoạt' })).toBeVisible();
    expect(retrievals).toBe(0);

    await page.getByRole('button', { name: 'Nhận mã kích hoạt' }).click();
    await expect(page.getByLabel('Mã kích hoạt')).toHaveValue(activationKey);
    expect(retrievals).toBe(1);

    await page.reload();
    await expect(page.getByText('Mã kích hoạt đã được nhận')).toBeVisible();
    await expect(page.getByLabel('Mã kích hoạt')).toHaveCount(0);
    expect(retrievals).toBe(1);
  });
});
