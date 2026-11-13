export type EventTypeName =
  | 'ORDER_PLACED'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'REFUND'
  | 'RETURN_REQUESTED'
  | 'UNKNOWN';

export interface EmailInput {
  messageId: string;
  from: string;
  subject: string;
  receivedAt: Date;
  html: string;
  text?: string;
}

export interface ParsedItem {
  name: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ParsedOrderEvent {
  platform: 'SHOPEE';
  templateId: string;
  eventType: EventTypeName;
  occurredAt: Date;
  orderId?: string;
  /** Mã khác mã đơn (vd mã yêu cầu trả hàng) khi email không nêu mã đơn. */
  externalRef?: string;
  orderDate?: Date;
  shopName?: string;
  items: ParsedItem[];
  grossAmount?: number;
  /** Tổng giảm thực tế = gross + ship − net (gồm cả khoản giảm không được liệt kê). */
  discountAmount?: number;
  /** Tổng các dòng voucher/giảm giá có ghi trong email. */
  listedDiscountAmount?: number;
  shippingFee?: number;
  netAmount?: number;
  refundAmount?: number;
  confidence: number;
  warnings: string[];
}

export interface EmailParser {
  id: string;
  version: string;
  canParse(input: EmailInput): boolean;
  /** Một email có thể chứa nhiều đơn (vd thanh toán gộp nhiều shop). */
  parse(input: EmailInput): ParsedOrderEvent[];
}
