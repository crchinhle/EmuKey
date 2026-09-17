import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  CatalogScreen,
  CheckoutScreen,
  PaymentScreen,
  ProfileScreen,
} from '../../src/presentation/EmuKeyMobileApp';
import {
  acceptOrderTerms,
  createOrder,
  createCheckout,
  getOrder,
  getOrderTerms,
  getProfile,
  listProducts,
  updateProfile,
  type MobileOrderDetail,
} from '../../src/infrastructure/api/client';

jest.mock('../../src/infrastructure/api/client', () => ({
  acceptOrderTerms: jest.fn(),
  createOrder: jest.fn(),
  createCheckout: jest.fn(),
  getOrder: jest.fn(),
  getOrderTerms: jest.fn(),
  getProfile: jest.fn(),
  listProducts: jest.fn(),
  updateProfile: jest.fn(),
}));

const listProductsMock = listProducts as jest.MockedFunction<typeof listProducts>;
const getProfileMock = getProfile as jest.MockedFunction<typeof getProfile>;
const updateProfileMock = updateProfile as jest.MockedFunction<typeof updateProfile>;
const createOrderMock = createOrder as jest.MockedFunction<typeof createOrder>;
const createCheckoutMock = createCheckout as jest.MockedFunction<typeof createCheckout>;
const getOrderMock = getOrder as jest.MockedFunction<typeof getOrder>;
const getOrderTermsMock = getOrderTerms as jest.MockedFunction<typeof getOrderTerms>;
const acceptOrderTermsMock = acceptOrderTerms as jest.MockedFunction<typeof acceptOrderTerms>;

const order: MobileOrderDetail = {
  billingCycleSnapshot: 'YEARLY',
  createdAt: '2026-09-15T00:00:00.000Z',
  currency: 'VND',
  customerUserId: 'customer-1',
  durationMonthsSnapshot: 12,
  entitlementsSnapshot: {},
  id: 'order-1',
  maxActiveDevicesSnapshot: 2,
  orderNumber: 'ORD-MOBILE-1',
  orderStatus: 'WAITING_TERMS_ACCEPTANCE',
  orderType: 'NEW_PURCHASE',
  paymentDueAt: '2026-09-16T00:00:00.000Z',
  planCommitmentSnapshot: `0x${'11'.repeat(32)}`,
  planId: 'plan-1',
  planNameSnapshot: 'Pro',
  planVersionSnapshot: 1,
  priceVndSnapshot: 990_000,
  productId: 'product-1',
  productNameSnapshot: 'EmuKey Desktop',
  providerNameSnapshot: 'EmuKey',
  providerUserId: 'provider-1',
  termsHashSnapshot: `0x${'22'.repeat(32)}`,
  termsVersionSnapshot: 1,
};

describe('mobile Phase 3 and Phase 4 screens', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the published catalog and opens checkout with the selected plan', async () => {
    listProductsMock.mockResolvedValue([
      {
        name: 'EmuKey Desktop',
        plans: [{
          billingCycle: 'YEARLY',
          code: 'PRO',
          durationMonths: 12,
          entitlements: {},
          id: 'plan-1',
          maxActiveDevices: 2,
          name: 'Pro',
          priceVnd: 990_000,
        }],
        slug: 'emukey-desktop',
        summary: 'Bản quyền desktop',
      },
    ]);
    const navigate = jest.fn();
    await render(<CatalogScreen navigation={{ navigate } as never} route={{} as never} />);

    expect(await screen.findByText('EmuKey Desktop')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Mua')));
    expect(navigate).toHaveBeenCalledWith('Checkout', expect.objectContaining({ planId: 'plan-1' }));
  });

  it('loads and updates the Customer profile', async () => {
    const profile = { id: 'customer-1', email: 'buyer@emukey.app', displayName: 'Buyer', role: 'CUSTOMER', status: 'ACTIVE' };
    getProfileMock.mockResolvedValue(profile);
    updateProfileMock.mockResolvedValue({ ...profile, displayName: 'Buyer Updated' });
    const onProfileUpdated = jest.fn();
    await render(<ProfileScreen onProfileUpdated={onProfileUpdated} />);

    await act(async () => fireEvent.changeText(await screen.findByLabelText('Tên hiển thị'), 'Buyer Updated'));
    await act(async () => fireEvent.press(screen.getByText('Lưu thay đổi')));
    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledWith({ displayName: 'Buyer Updated' }));
    expect(onProfileUpdated).toHaveBeenCalled();
  });

  it('creates a server order before showing the Terms acceptance step', async () => {
    createOrderMock.mockResolvedValue(order);
    getOrderTermsMock.mockResolvedValue({ content: 'Điều khoản bản quyền', hash: order.termsHashSnapshot, version: 1 });
    acceptOrderTermsMock.mockResolvedValue({ ...order, orderStatus: 'WAITING_PAYMENT' });
    const navigation = { replace: jest.fn() };
    const route = { params: { planId: 'plan-1', planName: 'Pro', priceVnd: 990_000, productName: 'EmuKey Desktop' } };
    await render(<CheckoutScreen navigation={navigation as never} route={route as never} />);

    await act(async () => fireEvent.press(screen.getByText('Tạo đơn hàng')));
    expect(await screen.findByText('Điều khoản bản quyền')).toBeOnTheScreen();
    expect(createOrderMock).toHaveBeenCalledWith({ planId: 'plan-1' });
  });

  it('renders the signed SePay POST fields inside the native checkout WebView', async () => {
    getOrderMock.mockResolvedValue({ ...order, orderStatus: 'WAITING_PAYMENT' });
    createCheckoutMock.mockResolvedValue({
      amountVnd: order.priceVndSnapshot,
      attemptId: 'attempt-1',
      checkoutFields: { order_invoice_number: 'EMU-MOBILE-1', signature: 'signed-value' },
      checkoutMethod: 'POST',
      checkoutReference: 'EMU-MOBILE-1',
      checkoutUrl: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
      expiresAt: order.paymentDueAt,
      expiresWithOrder: true,
    });
    const result = await render(
      <PaymentScreen
        navigation={{} as never}
        route={{ params: { orderId: order.id } } as never}
      />,
    );

    await act(async () => fireEvent.press(await screen.findByText('Thanh toán trên SePay')));
    const webView = await screen.findByTestId('payment-webview');
    expect((webView.props.source as { html: string }).html).toContain('name="signature" value="signed-value"');
    await result.unmount();
  });
});
