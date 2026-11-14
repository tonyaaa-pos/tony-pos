/**
 * Verification & Unit Test Suite for Calculation Engine
 * Tests all key pure calculation functions against standard mathematical assertions.
 */

import {
  calculateUsableQuantity,
  calculateEffectiveCost,
  calculateYieldPercent,
  calculateItemCost,
  calculateSubRecipeBatch,
  calculateRecipeDirectCost,
  calculatePortionCost,
  calculateFoodCostPercent,
  calculateSuggestedPrice,
  calculatePlatformFee,
  calculateNetRevenue,
  calculateContributionMetrics,
  calculateInventoryCOGS,
  calculatePrimeCostMetrics,
  calculateProfitAndLoss,
  calculateBreakEven,
  calculateMenuEngineering,
} from './calculations';
import { convertUnit } from './units';
import { TestSuiteResult, SalesChannel } from '../types/domain';

export function runAllCalculationUnitTests(): TestSuiteResult[] {
  const results: TestSuiteResult[] = [];

  // Helper to record test
  const record = (
    testId: string,
    functionName: string,
    testDescription: string,
    inputs: Record<string, any>,
    expected: number | string,
    actual: number | string
  ) => {
    const start = performance.now();
    const actualVal = typeof actual === 'object' && actual !== null
      ? (typeof (actual as any).cost === 'number' ? (actual as any).cost : typeof (actual as any).cogs === 'number' ? (actual as any).cogs : Number(actual))
      : actual;
    const isNum = typeof expected === 'number' && typeof actualVal === 'number';
    const diff = isNum ? Math.abs((actualVal as number) - (expected as number)) : expected === actualVal ? 0 : 1;
    const passed = isNum ? diff < 0.001 : expected === actualVal;

    results.push({
      testId,
      functionName,
      testDescription,
      inputs,
      expectedOutput: isNum ? Number((expected as number).toFixed(4)) : expected,
      actualOutput: isNum ? Number((actualVal as number).toFixed(4)) : actualVal,
      difference: Number(diff.toFixed(4)),
      status: passed ? 'PASS' : 'FAIL',
      executionTimeMs: Number((performance.now() - start).toFixed(2)),
    });
  };

  // Test 1: Unit conversion kg -> g
  const convKgG = convertUnit(2.5, 'kg', 'g');
  record(
    'TC-UNIT-01',
    'convertUnit(2.5, "kg", "g")',
    'Convert 2.5 kg into grams',
    { quantity: 2.5, from: 'kg', to: 'g' },
    2500,
    convKgG.convertedQuantity
  );

  // Test 2: Unit conversion l -> ml
  const convLMl = convertUnit(1.5, 'l', 'ml');
  record(
    'TC-UNIT-02',
    'convertUnit(1.5, "l", "ml")',
    'Convert 1.5 liters into milliliters',
    { quantity: 1.5, from: 'l', to: 'ml' },
    1500,
    convLMl.convertedQuantity
  );

  // Test 3: Usable Quantity with 95% trimming yield
  const usableQty1 = calculateUsableQuantity(1000, 95);
  record(
    'TC-YIELD-01',
    'calculateUsableQuantity(1000, 95)',
    'Calculate usable grams from 1000g raw pork with 95% yield',
    { purchaseQty: 1000, yieldPercent: 95 },
    950,
    usableQty1
  );

  // Test 4: Usable Quantity with dry noodle water absorption yield (240%)
  const usableNoodles = calculateUsableQuantity(500, 240);
  record(
    'TC-YIELD-02',
    'calculateUsableQuantity(500, 240)',
    'Calculate prepared noodle weight from 500g dry noodles at 240% expansion yield',
    { purchaseQty: 500, yieldPercent: 240 },
    1200,
    usableNoodles
  );

  // Test 5: Effective Cost per usable unit
  const effCost = calculateEffectiveCost(200, 950);
  record(
    'TC-COST-01',
    'calculateEffectiveCost(200, 950)',
    'Effective cost per usable gram when 200 THB yields 950g',
    { purchasePrice: 200, usableQuantity: 950 },
    200 / 950,
    effCost
  );

  // Test 6: Ingredient usage cost conversion (recipe uses 150g, purchased at 90 THB/kg usable)
  const itemCostCalc = calculateItemCost(150, 'g', 'kg', 90);
  record(
    'TC-COST-02',
    'calculateItemCost(150, "g", "kg", 90)',
    'Cost of 150g chicken when purchase price is 90 THB/kg',
    { quantityUsed: 150, recipeUnit: 'g', purchaseUnit: 'kg', costPerUsableUnit: 90 },
    13.5,
    itemCostCalc.cost
  );

  // Test 7: Sub-recipe sauce batch cost
  const sauceBatch = calculateSubRecipeBatch(
    [
      { id: '1', ingredientId: 'i1', ingredientName: 'Tamarind', quantity: 500, unit: 'g', unitCost: 0.12, extendedCost: 60 },
      { id: '2', ingredientId: 'i2', ingredientName: 'Palm Sugar', quantity: 500, unit: 'g', unitCost: 0.08, extendedCost: 40 },
      { id: '3', ingredientId: 'i3', ingredientName: 'Fish Sauce', quantity: 250, unit: 'ml', unitCost: 0.05, extendedCost: 12.5 },
    ],
    1250,
    92 // 92% yield after reduction
  );
  record(
    'TC-BATCH-01',
    'calculateSubRecipeBatch() - Cost per ml',
    'Calculate Pad Thai sauce cost per final ml after reduction',
    { rawBatchQty: 1250, yieldPercent: 92, totalItemsCost: 112.5 },
    112.5 / (1250 * 0.92),
    sauceBatch.costPerFinalUnit
  );

  // Test 8: Recipe direct cost summation
  const recipeCost = calculateRecipeDirectCost([
    { id: '1', type: 'ingredient', itemId: 'ing1', itemName: 'Pork', quantity: 120, unit: 'g', unitCost: 0.18, extendedCost: 21.6 },
    { id: '2', type: 'ingredient', itemId: 'ing2', itemName: 'Egg', quantity: 1, unit: 'egg', unitCost: 4.5, extendedCost: 4.5 },
    { id: '3', type: 'sub_recipe', itemId: 'sub1', itemName: 'Pad Thai Sauce', quantity: 45, unit: 'ml', unitCost: 0.10, extendedCost: 4.5 },
  ]);
  record(
    'TC-RECIPE-01',
    'calculateRecipeDirectCost()',
    'Direct cost of dish line items (21.6 + 4.5 + 4.5)',
    { items: 3 },
    30.6,
    recipeCost
  );

  // Test 9: Portion cost calculation
  const portionCost = calculatePortionCost(30.6, 1.25, 4.0); // 1.25x large portion + 4 THB packaging
  record(
    'TC-PORTION-01',
    'calculatePortionCost(30.6, 1.25, 4.0)',
    'Total direct cost for large portion with packaging',
    { baseCost: 30.6, multiplier: 1.25, packaging: 4.0 },
    30.6 * 1.25 + 4.0,
    portionCost.totalDirectCost
  );

  // Test 10: Food Cost % calculation
  const foodCostPct = calculateFoodCostPercent(35, 100);
  record(
    'TC-MARGIN-01',
    'calculateFoodCostPercent(35, 100)',
    'Food Cost % for 35 THB cost sold at 100 THB',
    { foodCost: 35, sellingPrice: 100 },
    35.0,
    foodCostPct
  );

  // Test 11: Pricing Engine Method A (Target 30% Food Cost)
  const suggestedPrice = calculateSuggestedPrice(36, 30, 'food_cost_target');
  record(
    'TC-PRICE-01',
    'calculateSuggestedPrice(36, 30, "food_cost_target")',
    'Recommended selling price for 36 THB cost at 30% food cost target',
    { directCost: 36, targetFoodCostPercent: 30 },
    120,
    suggestedPrice.recommendedPrice
  );

  // Test 12: Sales Channel platform fee calculation (Grab 30% GP + 7% VAT on GP)
  const sampleChannel: SalesChannel = {
    id: 'ch-grab',
    code: 'GRAB',
    name: 'GrabFood',
    commissionPercent: 30,
    paymentFeePercent: 0,
    fixedFeePerOrder: 0,
    packagingFeeSurcharge: 0,
    taxOnCommissionPercent: 7,
    active: true,
  };
  const platFee = calculatePlatformFee(100, sampleChannel);
  // commission = 30, tax = 30 * 0.07 = 2.1, total = 32.1
  record(
    'TC-CHANNEL-01',
    'calculatePlatformFee(100, Grab 30% + 7% VAT)',
    'Delivery platform fee on 100 THB order',
    { sellingPrice: 100, commissionPct: 30, vatOnCommission: 7 },
    32.1,
    platFee.totalPlatformFee
  );

  // Test 13: Net Revenue after platform fees
  const netRev = calculateNetRevenue(100, platFee.totalPlatformFee, 0, 0);
  record(
    'TC-NETREV-01',
    'calculateNetRevenue(100, 32.1)',
    'Net revenue received from 100 THB delivery order',
    { grossPrice: 100, fee: 32.1 },
    67.9,
    netRev
  );

  // Test 14: Contribution Margin Metrics
  const cmMetrics = calculateContributionMetrics(67.9, 30.6);
  record(
    'TC-CONTRIB-01',
    'calculateContributionMetrics(67.9, 30.6)',
    'Contribution profit on delivery order (67.9 - 30.6)',
    { netRevenue: 67.9, totalDirectCost: 30.6 },
    37.3,
    cmMetrics.contributionProfit
  );

  // Test 15: Inventory Accounting COGS (Beginning + Purchases - Waste - Ending)
  const invCogs = calculateInventoryCOGS(50000, 120000, 45000, 3000);
  record(
    'TC-COGS-01',
    'calculateInventoryCOGS(50000, 120000, 45000, 3000)',
    'Accounting COGS calculation (50k + 120k - 3k - 45k)',
    { beginning: 50000, purchases: 120000, ending: 45000, waste: 3000 },
    122000,
    invCogs.cogs
  );

  // Test 16: Prime Cost Metrics (COGS + Direct Labor)
  const primeMetrics = calculatePrimeCostMetrics(120000, 60000, 350000);
  record(
    'TC-PRIME-01',
    'calculatePrimeCostMetrics(120000, 60000, 350000)',
    'Prime Cost % on 350k sales (180k / 350k)',
    { cogs: 120000, directLabor: 60000, netSales: 350000 },
    (180000 / 350000) * 100,
    primeMetrics.primeCostPercent
  );

  // Test 17: Break-Even Sales calculation
  const breakEven = calculateBreakEven(85000, 65, 120, 30);
  record(
    'TC-BREAKEVEN-01',
    'calculateBreakEven(85000, 65%)',
    'Break-even monthly revenue for 85k fixed costs at 65% CM',
    { fixedCosts: 85000, cmPercent: 65 },
    85000 / 0.65,
    breakEven.breakEvenSales
  );

  // Test 18: Full P&L statement
  const pnl = calculateProfitAndLoss(
    400000, // Gross sales
    15000, // Discounts
    2000, // Refunds
    115000, // Food COGS
    12000, // Packaging COGS
    120000, // Operating expenses
    50000, // Direct labor
    20 // Income tax %
  );
  // Net sales = 383,000, total cogs = 127,000, gross profit = 256,000
  // Operating profit = gross profit - directLabor - opex = 256,000 - 50,000 - 120,000 = 86,000
  // Tax = 86,000 * 0.20 = 17,200, Net profit = 86,000 - 17,200 = 68,800
  record(
    'TC-PNL-01',
    'calculateProfitAndLoss() - Net Profit',
    'Monthly Net profit calculation after COGS, direct labor, expenses, and 20% income tax',
    { grossSales: 400000, discounts: 15000, refunds: 2000, cogs: 127000, directLabor: 50000, opex: 120000, taxRate: 20 },
    68800,
    pnl.netProfit
  );

  // Test 19: P&L negative operating profit (tax must be 0)
  const lossPnl = calculateProfitAndLoss(
    100000, // Gross sales
    0, // Discounts
    0, // Refunds
    60000, // Food COGS
    10000, // Packaging COGS
    50000, // Operating expenses
    40000, // Direct labor
    20 // Income tax %
  );
  // Gross profit = 100,000 - 70,000 = 30,000
  // Operating profit = 30,000 - 40,000 - 50,000 = -60,000
  // Tax must be 0 when operating profit <= 0; Net profit = -60,000
  record(
    'TC-PNL-02',
    'calculateProfitAndLoss() - Negative Profit (Zero Tax)',
    'Negative operating profit must result in 0 tax amount',
    { grossSales: 100000, operatingProfit: -60000, taxRate: 20 },
    0,
    lossPnl.taxAmount
  );

  return results;
}

export function runAllUnitTests(): {
  totalTests: number;
  passedCount: number;
  failedCount: number;
  durationMs: number;
  results: {
    testId: string;
    name: string;
    category: string;
    description: string;
    expected: any;
    actual: any;
    passed: boolean;
  }[];
} {
  const start = performance.now();
  const rawResults = runAllCalculationUnitTests();
  const durationMs = performance.now() - start;

  const results = rawResults.map((r) => ({
    testId: r.testId,
    name: r.functionName,
    category: r.testId.split('-')[1] || 'GENERAL',
    description: r.testDescription,
    expected: r.expectedOutput,
    actual: r.actualOutput,
    passed: r.status === 'PASS',
  }));

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  return {
    totalTests: results.length,
    passedCount,
    failedCount,
    durationMs,
    results,
  };
}

