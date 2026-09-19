import { expect, test } from '@playwright/test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const email = process.env.E2E_CUSTOMER_EMAIL;
const password = process.env.E2E_CUSTOMER_PASSWORD;
const activationKey = process.env.E2E_ACTIVATION_KEY;

test.describe('Phase 6 real customer flow', () => {
  test.skip(
    !email || !password || !activationKey,
    'Set E2E_CUSTOMER_EMAIL, E2E_CUSTOMER_PASSWORD and E2E_ACTIVATION_KEY for the real backend/chain flow.',
  );

  test('logs in, proves a device key and waits for blockchain finality', async ({ page }) => {
    test.setTimeout(180_000);
    const account = privateKeyToAccount(generatePrivateKey());
    const deviceRef = `playwright-${Date.now()}`;

    await page.goto('/auth');
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Mật khẩu').fill(password!);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.goto('/buyer/licenses');

    await expect(page.getByRole('heading', { name: 'License Hub' })).toBeVisible();
    await page.getByLabel('Activation key sử dụng trên thiết bị').fill(activationKey!);
    await page.getByLabel('Mã tham chiếu thiết bị').fill(deviceRef);
    await page.getByLabel('Địa chỉ khóa công khai thiết bị').fill(account.address);
    await page.getByRole('button', { name: 'Tạo challenge', exact: true }).click();

    const challenge = await page.locator('code').filter({ hasText: 'emukey:' }).first().textContent();
    expect(challenge).toBeTruthy();
    const proof = await account.signMessage({ message: challenge! });
    await page.getByLabel('Chữ ký xác thực thiết bị').fill(proof);
    await page.getByRole('button', { name: 'Gửi yêu cầu kích hoạt' }).click();

    await expect(page.getByText(/Command CONFIRMED:/)).toBeVisible({ timeout: 150_000 });
    await expect(page.getByText(/ACTIVE · CONFIRMED/)).toBeVisible({ timeout: 15_000 });
  });
});
