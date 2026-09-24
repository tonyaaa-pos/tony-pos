export type UserRole = 'owner' | 'cashier' | 'waiter';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
  avatar?: string;
}

export type TableZone = 'indoor' | 'outdoor' | 'vip' | string;
export type TableStatus = 'available' | 'occupied' | 'payment_pending' | 'reserved';
export type TableShape = 'square' | 'round' | 'rectangle' | 'counter' | 'standalone_chair';
export type ChairStyle = 'standard' | 'stool' | 'sofa';

export interface ReservationInfo {
  customerName: string;
  phone: string;
  reservedTime: string; // ISO or '18:30'
  partySize: number;
  note?: string;
  createdAt: string;
}

export interface Table {
  id: string;
  number: string;
  zone: TableZone;
  capacity: number;
  status: TableStatus;
  shape?: TableShape;
  chairStyle?: ChairStyle;
  x?: number;
  y?: number;
  rotation?: number; // 0, 90, 180, 270
  width?: number; // Table surface width in px
  height?: number; // Table surface height in px
  chairSize?: number; // Chair diameter / size in px
  isStandaloneChair?: boolean;
  currentBillId?: string;
  seatedAt?: string;
  guestCount?: number;
  reservation?: ReservationInfo;
}

export interface OptionChoice {
  id: string;
  name: string;
  priceDelta: number;
}

export interface OptionGroup {
  id: string;
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  choices: OptionChoice[];
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  cost: number;
  image: string;
  description: string;
  isAvailable: boolean;
  isSoldOut: boolean;
  isRecommended?: boolean;
  isFeatured?: boolean;
  promoPrice?: number;
  promoActive?: boolean;
  optionGroups?: OptionGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  sortOrder: number;
}

export interface SelectedOption {
  groupId: string;
  groupName: string;
  choiceId: string;
  choiceName: string;
  priceDelta: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number; // calculated unit price including options
  cost: number;
  quantity: number;
  selectedOptions: SelectedOption[];
  note: string;
  status?: 'confirmed' | 'voided';
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  isNewUnsent?: boolean;
}

export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export interface DeliveryInfo {
  customerName: string;
  phone: string;
  address: string;
  driverNote?: string;
}

export type PaymentMethod = 'cash' | 'qr' | 'card' | 'transfer' | 'ewallet';

export interface PaymentRecord {
  method: PaymentMethod;
  amount: number;
  receivedAmount?: number;
  change?: number;
  ref?: string;
  qrImageId?: string;
}

export interface Bill {
  id: string;
  billNumber: string;
  orderType: OrderType;
  tableId?: string;
  tableName?: string;
  guestCount?: number;
  deliveryInfo?: DeliveryInfo;
  items: OrderItem[];
  status: 'open' | 'paid' | 'voided';
  createdAt: string;
  closedAt?: string;
  createdByUserId: string;
  createdByName: string;
  subtotal: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  membershipPhone?: string;
  membershipDiscountPoints?: number;
  serviceChargeRate: number;
  serviceChargeAmount: number;
  vatRate: number;
  vatAmount: number;
  vatIncluded: boolean;
  grandTotal: number;
  payments: PaymentRecord[];
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
}

export interface Shift {
  id: string;
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  closedBy?: string;
  startingCash: number;
  endingCashCounted?: number;
  expectedCash?: number;
  difference?: number;
  status: 'open' | 'closed';
  note?: string;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  points: number;
  totalSpent: number;
  registeredAt: string;
}

export interface PaymentQrImage {
  id: string;
  label: string;
  imageData: string; // compressed base64
  isDefault?: boolean;
}

export interface ShopSettings {
  shopName: string;
  address: string;
  phone: string;
  taxId: string;
  logoUrl?: string;
  vatEnabled: boolean;
  vatRate: number; // 7
  vatInclusive: boolean; // true = price includes VAT, false = VAT added on top
  serviceChargeEnabled: boolean;
  serviceChargeRate: number; // 10
  receiptHeader: string;
  receiptFooter: string;
  receiptPaperWidth: '80mm' | '58mm';
  allowedPaymentMethods: PaymentMethod[];
  pointsEarnRate: number; // e.g. 1 point per 50 THB
  pointsRedeemRate: number; // e.g. 1 point = 1 THB
}

export type NotificationType = 'new_order' | 'call_waiter' | 'request_bill';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  tableNumber?: string;
  orderId?: string;
}
