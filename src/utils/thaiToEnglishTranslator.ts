/**
 * Intelligent Thai-to-English Culinary & POS Translator
 * Provides instantaneous, accurate culinary translation for dishes, ingredients,
 * categories, option groups, choices, and variants.
 */

// Comprehensive dictionary for Thai food, drinks, cooking styles, options, categories, and ingredients
const EXACT_DICTIONARY: Record<string, string> = {
  // Common Single Dishes & Rice
  'ผัดกะเพรา': 'Holy Basil Stir-fry',
  'ผัดกะเพราหมูสับ': 'Holy Basil Stir-fry with Minced Pork',
  'ผัดกะเพราไก่': 'Holy Basil Stir-fry with Chicken',
  'ผัดกะเพราเนื้อ': 'Holy Basil Stir-fry with Beef',
  'ผัดกะเพราหมูกรอบ': 'Holy Basil Stir-fry with Crispy Pork',
  'ผัดกะเพราทะเล': 'Holy Basil Stir-fry with Seafood',
  'ผัดกะเพรากุ้ง': 'Holy Basil Stir-fry with Prawns',
  'ผัดกะเพราปลาหมึก': 'Holy Basil Stir-fry with Squid',
  'ผัดกะเพราโบราณ': 'Traditional Holy Basil Stir-fry',
  'ผัดกะเพราราดข้าว': 'Holy Basil Stir-fry on Rice',
  'กะเพราหมูสับ': 'Minced Pork Basil Rice',
  'กะเพราไก่': 'Chicken Basil Rice',
  'กะเพราเนื้อ': 'Beef Basil Rice',
  'กะเพราหมูกรอบ': 'Crispy Pork Basil Rice',

  'ข้าวผัด': 'Fried Rice',
  'ข้าวผัดปู': 'Crab Fried Rice',
  'ข้าวผัดหมู': 'Pork Fried Rice',
  'ข้าวผัดไก่': 'Chicken Fried Rice',
  'ข้าวผัดกุ้ง': 'Prawn Fried Rice',
  'ข้าวผัดทะเล': 'Seafood Fried Rice',
  'ข้าวผัดโบราณ': 'Traditional Fried Rice',
  'ข้าวผัดอเมริกัน': 'American Fried Rice',
  'ข้าวผัดกุนเชียง': 'Chinese Sausage Fried Rice',

  'ผัดไทย': 'Pad Thai',
  'ผัดไทยกุ้งสด': 'Pad Thai with Fresh Prawns',
  'ผัดไทยโบราณ': 'Traditional Pad Thai',
  'ผัดซีอิ๊ว': 'Stir-fried Noodles in Soy Sauce (Pad See Ew)',
  'ผัดซีอิ๊วหมู': 'Pad See Ew with Pork',
  'ผัดซีอิ๊วไก่': 'Pad See Ew with Chicken',
  'ราดหน้า': 'Noodles in Thick Gravy (Rad Na)',
  'ราดหน้าหมูหมัก': 'Rad Na with Marinated Pork',
  'ก๋วยเตี๋ยวคั่วไก่': 'Stir-fried Chicken Noodles (Kuaitiao Khua Gai)',

  'ข้าวมันไก่': 'Hainanese Chicken Rice',
  'ข้าวมันไก่ทอด': 'Crispy Fried Chicken Rice',
  'ข้าวหมูกรอบ': 'Crispy Pork Rice',
  'ข้าวหมูแดง': 'Barbecued Red Pork Rice',
  'ข้าวขาหมู': 'Stewed Pork Leg Rice',
  'ข้าวหน้าเป็ด': 'Roasted Duck Rice',
  'ข้าวคลุกกะปิ': 'Shrimp Paste Fried Rice',
  'ข้าวไข่ข้น': 'Creamy Omelet Rice',
  'ข้าวไข่ข้นกุ้ง': 'Creamy Omelet Rice with Prawns',

  // Soups & Curries
  'ต้มยำ': 'Tom Yum Soup',
  'ต้มยำกุ้ง': 'Tom Yum Soup with Prawns',
  'ต้มยำกุ้งน้ำข้น': 'Creamy Tom Yum Soup with River Prawns',
  'ต้มยำกุ้งน้ำใส': 'Clear Tom Yum Soup with Prawns',
  'ต้มยำรวมมิตร': 'Mixed Seafood Tom Yum Soup',
  'ต้มยำทะเล': 'Spicy Seafood Tom Yum Soup',
  'ต้มยำหัวปลา': 'Fish Head Tom Yum Soup',
  'ต้มข่าไก่': 'Chicken Coconut Soup (Tom Kha Gai)',
  'ต้มแซ่บกระดูกอ่อน': 'Spicy Pork Ribs Soup (Tom Saep)',
  'ต้มแซ่บเนื้อ': 'Spicy Beef Soup',
  'แกงจืดเต้าหู้หมูสับ': 'Clear Soup with Tofu & Minced Pork',
  'แกงส้มชะอมกุ้ง': 'Sour Curry with Cha-om Omelet and Prawns',
  'แกงเขียวหวาน': 'Green Curry',
  'แกงเขียวหวานไก่': 'Green Curry with Chicken',
  'แกงเขียวหวานหมู': 'Green Curry with Pork',
  'แกงเขียวหวานเนื้อ': 'Green Curry with Beef',
  'แกงมัสมั่น': 'Massaman Curry',
  'แกงมัสมั่นไก่': 'Massaman Chicken Curry',
  'แกงมัสมั่นเนื้อ': 'Massaman Beef Curry',
  'พะแนงหมู': 'Panang Pork Curry',
  'พะแนงไก่': 'Panang Chicken Curry',
  'พะแนงเนื้อ': 'Panang Beef Curry',

  // Som Tum & Spicy Salads
  'ส้มตำ': 'Papaya Salad (Som Tum)',
  'ส้มตำไทย': 'Som Tum Thai (Green Papaya Salad)',
  'ส้มตำไทยไข่เค็ม': 'Som Tum Thai with Salted Egg',
  'ส้มตำปูปลาร้า': 'Som Tum with Fermented Fish & Crab',
  'ส้มตำปู': 'Som Tum with Salted Crab',
  'ส้มตำข้าวโพด': 'Sweet Corn Spicy Salad',
  'ส้มตำผลไม้': 'Mixed Fruit Spicy Salad',
  'ตำแตง': 'Spicy Cucumber Salad',
  'ตำถั่ว': 'Spicy Long Bean Salad',
  'ตำป่า': 'Som Tum Pa (Jungle Salad)',
  'ลาบหมู': 'Spicy Minced Pork Salad (Larb Moo)',
  'ลาบไก่': 'Spicy Minced Chicken Salad (Larb Gai)',
  'ลาบเป็ด': 'Spicy Minced Duck Salad',
  'น้ำตกคอหมูย่าง': 'Spicy Grilled Pork Neck Salad (Nam Tok)',
  'น้ำตกหมู': 'Spicy Grilled Pork Salad',
  'น้ำตกเนื้อ': 'Spicy Grilled Beef Salad',
  'ยำวุ้นเส้น': 'Spicy Glass Noodle Salad',
  'ยำวุ้นเส้นโบราณ': 'Traditional Glass Noodle Salad',
  'ยำวุ้นเส้นรวมมิตร': 'Spicy Mixed Seafood Glass Noodle Salad',
  'ยำรวมมิตร': 'Spicy Mixed Salad',
  'ยำรวมมิตรทะเล': 'Spicy Mixed Seafood Salad',
  'ยำมาม่า': 'Spicy Instant Noodle Salad',
  'ยำหมูยอ': 'Spicy Vietnamese Pork Sausage Salad',
  'ยำกุ้งสด': 'Spicy Fresh Prawn Salad',
  'ยำแซลมอน': 'Spicy Salmon Salad',
  'พล่ากุ้ง': 'Spicy Herb Salad with Prawns',

  // Appetizers & Snacks
  'ปีกไก่ทอดน้ำปลา': 'Deep-fried Chicken Wings with Fish Sauce',
  'ปีกไก่ทอด': 'Deep-fried Chicken Wings',
  'เอ็นข้อไก่ทอด': 'Deep-fried Chicken Tendons',
  'หมูกรอบคั่วพริกเกลือ': 'Crispy Pork Belly with Salt & Chili',
  'หมูสามชั้นทอดน้ำปลา': 'Deep-fried Pork Belly with Fish Sauce',
  'หมูแดดเดียว': 'Sun-dried Pork Jerky',
  'เนื้อแดดเดียว': 'Sun-dried Beef Jerky',
  'คอหมูย่าง': 'Grilled Pork Neck',
  'ไก่ย่าง': 'Grilled Chicken',
  'ไก่ทอด': 'Fried Chicken',
  'หมูสะเต๊ะ': 'Pork Satay with Peanut Sauce',
  'เกี๊ยวซ่า': 'Fried Gyoza',
  'ทอดมันกุ้ง': 'Deep-fried Shrimp Cakes',
  'ทอดมันปลากราย': 'Thai Fish Cakes',
  'ปอเปี๊ยะทอด': 'Deep-fried Spring Rolls',
  'เฟรนช์ฟรายส์': 'French Fries',
  'นักเก็ตไก่': 'Chicken Nuggets',
  'กุ้งแช่น้ำปลา': 'Raw Prawns in Spicy Fish Sauce',
  'ไข่ตุ๋น': 'Steamed Egg Custard',

  // Drinks & Desserts
  'ชาไทย': 'Thai Tea',
  'ชาไทยเย็น': 'Thai Iced Tea',
  'ชาเย็น': 'Thai Iced Milk Tea',
  'ชาดำเย็น': 'Iced Black Tea',
  'ชามะนาว': 'Lemon Iced Tea',
  'ชาเขียว': 'Green Tea',
  'ชาเขียวเย็น': 'Iced Green Tea Latte',
  'กาแฟ': 'Coffee',
  'กาแฟโบราณ': 'Traditional Thai Iced Coffee',
  'โอเลี้ยง': 'Thai Iced Black Coffee (O-Liang)',
  'เอสเพรสโซ่': 'Espresso',
  'อเมริกาโน่': 'Americano',
  'อเมริกาโน่เย็น': 'Iced Americano',
  'ลาเต้': 'Latte',
  'ลาเต้เย็น': 'Iced Latte',
  'คาปูชิโน่': 'Cappuccino',
  'มอคค่า': 'Mocha',
  'ช็อคโกแลตเย็น': 'Iced Chocolate',
  'โกโก้เย็น': 'Iced Cocoa',
  'นมสดเย็น': 'Iced Fresh Milk',
  'นมชมพู': 'Pink Milk (Nom Yen)',
  'น้ำส้มคั้น': 'Fresh Orange Juice',
  'น้ำมะนาว': 'Fresh Lime Juice',
  'น้ำมะพร้าว': 'Fresh Coconut Water',
  'น้ำแตงโมปั่น': 'Watermelon Smoothie',
  'น้ำอัดลม': 'Soft Drink (Soda)',
  'น้ำเปล่า': 'Drinking Water',
  'น้ำแข็ง': 'Ice (Bucket)',
  'ข้าวเหนียวมะม่วง': 'Mango Sticky Rice',
  'บัวลอย': 'Bua Loy in Coconut Milk',
  'เฉาก๊วยนมสด': 'Grass Jelly with Fresh Milk',
  'ทับทิมกรอบ': 'Water Chestnut Rubies in Coconut Milk',
  'ไอศกรีมกะทิสด': 'Coconut Milk Ice Cream',
  'ไอศกรีม': 'Ice Cream',
  'โรตี': 'Crispy Roti',
  'กล้วยบวชชี': 'Bananas in Coconut Milk',

  // Categories
  'อาหารจานเดียว': 'Single Dishes',
  'ต้มและแกง': 'Soups & Curries',
  'ส้มตำและยำ': 'Som Tum & Spicy Salads',
  'ของทานเล่น': 'Appetizers & Snacks',
  'เครื่องดื่มและขนมหวาน': 'Beverages & Desserts',
  'เครื่องดื่ม': 'Beverages',
  'ขนมหวาน': 'Desserts',
  'อาหารว่าง': 'Snacks',
  'อาหารชุด': 'Set Meals',
  'เมนูเส้น': 'Noodles',
  'กับข้าว': 'Side Dishes',

  // Option Presets & Groups
  'เพิ่มไข่ดาว': 'Add Eggs',
  'ไข่ดาว': 'Fried Egg',
  'เลือกระดับความเผ็ด': 'Spiciness Level',
  'ความเผ็ด': 'Spiciness',
  'เลือกระดับความหวาน': 'Sweetness Level',
  'ความหวาน': 'Sweetness',
  'เลือกขนาด': 'Portion Size',
  'ขนาด': 'Size',
  'ท็อปปิ้งเพิ่มเติม': 'Toppings & Add-ons',
  'ท็อปปิ้ง': 'Toppings',
  'ท็อปปิ้งเครื่องดื่ม': 'Drink Toppings',
  'เลือกเส้น': 'Choice of Noodles',
  'เลือกเนื้อสัตว์': 'Choice of Meat',
  'เลือกข้าว': 'Choice of Rice',

  // Choices & Variants
  'ปกติ': 'Standard',
  'ธรรมดา': 'Regular',
  'พิเศษ': 'Special',
  'จัมโบ้': 'Jumbo',
  'ถ้วย': 'Cup / Bowl',
  'ชาม': 'Bowl',
  'จาน': 'Plate',
  'หม้อไฟ': 'Hot Pot',
  'แก้ว': 'Glass',
  'ขวด': 'Bottle',

  'ไข่ดาวสุก': 'Well-done Fried Egg',
  'ไข่ดาวไม่สุก': 'Sunny-side Up (Runny Egg)',
  'ไข่ดาวเยิ้ม': 'Sunny-side Up (Runny)',
  'ไข่เจียว': 'Thai Omelet',
  'ไข่ออนเซ็น': 'Onsen Soft Egg',
  'ไข่เค็ม': 'Salted Egg',
  'ไข่เยี่ยวม้า': 'Century Egg',
  'ไข่ต้ม': 'Boiled Egg',

  'ไม่เผ็ด': 'Non-spicy',
  'เผ็ดน้อย': 'Mild (1 Chili)',
  'เผ็ดกลาง': 'Medium (Standard)',
  'เผ็ดมาก': 'Extra Spicy (Hot)',
  'เผ็ดพ่นไฟ': 'Super Hot & Spicy (5 Chilies)',

  'ไม่หวาน': 'No Sugar (0%)',
  'หวานน้อย': 'Less Sweet (25%)',
  'หวานปกติ': 'Regular Sweet (50%)',
  'หวานมาก': 'Extra Sweet (100%)',

  'เพิ่มข้าว': 'Extra Rice',
  'เพิ่มหมูกรอบ': 'Extra Crispy Pork',
  'เพิ่มกุ้ง': 'Extra Prawns',
  'เพิ่มหมู': 'Extra Pork',
  'เพิ่มไก่': 'Extra Chicken',
  'เพิ่มเนื้อ': 'Extra Beef',
  'เพิ่มชีส': 'Melted Cheese',
  'กากหมูเจียว': 'Crispy Pork Cracklings',
  'กุนเชียงทอด': 'Fried Chinese Sausage',

  'ไข่มุก': 'Brown Sugar Pearls',
  'บุกคริสตัล': 'Crystal Jelly',
  'พุดดิ้งนมสด': 'Milk Pudding',
  'เฉาก๊วย': 'Grass Jelly',
  'ว่านหางจระเข้': 'Aloe Vera',

  'ไม่ใส่ผัก': 'No Vegetables',
  'ไม่ใส่พริก': 'No Chili',
  'ไม่ใส่กระเทียม': 'No Garlic',
  'ไม่ใส่ชูรส': 'No MSG',
  'แยกน้ำ': 'Separate Soup / Broth',
  'แยกน้ำแข็ง': 'Separate Ice',
  'ร้อน': 'Hot',
  'เย็น': 'Iced',
  'ปั่น': 'Frappe / Smoothie',

  // Zones
  'ในห้องแอร์': 'Indoor (Air Conditioned)',
  'รับลมด้านนอก': 'Outdoor',
  'ริมระเบียง': 'Balcony',
  'ห้องพิเศษ': 'VIP Room',
  'ชั้น 2': '2nd Floor',
  'บาร์': 'Bar Counter',
};

// Word & Prefix translation table for smart phrase generation
const COMPONENT_TRANSLATIONS: [RegExp, string][] = [
  // Actions / Cooking methods
  [/^ผัดกะเพรา/i, 'Holy Basil Stir-fry '],
  [/^ข้าวผัด/i, 'Fried Rice with '],
  [/^ต้มยำ/i, 'Tom Yum with '],
  [/^ต้มแซ่บ/i, 'Spicy Soup with '],
  [/^ต้มข่า/i, 'Coconut Soup with '],
  [/^แกงเขียวหวาน/i, 'Green Curry with '],
  [/^แกงมัสมั่น/i, 'Massaman Curry with '],
  [/^แกงส้ม/i, 'Sour Curry with '],
  [/^แกงจืด/i, 'Clear Soup with '],
  [/^ส้มตำ/i, 'Papaya Salad with '],
  [/^ยำ/i, 'Spicy Salad with '],
  [/^ลาบ/i, 'Spicy Minced '],
  [/^น้ำตก/i, 'Spicy Grilled '],
  [/^ผัด/i, 'Stir-fried '],
  [/^ทอด/i, 'Deep-fried '],
  [/^ย่าง/i, 'Grilled '],
  [/^ต้ม/i, 'Boiled '],
  [/^นึ่ง/i, 'Steamed '],
  [/^อบ/i, 'Baked '],
  [/^ลวก/i, 'Scalded '],
  [/^ข้าวหน้า/i, 'Rice topped with '],
  [/^ข้าวมัน/i, 'Oily Rice with '],
  [/^ก๋วยเตี๋ยว/i, 'Noodles with '],

  // Drinks
  [/^ชา/i, 'Tea '],
  [/^กาแฟ/i, 'Coffee '],
  [/^น้ำ/i, 'Juice '],

  // Modifiers & Additions
  [/ราดข้าว$/i, ' on Rice'],
  [/ใส่ไข่$/i, ' with Egg'],
  [/โบราณ$/i, ' (Traditional)'],
  [/น้ำข้น$/i, ' (Creamy Broth)'],
  [/น้ำใส$/i, ' (Clear Broth)'],
  [/กระเทียม$/i, ' with Garlic'],
  [/พริกเกลือ$/i, ' with Salt & Chili'],
  [/น้ำปลา$/i, ' with Fish Sauce'],
  [/พริกเผา$/i, ' with Chili Paste'],
  [/ไข่เค็ม$/i, ' with Salted Egg'],
  [/น้ำกะทิ$/i, ' in Coconut Milk'],
  [/นมสด$/i, ' with Fresh Milk'],
];

const NOUN_DICTIONARY: [RegExp, string][] = [
  [/หมูกรอบ/gi, 'Crispy Pork'],
  [/หมูสับ/gi, 'Minced Pork'],
  [/หมูแดง/gi, 'Red Pork'],
  [/หมูหมัก/gi, 'Marinated Pork'],
  [/คอหมู/gi, 'Pork Neck'],
  [/หมูสามชั้น/gi, 'Pork Belly'],
  [/หมู/gi, 'Pork'],
  [/ไก่ทอด/gi, 'Fried Chicken'],
  [/เอ็นข้อไก่/gi, 'Chicken Tendons'],
  [/ไก่/gi, 'Chicken'],
  [/เนื้อเปื่อย/gi, 'Stewed Beef'],
  [/เนื้อ/gi, 'Beef'],
  [/กุ้งแม่น้ำ/gi, 'River Prawns'],
  [/กุ้งสด/gi, 'Fresh Prawns'],
  [/กุ้ง/gi, 'Prawns'],
  [/ปลาหมึก/gi, 'Squid'],
  [/ปลากะพง/gi, 'Sea Bass'],
  [/ปลาทับทิม/gi, 'Ruby Fish'],
  [/ปลาดุก/gi, 'Catfish'],
  [/ปลาแซลมอน|แซลมอน/gi, 'Salmon'],
  [/ปลา/gi, 'Fish'],
  [/ปูม้า/gi, 'Blue Crab'],
  [/ปู/gi, 'Crab'],
  [/หอยนางรม/gi, 'Oysters'],
  [/หอยแมลงภู่/gi, 'Mussels'],
  [/หอย/gi, 'Clams'],
  [/ทะเล|ซีฟู้ด/gi, 'Seafood'],
  [/รวมมิตร/gi, 'Mixed Assorted'],
  [/ไข่ดาว/gi, 'Fried Egg'],
  [/ไข่เจียว/gi, 'Omelet'],
  [/ไข่/gi, 'Egg'],
  [/เต้าหู้/gi, 'Tofu'],
  [/เห็ด/gi, 'Mushrooms'],
  [/ผักบุ้ง/gi, 'Morning Glory'],
  [/คะน้า/gi, 'Chinese Broccoli'],
  [/กะหล่ำปลี/gi, 'Cabbage'],
  [/วุ้นเส้น/gi, 'Glass Noodles'],
  [/มาม่า/gi, 'Instant Noodles'],
  [/ข้าว/gi, 'Rice'],
  [/มะนาว/gi, 'Lime'],
  [/มะม่วง/gi, 'Mango'],
  [/แตงโม/gi, 'Watermelon'],
  [/ส้ม/gi, 'Orange'],
  [/มะพร้าว/gi, 'Coconut'],
];

/**
 * Fast synchronous offline translator for Thai to English
 */
export function translateThaiToEnglishFast(thaiText: string): string {
  if (!thaiText || !thaiText.trim()) return '';

  const clean = thaiText.trim();

  // 1. Check exact dictionary match
  if (EXACT_DICTIONARY[clean]) {
    return EXACT_DICTIONARY[clean];
  }

  // Check case without spaces or punctuation
  const normalized = clean.replace(/[\s\-_()]+/g, '');
  for (const [key, val] of Object.entries(EXACT_DICTIONARY)) {
    if (key.replace(/[\s\-_()]+/g, '') === normalized) {
      return val;
    }
  }

  // 2. Multi-component phrase decomposition
  let translated = clean;

  // Replace noun components
  for (const [pattern, englishNoun] of NOUN_DICTIONARY) {
    translated = translated.replace(pattern, ` ${englishNoun} `);
  }

  // Apply component prefixes and suffixes
  for (const [pattern, replacement] of COMPONENT_TRANSLATIONS) {
    translated = translated.replace(pattern, replacement);
  }

  // Clean up extra spaces
  translated = translated
    .replace(/\s+/g, ' ')
    .trim();

  // If the result still contains Thai characters (untranslated portion)
  const hasThai = /[\u0E00-\u0E7F]/.test(translated);
  if (!hasThai && translated.length > 0) {
    // Capitalize first letter of each word
    return translated
      .split(' ')
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ')
      .replace(/\s*\(\s*/g, ' (')
      .replace(/\s*\)\s*/g, ')')
      .trim();
  }

  // If exact match was partial, extract English words and make readable
  const englishWords = translated
    .replace(/[\u0E00-\u0E7F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (englishWords.length >= 2) {
    return englishWords
      .split(' ')
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ');
  }

  return clean;
}

/**
 * Intelligent Thai to English translation with online Google Translate fallback
 * Falls back immediately to the comprehensive local culinary dictionary if offline or unavailable.
 */
export async function translateThaiToEnglish(thaiText: string): Promise<string> {
  if (!thaiText || !thaiText.trim()) return '';

  const trimmed = thaiText.trim();

  // Check exact dictionary first (always fastest and most culinary-accurate)
  if (EXACT_DICTIONARY[trimmed]) {
    return EXACT_DICTIONARY[trimmed];
  }

  // Try online translate API with short timeout
  if (typeof window !== 'undefined' && navigator.onLine) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=th&tl=en&dt=t&q=${encodeURIComponent(
        trimmed
      )}`;

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const fullTranslation = data[0]
            .map((item: any) => item[0])
            .filter(Boolean)
            .join('')
            .trim();

          if (fullTranslation && !/[\u0E00-\u0E7F]/.test(fullTranslation)) {
            // Capitalize properly
            return fullTranslation
              .split(' ')
              .map((w: string) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
              .join(' ');
          }
        }
      }
    } catch {
      // Fallback to offline fast engine below
    }
  }

  // Local fast culinary engine
  return translateThaiToEnglishFast(trimmed);
}
