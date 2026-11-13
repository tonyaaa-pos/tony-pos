import { doc, collection, getDoc, getDocs, setDoc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import {
  db,
  getCloudUser,
  isFirebaseConfigured,
  firebaseConfig,
  OperationType,
  handleFirestoreError,
} from './firebase';
import { saveMenuItemRemote } from './cloudStore';
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
  savedToCloud?: boolean;
  cloudPath?: string;
  cloudReason?: 'not_configured' | 'not_signed_in';
}

export interface CostFirestoreFetchResult {
  status: 'found' | 'not_found' | 'not_signed_in' | 'not_configured';
  data: TonysKitchenPayload | null;
  docPath?: string;
  uid?: string;
}

export interface CostFirestoreSaveResult {
  savedToCloud: boolean;
  docPath?: string;
  reason?: 'not_configured' | 'not_signed_in';
}

export const OPEX_STORAGE_KEY = 'kind_pos_opex_settings_v4';
export const COST_BUNDLE_CACHE_KEY = 'kind_pos_cost_bundle_cache_v1';

export function saveCachedCostBundle(payload: TonysKitchenPayload): void {
  try {
    if (typeof localStorage !== 'undefined' && payload && payload.payload) {
      localStorage.setItem(COST_BUNDLE_CACHE_KEY, JSON.stringify(payload));
    }
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
  const raw =
    variant.recipeCost ??
    variant.foodCostPerUnit ??
    variant.calculatedCost ??
    variant.cost ??
    0;
  return Math.round(Number(raw) * 100) / 100;
}

export function getVariantSellingPrice(variant?: TonysKitchenVariant | null): number {
  if (!variant) return 0;
  const raw = variant.sellingPrice ?? variant.price ?? 0;
  return Math.round(Number(raw) * 100) / 100;
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

/**
 * Parses raw JSON string or object from Cost & Profit application
 */
export function parseCostAndProfitPayload(input: string | object): TonysKitchenPayload {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (!data || typeof data !== 'object') {
    throw new Error('รูปแบบข้อมูล JSON ไม่ถูกต้อง');
  }

  // Handle case where user passes inner payload or full export
  if (data.payload && typeof data.payload === 'object') {
    return data as TonysKitchenPayload;
  }

  // Fallback: wrap raw structure into standard payload envelope
  return {
    schemaVersion: data.schemaVersion || '1.1.0',
    appId: data.appId || 'TONYS_KITCHEN_POS',
    appName: data.appName || "Tony's Kitchen POS & Cost Management",
    payload: data,
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
 * Builds POS variants strictly from the selected Food Cost menu (never mixing options from other menus).
 * Keeps latest edited selling price if matching the same linked cost menu, while always locking cost to recipe formula.
 */
export function buildVariantsFromCostMenu(
  costMenu: TonysKitchenMenu,
  existingVariants: ItemVariantOption[] = []
): ItemVariantOption[] {
  const costVars = costMenu.variants || [];
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

    const resolvedPrice =
      existingMatch && existingMatch.price > 0
        ? existingMatch.price
        : bundlePrice > 0
        ? bundlePrice
        : 80;

    return {
      id:
        existingMatch?.id ||
        `v_${cv.id}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`,
      name: varName,
      nameEn: existingMatch?.nameEn || nameEn,
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
 * Persists POS selling price modifications back to the linked Food Cost bundle (local cache + Firestore)
 * so the latest edited price is always treated as the current linked value.
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

  const nowIso = new Date().toISOString();
  let changed = false;

  const updatedMenus = menus.map((cm) => {
    const isTargetMenu =
      (costMenuId && cm.id === costMenuId) ||
      variants.some((v) => v.costMenuId === cm.id);
    if (!isTargetMenu || !cm.variants) return cm;

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
    payload: {
      ...bundle.payload,
      menus: updatedMenus,
    },
  };

  saveCachedCostBundle(updatedPayload);

  try {
    await saveCostBundleToFirestore(updatedPayload);
  } catch (err) {
    console.warn('[syncSellingPriceUpdatesToCostBundle] Cloud save warning:', err);
  }

  return true;
}

/**
 * Syncs Cost & Profit data into KinD POS menu items, OpEx, and Firestore
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
  } catch (err) {
    console.warn('[applyCostDataToPOS] Failed to save OpEx settings:', err);
  }

  // 4. Update Shop Name if user provided
  if (updateSettings && settings.restaurantName) {
    updateSettings({ shopName: settings.restaurantName });
  }

  // Cache latest Cost & Profit bundle locally for Menu Management & Food Cost pickers
  saveCachedCostBundle(payload);

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
          const remoteTime = payload.exportedAt ? new Date(payload.exportedAt).getTime() : 0;
          const localTime = posVar.priceUpdatedAt ? new Date(posVar.priceUpdatedAt).getTime() : 0;
          const resolvedPrice =
            remoteSellPrice > 0 && (posVar.price <= 0 || remoteTime > localTime)
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

        const updatedItem: MenuItem = {
          ...posItem,
          cost: newBaseCost,
          costMenuId: matchedCostMenu.id,
          costMenuName: matchedCostMenu.name,
          variants: updatedVariants,
        };
        updateMenuItem(posItem.id, {
          cost: newBaseCost,
          costMenuId: matchedCostMenu.id,
          costMenuName: matchedCostMenu.name,
          variants: updatedVariants,
        });
        saveMenuItemRemote(updatedItem).catch((err) =>
          console.warn('[applyCostDataToPOS] Remote sync failed for:', posItem.id, err)
        );
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
        const updatedItem: MenuItem = {
          ...posItem,
          cost: newBaseCost,
          costMenuId: matchedCostMenu.id,
          costMenuName: matchedCostMenu.name,
        };
        updateMenuItem(posItem.id, {
          cost: newBaseCost,
          costMenuId: matchedCostMenu.id,
          costMenuName: matchedCostMenu.name,
        });
        saveMenuItemRemote(updatedItem).catch((err) =>
          console.warn('[applyCostDataToPOS] Remote sync failed for:', posItem.id, err)
        );
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

  // 6. Save Cost Management bundle to Cloud Firestore under users/{uid}/costManagement/tonys_kitchen
  const saveResult = await saveCostBundleToFirestore(payload);

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
    savedToCloud: saveResult.savedToCloud,
    cloudPath: saveResult.docPath,
    cloudReason: saveResult.reason,
  };
}

function formatFirestoreException(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('Quota exceeded')) {
    const link = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
    return new Error(
      `ใช้งานโควตาฟรีประจำวันของ Firestore เกินกำหนด (Quota exceeded) ระบบจะรีเซ็ตในวันถัดไป หรืออัปเกรดได้ที่: ${link}`
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

function isPermissionDeniedError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes('missing or insufficient permissions') || msg.includes('permission-denied');
}

/**
 * Saves cost bundle to Cloud Firestore users/{uid}/costManagement/tonys_kitchen
 */
export async function saveCostBundleToFirestore(
  payload: TonysKitchenPayload
): Promise<CostFirestoreSaveResult> {
  if (!isFirebaseConfigured() || !db) {
    return { savedToCloud: false, reason: 'not_configured' };
  }
  const user = getCloudUser();
  if (!user) {
    return { savedToCloud: false, reason: 'not_signed_in' };
  }

  const docPath = `users/${user.uid}/costManagement/tonys_kitchen`;
  try {
    const costDocRef = doc(db, 'users', user.uid, 'costManagement', 'tonys_kitchen');
    await setDoc(
      costDocRef,
      {
        ...payload,
        updatedAt: new Date().toISOString(),
        serverUpdatedAt: serverTimestamp(),
        syncedFrom: 'POS_CostProfitIntegration',
      },
      { merge: true }
    );
    saveCachedCostBundle(payload);
    return { savedToCloud: true, docPath };
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
    throw formatFirestoreException(err);
  }
}

/**
 * Fetches cost management data from Firestore with clear connection/auth/existence status
 */
export async function fetchRemoteCostManagementStatus(): Promise<CostFirestoreFetchResult> {
  if (!isFirebaseConfigured() || !db) {
    return { status: 'not_configured', data: null };
  }
  const user = getCloudUser();
  if (!user) {
    return { status: 'not_signed_in', data: null };
  }

  const docPath = `users/${user.uid}/costManagement/tonys_kitchen`;
  try {
    const costDocRef = doc(db, 'users', user.uid, 'costManagement', 'tonys_kitchen');
    const snap = await getDoc(costDocRef);
    if (snap.exists()) {
      const parsed = parseCostAndProfitPayload(snap.data());
      saveCachedCostBundle(parsed);
      return {
        status: 'found',
        data: parsed,
        docPath,
        uid: user.uid,
      };
    }

    // Fallback: inspect any document inside users/{uid}/costManagement in case the external app used another doc ID
    const colPath = `users/${user.uid}/costManagement`;
    const colSnap = await getDocs(collection(db, 'users', user.uid, 'costManagement'));
    for (const d of colSnap.docs) {
      const raw = d.data();
      if (raw && (raw.payload || raw.menus || raw.settings)) {
        const parsed = parseCostAndProfitPayload(raw);
        saveCachedCostBundle(parsed);
        return {
          status: 'found',
          data: parsed,
          docPath: `${colPath}/${d.id}`,
          uid: user.uid,
        };
      }
    }

    return {
      status: 'not_found',
      data: null,
      docPath,
      uid: user.uid,
    };
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.GET, docPath);
    }
    throw formatFirestoreException(err);
  }
}

/**
 * Fetches cost management data from Firestore if present
 */
export async function fetchRemoteCostManagementData(): Promise<TonysKitchenPayload | null> {
  const result = await fetchRemoteCostManagementStatus();
  return result.data;
}

/**
 * Subscribes to Real-time updates from Cost & Profit in Firestore
 */
export function subscribeCostManagementData(
  onUpdate: (payload: TonysKitchenPayload) => void,
  onError?: (err: Error) => void
): Unsubscribe | null {
  if (!isFirebaseConfigured() || !db) return null;
  const user = getCloudUser();
  if (!user) return null;

  const docPath = `users/${user.uid}/costManagement/tonys_kitchen`;
  try {
    const costDocRef = doc(db, 'users', user.uid, 'costManagement', 'tonys_kitchen');
    return onSnapshot(
      costDocRef,
      (snap) => {
        if (snap.exists()) {
          const parsed = parseCostAndProfitPayload(snap.data());
          saveCachedCostBundle(parsed);
          onUpdate(parsed);
        }
      },
      (err) => {
        if (isPermissionDeniedError(err)) {
          try {
            handleFirestoreError(err, OperationType.GET, docPath);
          } catch (wrappedErr) {
            if (onError && wrappedErr instanceof Error) onError(wrappedErr);
          }
          return;
        }
        const formatted = formatFirestoreException(err);
        console.warn('[subscribeCostManagementData] Error:', formatted);
        if (onError) onError(formatted);
      }
    );
  } catch (err) {
    console.warn('[subscribeCostManagementData] Setup Error:', err);
    return null;
  }
}
