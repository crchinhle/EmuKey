import type {
  AuditEvent,
  ConversationRecord,
  JobRecord,
  KnowledgeDocument,
  LicenseRecord,
  MetricRecord,
  OrderRecord,
  PromotionRecord,
  RevenuePoint,
  VerificationRecord,
} from '../../domain/workspace';

export const primaryOrder: OrderRecord = {
  id: 'ORD-2026-0218',
  company: 'Công ty TNHH Minh An',
  product: 'SecureDesk Pro',
  plan: 'Business',
  devices: 25,
  subtotal: 2_450_000,
  discount: 367_500,
  total: 2_082_500,
  status: 'awaiting-payment',
  statusLabel: 'Chờ thanh toán',
};

export const orders: readonly OrderRecord[] = [
  primaryOrder,
  {
    id: 'ORD-2026-0207',
    company: 'Công ty TNHH Minh An',
    product: 'CloudStudio AI',
    plan: 'Business',
    devices: 10,
    subtotal: 2_100_000,
    discount: 210_000,
    total: 1_890_000,
    status: 'complete',
    statusLabel: 'Hoàn tất',
  },
  {
    id: 'ORD-2026-0199',
    company: 'Công ty TNHH Minh An',
    product: 'DataGuard SDK',
    plan: 'Starter',
    devices: 5,
    subtotal: 1_100_000,
    discount: 110_000,
    total: 990_000,
    status: 'awaiting-signature',
    statusLabel: 'Chờ ký',
  },
  {
    id: 'ORD-2026-0184',
    company: 'Công ty TNHH Minh An',
    product: 'SecureDesk Pro',
    plan: 'Business',
    devices: 15,
    subtotal: 1_650_000,
    discount: 180_000,
    total: 1_470_000,
    status: 'complete',
    statusLabel: 'Hoàn tất',
  },
];

export const providerOrders: readonly OrderRecord[] = [
  {
    ...primaryOrder,
    id: 'ORD-0225',
    company: 'Công ty Minh Châu',
    total: 4_125_000,
  },
  {
    ...primaryOrder,
    id: 'ORD-0224',
    company: 'Công ty Lam Sơn',
    plan: 'Starter',
    devices: 5,
    total: 990_000,
  },
  {
    ...primaryOrder,
    id: 'ORD-0223',
    company: 'Công ty An Phát',
    plan: 'Enterprise',
    devices: 80,
    total: 9_800_000,
  },
  {
    ...primaryOrder,
    id: 'ORD-0222',
    company: 'Công ty K-Tech',
    devices: 20,
    total: 3_600_000,
  },
];

export const licenses: readonly LicenseRecord[] = [
  {
    id: 'LIC-8F3A-2026',
    product: 'SecureDesk Pro',
    plan: 'Business',
    used: 14,
    total: 25,
    expiresAt: '21/08/2027',
    status: 'active',
    statusLabel: 'Hoạt động',
    demoKey: 'DEMO-ONLY-9K2M',
    devices: [
      { id: 'DESKTOP-AN-01', platform: 'Windows 11', status: 'Hoạt động' },
      { id: 'LAPTOP-MKT-04', platform: 'Windows 11', status: 'Hoạt động' },
    ],
  },
  {
    id: 'LIC-CLOUD-2026',
    product: 'CloudStudio AI',
    plan: 'Business',
    used: 4,
    total: 10,
    expiresAt: '10/10/2026',
    status: 'expiring',
    statusLabel: 'Sắp gia hạn',
    demoKey: 'DEMO-CLOUD-7P4Q',
    devices: [{ id: 'STUDIO-AN-02', platform: 'macOS', status: 'Hoạt động' }],
  },
  {
    id: 'LIC-SDK-2026',
    product: 'DataGuard SDK',
    plan: 'Starter',
    used: 1,
    total: 5,
    expiresAt: '14/02/2027',
    status: 'active',
    statusLabel: 'Hoạt động',
    demoKey: 'DEMO-SDK-4H8R',
    devices: [{ id: 'CI-RUNNER-01', platform: 'Linux', status: 'Hoạt động' }],
  },
];

export const conversations: readonly ConversationRecord[] = [
  {
    id: 'SUP-0184',
    customer: 'Minh An',
    company: 'Công ty TNHH Minh An',
    subject: 'Hỗ trợ kích hoạt',
    preview: 'Không kích hoạt được máy mới',
    status: 'SLA 08:42',
    tone: 'error',
    product: 'SecureDesk Pro',
    orderId: 'ORD-2026-0218',
    payment: 'Đã thanh toán',
    usedDevices: 14,
    totalDevices: 25,
    messages: [
      {
        id: 'm1',
        author: 'Buyer',
        body: 'Máy mới báo fingerprint đã được dùng.',
      },
      {
        id: 'm2',
        author: 'Support',
        body: 'Anh gửi fingerprint mới để tôi kiểm tra quota nhé.',
      },
      { id: 'm3', author: 'Buyer', body: 'FP-DEMO-WIN11-9F2A' },
    ],
  },
  {
    id: 'SUP-0185',
    customer: 'An Phú',
    company: 'Công ty An Phú',
    subject: 'Kiểm tra thanh toán',
    preview: 'Chưa thấy trạng thái hoàn tất',
    status: 'Mới',
    tone: 'warning',
    product: 'CloudStudio AI',
    orderId: 'ORD-2026-0220',
    payment: 'Đang đối soát',
    usedDevices: 4,
    totalDevices: 10,
    messages: [
      {
        id: 'm4',
        author: 'Buyer',
        body: 'Nhờ kiểm tra giao dịch demo của tôi.',
      },
    ],
  },
  {
    id: 'SUP-0186',
    customer: 'Khang Minh',
    company: 'Công ty Khang Minh',
    subject: 'Hỏi gia hạn license',
    preview: 'Cần tư vấn chu kỳ gia hạn',
    status: 'Mới',
    tone: 'info',
    product: 'SecureDesk Pro',
    orderId: 'ORD-2026-0214',
    payment: 'Đã thanh toán',
    usedDevices: 8,
    totalDevices: 15,
    messages: [
      { id: 'm5', author: 'Buyer', body: 'Tôi muốn biết quy trình gia hạn.' },
    ],
  },
];

export const promotions: readonly PromotionRecord[] = [
  {
    id: 'promo-08',
    name: 'Ưu đãi tháng 8',
    scope: 'Toàn hệ thống',
    discount: '15%',
    period: '15/08 – 31/08',
    status: 'Đang chạy',
    tone: 'success',
  },
  {
    id: 'secure-launch',
    name: 'SecureDesk Launch',
    scope: 'Sản phẩm SecureDesk',
    discount: '300.000 ₫',
    period: '01/09 – 15/09',
    status: 'Sắp diễn ra',
    tone: 'info',
  },
  {
    id: 'business-volume',
    name: 'Business Volume',
    scope: 'Gói Business',
    discount: '10%',
    period: '01/08 – 31/12',
    status: 'Đang chạy',
    tone: 'success',
  },
  {
    id: 'summer-draft',
    name: 'Summer Draft',
    scope: 'Tất cả sản phẩm',
    discount: '20%',
    period: 'Chưa công bố',
    status: 'Bản nháp',
    tone: 'neutral',
  },
];

export const knowledgeDocuments: readonly KnowledgeDocument[] = [
  {
    id: 'doc-1',
    name: 'Hướng dẫn SecureDesk v3.2',
    meta: 'PDF · 4,2 MB',
    status: 'Đã duyệt',
    tone: 'success',
  },
  {
    id: 'doc-2',
    name: 'FAQ kích hoạt thiết bị',
    meta: 'DOCX · 1,1 MB',
    status: 'Đã duyệt',
    tone: 'success',
  },
  {
    id: 'doc-3',
    name: 'Chính sách hoàn tiền 2026',
    meta: 'PDF · 850 KB',
    status: 'Chờ duyệt',
    tone: 'warning',
  },
  {
    id: 'doc-4',
    name: 'API License Client',
    meta: 'MD · 620 KB',
    status: 'Đang xử lý',
    tone: 'module',
  },
];

export const jobs: readonly JobRecord[] = [
  {
    id: '9842',
    name: 'contract_anchor #9842',
    status: 'Đang chạy',
    tone: 'info',
    helper: 'Retry tối đa 3 lần · có audit',
  },
  {
    id: '9841',
    name: 'license_issue #9841',
    status: 'Hoàn tất',
    tone: 'success',
    helper: 'Retry tối đa 3 lần · có audit',
  },
  {
    id: '9840',
    name: 'payment_sync #9840',
    status: 'Lỗi',
    tone: 'error',
    helper: 'Retry tối đa 3 lần · có audit',
  },
];

export const auditEvents: readonly AuditEvent[] = [
  {
    id: 'evt-1',
    time: '10:42:18',
    actor: 'provider.admin',
    action: 'PROMOTION_PUBLISHED',
    resource: 'promotion/promo_08',
    ip: '203.0.113.24',
    requestId: 'req_demo_7f9c2a',
    tone: 'info',
  },
  {
    id: 'evt-2',
    time: '10:39:02',
    actor: 'system.worker',
    action: 'BLOCKCHAIN_RETRY',
    resource: 'job #9840',
    ip: '192.0.2.44',
    requestId: 'req_demo_8a1d',
    tone: 'warning',
  },
  {
    id: 'evt-3',
    time: '10:31:44',
    actor: 'support.lan',
    action: 'CHAT_RESOLVED',
    resource: '#SUP-0182',
    ip: '198.51.100.14',
    requestId: 'req_demo_31bb',
    tone: 'info',
  },
  {
    id: 'evt-4',
    time: '10:20:11',
    actor: 'buyer.minhan',
    action: 'LICENSE_ACTIVATED',
    resource: 'FP-DEMO-WIN11',
    ip: '192.0.2.61',
    requestId: 'req_demo_71ca',
    tone: 'success',
  },
];

export const verificationRecords: readonly VerificationRecord[] = [
  {
    code: 'KLTN-2026-8F3A91',
    contractId: 'HĐ-2026-000128',
    product: 'SecureDesk Pro',
    provider: 'EmuKey Software',
    validity: '22/08/2026 – 21/08/2027',
    devices: 25,
    createdAt: '22/08/2026 · 09:41',
    blockNumber: '#18,421,560',
    documentHash: '0x9f4d…71ac',
  },
];

export const buyerMetrics: readonly MetricRecord[] = [
  { label: 'License đang hoạt động', value: '04', tone: 'success' },
  { label: 'Đơn chờ thanh toán', value: '01', tone: 'warning' },
  { label: 'Thiết bị đã kích hoạt', value: '18 / 25', tone: 'info' },
];

export const providerMetrics: readonly MetricRecord[] = [
  { label: 'Doanh thu tháng', value: '128,4 triệu ₫', tone: 'commerce' },
  { label: 'License hoạt động', value: '186', tone: 'success' },
  { label: 'Đơn chờ xử lý', value: '07', tone: 'warning' },
  { label: 'Job Blockchain lỗi', value: '02', tone: 'error' },
];

export const healthMetrics: readonly MetricRecord[] = [
  { label: 'API Gateway', value: '99,99%', tone: 'success' },
  { label: 'PostgreSQL', value: 'Healthy', tone: 'success' },
  { label: 'Redis Queue', value: '12 jobs', tone: 'warning' },
  { label: 'Blockchain RPC', value: 'Degraded', tone: 'error' },
];

export const providerRevenue: readonly RevenuePoint[] = [
  { month: 'T3', value: 82 },
  { month: 'T4', value: 94 },
  { month: 'T5', value: 88 },
  { month: 'T6', value: 112 },
  { month: 'T7', value: 121 },
  { month: 'T8', value: 128 },
];
