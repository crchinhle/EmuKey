import { useEffect, useState } from 'react';
import {
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { GreatVibes_400Regular } from '@expo-google-fonts/great-vibes/400Regular';
import { useFonts } from 'expo-font';

import {
  acceptServiceTerms,
  comparePlans,
  createCheckout,
  createOrder,
  getOrder,
  getCommandStatus,
  getOrderTerms,
  getProfile,
  listConversationMessages,
  listConversations,
  listDevices,
  listLicenses,
  listOrders,
  listProducts,
  listNotifications,
  markNotificationRead,
  activateDevice,
  createActivationChallenge,
  createConversation,
  appendConversationMessage,
  askConversationAi,
  issueEntitlement,
  loadActivationKey,
  login,
  logout,
  restoreSession,
  retrieveActivationKey,
  verifyEntitlement,
  requestLicensingActionVerification,
  refreshEntitlement,
  revokeDevice,
  rotateActivationKey,
  storeActivationKey,
  type MobileDevice,
  type MobileCheckoutSession,
  verifyPublicLicense,
  type MobileLicense,
  type MobileLicenseVerification,
  type MobileOrderDetail,
  type MobileOrderSummary,
  type MobilePlanComparison,
  type MobileProduct,
  type MobileSession,
  type MobileNotification,
  type MobileConversation,
  type MobileConversationMessage,
  updateProfile,
} from '../infrastructure/api/client';
import { createOrLoadDeviceIdentity } from '../infrastructure/device-identity';

type RootStackParamList = {
  Assistance: undefined;
  Catalog: undefined;
  Checkout: { planId: string; planName: string; priceVnd: number; productName: string };
  ComparePlans: { ids: string[] };
  Licenses: undefined;
  Notifications: undefined;
  Orders: undefined;
  OrderDetail: { id: string };
  Payment: { orderId: string };
  Profile: undefined;
  Renewal: { licenseId: string; originOrderId: string; productName: string };
  VerifyLicense: undefined;
};
const Stack = createNativeStackNavigator<RootStackParamList>();

export function LoginScreen({
  onAuthenticated,
  onVerify,
}: {
  readonly onAuthenticated: (session: MobileSession) => void;
  readonly onVerify: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    try {
      onAuthenticated(await login(email, password));
    } catch {
      setError('Không thể đăng nhập. Vui lòng kiểm tra tài khoản và mật khẩu.');
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.brand}>Emukey</Text>
      <Text style={styles.subtitle}>Đăng nhập để quản lý đơn hàng và license của bạn</Text>
      <TextInput accessibilityLabel="Email" autoCapitalize="none" onChangeText={setEmail} style={styles.input} value={email} />
      <TextInput accessibilityLabel="Mật khẩu" onChangeText={setPassword} secureTextEntry style={styles.input} value={password} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button disabled={!email.trim() || password.length < 8} onPress={() => void submit()} title="Đăng nhập" />
      <Button onPress={onVerify} title="Xác minh License công khai" />
    </ScrollView>
  );
}

function CustomerNavigation({ navigation }: { readonly navigation: Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate'> }) {
  return (
    <View style={styles.actions}>
      <Button onPress={() => navigation.navigate('Catalog')} title="Sản phẩm" />
      <Button onPress={() => navigation.navigate('Orders')} title="Đơn hàng" />
      <Button onPress={() => navigation.navigate('Licenses')} title="License" />
      <Button onPress={() => navigation.navigate('Profile')} title="Hồ sơ" />
      <Button onPress={() => navigation.navigate('Notifications')} title="Thông báo" />
      <Button onPress={() => navigation.navigate('Assistance')} title="Hỗ trợ" />
    </View>
  );
}

export function AssistanceScreen() {
  const [conversations, setConversations] = useState<MobileConversation[]>([]);
  const [selected, setSelected] = useState<MobileConversation | null>(null);
  const [messages, setMessages] = useState<MobileConversationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aiAnswer, setAiAnswer] = useState<{ answer: string; grounded: boolean; citedSourceIds: string[] } | null>(null);

  useEffect(() => {
    void listConversations().then((items) => {
      setConversations(items);
      if (items[0]) {
        setSelected(items[0]);
        return listConversationMessages(items[0].id).then(setMessages);
      }
      return undefined;
    }).catch(() => setError('Không thể tải hội thoại hỗ trợ.'));
  }, []);

  const selectConversation = async (conversation: MobileConversation) => {
    setSelected(conversation);
    setAiAnswer(null);
    try { setMessages(await listConversationMessages(conversation.id)); }
    catch { setError('Không thể tải nội dung hội thoại.'); }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || !selected) return;
    try {
      await appendConversationMessage(selected.id, crypto.randomUUID(), content);
      setDraft('');
      setMessages(await listConversationMessages(selected.id));
    } catch { setError('Không thể gửi tin nhắn.'); }
  };

  const ask = async () => {
    const question = draft.trim();
    if (!question || !selected) return;
    try {
      setAiAnswer(await askConversationAi(selected.id, question));
      setDraft('');
      setMessages(await listConversationMessages(selected.id));
    } catch { setError('Không thể hỏi AI lúc này.'); }
  };

  const start = async () => {
    try {
      const conversation = await createConversation();
      setConversations((items) => [conversation, ...items]);
      setSelected(conversation);
      setMessages([]);
    } catch { setError('Không thể tạo hội thoại mới.'); }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Hỗ trợ</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button onPress={() => void start()} title="Hội thoại mới" />
      {conversations.map((conversation) => (
        <Pressable key={conversation.id} onPress={() => void selectConversation(conversation)} style={[styles.card, selected?.id === conversation.id ? styles.selectedCard : null]}>
          <Text style={styles.cardTitle}>{conversation.title ?? 'Hội thoại hỗ trợ'}</Text>
          <Text style={styles.muted}>{conversation.status}</Text>
        </Pressable>
      ))}
      {!selected ? <Text>Chưa có hội thoại hỗ trợ.</Text> : (
        <View style={styles.card}>
          {messages.map((message) => (
            <View key={message.id} style={styles.messageRow}>
              <Text style={styles.muted}>{message.senderType === 'CUSTOMER' ? 'Bạn' : message.senderType === 'AI' ? 'AI' : 'Hỗ trợ'}</Text>
              <Text>{message.content}</Text>
            </View>
          ))}
          {aiAnswer ? <View style={styles.aiNotice}><Text>{aiAnswer.answer}</Text><Text style={styles.muted}>{aiAnswer.grounded ? `Nguồn: ${aiAnswer.citedSourceIds.join(', ')}` : 'AI từ chối vì không đủ nguồn chính thức.'}</Text></View> : null}
          <TextInput accessibilityLabel="Tin nhắn hỗ trợ" onChangeText={setDraft} placeholder="Nhập câu hỏi hoặc tin nhắn" style={styles.input} value={draft} />
          <View style={styles.actions}><Button disabled={!draft.trim()} onPress={() => void send()} title="Gửi tin nhắn" /><Button disabled={!draft.trim()} onPress={() => void ask()} title="Hỏi AI có nguồn" /></View>
        </View>
      )}
    </ScrollView>
  );
}

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void listNotifications().then(setNotifications).catch(() => setError('Không thể tải thông báo.')); }, []);
  return <ScrollView contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.heading}>Thông báo</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {notifications.length === 0 && !error ? <Text>Chưa có thông báo.</Text> : null}
    {notifications.map((notification) => <Pressable key={notification.id} onPress={() => { if (!notification.isRead) void markNotificationRead(notification.id).then(() => setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, isRead: true } : item))); }} style={styles.card}>
      <Text style={styles.cardTitle}>{notification.title}</Text>
      <Text>{notification.content}</Text>
      {!notification.isRead ? <Text style={styles.muted}>Chưa đọc</Text> : null}
    </Pressable>)}
  </ScrollView>;
}

export function CatalogScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Catalog'>) {
  const [products, setProducts] = useState<MobileProduct[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void listProducts().then(setProducts).catch(() => setError('Không thể tải danh mục sản phẩm.'));
  }, []);
  const toggleComparison = (planId: string) => setSelectedPlanIds((current) =>
    current.includes(planId)
      ? current.filter((id) => id !== planId)
      : current.length < 4
        ? [...current, planId]
        : current,
  );
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Danh mục sản phẩm</Text>
      <Text style={styles.subtitle}>Chọn gói đã công bố hoặc so sánh từ hai đến bốn gói.</Text>
      <CustomerNavigation navigation={navigation} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {products.map((product) => (
        <View key={product.slug} style={styles.card}>
          <Text style={styles.cardTitle}>{product.name}</Text>
          <Text style={styles.muted}>{product.summary}</Text>
          {product.plans.map((plan) => (
            <View key={plan.id} style={styles.planRow}>
              <View style={styles.flexOne}>
                <Text style={styles.planTitle}>{plan.name}</Text>
                <Text>{plan.priceVnd.toLocaleString('vi-VN')} ₫ · {plan.maxActiveDevices} thiết bị</Text>
              </View>
              <Button
                onPress={() => navigation.navigate('Checkout', {
                  planId: plan.id,
                  planName: plan.name,
                  priceVnd: plan.priceVnd,
                  productName: product.name,
                })}
                title="Mua"
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selectedPlanIds.includes(plan.id) }}
                onPress={() => toggleComparison(plan.id)}
                style={[styles.compareToggle, selectedPlanIds.includes(plan.id) ? styles.compareToggleSelected : null]}
              >
                <Text>{selectedPlanIds.includes(plan.id) ? 'Đã chọn' : 'So sánh'}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ))}
      <Button
        disabled={selectedPlanIds.length < 2}
        onPress={() => navigation.navigate('ComparePlans', { ids: selectedPlanIds })}
        title={`So sánh ${selectedPlanIds.length} gói`}
      />
    </ScrollView>
  );
}

export function ComparePlansScreen({ route }: NativeStackScreenProps<RootStackParamList, 'ComparePlans'>) {
  const [comparison, setComparison] = useState<MobilePlanComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void comparePlans(route.params.ids).then(setComparison).catch(() => setError('Không thể so sánh các gói đã chọn.'));
  }, [route.params.ids]);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>So sánh gói</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {comparison?.plans.map((plan) => (
        <View key={plan.id} style={styles.card}>
          <Text style={styles.cardTitle}>{plan.productName}</Text>
          <Text>{plan.name} · phiên bản {plan.version}</Text>
          {comparison.dimensions.map((dimension) => (
            <View key={dimension.key} style={styles.factRow}>
              <Text style={styles.muted}>{dimension.label}</Text>
              <Text>{formatComparisonValue(dimension.key, dimension.values[plan.id])}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function formatComparisonValue(key: string, value: unknown): string {
  if (key === 'priceVnd' && typeof value === 'number') return `${value.toLocaleString('vi-VN')} ₫`;
  if (key === 'durationMonths' && typeof value === 'number') return `${value} tháng`;
  if (key === 'maxActiveDevices' && typeof value === 'number') return `${value} thiết bị`;
  if (value && typeof value === 'object') return Object.keys(value).join(', ') || 'Không có';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '—';
}

export function ProfileScreen({
  onProfileUpdated,
}: {
  readonly onProfileUpdated: (user: MobileSession['user']) => void;
}) {
  const [profile, setProfile] = useState<MobileSession['user'] | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    void getProfile()
      .then((value) => {
        setProfile(value);
        setDisplayName(value.displayName);
        setPhone(value.phone ?? '');
        setAddress(value.address ?? '');
      })
      .catch(() => setMessage('Không thể tải hồ sơ.'));
  }, []);
  const save = async () => {
    setMessage(null);
    try {
      const updated = await updateProfile({
        displayName: displayName.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
      });
      setProfile(updated);
      onProfileUpdated(updated);
      setMessage('Đã cập nhật hồ sơ.');
    } catch {
      setMessage('Không thể cập nhật hồ sơ.');
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Hồ sơ tài khoản</Text>
      <Text style={styles.subtitle}>{profile?.email ?? 'Đang tải thông tin tài khoản...'}</Text>
      <TextInput accessibilityLabel="Tên hiển thị" onChangeText={setDisplayName} style={styles.input} value={displayName} />
      <TextInput accessibilityLabel="Số điện thoại" keyboardType="phone-pad" onChangeText={setPhone} style={styles.input} value={phone} />
      <TextInput accessibilityLabel="Địa chỉ" multiline onChangeText={setAddress} style={[styles.input, styles.multilineInput]} value={address} />
      {message ? <Text accessibilityRole="alert" style={message.startsWith('Đã') ? styles.success : styles.error}>{message}</Text> : null}
      <Button disabled={!displayName.trim()} onPress={() => void save()} title="Lưu thay đổi" />
    </ScrollView>
  );
}

function OrdersScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Orders'>) {
  const [orders, setOrders] = useState<MobileOrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void listOrders().then(setOrders).catch(() => setError('Không thể tải danh sách đơn hàng.'));
  }, []);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.brand}>Emukey</Text>
      <Text style={styles.subtitle}>Đơn hàng gắn với tài khoản Emukey đang đăng nhập</Text>
      <CustomerNavigation navigation={navigation} />
      <Button onPress={() => navigation.navigate('VerifyLicense')} title="Xác minh License công khai" />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {orders.length === 0 ? <Text>Chưa có đơn hàng.</Text> : null}
      {orders.map((order) => (
        <Pressable key={order.id} onPress={() => navigation.navigate('OrderDetail', { id: order.id })} style={styles.card}>
          <Text style={styles.cardTitle}>{order.orderNumber}</Text>
          <Text>{order.orderStatus}</Text>
          <Text>{order.priceVndSnapshot.toLocaleString('vi-VN')} VND</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function CheckoutScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Checkout'>) {
  const [order, setOrder] = useState<MobileOrderDetail | null>(null);
  const [terms, setTerms] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startOrder = async () => {
    setError(null);
    try {
      const created = await createOrder({ planId: route.params.planId });
      setOrder(created);
      setTerms((await getOrderTerms(created.id)).content);
    } catch {
      setError('Không thể tạo đơn hàng hoặc tải điều khoản.');
    }
  };
  const continueToPayment = async () => {
    if (!order || !accepted) return;
    setError(null);
    try {
      const updated = await acceptServiceTerms(order);
      navigation.replace('Payment', { orderId: updated.id });
    } catch {
      setError('Không thể xác nhận điều khoản của đơn hàng.');
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Hoàn tất mua bản quyền</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{route.params.productName}</Text>
        <Text>{route.params.planName}</Text>
        <Text style={styles.price}>{route.params.priceVnd.toLocaleString('vi-VN')} ₫</Text>
      </View>
      {!order ? (
        <Button onPress={() => void startOrder()} title="Tạo đơn hàng" />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Điều khoản cấp phép</Text>
          <Text style={styles.terms}>{terms ?? 'Đang tải điều khoản...'}</Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            onPress={() => setAccepted((value) => !value)}
            style={[styles.acceptance, accepted ? styles.acceptanceSelected : null]}
          >
            <Text>{accepted ? '✓ ' : ''}Tôi đã đọc và đồng ý với điều khoản cấp phép</Text>
          </Pressable>
          <Button disabled={!accepted} onPress={() => void continueToPayment()} title="Tiếp tục thanh toán" />
        </View>
      )}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

function htmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function checkoutDocument(checkout: MobileCheckoutSession): string {
  const fields = Object.entries(checkout.checkoutFields)
    .map(([name, value]) => `<input type="hidden" name="${htmlAttribute(name)}" value="${htmlAttribute(value)}">`)
    .join('');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:sans-serif;background:#f3f0e9;padding:24px"><p>Đang chuyển đến cổng thanh toán SePay…</p><form id="checkout" method="post" action="${htmlAttribute(checkout.checkoutUrl)}">${fields}</form><script>document.getElementById('checkout').submit()</script></body></html>`;
}

export function PaymentScreen({ route }: NativeStackScreenProps<RootStackParamList, 'Payment'>) {
  const [order, setOrder] = useState<MobileOrderDetail | null>(null);
  const [checkout, setCheckout] = useState<MobileCheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => void getOrder(route.params.orderId)
      .then((value) => { if (active) setOrder(value); })
      .catch(() => { if (active) setError('Không thể cập nhật trạng thái đơn hàng.'); });
    refresh();
    const timer = setInterval(refresh, 5_000);
    return () => { active = false; clearInterval(timer); };
  }, [route.params.orderId]);
  const openCheckout = async () => {
    setError(null);
    try {
      const session = await createCheckout(route.params.orderId);
      if (!session.checkoutUrl.startsWith('https://')) throw new Error('UNSAFE_CHECKOUT_URL');
      setCheckout(session);
    } catch {
      setError('Không thể tạo phiên thanh toán SePay.');
    }
  };
  if (checkout) {
    return (
      <View style={styles.webViewContainer}>
        <WebView
          javaScriptEnabled
          onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url.startsWith('https://')}
          originWhitelist={['*']}
          source={{ html: checkoutDocument(checkout) }}
          style={styles.webView}
        />
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Thanh toán đơn hàng</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{order?.orderNumber ?? 'Đang tải đơn hàng...'}</Text>
        <Text>{order?.productNameSnapshot}</Text>
        <Text>{order?.orderStatus}</Text>
        {order ? <Text style={styles.price}>{order.priceVndSnapshot.toLocaleString('vi-VN')} ₫</Text> : null}
      </View>
      {order?.orderStatus === 'WAITING_PAYMENT' ? (
        <Button onPress={() => void openCheckout()} title="Thanh toán trên SePay" />
      ) : null}
      {order?.orderStatus === 'PAYMENT_ACCEPTED' ? (
        <Text accessibilityRole="alert" style={styles.success}>Thanh toán đã hoàn tất. License đang được xử lý trên blockchain.</Text>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

export function LicensesScreen({
  navigation,
}: {
  readonly navigation?: NativeStackScreenProps<RootStackParamList, 'Licenses'>['navigation'];
} = {}) {
  const [licenses, setLicenses] = useState<MobileLicense[]>([]);
  const [activationKey, setActivationKey] = useState<{ key: string; licenseId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<Record<string, MobileDevice[]>>({});
  const [actionToken, setActionToken] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [commandId, setCommandId] = useState<string | null>(null);
  const [entitlementToken, setEntitlementToken] = useState<string | null>(null);
  useEffect(() => {
    void listLicenses().then(setLicenses).catch(() => setError('Không thể tải danh sách License.'));
  }, []);
  const retrieve = async (license: MobileLicense) => {
    try {
      const result = await retrieveActivationKey(license.id);
      await storeActivationKey(license.id, result.activationKey);
      setActivationKey({ key: result.activationKey, licenseId: license.id });
    } catch {
      setError('Activation key không còn khả dụng hoặc đã được nhận trước đó.');
    }
  };
  const loadDevices = async (licenseId: string) => {
    try {
      const result = await listDevices(licenseId);
      setDevices((current) => ({ ...current, [licenseId]: result }));
    } catch {
      setError('Không thể tải danh sách thiết bị.');
    }
  };
  useEffect(() => {
    let active = true;
    void Promise.all(licenses.map(async (license) => [license.id, await loadActivationKey(license.id)] as const))
      .then((values) => {
        if (!active) return;
        const saved = values.find(([, key]) => key !== null);
        if (saved?.[1]) setActivationKey({ key: saved[1], licenseId: saved[0] });
      });
    return () => { active = false; };
  }, [licenses]);
  const activate = async (license: MobileLicense) => {
    setMessage(null);
    setError(null);
    try {
      const identity = await createOrLoadDeviceIdentity(license.id);
      const challenge = await createActivationChallenge({ deviceRef: identity.deviceRef, licenseId: license.id, purpose: 'ACTIVATE_DEVICE' });
      const proof = identity.signMessage(challenge.challenge);
      const command = await activateDevice({
        activationKey: activationKey?.licenseId === license.id ? activationKey.key : '',
        challenge: challenge.challenge,
        devicePublicKey: identity.address,
        deviceRef: identity.deviceRef,
        licenseId: license.id,
        proof,
      });
      setMessage(`Activation ${command.status}: ${command.commandId}`);
      setCommandId(command.commandId);
    } catch {
      setError('Không thể kích hoạt thiết bị. Kiểm tra activation key, quota và trạng thái on-chain.');
    }
  };
  const revoke = async (licenseId: string, device: MobileDevice) => {
    setError(null);
    try {
      const key = activationKey?.licenseId === licenseId ? activationKey.key : await loadActivationKey(licenseId);
      if (!key) throw new Error('ACTIVATION_KEY_MISSING');
      const identity = await createOrLoadDeviceIdentity(licenseId);
      const challenge = await createActivationChallenge({ deviceId: device.id, deviceRef: identity.deviceRef, licenseId, purpose: 'SELF_REVOKE_DEVICE' });
      const proof = identity.signMessage(challenge.challenge);
      const command = await revokeDevice(licenseId, device.id, { actionToken, activationKey: key, challenge: challenge.challenge, proof });
      setMessage(`Revoke ${command.status}: ${command.commandId}`);
      setCommandId(command.commandId);
      await loadDevices(licenseId);
    } catch {
      setError('Không thể thu hồi thiết bị. Xác nhận email trước và nhập action token.');
    }
  };
  const sendEntitlement = async (licenseId: string, device: MobileDevice, refresh: boolean) => {
    setError(null);
    try {
      const identity = await createOrLoadDeviceIdentity(licenseId);
      const challenge = await createActivationChallenge({
        deviceId: device.id,
        deviceRef: identity.deviceRef,
        licenseId,
        purpose: refresh ? 'REFRESH_ENTITLEMENT' : 'ISSUE_ENTITLEMENT',
      });
      const proof = identity.signMessage(challenge.challenge);
      const result = refresh
        ? await refreshEntitlement(licenseId, device.id, challenge.challenge, proof)
        : await issueEntitlement(licenseId, device.id, challenge.challenge, proof);
      setEntitlementToken(result.token);
      setMessage(`Entitlement hợp lệ đến ${result.expiresAt}`);
    } catch {
      setError('Thiết bị chưa đủ điều kiện hoặc chữ ký thiết bị không hợp lệ.');
    }
  };
  const rotateKey = async (licenseId: string) => {
    setError(null);
    try {
      const key = activationKey?.licenseId === licenseId ? activationKey.key : await loadActivationKey(licenseId);
      if (!key) throw new Error('ACTIVATION_KEY_MISSING');
      const command = await rotateActivationKey(licenseId, { actionToken, currentKey: key });
      setMessage(`Rotate ${command.status}: ${command.commandId}. Key mới khả dụng sau finality.`);
      setCommandId(command.commandId);
    } catch {
      setError('Không thể đổi activation key. Kiểm tra token email và key hiện tại.');
    }
  };
  useEffect(() => {
    if (!commandId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const command = await getCommandStatus(commandId);
        if (!active) return;
        const transactionHash = typeof command.transactionHash === 'string' ? command.transactionHash : null;
        setMessage(`Command ${command.status}: ${command.commandId}${transactionHash ? ` · ${transactionHash}` : ''}`);
        if (command.status === 'CONFIRMED') {
          if (command.commandType === 'ROTATE_KEY') {
            void retrieveActivationKey(command.licenseId).then(async (result) => {
              await storeActivationKey(command.licenseId, result.activationKey);
              setActivationKey({ key: result.activationKey, licenseId: command.licenseId });
              setMessage(`Đã nhận key phiên bản ${result.keyVersion} sau finality.`);
            }).catch(() => setError('Command đã final nhưng không thể nhận activation key mới.'));
          }
          void listLicenses().then(setLicenses);
          void loadDevices(command.licenseId);
          return;
        }
        if (['DEAD_LETTER', 'ABANDONED', 'SUPERSEDED'].includes(command.status)) return;
      } catch {
        if (active) setError('Tạm thời không thể đọc trạng thái blockchain command. Ứng dụng sẽ thử lại.');
      }
      if (active) timer = setTimeout(() => void poll(), 2_000);
    };
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [commandId]);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>License của tôi</Text>
      {navigation ? <CustomerNavigation navigation={navigation} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
      {licenses.length === 0 ? <Text>Chưa có License nào.</Text> : null}
      {licenses.map((license) => (
        <View key={license.id} style={styles.card}>
          <Text style={styles.cardTitle}>{license.productName}</Text>
          <Text>{license.publicLicenseId}</Text>
          <Text>{license.status} · {license.finality} ({license.confirmationCount})</Text>
           {activationKey?.licenseId === license.id ? (
            <Text selectable style={styles.activationKey}>{activationKey.key}</Text>
          ) : (
            <Button disabled={license.status !== 'ACTIVE'} onPress={() => void retrieve(license)} title="Nhận activation key" />
           )}
             <Button onPress={() => void loadDevices(license.id)} title="Xem thiết bị" />
             <Button disabled={!activationKey || activationKey.licenseId !== license.id || license.status !== 'ACTIVE'} onPress={() => void activate(license)} title="Kích hoạt thiết bị này" />
             <TextInput accessibilityLabel="Email action token" autoCapitalize="none" onChangeText={setActionToken} placeholder="Action token từ email" style={styles.input} value={actionToken} />
             <Button onPress={() => void requestLicensingActionVerification(license.id, 'ROTATE_KEY').then(() => setMessage('Đã gửi email xác nhận đổi key.')).catch(() => setError('Không thể gửi email xác nhận.'))} title="Gửi email xác nhận đổi key" />
             <Button disabled={!actionToken || !activationKey || activationKey.licenseId !== license.id} onPress={() => void rotateKey(license.id)} title="Đổi activation key" />
            {navigation && license.status === 'ACTIVE' ? (
              <Button
                onPress={() => navigation.navigate('Renewal', {
                  licenseId: license.id,
                  originOrderId: license.originOrderId,
                  productName: license.productName,
                })}
                title="Gia hạn License"
              />
            ) : null}
            {(devices[license.id] ?? []).map((device) => (
              <View key={device.id} style={styles.card}>
                <Text>{device.deviceRef} · {device.status} · {device.finality ?? 'PENDING'}</Text>
                {device.status === 'ACTIVE' ? <Button onPress={() => void requestLicensingActionVerification(license.id, 'REVOKE_DEVICE', device.id).then(() => setMessage('Đã gửi email xác nhận thu hồi.')).catch(() => setError('Không thể gửi email xác nhận.'))} title="Gửi email xác nhận thu hồi" /> : null}
                {device.status === 'ACTIVE' ? <Button disabled={!actionToken} onPress={() => void revoke(license.id, device)} title="Thu hồi thiết bị" /> : null}
                {device.status === 'ACTIVE' && device.finality === 'CONFIRMED' ? <Button onPress={() => void sendEntitlement(license.id, device, false)} title="Cấp entitlement" /> : null}
                {device.status === 'ACTIVE' && device.finality === 'CONFIRMED' ? <Button onPress={() => void sendEntitlement(license.id, device, true)} title="Làm mới entitlement" /> : null}
                {device.status === 'ACTIVE' && device.finality === 'CONFIRMED' && entitlementToken ? <Button onPress={() => void verifyEntitlement(entitlementToken).then((result) => setMessage(`Entitlement v${result.entitlementVersion} còn hiệu lực đến ${result.expiresAt}`)).catch(() => setError('Entitlement đã hết hạn hoặc bị vô hiệu.'))} title="Kiểm tra entitlement" /> : null}
              </View>
            ))}
        </View>
      ))}
    </ScrollView>
  );
}

export function RenewalScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Renewal'>) {
  const [sourceOrder, setSourceOrder] = useState<MobileOrderDetail | null>(null);
  const [renewalOrder, setRenewalOrder] = useState<MobileOrderDetail | null>(null);
  const [terms, setTerms] = useState<string | null>(null);
  const [activationKey, setActivationKey] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void getOrder(route.params.originOrderId)
      .then(setSourceOrder)
      .catch(() => setError('Không thể tải gói hiện tại của License.'));
  }, [route.params.originOrderId]);
  const startRenewal = async () => {
    if (!sourceOrder || !activationKey.trim()) return;
    setError(null);
    try {
      const created = await createOrder(
        { planId: sourceOrder.planId, targetLicenseId: route.params.licenseId },
        activationKey.trim(),
      );
      setRenewalOrder(created);
      setTerms((await getOrderTerms(created.id)).content);
    } catch {
      setError('Activation key không hợp lệ hoặc không thể tạo đơn gia hạn.');
    }
  };
  const continueToPayment = async () => {
    if (!renewalOrder || !accepted) return;
    try {
      const updated = await acceptServiceTerms(renewalOrder);
      navigation.replace('Payment', { orderId: updated.id });
    } catch {
      setError('Không thể xác nhận điều khoản gia hạn.');
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Gia hạn License</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{route.params.productName}</Text>
        <Text>{sourceOrder?.planNameSnapshot ?? 'Đang tải gói hiện tại...'}</Text>
        {sourceOrder ? <Text style={styles.price}>{sourceOrder.priceVndSnapshot.toLocaleString('vi-VN')} ₫</Text> : null}
      </View>
      {!renewalOrder ? (
        <>
          <TextInput
            accessibilityLabel="Activation key hiện tại"
            autoCapitalize="none"
            onChangeText={setActivationKey}
            placeholder="Activation key hiện tại"
            secureTextEntry
            style={styles.input}
            value={activationKey}
          />
          <Button disabled={!sourceOrder || !activationKey.trim()} onPress={() => void startRenewal()} title="Tạo đơn gia hạn" />
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Điều khoản gia hạn</Text>
          <Text style={styles.terms}>{terms}</Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            onPress={() => setAccepted((value) => !value)}
            style={[styles.acceptance, accepted ? styles.acceptanceSelected : null]}
          >
            <Text>{accepted ? '✓ ' : ''}Tôi đồng ý với điều khoản gia hạn</Text>
          </Pressable>
          <Button disabled={!accepted} onPress={() => void continueToPayment()} title="Tiếp tục thanh toán" />
        </View>
      )}
      <Text style={styles.muted}>Thời hạn chỉ được cập nhật sau khi transaction blockchain đạt finality.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

export function VerifyLicenseScreen() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<MobileLicenseVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verify = async () => {
    setError(null);
    try { setResult(await verifyPublicLicense(code.trim())); }
    catch { setError('Không thể xác minh License lúc này.'); }
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Xác minh Blockchain</Text>
      <Text>Chỉ dùng mã License công khai; kết quả không chứa danh tính người mua.</Text>
      <TextInput accessibilityLabel="Mã License công khai" autoCapitalize="characters" onChangeText={setCode} placeholder="EMU-..." style={styles.input} value={code} />
      <Button disabled={!code.trim()} onPress={() => void verify()} title="Xác minh" />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {result ? <View style={styles.card}><Text style={styles.cardTitle}>{result.productName ?? result.licenseId}</Text><Text>{result.state}</Text><Text>{result.licenseId}</Text></View> : null}
    </ScrollView>
  );
}

function OrderDetailScreen({ route }: NativeStackScreenProps<RootStackParamList, 'OrderDetail'>) {
  const [order, setOrder] = useState<MobileOrderDetail | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { void getOrder(route.params.id).then(setOrder).catch(() => setError(true)); }, [route.params.id]);
  if (error) return <View style={styles.container}><Text accessibilityRole="alert">Không thể tải đơn hàng.</Text></View>;
  if (!order) return <View style={styles.container}><Text>Đang tải...</Text></View>;
  return <View style={styles.container}><Text style={styles.heading}>{order.orderNumber}</Text><Text>{order.planNameSnapshot}</Text><Text>{order.orderStatus}</Text></View>;
}

export function EmuKeyMobileApp() {
  const [fontsLoaded, fontError] = useFonts({ GreatVibes_400Regular });
  const [session, setSession] = useState<MobileSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [publicVerify, setPublicVerify] = useState(false);
  useEffect(() => { void restoreSession().then(setSession).finally(() => setLoading(false)); }, []);
  if ((!fontsLoaded && !fontError) || loading) return <View style={styles.container}><Text>Đang khôi phục phiên đăng nhập...</Text></View>;
  if (!session) {
    if (publicVerify) return <View style={styles.publicContainer}><VerifyLicenseScreen /><Button onPress={() => setPublicVerify(false)} title="Quay lại đăng nhập" /></View>;
    return <LoginScreen onAuthenticated={setSession} onVerify={() => setPublicVerify(true)} />;
  }
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Catalog">
        <Stack.Screen component={CatalogScreen} name="Catalog" options={{ headerRight: () => <Button onPress={() => void logout().then(() => setSession(null))} title="Đăng xuất" />, title: 'Sản phẩm' }} />
        <Stack.Screen component={AssistanceScreen} name="Assistance" options={{ title: 'Hỗ trợ' }} />
        <Stack.Screen component={ComparePlansScreen} name="ComparePlans" options={{ title: 'So sánh gói' }} />
        <Stack.Screen component={CheckoutScreen} name="Checkout" options={{ title: 'Tạo đơn hàng' }} />
        <Stack.Screen component={OrdersScreen} name="Orders" options={{ headerRight: () => <Button onPress={() => void logout().then(() => setSession(null))} title="Đăng xuất" />, title: 'Đơn hàng' }} />
        <Stack.Screen component={OrderDetailScreen} name="OrderDetail" options={{ title: 'Chi tiết đơn hàng' }} />
        <Stack.Screen component={LicensesScreen} name="Licenses" options={{ title: 'License của tôi' }} />
        <Stack.Screen component={NotificationsScreen} name="Notifications" options={{ title: 'Thông báo' }} />
        <Stack.Screen component={PaymentScreen} name="Payment" options={{ title: 'Thanh toán' }} />
        <Stack.Screen name="Profile" options={{ title: 'Hồ sơ' }}>
          {() => <ProfileScreen onProfileUpdated={(user) => setSession((current) => current ? { ...current, user } : current)} />}
        </Stack.Screen>
        <Stack.Screen component={RenewalScreen} name="Renewal" options={{ title: 'Gia hạn License' }} />
        <Stack.Screen component={VerifyLicenseScreen} name="VerifyLicense" options={{ title: 'Xác minh License' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  aiNotice: { backgroundColor: '#e9f1f5', borderColor: '#b7cfda', borderRadius: 8, borderWidth: 1, gap: 6, padding: 12 },
  acceptance: { backgroundColor: '#fdfbf6', borderColor: '#a9977a', borderRadius: 8, borderWidth: 1, padding: 12 },
  acceptanceSelected: { backgroundColor: '#fbf0d6', borderColor: '#a8792e' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activationKey: { backgroundColor: '#e0f2fe', color: '#0c4a6e', fontFamily: 'monospace', padding: 10 },
  brand: { color: '#7a2e3a', fontFamily: 'GreatVibes_400Regular', fontSize: 42, lineHeight: 52 },
  card: { backgroundColor: '#fdfbf6', borderColor: '#a9977a', borderRadius: 12, borderWidth: 1, gap: 8, padding: 16 },
  cardTitle: { color: '#1c1a17', fontSize: 17, fontWeight: '700' },
  compareToggle: { borderColor: '#a9977a', borderRadius: 6, borderWidth: 1, minWidth: 72, padding: 9 },
  compareToggleSelected: { backgroundColor: '#fbf0d6', borderColor: '#a8792e' },
  container: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 20 },
  content: { backgroundColor: '#f3f0e9', flexGrow: 1, gap: 14, padding: 20 },
  error: { color: '#9b2226' },
  factRow: { borderTopColor: '#e4dfd3', borderTopWidth: 1, gap: 4, paddingTop: 8 },
  flexOne: { flex: 1 },
  heading: { color: '#1c1a17', fontSize: 22, fontWeight: '700' },
  input: { backgroundColor: '#fdfbf6', borderColor: '#a9977a', borderRadius: 8, borderWidth: 1, padding: 12 },
  messageRow: { borderBottomColor: '#e4dfd3', borderBottomWidth: 1, gap: 4, paddingVertical: 8 },
  multilineInput: { minHeight: 88, textAlignVertical: 'top' },
  muted: { color: '#52493c' },
  planRow: { alignItems: 'center', borderTopColor: '#e4dfd3', borderTopWidth: 1, flexDirection: 'row', gap: 8, paddingTop: 10 },
  planTitle: { color: '#1c1a17', fontWeight: '700' },
  price: { color: '#8a611f', fontSize: 18, fontWeight: '700' },
  publicContainer: { flex: 1 },
  subtitle: { color: '#52493c', fontSize: 16 },
  selectedCard: { borderColor: '#7a2e3a', borderWidth: 2 },
  success: { color: '#1f6f46' },
  terms: { color: '#1c1a17', lineHeight: 22 },
  webView: { flex: 1 },
  webViewContainer: { backgroundColor: '#f3f0e9', flex: 1 },
});
