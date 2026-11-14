import { syncService } from './syncService';
import { translateThaiToEnglishFast } from '../utils/thaiToEnglishTranslator';
import type { MenuItem, ItemVariantOption, ShopSettings } from '../types';

export interface TonysKitchenSetting {
  restaurantName?: string;
  defaultOverheadCostPerDish?: number;
  defaultOverheadCost?: number;
  overheadRatePercent?: number;
  overheadCalculationBase?: string;
  targetFoodCostPercent?: number;
  targetProfitAmount?: number;
  vatRatePercent?: number;
  incomeTaxRatePercent?: number;
  cogsVarianceThresholdPercent?: number;
  takeawayPackagingCost?: number;
  packagingCostTakeaway?: number;
  deliveryPackagingCost?: number;
  grabFoodCommissionPercent?: number;
  lineManCommissionPercent?: number;
  channels?: Array<{
    channelId: string;
    channelName: string;
    commissionPercent: number;
    packagingCost: number;
    fixedFee: number;
    otherFee: number;
    active: boolean;
  }>;
}

export interface TonysKitchenIngredient {
  id: string;
  name: string;
  category?: string;
  unit?: string;
  packSize?: number;
  packCost?: number;
  unitCost?: number;
  yieldPercent?: number;
  effectiveUnitCost?: number;
}

export interface TonysKitchenSauce {
  id: string;
  name: string;
  batchYield?: number;
  batchCost?: number;
  unitCost?: number;
}

export interface TonysKitchenRecipeItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  lineCost?: number;
  calculatedLineCost?: number;
}

export interface TonysKitchenVariant {
  id: string;
  name: string;
  variantName?: string;
  sellingPrice?: number;
  price?: number;
  recipeCost?: number;
  foodCostPerUnit?: number;
  calculatedCost?: number;
  cost?: number;
  recipeItems?: TonysKitchenRecipeItem[];
}

export interface TonysKitchenMenu {
  id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  sellingPrice?: number;
  recipeCost?: number;
  variants?: TonysKitchenVariant[];
}

export interface TonysKitchenExpense {
  id: string;
  title: string;
  category?: string;
  amount: number;
  frequency?: 'daily' | 'monthly' | 'yearly';
  isRecurring?: boolean;
}

export interface TonysKitchenEmployee {
  id: string;
  name: string;
  role: string;
  salary: number;
  salaryType?: 'monthly' | 'hourly';
}

export interface TonysKitchenPayload {
  schemaVersion: string;
  appId: string;
  appName?: string;
  exportedAt?: string;
  updatedAt?: string;
  updatedAtMs?: number;
  syncedFrom?: string;
  updatedBy?: string;
  overheadPercentOfSales?: number;
  payload: {
    settings?: TonysKitchenSetting;
    ingredients?: TonysKitchenIngredient[];
    sauces?: TonysKitchenSauce[];
    menus?: TonysKitchenMenu[];
    expenses?: TonysKitchenExpense[];
    employees?: TonysKitchenEmployee[];
    wasteLog?: unknown[];
    inventory?: unknown[];
    salesOrders?: unknown[];
    dailySales?: unknown[];
  };
}

export interface CostSyncSummary {
  restaurantName: string;
  matchedDishesCount: number;
  updatedVariantsCount: number;
  monthlyFixedOpEx: {
    rent: number;
    salaries: number;
    utilities: number;
    extraFixed: number;
    total: number;
  };
  deliveryGpRates: {
    grab: number;
    lineman: number;
  };
  packagingCosts: {
    delivery: number;
    takeaway: number;
  };
  syncedDishes: Array<{
    posDishId: string;
    posDishName: string;
    oldCost: number;
    newCost: number;
    variants: Array<{
      variantName: string;
      oldCost: number;
      newCost: number;
      sellingPrice: number;
      foodCostPct: number;
    }>;
  }>;
}

export interface CostBundleMeta {
  source: 'import' | 'sample';
  syncedAtMs?: number;
  remoteUpdatedAtMs?: number;
}

export const OPEX_STORAGE_KEY = 'kind_pos_opex_settings_v4';
export const COST_BUNDLE_CACHE_KEY = 'kind_pos_cost_bundle_cache_v1';
export const COST_BUNDLE_META_CACHE_KEY = 'kind_pos_cost_bundle_meta_v1';
export const COST_BUNDLE_UPDATED_EVENT = 'kind_pos_cost_bundle_updated';
export const OPEX_UPDATED_EVENT = 'kind_pos_opex_updated';

function parseTimestampField(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof val === 'object') {
    const obj = val as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof obj.toMillis === 'function') {
      try {
        const ms = obj.toMillis();
        return Number.isFinite(ms) ? ms : 0;
      } catch {
        return 0;
      }
    }
    if (typeof obj.seconds === 'number') {
      return obj.seconds * 1000 + Math.floor((obj.nanoseconds || 0) / 1e6);
    }
  }
  return 0;
}

export function extractCostTimestampMs(raw: unknown): number {
  if (!raw || typeof raw !== 'object') return 0;
  const obj = raw as Record<string, unknown>;
  const nested = obj.payload && typeof obj.payload === 'object' ? (obj.payload as Record<string, unknown>) : null;
  return Math.max(
    parseTimestampField(obj.serverUpdatedAt),
    parseTimestampField(obj.updatedAtMs),
    parseTimestampField(obj.updatedAt),
    parseTimestampField(obj.lastSyncedAt),
    parseTimestampField(obj.lastUpdated),
    parseTimestampField(obj.exportedAt),
    nested ? parseTimestampField(nested.updatedAt) : 0,
    nested ? parseTimestampField(nested.exportedAt) : 0
  );
}

export function notifyOpExUpdated(): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(OPEX_UPDATED_EVENT));
    }
    syncService.broadcast('DATA_RELOAD');
  } catch (err) {
    console.warn('[notifyOpExUpdated] Failed:', err);
  }
}

export function getCachedCostBundleMeta(): CostBundleMeta {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('kind_pos_linked_cost_uid_v1');
      const raw = localStorage.getItem(COST_BUNDLE_META_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { source?: string; syncedAtMs?: number; remoteUpdatedAtMs?: number };
        if (parsed && parsed.source) {
          return {
            source: parsed.source === 'sample' ? 'sample' : 'import',
            syncedAtMs: parsed.syncedAtMs,
            remoteUpdatedAtMs: parsed.remoteUpdatedAtMs,
          };
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return { source: 'sample' };
}

export function saveCachedCostBundle(
  payload: TonysKitchenPayload,
  meta?: Partial<CostBundleMeta>
): void {
  try {
    if (typeof localStorage !== 'undefined' && payload && payload.payload) {
      localStorage.setItem(COST_BUNDLE_CACHE_KEY, JSON.stringify(payload));
      if (meta) {
        const prevMeta = getCachedCostBundleMeta();
        const nextMeta: CostBundleMeta = {
          ...prevMeta,
          ...meta,
          syncedAtMs: meta.syncedAtMs ?? Date.now(),
          remoteUpdatedAtMs: meta.remoteUpdatedAtMs ?? extractCostTimestampMs(payload),
        };
        localStorage.setItem(COST_BUNDLE_META_CACHE_KEY, JSON.stringify(nextMeta));
      }
    }
    if (typeof window !== 'undefined' && payload && payload.payload) {
      window.dispatchEvent(new CustomEvent(COST_BUNDLE_UPDATED_EVENT, { detail: payload }));
    }
    syncService.broadcast('DATA_RELOAD');
  } catch (err) {
    console.warn('[saveCachedCostBundle] Failed:', err);
  }
}

export function getCachedCostBundle(): TonysKitchenPayload {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(COST_BUNDLE_CACHE_KEY);
      if (raw) {
        const parsed = parseCostAndProfitPayload(raw);
        if (parsed?.payload?.menus && parsed.payload.menus.length > 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('[getCachedCostBundle] Failed:', err);
  }
  return TONYS_KITCHEN_SAMPLE_DATA;
}

export function getVariantRecipeCost(variant?: TonysKitchenVariant | null): number {
  if (!variant) return 0;
  const v = variant as unknown as Record<string, unknown>;
  const raw =
    v.recipeCost ??
    v.foodCostPerUnit ??
    v.calculatedCost ??
    v.cost ??
    v.foodCost ??
    v.totalCost ??
    v.unitCost ??
    v.ingredientCost ??
    v.costPerDish ??
    0;
  const num = Number(raw);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

export function getVariantSellingPrice(variant?: TonysKitchenVariant | null): number {
  if (!variant) return 0;
  const v = variant as unknown as Record<string, unknown>;
  const raw = v.sellingPrice ?? v.price ?? v.sellPrice ?? v.menuPrice ?? v.salePrice ?? 0;
  const num = Number(raw);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

/**
 * Exact payload provided by Tony's Kitchen Cost Management app
 */
export const TONYS_KITCHEN_SAMPLE_DATA: TonysKitchenPayload = {
  schemaVersion: '1.1.0',
  appId: 'TONYS_KITCHEN_POS',
  appName: "Tony's Kitchen POS & Cost Management",
  exportedAt: '2026-11-12T08:19:27.436Z',
  overheadPercentOfSales: 35,
  payload: {
    settings: {
      restaurantName: "Tony's Kitchen",
      defaultOverheadCostPerDish: 25,
      defaultOverheadCost: 20,
      overheadRatePercent: 35,
      overheadCalculationBase: 'SELLING_PRICE',
      targetFoodCostPercent: 40,
      targetProfitAmount: 25,
      vatRatePercent: 7,
      incomeTaxRatePercent: 20,
      cogsVarianceThresholdPercent: 3,
      takeawayPackagingCost: 10,
      packagingCostTakeaway: 10,
      deliveryPackagingCost: 8,
      grabFoodCommissionPercent: 37,
      lineManCommissionPercent: 37,
      channels: [
        {
          channelId: 'dinein',
          channelName: 'ทานที่ร้าน (Dine-in)',
          commissionPercent: 0,
          packagingCost: 0,
          fixedFee: 0,
          otherFee: 0,
          active: true,
        },
        {
          channelId: 'takeaway',
          channelName: 'สั่งกลับบ้าน (Takeaway)',
          commissionPercent: 0,
          packagingCost: 5,
          fixedFee: 0,
          otherFee: 0,
          active: true,
        },
        {
          channelId: 'grab',
          channelName: 'GrabFood',
          commissionPercent: 37,
          packagingCost: 8,
          fixedFee: 0,
          otherFee: 0,
          active: true,
        },
        {
          channelId: 'lineman',
          channelName: 'LINE MAN',
          commissionPercent: 37,
          packagingCost: 8,
          fixedFee: 0,
          otherFee: 0,
          active: true,
        },
      ],
    },
    menus: [
      {
        id: 'menu_kaprow',
        name: 'กะเพรา',
        categoryName: 'อาหารจานเดียว',
        variants: [
          {
            id: 'var_kaprow_pork_marinated',
            name: 'กะเพราหมูหมัก',
            sellingPrice: 87,
            recipeCost: 34.2,
            recipeItems: [
              { ingredientId: 'ing_jasmine_rice', ingredientName: 'ข้าวหอมมะลิ', quantity: 200, unit: 'g', calculatedLineCost: 7.0 },
              { ingredientId: 'ing_pork_marinated', ingredientName: 'หมูหมักปรุงรส', quantity: 120, unit: 'g', calculatedLineCost: 21.6 },
              { ingredientId: 'sauce_kaprow_1', ingredientName: 'ซอสกะเพราสูตร 1', quantity: 35, unit: 'ml', calculatedLineCost: 3.85 },
              { ingredientId: 'ing_holy_basil', ingredientName: 'ใบกะเพรา', quantity: 15, unit: 'g', calculatedLineCost: 1.05 },
              { ingredientId: 'ing_oil', ingredientName: 'น้ำมันพืช', quantity: 15, unit: 'ml', calculatedLineCost: 0.7 },
            ],
          },
          {
            id: 'var_kaprow_pork_ground',
            name: 'กะเพราหมูบด',
            sellingPrice: 90,
            recipeCost: 23.5,
          },
          {
            id: 'var_kaprow_chicken',
            name: 'กะเพราไก่',
            sellingPrice: 99,
            recipeCost: 28.5,
          },
          {
            id: 'var_kaprow_beef',
            name: 'กะเพราเนื้อวัวโคขุน',
            sellingPrice: 85,
            recipeCost: 48.2,
          },
          {
            id: 'var_kaprow_shrimp',
            name: 'กะเพรากุ้งสด',
            sellingPrice: 85,
            recipeCost: 56.5,
          },
          {
            id: 'var_kaprow_squid',
            name: 'กะเพราปลาหมึก',
            sellingPrice: 85,
            recipeCost: 67.5,
          },
          {
            id: 'var_kaprow_seafood',
            name: 'กะเพราทะเล',
            sellingPrice: 50,
            recipeCost: 67.8,
          },
        ],
      },
      {
        id: 'menu_fried_rice',
        name: 'ข้าวผัด',
        categoryName: 'อาหารจานเดียว',
        variants: [
          {
            id: 'var_fried_rice_pork',
            name: 'ข้าวผัดหมูหมัก',
            sellingPrice: 65,
            recipeCost: 28.0,
          },
          {
            id: 'var_fried_rice_shrimp',
            name: 'ข้าวผัดกุ้งสด',
            sellingPrice: 89,
            recipeCost: 39.9,
          },
        ],
      },
      {
        id: 'menu_pad_thai',
        name: 'ผัดไทย จันท์',
        categoryName: 'อาหารจานเดียว',
        variants: [
          {
            id: 'var_pad_thai_shrimp',
            name: 'ผัดไทยเส้นจันท์ กุ้งสด',
            sellingPrice: 85,
            recipeCost: 40.1,
          },
        ],
      },
      {
        id: 'menu_suki_dry',
        name: 'สุกี้แห้ง',
        categoryName: 'อาหารจานเดียว',
        variants: [
          {
            id: 'var_suki_dry_pork',
            name: 'สุกี้แห้งหมูหมัก',
            sellingPrice: 70,
            recipeCost: 32.9,
          },
        ],
      },
      {
        id: 'menu_side_eggs',
        name: 'ไข่ดาว',
        categoryName: 'เครื่องเคียง/ท็อปปิ้ง',
        variants: [
          {
            id: 'var_fried_egg',
            name: 'ไข่ดาวกรอบ',
            sellingPrice: 12,
            recipeCost: 4.72,
          },
        ],
      },
    ],
    expenses: [
      {
        id: 'exp_rent',
        title: 'ค่าเช่าร้านประจำเดือน',
        category: 'ค่าเช่าสถานที่',
        amount: 15000,
        frequency: 'monthly',
        isRecurring: true,
      },
      {
        id: 'exp_elec',
        title: 'ค่าไฟฟ้าประจำเดือน',
        category: 'สาธารณูปโภค',
        amount: 7800,
        frequency: 'monthly',
        isRecurring: true,
      },
      {
        id: 'exp_gas',
        title: 'ค่าแก๊สหุงต้ม',
        category: 'สาธารณูปโภค',
        amount: 960,
        frequency: 'monthly',
        isRecurring: true,
      },
    ],
    employees: [
      {
        id: 'emp_1',
        name: 'สมศักดิ์ ขยันยิ่ง',
        role: 'เชฟ/กุ๊กหลัก',
        salary: 28000,
        salaryType: 'monthly',
      },
      {
        id: 'emp_2',
        name: 'วรรณา ใจดี',
        role: 'ผู้ช่วยกุ๊ก/เตรียมของ',
        salary: 15000,
        salaryType: 'monthly',
      },
      {
        id: 'emp_3',
        name: 'อนุชา ยิ้มแย้ม',
        role: 'พนักงานเสิร์ฟ/แคชเชียร์',
        salary: 14000,
        salaryType: 'monthly',
      },
    ],
  },
};

function normalizeCostVariant(raw: unknown, idx: number, fallbackMenuName?: string): TonysKitchenVariant | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const nameRaw =
    obj.name ?? obj.variantName ?? obj.title ?? obj.label ?? obj.protein ?? obj.meatName ?? fallbackMenuName ?? '';
  const name = String(nameRaw || '').trim();
  if (!name) return null;

  const id = String(obj.id ?? obj.variantId ?? `var_${idx}_${name}`).trim();
  const sellingPriceRaw = obj.sellingPrice ?? obj.price ?? obj.sellPrice ?? obj.menuPrice ?? obj.salePrice;
  const recipeCostRaw =
    obj.recipeCost ??
    obj.foodCostPerUnit ??
    obj.calculatedCost ??
    obj.cost ??
    obj.foodCost ??
    obj.totalCost ??
    obj.unitCost ??
    obj.ingredientCost ??
    obj.costPerDish;

  const sellingPrice = sellingPriceRaw !== undefined && sellingPriceRaw !== null && Number.isFinite(Number(sellingPriceRaw))
    ? Math.round(Number(sellingPriceRaw) * 100) / 100
    : undefined;
  const recipeCost = recipeCostRaw !== undefined && recipeCostRaw !== null && Number.isFinite(Number(recipeCostRaw))
    ? Math.round(Number(recipeCostRaw) * 100) / 100
    : undefined;

  return {
    ...(obj as unknown as TonysKitchenVariant),
    id,
    name,
    variantName: String(obj.variantName ?? name),
    ...(sellingPrice !== undefined ? { sellingPrice, price: sellingPrice } : {}),
    ...(recipeCost !== undefined ? { recipeCost } : {}),
  };
}

function normalizeCostMenu(raw: unknown, idx: number): TonysKitchenMenu | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const nameRaw = obj.name ?? obj.menuName ?? obj.title ?? obj.dishName ?? obj.thaiName ?? obj.label ?? '';
  const name = String(nameRaw || '').trim();
  if (!name) return null;

  const id = String(obj.id ?? obj.menuId ?? obj.docId ?? `menu_${idx}_${name}`).trim();
  const sellingPriceRaw = obj.sellingPrice ?? obj.price ?? obj.sellPrice ?? obj.menuPrice ?? obj.salePrice;
  const recipeCostRaw =
    obj.recipeCost ??
    obj.foodCostPerUnit ??
    obj.calculatedCost ??
    obj.cost ??
    obj.foodCost ??
    obj.totalCost ??
    obj.unitCost ??
    obj.ingredientCost ??
    obj.costPerDish;

  const sellingPrice = sellingPriceRaw !== undefined && sellingPriceRaw !== null && Number.isFinite(Number(sellingPriceRaw))
    ? Math.round(Number(sellingPriceRaw) * 100) / 100
    : undefined;
  const recipeCost = recipeCostRaw !== undefined && recipeCostRaw !== null && Number.isFinite(Number(recipeCostRaw))
    ? Math.round(Number(recipeCostRaw) * 100) / 100
    : undefined;

  const rawVariantsCandidate =
    (Array.isArray(obj.variants) && obj.variants) ||
    (Array.isArray(obj.options) && obj.options) ||
    (Array.isArray(obj.meats) && obj.meats) ||
    (Array.isArray(obj.sizes) && obj.sizes) ||
    (Array.isArray(obj.subMenus) && obj.subMenus) ||
    (Array.isArray(obj.choices) && obj.choices) ||
    (Array.isArray(obj.items) && obj.items) ||
    [];

  const normalizedVariants = rawVariantsCandidate
    .map((v, vIdx) => normalizeCostVariant(v, vIdx, name))
    .filter((v): v is TonysKitchenVariant => Boolean(v));

  return {
    ...(obj as unknown as TonysKitchenMenu),
    id,
    name,
    categoryId: obj.categoryId ? String(obj.categoryId) : undefined,
    categoryName: obj.categoryName ? String(obj.categoryName) : (obj.category ? String(obj.category) : undefined),
    ...(sellingPrice !== undefined ? { sellingPrice } : {}),
    ...(recipeCost !== undefined ? { recipeCost } : {}),
    variants: normalizedVariants,
  };
}

function normalizeInnerPayload(rawPayload: Record<string, unknown>): TonysKitchenPayload['payload'] {
  const rawMenus =
    (Array.isArray(rawPayload.menus) && rawPayload.menus) ||
    (Array.isArray(rawPayload.menuItems) && rawPayload.menuItems) ||
    (Array.isArray(rawPayload.recipes) && rawPayload.recipes) ||
    (Array.isArray(rawPayload.dishes) && rawPayload.dishes) ||
    (Array.isArray(rawPayload.foodMenus) && rawPayload.foodMenus) ||
    undefined;

  const normalizedMenus = rawMenus
    ? rawMenus
        .map((m, idx) => normalizeCostMenu(m, idx))
        .filter((m): m is TonysKitchenMenu => Boolean(m))
    : undefined;

  return {
    ...(rawPayload as TonysKitchenPayload['payload']),
    ...(normalizedMenus ? { menus: normalizedMenus } : {}),
  };
}

/**
 * Parses raw JSON string or object from Cost & Profit application
 */
export function parseCostAndProfitPayload(input: string | object): TonysKitchenPayload {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (!data || typeof data !== 'object') {
    throw new Error('รูปแบบข้อมูล JSON ไม่ถูกต้อง');
  }

  const tsMs = extractCostTimestampMs(data);
  const resolvedIso = tsMs > 0 ? new Date(tsMs).toISOString() : undefined;

  // Handle case where user passes inner payload or full export
  if (data.payload && typeof data.payload === 'object') {
    const typed = data as TonysKitchenPayload;
    return {
      ...typed,
      exportedAt: resolvedIso || typed.exportedAt,
      updatedAtMs: tsMs || typed.updatedAtMs,
      payload: normalizeInnerPayload(data.payload as Record<string, unknown>),
    };
  }

  // Fallback: wrap raw structure into standard payload envelope
  return {
    schemaVersion: data.schemaVersion || '1.1.0',
    appId: data.appId || 'TONYS_KITCHEN_POS',
    appName: data.appName || "Tony's Kitchen POS & Cost Management",
    exportedAt: resolvedIso || data.exportedAt,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : resolvedIso,
    updatedAtMs: tsMs || undefined,
    syncedFrom: typeof data.syncedFrom === 'string' ? data.syncedFrom : undefined,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
    payload: normalizeInnerPayload(data as Record<string, unknown>),
  };
}

/**
 * Extracts and sums Fixed Monthly OpEx from expenses & employees
 */
export function calculateFixedMonthlyOpEx(payload: TonysKitchenPayload) {
  const expenses = payload.payload?.expenses || [];
  const employees = payload.payload?.employees || [];

  let rent = 0;
  let utilities = 0;
  let extraFixed = 0;

  expenses.forEach((exp) => {
    const title = (exp.title || '').toLowerCase();
    const cat = (exp.category || '').toLowerCase();
    if (title.includes('เช่า') || cat.includes('เช่า') || cat.includes('rent')) {
      rent += exp.amount || 0;
    } else if (
      title.includes('ไฟ') ||
      title.includes('น้ำ') ||
      title.includes('แก๊ส') ||
      cat.includes('สาธารณูปโภค') ||
      cat.includes('util')
    ) {
      utilities += exp.amount || 0;
    } else {
      extraFixed += exp.amount || 0;
    }
  });

  // Calculate monthly salaries
  let salaries = 0;
  employees.forEach((emp) => {
    salaries += emp.salary || 0;
  });

  const total = rent + salaries + utilities + extraFixed;

  return {
    rent,
    salaries,
    utilities,
    extraFixed,
    total,
  };
}

/**
 * Helper to match dish name and variant
 */
function normalizeName(str: string): string {
  return str.toLowerCase().replace(/[\s\-_()/]+/g, '');
}

const CORE_DISH_KEYWORDS = ['กะเพรา', 'ข้าวผัด', 'ผัดไทย', 'สุกี้', 'ไข่ดาว'];

function doesMenuMatch(posName: string, costName: string, posId: string, costId: string): boolean {
  if (posId === costId) return true;
  const posNorm = normalizeName(posName);
  const costNorm = normalizeName(costName);
  if (posNorm.includes(costNorm) || costNorm.includes(posNorm)) return true;
  return CORE_DISH_KEYWORDS.some((kw) => posNorm.includes(kw) && costNorm.includes(kw));
}

function doesVariantMatch(posVarName: string, costVarName: string, posVarId: string, costVarId: string, fallbackDishName?: string): boolean {
  if (posVarId === costVarId) return true;
  const vNorm = normalizeName(posVarName);
  const cvNorm = normalizeName(costVarName);
  if (vNorm.includes(cvNorm) || cvNorm.includes(vNorm)) return true;

  const targetText = vNorm === 'ปกติ' && fallbackDishName ? normalizeName(fallbackDishName) : vNorm;
  const proteinGroups = [
    ['หมูสับ', 'หมูหมัก', 'หมูบด', 'หมู'],
    ['ไก่ชิ้น', 'ไก่สับ', 'ไก่'],
    ['เนื้อโคขุน', 'เนื้อวัว', 'เนื้อ'],
    ['กุ้งสด', 'กุ้ง'],
    ['ปลาหมึก', 'หมึก'],
    ['ทะเลรวม', 'ซีฟู้ด', 'ทะเล'],
  ];
  return proteinGroups.some(
    (group) => group.some((kw) => targetText.includes(kw)) && group.some((kw) => cvNorm.includes(kw))
  );
}

export function findMatchingCostMenu(
  posName: string,
  costMenus: TonysKitchenMenu[],
  costMenuId?: string,
  posId?: string
): TonysKitchenMenu | undefined {
  if (costMenuId) {
    const byLink = costMenus.find((cm) => cm.id === costMenuId);
    if (byLink) return byLink;
  }
  return costMenus.find((cm) => doesMenuMatch(posName, cm.name, posId || '', cm.id));
}

export function findMatchingCostVariant(
  posVarName: string,
  costVariants: TonysKitchenVariant[],
  costVariantId?: string,
  posVarId?: string,
  fallbackDishName?: string
): TonysKitchenVariant | undefined {
  if (costVariantId) {
    const byLink = costVariants.find((cv) => cv.id === costVariantId);
    if (byLink) return byLink;
  }
  return costVariants.find((cv) =>
    doesVariantMatch(
      posVarName,
      cv.name || cv.variantName || '',
      posVarId || '',
      cv.id,
      fallbackDishName
    )
  );
}

/**
 * Returns the variants defined inside a Food Cost menu, or synthesizes a linked standard variant
 * from menu-level sellingPrice / recipeCost when the menu has no sub-variants.
 */
export function getEffectiveCostMenuVariants(costMenu: TonysKitchenMenu): TonysKitchenVariant[] {
  if (costMenu.variants && costMenu.variants.length > 0) {
    return costMenu.variants;
  }
  const hasMenuNumbers =
    costMenu.recipeCost !== undefined ||
    costMenu.sellingPrice !== undefined ||
    Boolean(costMenu.name?.trim());
  if (!hasMenuNumbers) return [];
  const rawCost = Number(
    costMenu.recipeCost ??
      (costMenu as unknown as Record<string, unknown>).cost ??
      (costMenu as unknown as Record<string, unknown>).foodCost ??
      0
  );
  const rawPrice = Number(
    costMenu.sellingPrice ??
      (costMenu as unknown as Record<string, unknown>).price ??
      0
  );
  return [
    {
      id: costMenu.id,
      name: 'ปกติ',
      variantName: 'ปกติ',
      sellingPrice: Number.isFinite(rawPrice) ? Math.round(rawPrice * 100) / 100 : 0,
      price: Number.isFinite(rawPrice) ? Math.round(rawPrice * 100) / 100 : 0,
      recipeCost: Number.isFinite(rawCost) ? Math.round(rawCost * 100) / 100 : 0,
    },
  ];
}

/**
 * Builds POS variants strictly from the selected Food Cost menu (never mixing options from other menus).
 * Keeps latest edited selling price if matching the same linked cost menu, while always locking cost to recipe formula.
 */
export function buildVariantsFromCostMenu(
  costMenu: TonysKitchenMenu,
  existingVariants: ItemVariantOption[] = []
): ItemVariantOption[] {
  const costVars = getEffectiveCostMenuVariants(costMenu);
  if (costVars.length === 0) return existingVariants;

  const built: ItemVariantOption[] = costVars.map((cv) => {
    const varName = (cv.name || cv.variantName || costMenu.name || '').trim();
    const translatedEn = translateThaiToEnglishFast(varName);
    const nameEn =
      translatedEn && !/[\u0E00-\u0E7F]/.test(translatedEn) ? translatedEn : '';
    const recipeCost = getVariantRecipeCost(cv);
    const bundlePrice = getVariantSellingPrice(cv);

    // Preserve user's previously customized variant only if it already belonged to THIS costMenu
    const existingMatch = existingVariants.find(
      (ev) =>
        ev.costMenuId === costMenu.id &&
        (ev.costVariantId === cv.id ||
          normalizeName(ev.name) === normalizeName(varName))
    );

    const fallbackExistingPrice =
      costVars.length === 1 && existingVariants[0]?.price > 0
        ? existingVariants[0].price
        : 80;

    const resolvedPrice =
      existingMatch && existingMatch.price > 0
        ? existingMatch.price
        : bundlePrice > 0
        ? bundlePrice
        : fallbackExistingPrice;

    return {
      id:
        existingMatch?.id ||
        `v_${cv.id}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`,
      name: varName,
      nameEn: existingMatch?.nameEn || (varName === 'ปกติ' ? 'Standard' : nameEn),
      price: resolvedPrice,
      cost: recipeCost,
      isAvailable: existingMatch ? existingMatch.isAvailable : true,
      isSoldOut: existingMatch?.isSoldOut || false,
      costMenuId: costMenu.id,
      costVariantId: cv.id,
      costVariantName: varName,
      priceUpdatedAt: existingMatch?.priceUpdatedAt,
    };
  });

  // Keep any truly custom unlinked variants the user created (exclude default placeholder 'ปกติ')
  const customUnlinked = existingVariants.filter(
    (ev) =>
      !ev.costVariantId &&
      !ev.costMenuId &&
      ev.name.trim() !== '' &&
      ev.name.trim() !== 'ปกติ' &&
      ev.name.trim().toLowerCase() !== 'standard'
  );

  return [...built, ...customUnlinked];
}

/**
 * Persists POS selling price modifications back to the linked local Food Cost bundle cache
 */
export async function syncSellingPriceUpdatesToCostBundle(
  costMenuId: string | undefined,
  variants: ItemVariantOption[]
): Promise<boolean> {
  if (!costMenuId && !variants.some((v) => v.costMenuId || v.costVariantId)) {
    return false;
  }

  const bundle = getCachedCostBundle();
  const menus = bundle.payload?.menus || [];
  if (menus.length === 0) return false;

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  let changed = false;

  const updatedMenus = menus.map((cm) => {
    const isTargetMenu =
      (costMenuId && cm.id === costMenuId) ||
      variants.some((v) => v.costMenuId === cm.id);
    if (!isTargetMenu) return cm;

    // Single-variant / menu-level pricing when Food Cost menu has no variants array
    if (!cm.variants || cm.variants.length === 0) {
      const matchedPosVar = variants.find(
        (pv) => pv.costVariantId === cm.id || pv.costMenuId === cm.id
      ) || variants[0];
      if (matchedPosVar && typeof matchedPosVar.price === 'number' && matchedPosVar.price >= 0) {
        const curPrice = cm.sellingPrice ?? (cm as unknown as Record<string, unknown>).price ?? 0;
        if (curPrice !== matchedPosVar.price) {
          changed = true;
          return {
            ...cm,
            sellingPrice: matchedPosVar.price,
          };
        }
      }
      return cm;
    }

    const updatedVars = cm.variants.map((cv) => {
      const matchedPosVar = variants.find(
        (pv) =>
          (pv.costVariantId && pv.costVariantId === cv.id) ||
          ((pv.costMenuId === cm.id || costMenuId === cm.id) &&
            normalizeName(pv.name) === normalizeName(cv.name || cv.variantName || ''))
      );
      if (matchedPosVar && typeof matchedPosVar.price === 'number' && matchedPosVar.price >= 0) {
        const currentBundlePrice = getVariantSellingPrice(cv);
        if (currentBundlePrice !== matchedPosVar.price) {
          changed = true;
        }
        return {
          ...cv,
          sellingPrice: matchedPosVar.price,
          price: matchedPosVar.price,
        };
      }
      return cv;
    });

    return { ...cm, variants: updatedVars };
  });

  if (!changed) return false;

  const updatedPayload: TonysKitchenPayload = {
    ...bundle,
    exportedAt: nowIso,
    updatedAt: nowIso,
    updatedAtMs: nowMs,
    syncedFrom: 'POS_CostProfitIntegration',
    payload: {
      ...bundle.payload,
      menus: updatedMenus,
    },
  };

  saveCachedCostBundle(updatedPayload, { source: 'import' });
  return true;
}

/**
 * Syncs Cost & Profit data locally into KinD POS menu items and OpEx settings
 */
export async function applyCostDataToPOS(
  payload: TonysKitchenPayload,
  currentMenuItems: MenuItem[],
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => void,
  updateSettings?: (updates: Partial<ShopSettings>) => void
): Promise<CostSyncSummary> {
  const p = payload.payload;
  const settings = p.settings || {};
  const costMenus = p.menus || [];

  // 1. Extract Commission & Packaging
  const grabCommission = settings.grabFoodCommissionPercent ?? 37;
  const linemanCommission = settings.lineManCommissionPercent ?? 37;
  const deliveryPkg = settings.deliveryPackagingCost ?? 8;
  const takeawayPkg = settings.takeawayPackagingCost ?? settings.packagingCostTakeaway ?? 5;

  // 2. Fixed OpEx
  const fixedOpEx = calculateFixedMonthlyOpEx(payload);

  // 3. Update localStorage OpEx
  try {
    const existingRaw = localStorage.getItem(OPEX_STORAGE_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const updatedOpEx = {
      ...existing,
      defaultGrabGpRate: grabCommission,
      defaultLinemanGpRate: linemanCommission,
      defaultPackagingCost: deliveryPkg,
      monthlyRent: fixedOpEx.rent > 0 ? fixedOpEx.rent : existing.monthlyRent ?? 15000,
      monthlyFixedSalaries: fixedOpEx.salaries > 0 ? fixedOpEx.salaries : existing.monthlyFixedSalaries ?? 57000,
      monthlyUtilitiesFixed: fixedOpEx.utilities > 0 ? fixedOpEx.utilities : existing.monthlyUtilitiesFixed ?? 8760,
      customFixedExpense: fixedOpEx.extraFixed,
    };
    localStorage.setItem(OPEX_STORAGE_KEY, JSON.stringify(updatedOpEx));
    notifyOpExUpdated();
  } catch (err) {
    console.warn('[applyCostDataToPOS] Failed to save OpEx settings:', err);
  }

  // 4. Update Shop Name if user provided
  if (updateSettings && settings.restaurantName) {
    updateSettings({ shopName: settings.restaurantName });
  }

  // Cache latest Cost & Profit bundle locally for Menu Management & Food Cost pickers
  saveCachedCostBundle(payload, { source: 'import' });

  // 5. Match and Update Menu Items & Variants
  const syncedDishes: CostSyncSummary['syncedDishes'] = [];
  let updatedVariantsTotal = 0;

  currentMenuItems.forEach((posItem) => {
    const matchedCostMenu = findMatchingCostMenu(
      posItem.name,
      costMenus,
      posItem.costMenuId,
      posItem.id
    );

    if (!matchedCostMenu) return;

    let itemCostUpdated = false;
    let itemMatchedAnyVariant = false;
    let newBaseCost = posItem.cost;
    const oldBaseCost = posItem.cost;
    const variantChanges: CostSyncSummary['syncedDishes'][0]['variants'] = [];

    // Check if dish has variants in POS
    if (posItem.variants && posItem.variants.length > 0 && matchedCostMenu.variants) {
      const updatedVariants: ItemVariantOption[] = posItem.variants.map((posVar) => {
        const matchedCostVar = findMatchingCostVariant(
          posVar.name,
          matchedCostMenu.variants || [],
          posVar.costVariantId,
          posVar.id,
          posItem.name
        );

        if (matchedCostVar) {
          const varCost = getVariantRecipeCost(matchedCostVar) || posVar.cost;
          const remoteSellPrice = getVariantSellingPrice(matchedCostVar);
          const remoteTime = extractCostTimestampMs(payload);
          const localTime = posVar.priceUpdatedAt ? new Date(posVar.priceUpdatedAt).getTime() : 0;
          const resolvedPrice =
            remoteSellPrice > 0 && (posVar.price <= 0 || remoteTime >= localTime)
              ? remoteSellPrice
              : posVar.price;

          itemMatchedAnyVariant = true;
          const oldVcost = posVar.cost;
          if (
            varCost !== oldVcost ||
            resolvedPrice !== posVar.price ||
            posVar.costVariantId !== matchedCostVar.id ||
            posVar.costMenuId !== matchedCostMenu.id
          ) {
            itemCostUpdated = true;
          }
          updatedVariantsTotal++;
          variantChanges.push({
            variantName: posVar.name,
            oldCost: oldVcost,
            newCost: varCost,
            sellingPrice: resolvedPrice,
            foodCostPct: resolvedPrice > 0 ? (varCost / resolvedPrice) * 100 : 0,
          });
          return {
            ...posVar,
            price: resolvedPrice,
            cost: varCost,
            costMenuId: matchedCostMenu.id,
            costVariantId: matchedCostVar.id,
            costVariantName: matchedCostVar.name || matchedCostVar.variantName || posVar.name,
            priceUpdatedAt:
              resolvedPrice !== posVar.price && payload.exportedAt
                ? payload.exportedAt
                : posVar.priceUpdatedAt,
          };
        }
        return posVar;
      });

      if (itemCostUpdated || posItem.costMenuId !== matchedCostMenu.id) {
        // Compute new average base cost
        const validCosts = updatedVariants.map((v) => v.cost).filter((c) => c > 0);
        if (validCosts.length > 0) {
          newBaseCost = Math.round((validCosts.reduce((a, b) => a + b, 0) / validCosts.length) * 100) / 100;
        }

        updateMenuItem(posItem.id, {
          cost: newBaseCost,
          costMenuId: matchedCostMenu.id,
          costMenuName: matchedCostMenu.name,
          variants: updatedVariants,
        });
      }

      if (itemMatchedAnyVariant) {
        syncedDishes.push({
          posDishId: posItem.id,
          posDishName: posItem.name,
          oldCost: oldBaseCost,
          newCost: newBaseCost,
          variants: variantChanges,
        });
      }
    } else {
      // Dish without variants
      const singleVar = matchedCostMenu.variants?.[0];
      const singleCost =
        matchedCostMenu.recipeCost ??
        (singleVar ? getVariantRecipeCost(singleVar) : undefined) ??
        posItem.cost;

      if (singleCost !== posItem.cost || posItem.costMenuId !== matchedCostMenu.id) {
        newBaseCost = singleCost;
        updateMenuItem(posItem.id, {
          cost: newBaseCost,
          costMenuId: matchedCostMenu.id,
          costMenuName: matchedCostMenu.name,
        });
      }

      syncedDishes.push({
        posDishId: posItem.id,
        posDishName: posItem.name,
        oldCost: oldBaseCost,
        newCost: singleCost,
        variants: [
          {
            variantName: 'ราคามาตรฐาน',
            oldCost: oldBaseCost,
            newCost: singleCost,
            sellingPrice: posItem.price,
            foodCostPct: posItem.price > 0 ? (singleCost / posItem.price) * 100 : 0,
          },
        ],
      });
    }
  });

  return {
    restaurantName: settings.restaurantName || "Tony's Kitchen",
    matchedDishesCount: syncedDishes.length,
    updatedVariantsCount: updatedVariantsTotal,
    monthlyFixedOpEx: fixedOpEx,
    deliveryGpRates: {
      grab: grabCommission,
      lineman: linemanCommission,
    },
    packagingCosts: {
      delivery: deliveryPkg,
      takeaway: takeawayPkg,
    },
    syncedDishes,
  };
}
