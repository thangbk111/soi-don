import type { DateRange, OrderEmailKind } from '@soi-don/shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', ...init });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(res.status, body?.message ?? res.statusText);
  }
  // NestJS trả handler `null` thành body rỗng (vd /scans/latest khi chưa quét lần nào).
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  gmail: {
    status: 'ACTIVE' | 'REVOKED' | 'ERROR';
    lastSyncedAt: string | null;
    createdAt: string;
  } | null;
}

export interface SpikeResult {
  range: DateRange;
  listed: number;
  shopeeSender: number;
  ignored: number;
  templates: {
    kind: OrderEmailKind;
    subject: string;
    count: number;
    firstAt: string;
    lastAt: string;
  }[];
}

export interface SpikeState {
  status: 'RUNNING' | 'DONE' | 'FAILED';
  phase: 'listing' | 'reading' | 'done';
  listed: number;
  processed: number;
  waitingMs: number;
  error?: string;
  revoked?: boolean;
  result?: SpikeResult;
  startedAt: string;
}

export interface ScanJob {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  rangeFrom: string;
  rangeTo: string;
  totalMessages: number;
  processed: number;
  parsedOk: number;
  failed: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export type CategorySource = 'MANUAL' | 'USER_RULE' | 'RULE' | 'AI';

export interface TxItem {
  id: string;
  productName: string;
  variant: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Tiền hàng sau giảm phân bổ cho dòng; null = không phân bổ được. */
  allocatedAmount: number | null;
  categoryId: string | null;
  categorySource: CategorySource | null;
  /** Dòng thuộc danh mục đang lọc. */
  matchesFilter: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
}

export interface CategoryRule {
  id: string;
  label: string;
  createdAt: string;
  category: { id: string; name: string };
}

export interface SetCategoryResult {
  updated: number;
  rulesSaved: number;
  appliedToOthers: number;
}

export interface Tx {
  id: string;
  orderId: string | null;
  orderDate: string;
  shopName: string | null;
  grossAmount: number;
  discountAmount: number;
  shippingFee: number;
  netAmount: number;
  refundAmount: number;
  unallocatedAmount: number;
  /** Đơn có được tính vào chi tiêu không (đơn hủy thì không). */
  counted: boolean;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  confidence: number;
  needsReview: boolean;
  reviewReason: string | null;
  items: TxItem[];
  events: { type: string; occurredAt: string }[];
}

export interface TransactionsResponse {
  range: DateRange;
  category: string | null;
  summary: {
    orders: number;
    gross: number;
    discount: number;
    shipping: number;
    net: number;
    refund: number;
    needsReview: number;
    deliveredOnly: number;
    paymentOnly: number;
    returnEmails: number;
    /** Chỉ có khi lọc theo danh mục: phần tiền hàng sau giảm thuộc danh mục. */
    category: { amount: number; lines: number; linesWithoutValue: number } | null;
  };
  emails: { templateId: string | null; parsedOk: boolean; count: number }[];
  transactions: Tx[];
}

export interface SpendTotals {
  orders: number;
  gross: number;
  discount: number;
  shipping: number;
  /** Tổng thực trả */
  net: number;
  refund: number;
}

export interface CategoryAmount {
  /** null = Chưa phân loại */
  id: string | null;
  name: string;
  amount: number;
  /** Số dòng sản phẩm, không phải số lượng đơn vị. */
  lines: number;
  linesWithoutValue: number;
}

export interface DashboardResponse {
  range: DateRange;
  previous: {
    range: DateRange;
    kind: 'months' | 'partial' | 'days';
    /** Kỳ trước nằm trọn trong các lần quét Gmail đã xong. */
    covered: boolean;
    summary: SpendTotals;
  };
  covered: boolean;
  /** Các khoảng ngày đã quét Gmail xong, đã gộp. */
  scanned: DateRange[];
  hasAnyOrders: boolean;
  summary: SpendTotals;
  granularity: 'day' | 'month';
  timeline: { key: string; range: DateRange; net: number; orders: number }[];
  categories: {
    groups: (CategoryAmount & { children: CategoryAmount[] })[];
    unallocated: number;
    /** Khoản điều chỉnh cấp đơn (≤ 0). */
    adjustment: number;
    shipping: number;
    /** Cơ sở tính tỷ trọng: Σ danh mục + chưa phân bổ. */
    allocatedBase: number;
    linesWithoutValue: number;
  };
}
