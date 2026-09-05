import { GarmentPieceItem, GarmentPieceSnapshot, SelectedPieceItem } from '../types';

export const GARMENT_CATALOG: GarmentPieceItem[] = [
  // --- TOPS ---
  {
    id: 'top_light_tshirt',
    category: 'Tops',
    subCategory: 'Light Top',
    name: 'T-shirt / Shirt / Short Kurta / Kurti',
    regular_price: 20,
    offer_price: 15,
    price: 15,
    avgWeight: '250g',
    subscriberCredits: 3,
    active: true,
    offer_active: true
  },
  {
    id: 'top_heavy_kurti',
    category: 'Tops',
    subCategory: 'Heavy Top',
    name: 'Kurti / Kurta / Churidar Top',
    regular_price: 30,
    offer_price: 20,
    price: 20,
    avgWeight: '350g',
    subscriberCredits: 4,
    active: true,
    offer_active: true
  },
  {
    id: 'top_heavy_hoodie',
    category: 'Tops',
    subCategory: 'Heavy Top',
    name: 'Sweatshirt / Hoodie',
    regular_price: 35,
    offer_price: 25,
    price: 25,
    avgWeight: '600g',
    subscriberCredits: 6,
    active: true,
    offer_active: true
  },
  {
    id: 'top_light_blouse',
    category: 'Tops',
    subCategory: 'Light Top',
    name: 'Blouse',
    regular_price: 15,
    offer_price: 10,
    price: 10,
    avgWeight: '150g',
    subscriberCredits: 2,
    active: true,
    offer_active: true
  },

  // --- BOTTOMS ---
  {
    id: 'bottom_light_pants',
    category: 'Bottoms',
    subCategory: 'Light Bottom',
    name: 'Pants / Track Pants / Shorts / Churidar Bottom',
    regular_price: 20,
    offer_price: 15,
    price: 15,
    avgWeight: '400g',
    subscriberCredits: 4,
    active: true,
    offer_active: true
  },
  {
    id: 'bottom_heavy_jeans',
    category: 'Bottoms',
    subCategory: 'Heavy Bottom',
    name: 'Jeans / Sweatpants',
    regular_price: 35,
    offer_price: 25,
    price: 25,
    avgWeight: '700g',
    subscriberCredits: 7,
    active: true,
    offer_active: true
  },

  // --- COMBOS & SETS ---
  {
    id: 'combo_light_outfit',
    category: 'Combos & Sets',
    subCategory: 'Combo',
    name: 'Light Outfit',
    includes: 'Light Top + Light Bottom',
    regular_price: 35,
    offer_price: 25,
    price: 25,
    avgWeight: '600g',
    subscriberCredits: 6,
    active: true,
    offer_active: true
  },
  {
    id: 'combo_heavy_outfit',
    category: 'Combos & Sets',
    subCategory: 'Combo',
    name: 'Heavy Outfit',
    includes: 'Top + Jeans / Sweatshirt / Sweatpants',
    regular_price: 40,
    offer_price: 35,
    price: 35,
    avgWeight: '1000g',
    subscriberCredits: 10,
    active: true,
    offer_active: true
  },
  {
    id: 'combo_churidar_set',
    category: 'Combos & Sets',
    subCategory: 'Combo',
    name: 'Churidar Set',
    includes: 'Scarf + Churidar Top + Bottom',
    regular_price: 40,
    offer_price: 30,
    price: 30,
    avgWeight: '750g',
    subscriberCredits: 8,
    active: true,
    offer_active: true
  },
  {
    id: 'combo_kurta_pajama',
    category: 'Combos & Sets',
    subCategory: 'Combo',
    name: 'Kurta Pajama',
    includes: 'Kurta + Pajama',
    regular_price: 40,
    offer_price: 30,
    price: 30,
    avgWeight: '750g',
    subscriberCredits: 8,
    active: true,
    offer_active: true
  },
  {
    id: 'combo_nightwear_set',
    category: 'Combos & Sets',
    subCategory: 'Combo',
    name: 'Nightwear Set',
    includes: 'Top + Bottom',
    regular_price: 30,
    offer_price: 20,
    price: 20,
    avgWeight: '500g',
    subscriberCredits: 5,
    active: true,
    offer_active: true
  },

  // --- ACTIVEWEAR ---
  {
    id: 'activewear_set',
    category: 'Activewear',
    subCategory: 'Activewear',
    name: 'Activewear',
    includes: 'Jersey / Sports Top + Bottoms',
    regular_price: 40,
    offer_price: 30,
    price: 30,
    avgWeight: '650g',
    subscriberCredits: 7,
    active: true,
    offer_active: true
  },

  // --- WHITES ---
  {
    id: 'whites_light',
    category: 'Whites',
    subCategory: 'Light Whites',
    name: 'Light Whites',
    includes: 'White shirts, T-shirts, tops, innerwear, light cottons',
    regular_price: 25,
    offer_price: 20,
    price: 20,
    avgWeight: '250g',
    subscriberCredits: 4,
    active: true,
    offer_active: true
  },
  {
    id: 'whites_heavy',
    category: 'Whites',
    subCategory: 'Heavy Whites',
    name: 'Heavy Whites',
    includes: 'White pants, jeans, bedsheets, towels, heavy cottons',
    regular_price: 40,
    offer_price: 30,
    price: 30,
    avgWeight: '500g',
    subscriberCredits: 6,
    active: true,
    offer_active: true
  }
];

export const GARMENT_CATEGORIES = ['Tops', 'Bottoms', 'Combos & Sets', 'Activewear', 'Whites'] as const;

export function normalizeGarmentItem(
  item: Partial<GarmentPieceItem> & { id: string },
  isOfferActive: boolean = true
): GarmentPieceItem {
  const fallback = GARMENT_CATALOG.find(g => g.id === item.id);
  const regPrice = item.regular_price ?? fallback?.regular_price ?? (item.price ?? 20);
  const offPrice = item.offer_price ?? fallback?.offer_price ?? (item.price ?? 15);
  const offerEnabled = isOfferActive && (item.offer_active !== false);
  const activePrice = offerEnabled ? offPrice : regPrice;

  return {
    id: item.id,
    category: item.category ?? fallback?.category ?? 'Tops',
    subCategory: item.subCategory ?? fallback?.subCategory ?? 'General',
    name: item.name ?? fallback?.name ?? 'Garment Piece',
    description: item.description ?? item.includes ?? fallback?.includes,
    includes: item.includes ?? fallback?.includes,
    regular_price: regPrice,
    offer_price: offPrice,
    price: activePrice,
    avgWeight: item.avgWeight ?? fallback?.avgWeight ?? '300g',
    subscriberCredits: item.subscriberCredits ?? fallback?.subscriberCredits ?? 3,
    active: item.active !== false,
    offer_active: item.offer_active !== false
  };
}

export function calculateGarmentTotal(
  garmentCounts: Record<string, number>,
  customCatalog?: GarmentPieceItem[],
  isOfferActive: boolean = true
): {
  totalPieces: number;
  totalPrice: number;
  totalRegularPrice: number;
  totalSavings: number;
  totalCredits: number;
  breakdown: SelectedPieceItem[];
  snapshots: GarmentPieceSnapshot[];
} {
  let totalPieces = 0;
  let totalPrice = 0;
  let totalRegularPrice = 0;
  let totalSavings = 0;
  let totalCredits = 0;
  const breakdown: SelectedPieceItem[] = [];
  const snapshots: GarmentPieceSnapshot[] = [];

  const rawCatalog = customCatalog && customCatalog.length > 0 ? customCatalog : GARMENT_CATALOG;
  const catalog = rawCatalog.map(item => normalizeGarmentItem(item, isOfferActive));

  const nowIso = new Date().toISOString();

  catalog.forEach(item => {
    const count = garmentCounts[item.id] || 0;
    if (count > 0 && item.active !== false) {
      const regUnitPrice = item.regular_price;
      const offUnitPrice = item.offer_price;
      const effectiveOfferActive = isOfferActive && (item.offer_active !== false);
      const priceUsed = effectiveOfferActive ? offUnitPrice : regUnitPrice;
      
      const itemTotalPrice = count * priceUsed;
      const itemRegularPrice = count * regUnitPrice;
      const itemSavings = Math.max(0, itemRegularPrice - itemTotalPrice);
      const itemTotalCredits = count * (item.subscriberCredits ?? 3);

      totalPieces += count;
      totalPrice += itemTotalPrice;
      totalRegularPrice += itemRegularPrice;
      totalSavings += itemSavings;
      totalCredits += itemTotalCredits;

      breakdown.push({
        id: item.id,
        category: item.category,
        subCategory: item.subCategory,
        name: item.name,
        description: item.description,
        includes: item.includes,
        count,
        unitPrice: priceUsed,
        regularUnitPrice: regUnitPrice,
        offerUnitPrice: offUnitPrice,
        regular_unit_price: regUnitPrice,
        offer_unit_price: offUnitPrice,
        price_used: priceUsed,
        offer_active: effectiveOfferActive,
        totalPrice: itemTotalPrice,
        totalRegularPrice: itemRegularPrice,
        savings: itemSavings,
        totalSavings: itemSavings,
        unitCredits: item.subscriberCredits ?? 3,
        subscriberCredits: item.subscriberCredits ?? 3,
        totalCredits: itemTotalCredits,
        avgWeight: item.avgWeight
      });

      snapshots.push({
        garment_id: item.id,
        garment_name: item.name,
        quantity: count,
        regular_unit_price: regUnitPrice,
        offer_unit_price: offUnitPrice,
        price_used: priceUsed,
        offer_active: effectiveOfferActive,
        total_price: itemTotalPrice,
        timestamp: nowIso
      });
    }
  });

  return {
    totalPieces,
    totalPrice,
    totalRegularPrice,
    totalSavings,
    totalCredits,
    breakdown,
    snapshots
  };
}
