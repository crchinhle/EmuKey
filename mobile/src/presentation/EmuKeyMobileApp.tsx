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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  getOrder,
  listLicenses,
  listOrders,
  login,
  logout,
  restoreSession,
  retrieveActivationKey,
  verifyPublicLicense,
  type MobileLicense,
  type MobileLicenseVerification,
  type MobileOrderDetail,
  type MobileOrderSummary,
  type MobileSession,
} from '../infrastructure/api/client';

type RootStackParamList = {
  Licenses: undefined;
  Orders: undefined;
  OrderDetail: { id: string };
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
      <Text accessibilityRole="header" style={styles.brand}>EmuKey</Text>
      <Text style={styles.subtitle}>Đăng nhập để quản lý đơn hàng và license của bạn</Text>
      <TextInput accessibilityLabel="Email" autoCapitalize="none" onChangeText={setEmail} style={styles.input} value={email} />
      <TextInput accessibilityLabel="Mật khẩu" onChangeText={setPassword} secureTextEntry style={styles.input} value={password} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button disabled={!email.trim() || password.length < 8} onPress={() => void submit()} title="Đăng nhập" />
      <Button onPress={onVerify} title="Xác minh License công khai" />
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
      <Text accessibilityRole="header" style={styles.brand}>EmuKey</Text>
      <Text style={styles.subtitle}>Đơn hàng gắn với tài khoản EmuKey đang đăng nhập</Text>
      <View style={styles.actions}>
        <Button onPress={() => navigation.navigate('Licenses')} title="License của tôi" />
        <Button onPress={() => navigation.navigate('VerifyLicense')} title="Xác minh License" />
      </View>
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

export function LicensesScreen() {
  const [licenses, setLicenses] = useState<MobileLicense[]>([]);
  const [activationKey, setActivationKey] = useState<{ key: string; licenseId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void listLicenses().then(setLicenses).catch(() => setError('Không thể tải danh sách License.'));
  }, []);
  const retrieve = async (license: MobileLicense) => {
    try {
      const result = await retrieveActivationKey(license.id);
      setActivationKey({ key: result.activationKey, licenseId: license.id });
    } catch {
      setError('Activation key không còn khả dụng hoặc đã được nhận trước đó.');
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>License của tôi</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
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
        </View>
      ))}
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
  const [session, setSession] = useState<MobileSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [publicVerify, setPublicVerify] = useState(false);
  useEffect(() => { void restoreSession().then(setSession).finally(() => setLoading(false)); }, []);
  if (loading) return <View style={styles.container}><Text>Đang khôi phục phiên đăng nhập...</Text></View>;
  if (!session) {
    if (publicVerify) return <View style={styles.publicContainer}><VerifyLicenseScreen /><Button onPress={() => setPublicVerify(false)} title="Quay lại đăng nhập" /></View>;
    return <LoginScreen onAuthenticated={setSession} onVerify={() => setPublicVerify(true)} />;
  }
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Orders">
        <Stack.Screen component={OrdersScreen} name="Orders" options={{ headerRight: () => <Button onPress={() => void logout().then(() => setSession(null))} title="Đăng xuất" />, title: 'Đơn hàng' }} />
        <Stack.Screen component={OrderDetailScreen} name="OrderDetail" options={{ title: 'Chi tiết đơn hàng' }} />
        <Stack.Screen component={LicensesScreen} name="Licenses" options={{ title: 'License của tôi' }} />
        <Stack.Screen component={VerifyLicenseScreen} name="VerifyLicense" options={{ title: 'Xác minh License' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8 },
  activationKey: { backgroundColor: '#e0f2fe', color: '#0c4a6e', fontFamily: 'monospace', padding: 10 },
  brand: { color: '#172554', fontSize: 32, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderColor: '#cbd5e1', borderRadius: 8, borderWidth: 1, gap: 6, padding: 14 },
  cardTitle: { color: '#172554', fontSize: 17, fontWeight: '700' },
  container: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 20 },
  content: { backgroundColor: '#f8fafc', flexGrow: 1, gap: 12, padding: 20 },
  error: { color: '#b91c1c' },
  heading: { color: '#0f172a', fontSize: 22, fontWeight: '700' },
  input: { backgroundColor: '#fff', borderColor: '#cbd5e1', borderWidth: 1, padding: 10 },
  publicContainer: { flex: 1 },
  subtitle: { color: '#334155', fontSize: 16 },
});
