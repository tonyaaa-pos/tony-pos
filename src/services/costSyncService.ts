import { doc, getDoc, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db, getCloudUser } from './firebase';
import { saveMenuItemRemote } from './cloudStore';
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
}

export const OPEX_STORAGE_KEY = 'kind_pos_opex_settings_v4';

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
  return str.toLowerCase().replace(/[\s\-_]/g, '');
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

  // 5. Match and Update Menu Items & Variants
  const syncedDishes: CostSyncSummary['syncedDishes'] = [];
  let updatedVariantsTotal = 0;

  currentMenuItems.forEach((posItem) => {
    const posNorm = normalizeName(posItem.name);
    // Find matching menu in Cost & Profit
    const matchedCostMenu = costMenus.find((cm) => {
      const cNorm = normalizeName(cm.name);
      return posNorm.includes(cNorm) || cNorm.includes(posNorm) || cm.id === posItem.id;
    });

    if (!matchedCostMenu) return;

    let itemCostUpdated = false;
    let newBaseCost = posItem.cost;
    const oldBaseCost = posItem.cost;
    const variantChanges: CostSyncSummary['syncedDishes'][0]['variants'] = [];

    // Check if dish has variants in POS
    if (posItem.variants && posItem.variants.length > 0 && matchedCostMenu.variants) {
      const updatedVariants: ItemVariantOption[] = posItem.variants.map((posVar) => {
        const vNorm = normalizeName(posVar.name);
        const matchedCostVar = matchedCostMenu.variants?.find((cv) => {
          const cvNorm = normalizeName(cv.name || cv.variantName || '');
          return (
            vNorm.includes(cvNorm) ||
            cvNorm.includes(vNorm) ||
            cv.id === posVar.id ||
            // Handle pork matching (หมูสับ / หมูหมัก / หมูบด)
            (vNorm.includes('หมู') && cvNorm.includes('หมู')) ||
            (vNorm.includes('ไก่') && cvNorm.includes('ไก่')) ||
            (vNorm.includes('เนื้อ') && cvNorm.includes('เนื้อ')) ||
            (vNorm.includes('กุ้ง') && cvNorm.includes('กุ้ง')) ||
            (vNorm.includes('หมึก') && cvNorm.includes('หมึก')) ||
            (vNorm.includes('ทะเล') && cvNorm.includes('ทะเล'))
          );
        });

        if (matchedCostVar) {
          const varCost =
            matchedCostVar.recipeCost ??
            matchedCostVar.foodCostPerUnit ??
            matchedCostVar.calculatedCost ??
            matchedCostVar.cost ??
            posVar.cost;

          const oldVcost = posVar.cost;
          if (varCost !== oldVcost) {
            itemCostUpdated = true;
            updatedVariantsTotal++;
            variantChanges.push({
              variantName: posVar.name,
              oldCost: oldVcost,
              newCost: varCost,
              sellingPrice: posVar.price,
              foodCostPct: posVar.price > 0 ? (varCost / posVar.price) * 100 : 0,
            });
            return { ...posVar, cost: varCost };
          }
        }
        return posVar;
      });

      if (itemCostUpdated) {
        // Compute new average base cost
        const validCosts = updatedVariants.map((v) => v.cost).filter((c) => c > 0);
        if (validCosts.length > 0) {
          newBaseCost = Math.round((validCosts.reduce((a, b) => a + b, 0) / validCosts.length) * 100) / 100;
        }

        const updatedItem = {
          ...posItem,
          cost: newBaseCost,
          variants: updatedVariants,
        };
        updateMenuItem(posItem.id, { cost: newBaseCost, variants: updatedVariants });
        saveMenuItemRemote(updatedItem).catch((err) =>
          console.warn('[applyCostDataToPOS] Remote sync failed for:', posItem.id, err)
        );

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
        singleVar?.recipeCost ??
        singleVar?.foodCostPerUnit ??
        posItem.cost;

      if (singleCost !== posItem.cost) {
        newBaseCost = singleCost;
        const updatedItem = { ...posItem, cost: newBaseCost };
        updateMenuItem(posItem.id, { cost: newBaseCost });
        saveMenuItemRemote(updatedItem).catch((err) =>
          console.warn('[applyCostDataToPOS] Remote sync failed for:', posItem.id, err)
        );

        syncedDishes.push({
          posDishId: posItem.id,
          posDishName: posItem.name,
          oldCost: oldBaseCost,
          newCost: newBaseCost,
          variants: [
            {
              variantName: 'ราคามาตรฐาน',
              oldCost: oldBaseCost,
              newCost: newBaseCost,
              sellingPrice: posItem.price,
              foodCostPct: posItem.price > 0 ? (newBaseCost / posItem.price) * 100 : 0,
            },
          ],
        });
      }
    }
  });

  // 6. Save Cost Management bundle to Cloud Firestore under users/{uid}/costManagement/tonys_kitchen
  await saveCostBundleToFirestore(payload);

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

/**
 * Saves cost bundle to Cloud Firestore users/{uid}/costManagement/tonys_kitchen
 */
export async function saveCostBundleToFirestore(payload: TonysKitchenPayload): Promise<void> {
  const user = getCloudUser();
  if (!db || !user) return;

  try {
    const costDocRef = doc(db, 'users', user.uid, 'costManagement', 'tonys_kitchen');
    await setDoc(
      costDocRef,
      {
        ...payload,
        updatedAt: new Date().toISOString(),
        syncedFrom: 'POS_CostProfitIntegration',
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[saveCostBundleToFirestore] Error:', err);
  }
}

/**
 * Fetches cost management data from Firestore if present
 */
export async function fetchRemoteCostManagementData(): Promise<TonysKitchenPayload | null> {
  const user = getCloudUser();
  if (!db || !user) return null;

  try {
    const costDocRef = doc(db, 'users', user.uid, 'costManagement', 'tonys_kitchen');
    const snap = await getDoc(costDocRef);
    if (snap.exists()) {
      return snap.data() as TonysKitchenPayload;
    }
  } catch (err) {
    console.warn('[fetchRemoteCostManagementData] Error:', err);
  }
  return null;
}

/**
 * Subscribes to Real-time updates from Cost & Profit in Firestore
 */
export function subscribeCostManagementData(
  onUpdate: (payload: TonysKitchenPayload) => void
): Unsubscribe | null {
  const user = getCloudUser();
  if (!db || !user) return null;

  try {
    const costDocRef = doc(db, 'users', user.uid, 'costManagement', 'tonys_kitchen');
    return onSnapshot(
      costDocRef,
      (snap) => {
        if (snap.exists()) {
          onUpdate(snap.data() as TonysKitchenPayload);
        }
      },
      (err) => {
        console.warn('[subscribeCostManagementData] Error:', err);
      }
    );
  } catch (err) {
    console.warn('[subscribeCostManagementData] Setup Error:', err);
    return null;
  }
}
