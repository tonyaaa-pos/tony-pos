import React, { useState, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import { customerDisplayService, CustomerDisplayState } from '../../services/customerDisplayService';
import { formatBaht, formatThaiDateTime } from '../../utils/formatters';
import {
  UtensilsCrossed,
  QrCode,
  CheckCircle2,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
  Receipt,
  Store,
  ChevronRight,
  Wifi,
  Phone,
  MapPin,
} from 'lucide-react';

import imgThaiBasilPork from '../../assets/images/thai_basil_pork_1790227626595.jpg';
import imgThaiTomYum from '../../assets/images/thai_tom_yum_1790227640441.jpg';
import imgThaiPapayaSalad from '../../assets/images/thai_papaya_salad_1790227650111.jpg';
import imgThaiIcedTea from '../../assets/images/thai_iced_tea_1790227660845.jpg';
import imgThaiMangoStickyRice from '../../assets/images/thai_mango_sticky_rice_1790227672020.jpg';

const PROMO_SLIDES = [
  {
    title: 'ผัดกะเพราราดข้าว สูตรโบราณ',
    titleEn: 'Traditional Holy Basil Stir-fry',
    price: 75,
    tag: 'เมนูแนะนำยอดนิยม',
    image: imgThaiBasilPork,
    desc: 'หอมใบกะเพราแท้ รสชาติจัดจ้าน กลมกล่อมเสิร์ฟพร้อมข้าวสวยร้อนๆ',
  },
  {
    title: 'ต้มยำกุ้งน้ำข้นแม่น้ำ',
    titleEn: 'Creamy Tom Yum with River Prawns',
    price: 180,
    tag: 'สูตรต้นตำรับ',
    image: imgThaiTomYum,
    desc: 'กุ้งแม่น้ำตัวโต สมุนไพรไทยแท้ เปรี้ยวเผ็ดครบรส เข้มข้นถึงใจ',
  },
  {
    title: 'ส้มตำไทยไข่เค็มสูตรเด็ด',
    titleEn: 'Som Tum Thai with Salted Egg',
    price: 80,
    tag: 'แซ่บจัดจ้าน',
    image: imgThaiPapayaSalad,
    desc: 'เส้นมะละกอกรอบ คลุกเคล้าน้ำยำรสเด็ด ท็อปไข่เค็มมันนัว',
  },
  {
    title: 'ชาไทยเย็น หวานน้อยกลมกล่อม',
    titleEn: 'Thai Iced Tea (Original)',
    price: 55,
    tag: 'เครื่องดื่มดับกระหาย',
    image: imgThaiIcedTea,
    desc: 'ใบชาคัดพิเศษ หอมละมุน ชงสดใหม่ทุกแก้ว สูตรหวานพอดี',
  },
  {
    title: 'ข้าวเหนียวมะม่วงน้ำดอกไม้',
    titleEn: 'Mango Sticky Rice',
    price: 120,
    tag: 'ของหวานขึ้นชื่อ',
    image: imgThaiMangoStickyRice,
    desc: 'มะม่วงน้ำดอกไม้สุกหวานฉ่ำ ข้าวเหนียวมูนกะทิสด ราดกะทิเข้มข้น',
  },
];

interface CustomerDisplayViewProps {
  isPreview?: boolean;
  onClosePreview?: () => void;
}

export const CustomerDisplayView: React.FC<CustomerDisplayViewProps> = ({
  isPreview = false,
  onClosePreview,
}) => {
  const { settings, activeBill } = usePOS();
  const [displayState, setDisplayState] = useState<CustomerDisplayState>(customerDisplayService.getState());
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Subscribe to real-time customer display events
  useEffect(() => {
    return customerDisplayService.subscribe((state) => {
      setDisplayState(state);
    });
  }, []);

  // Sync with activeBill if not explicitly controlled by displayState
  const effectiveBill = displayState.bill || (activeBill && activeBill.items.length > 0 ? activeBill : null);
  const effectiveMode: CustomerDisplayState['mode'] =
    displayState.mode === 'payment'
      ? 'payment'
      : displayState.mode === 'completed'
      ? 'completed'
      : effectiveBill && effectiveBill.items.length > 0
      ? 'ordering'
      : 'idle';

  // Live Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Promo Slide Carousel (rotates every 5 seconds)
  useEffect(() => {
    const slideTimer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % PROMO_SLIDES.length);
    }, 5000);
    return () => clearInterval(slideTimer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const currentSlide = PROMO_SLIDES[currentSlideIndex];
  const items = effectiveBill?.items.filter((i) => i.status !== 'voided') || [];
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div
      className={`bg-slate-950 text-white font-sans flex flex-col select-none overflow-hidden ${
        isPreview ? 'w-full h-full rounded-2xl border border-slate-800' : 'w-screen h-screen'
      }`}
    >
      {/* Top Customer Display Header */}
      <header className="px-5 py-3 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-extrabold text-lg shadow-sm">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
              <span>{settings.shopName || 'KinD Restaurant & Cafe'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                Customer Display
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {effectiveBill?.tableName
                ? `โต๊ะ: ${effectiveBill.tableName}`
                : effectiveBill
                ? `บิล: ${effectiveBill.billNumber}`
                : 'ยินดีต้อนรับ / Welcome'}
            </p>
          </div>
        </div>

        {/* Status Mode Badge & Live Clock */}
        <div className="flex items-center gap-3">
          {effectiveMode === 'payment' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold animate-pulse">
              <QrCode className="w-3.5 h-3.5" />
              <span>รอการชำระเงิน</span>
            </div>
          ) : effectiveMode === 'completed' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>ชำระเงินสำเร็จ</span>
            </div>
          ) : effectiveMode === 'ordering' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-bold">
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>กำลังเลือกรายการอาหาร ({totalItemCount} รายการ)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>พร้อมให้บริการ</span>
            </div>
          )}

          {/* Clock */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-800/90 rounded-xl text-xs font-mono font-bold text-amber-400 border border-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTime}</span>
          </div>

          {/* Fullscreen Button (Only when not preview) */}
          {!isPreview && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="ขยายเต็มจอ (Fullscreen สำหรับจอที่ 2)"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          {/* Close Preview if in modal */}
          {isPreview && onClosePreview && (
            <button
              type="button"
              onClick={onClosePreview}
              className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          )}
        </div>
      </header>

      {/* Main Dual-Screen Content */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT COLUMN: Real-Time Order & Bill Receipt */}
        <div className="w-full md:w-1/2 lg:w-7/12 flex flex-col justify-between border-r border-slate-800/80 bg-slate-900/60 p-4 sm:p-6 min-h-0">
          {effectiveBill && items.length > 0 ? (
            <>
              {/* Order Items Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-sm text-slate-200">
                    รายการที่สั่ง (Order Details)
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  รวม {totalItemCount} จาน
                </span>
              </div>

              {/* Items List (Real-time synced as cashier taps) */}
              <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-2.5 pr-1 no-scrollbar">
                {items.map((item, idx) => (
                  <div
                    key={item.id + idx}
                    className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-3 shadow-xs hover:border-slate-600 transition animate-in fade-in"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm sm:text-base text-white truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        {item.variantName && (
                          <span className="text-amber-300 font-medium">{item.variantName}</span>
                        )}
                        <span>฿{item.price.toFixed(2)}</span>
                      </div>
                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <div className="text-[11px] text-slate-400 mt-1">
                          {item.selectedOptions.map((o) => `+${o.choiceName}`).join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Qty Badge & Line Total */}
                    <div className="text-right shrink-0">
                      <div className="inline-block px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-extrabold text-xs mb-1">
                        x {item.quantity}
                      </div>
                      <div className="font-mono font-bold text-sm sm:text-base text-white">
                        {formatBaht(item.price * item.quantity)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Totals Box */}
              <div className="pt-3 border-t border-slate-800 shrink-0 space-y-2">
                <div className="space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>ยอดรวมสินค้า (Subtotal):</span>
                    <span className="font-mono">{formatBaht(effectiveBill.subtotal)}</span>
                  </div>
                  {effectiveBill.discountAmount > 0 && (
                    <div className="flex justify-between text-rose-400">
                      <span>ส่วนลด (Discount):</span>
                      <span className="font-mono">-{formatBaht(effectiveBill.discountAmount)}</span>
                    </div>
                  )}
                  {effectiveBill.serviceChargeAmount > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>เซอร์วิสชาร์จ (Service Charge):</span>
                      <span className="font-mono">+{formatBaht(effectiveBill.serviceChargeAmount)}</span>
                    </div>
                  )}
                  {effectiveBill.vatAmount > 0 && (
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>VAT {effectiveBill.vatRate}% ({effectiveBill.vatIncluded ? 'รวมในราคาแล้ว' : 'แยกต่างหาก'}):</span>
                      <span className="font-mono">{formatBaht(effectiveBill.vatAmount)}</span>
                    </div>
                  )}
                </div>

                {/* Grand Total Banner */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-transparent border border-amber-500/40 flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase font-extrabold text-amber-300 tracking-wider block">
                      ยอดชำระสุทธิ (Grand Total)
                    </span>
                    <span className="text-[11px] text-slate-400">ราคาสุทธิที่ต้องชำระ</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400 tracking-tight">
                    {formatBaht(effectiveBill.grandTotal)}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Idle / Waiting for Order state on Left */
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-20 h-20 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-amber-400">
                <UtensilsCrossed className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">ยินดีต้อนรับสู่ร้าน</h3>
                <h2 className="text-2xl font-extrabold text-amber-400">
                  {settings.shopName || 'KinD Restaurant & Cafe'}
                </h2>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2">
                  พนักงานกำลังเตรียมรับออเดอร์ของท่าน รายการอาหารและยอดเงินจะแสดงที่หน้านี้โดยอัตโนมัติ
                </p>
              </div>

              {/* Shop contact info pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] text-slate-400">
                {settings.phone && (
                  <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-amber-400" />
                    <span>{settings.phone}</span>
                  </span>
                )}
                {settings.address && (
                  <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    <span className="max-w-[200px] truncate">{settings.address}</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Payment QR / Food Showcase / Success State */}
        <div className="w-full md:w-1/2 lg:w-5/12 flex flex-col justify-center items-center bg-slate-950 p-6 relative overflow-hidden">
          {/* State 1: Active Payment (PromptPay QR Code Display) */}
          {effectiveMode === 'payment' ? (
            <div className="w-full max-w-sm flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="space-y-1">
                <span className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-extrabold tracking-wide uppercase inline-flex items-center gap-1.5 shadow-sm">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>สแกน QR เพื่อชำระเงิน</span>
                </span>
                <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                  {formatBaht(effectiveBill?.grandTotal || 0)}
                </div>
              </div>

              {/* Big High-Resolution QR Container */}
              <div className="p-4 bg-white rounded-3xl shadow-2xl border-4 border-amber-400/80 flex flex-col items-center justify-center">
                {displayState.qrImageData ? (
                  <img
                    src={displayState.qrImageData}
                    alt={displayState.qrLabel || 'PromptPay QR'}
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-600 bg-slate-50 rounded-xl p-4">
                    <QrCode className="w-20 h-20 text-slate-400 mb-2" />
                    <span className="text-xs font-bold text-center">พร้อมเพย์ PromptPay</span>
                    <span className="text-[10px] text-slate-400 text-center mt-1">
                      กำลังโหลดข้อมูล QR ชำระเงิน...
                    </span>
                  </div>
                )}
                <span className="text-xs font-extrabold text-slate-900 mt-2">
                  {displayState.qrLabel || 'พร้อมเพย์ (PromptPay)'}
                </span>
                <span className="text-[10px] text-slate-500">
                  สแกนจ่ายผ่าน Mobile Banking ได้ทุกธนาคาร
                </span>
              </div>

              {/* Cash payment info if paid in cash */}
              {displayState.cashReceived !== undefined && (
                <div className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs flex justify-around">
                  <div>
                    <span className="text-slate-400 block text-[10px]">รับเงินสด:</span>
                    <span className="font-mono font-bold text-white">
                      ฿{displayState.cashReceived.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">เงินทอน:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      ฿{(displayState.change || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : effectiveMode === 'completed' ? (
            /* State 2: Payment Completed Celebration */
            <div className="w-full max-w-sm flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-300">
              <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-xl">
                <CheckCircle2 className="w-14 h-14" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white">ชำระเงินเรียบร้อยแล้ว</h3>
                <p className="text-sm text-emerald-400 font-bold">
                  ขอบพระคุณที่มาอุดหนุน KinD Restaurant
                </p>
                <p className="text-xs text-slate-400">
                  โอกาสหน้าเชิญใหม่นะคะ / Thank you for visiting!
                </p>
              </div>

              {displayState.change !== undefined && displayState.change > 0 && (
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center w-full">
                  <span className="text-xs text-slate-400 block">เงินทอนของท่าน:</span>
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    ฿{displayState.change.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* State 3: Promotional Showcase Slide & Food Carousel */
            <div className="w-full h-full flex flex-col justify-between p-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-2 pt-2">
                <span className="flex items-center gap-1 font-bold text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>เมนูแนะนำพิเศษของร้าน</span>
                </span>
                <span className="text-[11px] font-mono">
                  {currentSlideIndex + 1} / {PROMO_SLIDES.length}
                </span>
              </div>

              {/* Slide Card */}
              <div className="flex-1 flex flex-col justify-center items-center p-3 sm:p-4 text-center space-y-3">
                <div className="relative w-48 h-48 sm:w-60 sm:h-60 rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-700/60 group">
                  <img
                    src={currentSlide.image}
                    alt={currentSlide.title}
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                  <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] shadow-md">
                    {currentSlide.tag}
                  </div>
                  <div className="absolute bottom-2 right-2 px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-xs text-amber-400 font-mono font-extrabold text-sm shadow-md">
                    ฿{currentSlide.price}
                  </div>
                </div>

                <div className="space-y-1 max-w-xs">
                  <h4 className="font-extrabold text-base text-white">{currentSlide.title}</h4>
                  <div className="text-[11px] text-slate-400">{currentSlide.titleEn}</div>
                  <p className="text-xs text-slate-400 leading-snug pt-1">{currentSlide.desc}</p>
                </div>

                {/* Carousel Dots */}
                <div className="flex items-center gap-1.5 pt-2">
                  {PROMO_SLIDES.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentSlideIndex(i)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        currentSlideIndex === i ? 'w-6 bg-amber-400' : 'w-2 bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Bottom Customer Service info */}
              <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-[11px] text-slate-400">
                หากต้องการปรับแต่งรสชาติ หรือแพ้อาหาร แจ้งพนักงานได้ทันทีค่ะ
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
