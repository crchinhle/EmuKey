import type { Product } from '../../domain/product';

export const products: readonly Product[] = [
  {
    slug: 'securedesk',
    name: 'SecureDesk Pro',
    summary:
      'Bảo vệ phần mềm desktop, quản lý thiết bị và xác minh giấy phép theo thời gian thực.',
    group: 'Bảo mật',
    promotion: 'Giảm 15%',
    tone: 'brand',
    tags: ['License', 'Blockchain', 'AI hỗ trợ'],
    features: [
      'Khóa license theo fingerprint thiết bị',
      'Thu hồi hoặc cấp lại license có audit',
      'Xác minh hợp đồng và trạng thái Blockchain',
      'Chat hỗ trợ realtime trong toàn bộ vòng đời',
    ],
    plans: [
      {
        devices: 10,
        label: '10 thiết bị',
        listPrice: 1_490_000,
        salePrice: 1_266_500,
      },
      {
        devices: 25,
        label: '25 thiết bị',
        listPrice: 2_450_000,
        salePrice: 2_082_500,
      },
      {
        devices: 50,
        label: '50 thiết bị',
        listPrice: 4_200_000,
        salePrice: 3_570_000,
      },
    ],
  },
  {
    slug: 'cloudstudio-ai',
    name: 'CloudStudio AI',
    summary: 'Bộ công cụ sáng tạo có trợ lý AI theo ngữ cảnh.',
    group: 'Sáng tạo',
    promotion: 'Ưu đãi doanh nghiệp',
    tone: 'module',
    tags: ['AI', 'Cloud'],
    features: ['Trợ lý AI theo ngữ cảnh', 'Quản lý nhóm tập trung'],
    plans: [
      {
        devices: 10,
        label: '10 thiết bị',
        listPrice: 2_100_000,
        salePrice: 1_890_000,
      },
    ],
  },
  {
    slug: 'dataguard-sdk',
    name: 'DataGuard SDK',
    summary: 'SDK xác thực license cho ứng dụng và API.',
    group: 'Nhà phát triển',
    promotion: 'Giá tốt nhất',
    tone: 'neutral',
    tags: ['SDK', 'API'],
    features: ['Xác thực license qua API', 'Theo dõi quota thiết bị'],
    plans: [
      {
        devices: 5,
        label: '5 thiết bị',
        listPrice: 1_100_000,
        salePrice: 990_000,
      },
    ],
  },
];
