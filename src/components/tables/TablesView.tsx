import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePOS } from '../../context/POSContext';
import { Table, TableShape, ChairStyle, ReservationInfo } from '../../types';
import {
  Users,
  Clock,
  BookmarkCheck,
  RotateCw,
  Trash2,
  Edit3,
  Check,
  Move,
  Receipt,
  Armchair,
  Grid,
  Plus,
  Minus,
  Maximize2,
  ArrowRightLeft,
  Merge,
} from 'lucide-react';
import { formatBaht, formatElapsedTime } from '../../utils/formatters';
import { soundService } from '../../utils/audio';
import { Modal } from '../common/Modal';
import { ReservationModal } from './ReservationModal';
import { TableDetailModal } from './TableDetailModal';
import { PaymentModal } from '../pos/PaymentModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ZoneBar } from '../common/ZoneBar';
import { isTableWithCustomers, canPay, PayBlockReason } from '../../utils/orderRules';
import { UnsavedItemsPaymentDialog } from '../pos/UnsavedItemsPaymentDialog';
import { useLanguage } from '../../context/LanguageContext';

export const getDefaultTableDimensions = (shape: TableShape = 'square') => {
  switch (shape) {
    case 'round':
      return { width: 112, height: 112 };
    case 'rectangle':
      return { width: 180, height: 112 };
    case 'counter':
      return { width: 220, height: 80 };
    case 'standalone_chair':
      return { width: 48, height: 48 };
    case 'square':
    default:
      return { width: 112, height: 112 };
  }
};

export const CHAIR_SIZE_OPTIONS = [
  { id: 'small', label: 'ขนาดเล็ก (Small)', size: 36, desc: '36x36 px' },
  { id: 'medium', label: 'ขนาดกลาง (Medium)', size: 48, desc: '48x48 px' },
  { id: 'large', label: 'ขนาดใหญ่ (Large)', size: 60, desc: '60x60 px' },
] as const;

export const CHAIR_STYLE_OPTIONS: { id: ChairStyle; label: string; icon: string }[] = [
  { id: 'standard', label: 'เก้าอี้มาตรฐาน (Standard)', icon: '🪑' },
  { id: 'sofa', label: 'โซฟา / อาร์มแชร์ (Sofa)', icon: '🛋️' },
  { id: 'stool', label: 'สตูลกลม (Round Stool)', icon: '⭕' },
  { id: 'bar_stool', label: 'บาร์สตูลสูง (High Bar Stool)', icon: '🍸' },
  { id: 'wood', label: 'เก้าอี้ไม้คาเฟ่ (Wooden Chair)', icon: '🪵' },
];

export const DEFAULT_CHAIR_SIZE = 20;

export const TablesView: React.FC = () => {
  const {
    tables,
    bills,
    openTable,
    moveTable,
    mergeTables,
    reserveTable,
    setActiveNav,
    setActiveBillId,
    updateTablePosition,
    addTable,
    updateTable,
    deleteTable,
    selectedZone,
    setSelectedZone,
    confirmOrder,
    setActiveCategory,
  } = usePOS();
  const { t } = useLanguage();

  const [isEditLayout, setIsEditLayout] = useState<boolean>(false);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);

  // Interactive Table Move & Merge mode directly on Floor Plan
  const [movingSourceTable, setMovingSourceTable] = useState<Table | null>(null);
  const [mergingSourceTable, setMergingSourceTable] = useState<Table | null>(null);
  const [moveFeedback, setMoveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [showOpenModal, setShowOpenModal] = useState<Table | null>(null);
  const [guestCountInput, setGuestCountInput] = useState<number>(2);
  const [showReserveModal, setShowReserveModal] = useState<Table | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<Table | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<Table | null>(null);

  // Payment blocked dialog
  const [showBlockedPayDialog, setShowBlockedPayDialog] = useState<boolean>(false);
  const [payBlockReason, setPayBlockReason] = useState<PayBlockReason>('unsaved_items');
  const [tableForBlockedPay, setTableForBlockedPay] = useState<Table | null>(null);

  // Table add/edit modal
  const [isTableModalOpen, setIsTableModalOpen] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [tableFormNumber, setTableFormNumber] = useState<string>('');
  const [tableFormZone, setTableFormZone] = useState<string>('indoor');
  const [tableFormCapacity, setTableFormCapacity] = useState<number>(4);
  const [tableFormShape, setTableFormShape] = useState<TableShape>('square');
  const [tableFormChairStyle, setTableFormChairStyle] = useState<ChairStyle>('standard');
  const [tableFormWidth, setTableFormWidth] = useState<number>(112);
  const [tableFormHeight, setTableFormHeight] = useState<number>(112);
  const [tableFormChairSize, setTableFormChairSize] = useState<number>(DEFAULT_CHAIR_SIZE);

  // Delete table confirmation dialog
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);

  // Dragging state
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartPos = useRef<{
    pointerX: number;
    pointerY: number;
    itemX: number;
    itemY: number;
  }>({
    pointerX: 0,
    pointerY: 0,
    itemX: 0,
    itemY: 0,
  });

  // Corner resize dragging state
  const [resizingTableId, setResizingTableId] = useState<string | null>(null);
  const resizeStartRef = useRef<{
    startX: number;
    startY: number;
    initialWidth: number;
    initialHeight: number;
    shape: TableShape;
  }>({
    startX: 0,
    startY: 0,
    initialWidth: 112,
    initialHeight: 112,
    shape: 'square',
  });

  const currentZoneTables =
    selectedZone === 'all'
      ? tables
      : tables.filter((t) => t.zone === selectedZone);

  const handlePointerDown = (e: React.PointerEvent, table: Table) => {
    if (!isEditLayout) return;
    if (resizingTableId) return;

    setActiveTableId(table.id);
    setDraggingId(table.id);

    dragStartPos.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      itemX: table.x || 60,
      itemY: table.y || 60,
    };

    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isEditLayout || !draggingId || !canvasRef.current) return;
    const dx = e.clientX - dragStartPos.current.pointerX;
    const dy = e.clientY - dragStartPos.current.pointerY;

    const bounds = canvasRef.current.getBoundingClientRect();
    const maxX = Math.max(bounds.width - 140, 200);
    const maxY = Math.max(bounds.height - 140, 300);

    const newX = Math.min(Math.max(15, dragStartPos.current.itemX + dx), maxX);
    const newY = Math.min(Math.max(15, dragStartPos.current.itemY + dy), maxY);

    updateTablePosition(draggingId, newX, newY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isEditLayout || !draggingId) return;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
    setDraggingId(null);
  };

  // Corner resize handlers
  const handleResizePointerDown = (e: React.PointerEvent, table: Table) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const shape = table.shape || (table.isStandaloneChair ? 'standalone_chair' : 'square');
    const defaults = getDefaultTableDimensions(shape);

    setResizingTableId(table.id);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialWidth: table.width || defaults.width,
      initialHeight: table.height || defaults.height,
      shape,
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizingTableId) return;
    const { startX, startY, initialWidth, initialHeight, shape } = resizeStartRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    let newWidth = Math.max(64, Math.min(420, Math.round(initialWidth + deltaX)));
    let newHeight = Math.max(50, Math.min(320, Math.round(initialHeight + deltaY)));

    if (shape === 'square' || shape === 'round') {
      const avg = Math.round((newWidth + newHeight) / 2);
      newWidth = avg;
      newHeight = avg;
    }

    updateTable(resizingTableId, { width: newWidth, height: newHeight });
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (resizingTableId) {
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
      setResizingTableId(null);
    }
  };

  const handleTableClick = (table: Table) => {
    if (isEditLayout) {
      setActiveTableId(table.id);
      return;
    }

    // Floor plan interactive table move mode
    if (movingSourceTable) {
      if (table.id === movingSourceTable.id) {
        return;
      }

      if (table.status !== 'available') {
        soundService.playTap();
        setMoveFeedback({
          type: 'error',
          message: `โต๊ะ ${table.number} ไม่ว่าง (สามารถย้ายไปเฉพาะโต๊ะที่ว่างได้เท่านั้น)`,
        });
        setTimeout(() => setMoveFeedback(null), 3000);
        return;
      }

      const fromNumber = movingSourceTable.number;
      const toNumber = table.number;
      const success = moveTable(movingSourceTable.id, table.id);

      if (success) {
        soundService.playSuccessTap();
        setMovingSourceTable(null);
        setMoveFeedback({
          type: 'success',
          message: `ย้ายข้อมูลและบิลทั้งหมดจากโต๊ะ ${fromNumber} ไปยังโต๊ะ ${toNumber} สำเร็จเรียบร้อยแล้ว`,
        });
        setTimeout(() => setMoveFeedback(null), 4000);
      } else {
        setMoveFeedback({
          type: 'error',
          message: 'ไม่สามารถย้ายโต๊ะได้ กรุณาลองใหม่อีกครั้ง',
        });
        setTimeout(() => setMoveFeedback(null), 3500);
      }
      return;
    }

    // Floor plan interactive table merge mode
    if (mergingSourceTable) {
      if (table.id === mergingSourceTable.id) {
        return;
      }

      const hasCustomers = isTableWithCustomers(table, bills) || table.status === 'occupied' || Boolean(table.currentBillId);

      if (!hasCustomers) {
        soundService.playTap();
        setMoveFeedback({
          type: 'error',
          message: `โต๊ะ ${table.number} เป็นโต๊ะว่าง (สามารถรวมได้เฉพาะโต๊ะที่มีลูกค้า/ออเดอร์เปิดอยู่เท่านั้น)`,
        });
        setTimeout(() => setMoveFeedback(null), 3000);
        return;
      }

      const fromNumber = table.number;
      const toNumber = mergingSourceTable.number;
      const success = mergeTables([table.id], mergingSourceTable.id);

      if (success) {
        soundService.playSuccessTap();
        setMergingSourceTable(null);
        setMoveFeedback({
          type: 'success',
          message: `รวมรายการอาหารและบิลจากโต๊ะ ${fromNumber} เข้ากับโต๊ะ ${toNumber} สำเร็จเรียบร้อยแล้ว`,
        });
        setTimeout(() => setMoveFeedback(null), 4000);
      } else {
        setMoveFeedback({
          type: 'error',
          message: 'ไม่สามารถรวมโต๊ะได้ กรุณาลองใหม่อีกครั้ง',
        });
        setTimeout(() => setMoveFeedback(null), 3500);
      }
      return;
    }

    if (table.status === 'available') {
      const defaultGuests = table.capacity || 2;
      const billId = openTable(table.id, defaultGuests);
      setActiveBillId(billId);
      setActiveCategory('all');
      setActiveNav('pos');
      soundService.playTap();
      return;
    } else {
      setShowDetailModal(table);
    }
  };

  const handleRotate = (table: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentRot = table.rotation || 0;
    const nextRot = (currentRot + 90) % 360;
    updateTablePosition(table.id, table.x || 60, table.y || 60, nextRot);
  };

  // Quick Table Resize +/-
  const handleQuickResizeTable = (table: Table, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const shape = table.shape || (table.isStandaloneChair ? 'standalone_chair' : 'square');
    const defaults = getDefaultTableDimensions(shape);
    const currentW = table.width || defaults.width;
    const currentH = table.height || defaults.height;
    const isSquareOrRound = shape === 'square' || shape === 'round';

    const newW = Math.max(64, Math.min(380, currentW + delta));
    const newH = isSquareOrRound
      ? newW
      : Math.max(50, Math.min(300, currentH + Math.round(delta * (currentH / currentW))));

    updateTable(table.id, { width: newW, height: newH });
  };

  // Quick Chair Resize +/-
  const handleQuickResizeChair = (table: Table, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentChair = table.chairSize || DEFAULT_CHAIR_SIZE;
    const newSize = Math.max(14, Math.min(38, currentChair + delta));
    updateTable(table.id, { chairSize: newSize });
  };

  const handleOpenAddTableModal = (
    standaloneChair = false,
    chairSizeKey: 'small' | 'medium' | 'large' = 'medium',
    defaultChairStyle: ChairStyle = 'standard'
  ) => {
    setEditingTable(null);
    const shape: TableShape = standaloneChair ? 'standalone_chair' : 'square';
    const defaults = getDefaultTableDimensions(shape);

    if (standaloneChair) {
      const chosenSize = CHAIR_SIZE_OPTIONS.find((s) => s.id === chairSizeKey)?.size || 48;
      setTableFormNumber(`C${tables.filter((t) => t.isStandaloneChair || t.shape === 'standalone_chair').length + 1}`);
      setTableFormCapacity(1);
      setTableFormShape('standalone_chair');
      setTableFormChairStyle(defaultChairStyle);
      setTableFormChairSize(chosenSize);
      setTableFormWidth(chosenSize);
      setTableFormHeight(chosenSize);
    } else {
      setTableFormNumber(`T${tables.filter((t) => !t.isStandaloneChair && t.shape !== 'standalone_chair').length + 1}`);
      setTableFormCapacity(4);
      setTableFormShape('square');
      setTableFormChairStyle('standard');
      setTableFormChairSize(DEFAULT_CHAIR_SIZE);
      setTableFormWidth(defaults.width);
      setTableFormHeight(defaults.height);
    }
    setTableFormZone(selectedZone === 'all' ? 'indoor' : selectedZone);
    setIsTableModalOpen(true);
  };

  const handleOpenEditTableModal = (table: Table, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shape = table.shape || (table.isStandaloneChair ? 'standalone_chair' : 'square');
    const defaults = getDefaultTableDimensions(shape);

    setEditingTable(table);
    setTableFormNumber(table.number);
    setTableFormZone(table.zone);
    setTableFormCapacity(table.capacity);
    setTableFormShape(shape);
    setTableFormChairStyle(table.chairStyle || 'standard');
    setTableFormWidth(table.width || defaults.width);
    setTableFormHeight(table.height || defaults.height);
    setTableFormChairSize(table.chairSize || (shape === 'standalone_chair' ? (table.width || 48) : DEFAULT_CHAIR_SIZE));
    setIsTableModalOpen(true);
  };

  const handleShapeChangeInModal = (newShape: TableShape) => {
    setTableFormShape(newShape);
    const defaults = getDefaultTableDimensions(newShape);
    setTableFormWidth(defaults.width);
    setTableFormHeight(defaults.height);
  };

  const handleSaveTableForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableFormNumber.trim()) return;

    if (editingTable) {
      updateTable(editingTable.id, {
        number: tableFormNumber.trim(),
        zone: tableFormZone,
        capacity: Number(tableFormCapacity),
        shape: tableFormShape,
        chairStyle: tableFormChairStyle,
        width: tableFormWidth,
        height: tableFormHeight,
        chairSize: tableFormChairSize,
        isStandaloneChair: tableFormShape === 'standalone_chair',
      });
    } else {
      const count = currentZoneTables.length;
      const col = count % 3;
      const row = Math.floor(count / 3);
      addTable({
        number: tableFormNumber.trim(),
        zone: tableFormZone,
        capacity: Number(tableFormCapacity),
        shape: tableFormShape,
        chairStyle: tableFormChairStyle,
        width: tableFormWidth,
        height: tableFormHeight,
        chairSize: tableFormChairSize,
        isStandaloneChair: tableFormShape === 'standalone_chair',
        x: 60 + col * 220,
        y: 60 + row * 160,
        rotation: 0,
      });
    }

    setIsTableModalOpen(false);
  };

  const handleAutoGrid = () => {
    currentZoneTables.forEach((tbl, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      updateTablePosition(tbl.id, 60 + col * 230, 60 + row * 180, 0);
    });
  };

  const handleConfirmOpenTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showOpenModal) return;

    const billId = openTable(showOpenModal.id, Number(guestCountInput) || 2);
    setActiveBillId(billId);
    setShowOpenModal(null);
    setActiveCategory('all');
    setActiveNav('pos');
  };

  const handleSaveReservation = (res: ReservationInfo) => {
    if (showReserveModal) {
      reserveTable(showReserveModal.id, res);
      setShowReserveModal(null);
    }
  };

  const getTableBill = (table: Table) => {
    if (!table.currentBillId) return null;
    return bills.find((b) => b.id === table.currentBillId) || null;
  };

  // Helper to render chairs around table - per user requirement: tables created must NOT have chairs around them
  const renderChairs = (_table: Table) => {
    return null;
  };

  const handleDeleteTablePrompt = (table: Table, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTableToDelete(table);
  };

  return (
    <div className="p-3 sm:p-5 md:p-6 space-y-4 max-w-7xl mx-auto pb-32">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Zone Selector Tabs */}
        <div className="flex-1 min-w-0">
          <ZoneBar />
        </div>

        {/* Edit Layout Mode Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsEditLayout(!isEditLayout);
              setActiveTableId(null);
              setMovingSourceTable(null);
              setMergingSourceTable(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
              isEditLayout
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/50'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
            }`}
          >
            {isEditLayout ? <Check className="w-4 h-4" /> : <Move className="w-4 h-4" />}
            <span>{isEditLayout ? (t('table_finish_edit') || 'เสร็จสิ้นการจัดผัง') : (t('table_edit_layout') || 'แก้ไขผังร้าน')}</span>
          </button>
        </div>
      </div>

      {/* Interactive Table Move Banner on Floor Plan */}
      {movingSourceTable && (
        <div className="p-4 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 rounded-2xl shadow-lg border-2 border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-950 text-amber-400 shadow-sm">
              <ArrowRightLeft className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-900/80">
                โหมดย้ายโต๊ะ (แตะเลือกโต๊ะว่างปลายทางบนผังด้านล่าง)
              </div>
              <div className="text-sm font-black">
                กำลังย้ายจาก: <span className="underline decoration-2 underline-offset-2">โต๊ะ {movingSourceTable.number}</span> → แตะเลือกโต๊ะว่าง (กรอบเขียว) ที่ต้องการย้ายไป
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMovingSourceTable(null)}
            className="px-4 py-2 rounded-xl bg-slate-950 text-white hover:bg-slate-900 text-xs font-bold shadow-xs transition cursor-pointer self-start sm:self-auto shrink-0"
          >
            ยกเลิกการย้ายโต๊ะ
          </button>
        </div>
      )}

      {/* Interactive Table Merge Banner on Floor Plan */}
      {mergingSourceTable && (
        <div className="p-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white rounded-2xl shadow-lg border-2 border-purple-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white text-purple-700 shadow-sm">
              <Merge className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-purple-200">
                โหมดรวมโต๊ะ (แตะเลือกอีกโต๊ะหนึ่งบนผังด้านล่างเพื่อรวม)
              </div>
              <div className="text-sm font-black">
                โต๊ะหลัก: <span className="underline decoration-2 underline-offset-2">โต๊ะ {mergingSourceTable.number}</span> ← แตะเลือกโต๊ะที่มีลูกค้าที่ต้องการรวมเข้ามา
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMergingSourceTable(null)}
            className="px-4 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-950 text-white text-xs font-bold shadow-xs transition cursor-pointer self-start sm:self-auto shrink-0 border border-purple-300/40"
          >
            ยกเลิกการรวมโต๊ะ
          </button>
        </div>
      )}

      {/* Move Feedback Notification */}
      {moveFeedback && (
        <div
          className={`p-3 rounded-2xl shadow-md flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            moveFeedback.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <Check className="w-4 h-4" />
            <span>{moveFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setMoveFeedback(null)}
            className="text-white/80 hover:text-white text-xs font-semibold cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {/* Edit Mode Toolbar */}
      {isEditLayout && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>โหมดแก้ไขผัง: ลากย้ายตำแหน่ง, ดึงมุมขวาล่างหรือกดปุ่มเพื่อปรับขนาดโต๊ะและเก้าอี้</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAutoGrid}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>จัดเรียงระเบียบ</span>
            </button>

            {/* Quick Chair Add Options with Small, Medium, Large sizes */}
            <div className="flex items-center bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900 rounded-xl p-0.5 gap-0.5 shadow-2xs">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 px-1.5 flex items-center gap-1">
                <Armchair className="w-3.5 h-3.5" />
                <span>เก้าอี้:</span>
              </span>
              <button
                type="button"
                onClick={() => handleOpenAddTableModal(true, 'small')}
                className="px-2 py-1 rounded-lg text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-700 dark:text-indigo-300 transition cursor-pointer"
                title="เพิ่มเก้าอี้ขนาดเล็ก (36x36px)"
              >
                + เล็ก (36px)
              </button>
              <button
                type="button"
                onClick={() => handleOpenAddTableModal(true, 'medium')}
                className="px-2 py-1 rounded-lg text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-700 dark:text-indigo-300 transition cursor-pointer"
                title="เพิ่มเก้าอี้ขนาดกลาง (48x48px)"
              >
                + กลาง (48px)
              </button>
              <button
                type="button"
                onClick={() => handleOpenAddTableModal(true, 'large')}
                className="px-2 py-1 rounded-lg text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-700 dark:text-indigo-300 transition cursor-pointer"
                title="เพิ่มเก้าอี้ขนาดใหญ่ (60x60px)"
              >
                + ใหญ่ (60px)
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleOpenAddTableModal(false)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-600 transition flex items-center gap-1.5 cursor-pointer shadow-xs text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ เพิ่มโต๊ะใหม่</span>
            </button>
          </div>
        </div>
      )}

      {/* Interactive Free-form Floor Plan Canvas */}
      <div
        ref={canvasRef}
        onPointerMove={(e) => {
          if (resizingTableId) {
            handleResizePointerMove(e);
          } else {
            handlePointerMove(e);
          }
        }}
        onPointerUp={(e) => {
          if (resizingTableId) {
            handleResizePointerUp(e);
          }
          handlePointerUp(e);
        }}
        className={`relative w-full h-[670px] lg:h-[720px] rounded-3xl border transition select-none overflow-hidden ${
          isEditLayout
            ? 'border-amber-400/80 bg-slate-50 dark:bg-slate-950 shadow-inner'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-md'
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(148, 163, 184, 0.22) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {currentZoneTables.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
            <Armchair className="w-12 h-12 text-slate-300 dark:text-slate-700" />
            <div className="text-sm font-semibold">ยังไม่มีโต๊ะในโซนนี้</div>
            <button
              type="button"
              onClick={() => handleOpenAddTableModal(false)}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-xs hover:bg-amber-600 transition cursor-pointer"
            >
              + เพิ่มโต๊ะแรกในโซนนี้
            </button>
          </div>
        ) : (
          currentZoneTables.map((table) => {
            const bill = getTableBill(table);
            const isSelected = activeTableId === table.id;
            const shape = table.shape || (table.isStandaloneChair ? 'standalone_chair' : 'square');
            const defaults = getDefaultTableDimensions(shape);
            const tableW = table.width || defaults.width;
            const tableH = table.height || defaults.height;

            let radiusClass = 'rounded-2xl';
            if (shape === 'round' || (shape === 'standalone_chair' && (table.chairStyle === 'stool' || table.chairStyle === 'bar_stool'))) {
              radiusClass = 'rounded-full';
            } else if (shape === 'counter' || shape === 'standalone_chair') {
              radiusClass = 'rounded-xl';
            }

            // Status Styling: Table border colors according to status
            // - Available (free) table: dark green border (#047857), 3px thick
            // - Table with customers (Occupied or Waiting for payment): red border (#dc2626), 3px thick
            // - Reserved tables keep blue look
            const withCustomers = isTableWithCustomers(table, bills);

            const isMoveSource = movingSourceTable?.id === table.id;
            const isMoveTarget = Boolean(movingSourceTable && table.status === 'available');
            const isMoveBlocked = Boolean(movingSourceTable && !isMoveSource && table.status !== 'available');

            const isMergeSource = mergingSourceTable?.id === table.id;
            const isMergeTarget = Boolean(
              mergingSourceTable &&
                !isMergeSource &&
                (withCustomers || table.status === 'occupied' || Boolean(table.currentBillId))
            );
            const isMergeBlocked = Boolean(mergingSourceTable && !isMergeSource && !isMergeTarget);

            let statusClass = 'border-[3px] border-[#047857] dark:border-[#10b981] bg-emerald-500/10 text-emerald-950 dark:text-emerald-200';
            if (table.status === 'reserved') {
              statusClass = 'border-[3px] border-sky-500 bg-sky-500 text-white shadow-md shadow-sky-500/20';
            } else if (withCustomers) {
              if (table.status === 'payment_pending') {
                statusClass = 'border-[3px] border-[#dc2626] dark:border-[#ef4444] bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/20';
              } else {
                statusClass = 'border-[3px] border-[#dc2626] dark:border-[#ef4444] bg-amber-500 text-white shadow-md shadow-amber-500/20';
              }
            }

            if (isMoveSource) {
              statusClass = 'border-[3px] border-amber-500 bg-amber-500 text-slate-950 ring-4 ring-amber-400 ring-offset-2 animate-pulse shadow-xl shadow-amber-500/30';
            } else if (isMoveTarget) {
              statusClass = 'border-[3px] border-emerald-500 bg-emerald-500/25 text-emerald-950 dark:text-emerald-100 ring-4 ring-emerald-400 ring-offset-2 shadow-xl shadow-emerald-500/40 animate-pulse';
            } else if (isMoveBlocked) {
              statusClass = 'opacity-35 grayscale border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed';
            } else if (isMergeSource) {
              statusClass = 'border-[3px] border-purple-500 bg-purple-600 text-white ring-4 ring-purple-400 ring-offset-2 animate-pulse shadow-xl shadow-purple-500/40';
            } else if (isMergeTarget) {
              statusClass = 'border-[3px] border-indigo-500 bg-indigo-500/25 text-indigo-950 dark:text-indigo-100 ring-4 ring-indigo-400 ring-offset-2 shadow-xl shadow-indigo-500/40 animate-pulse cursor-pointer';
            } else if (isMergeBlocked) {
              statusClass = 'opacity-35 grayscale border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed';
            }

            return (
              <div
                key={table.id}
                onPointerDown={(e) => handlePointerDown(e, table)}
                onClick={() => handleTableClick(table)}
                style={{
                  left: `${table.x ?? 60}px`,
                  top: `${table.y ?? 60}px`,
                  transform: `rotate(${table.rotation || 0}deg)`,
                  touchAction: 'none',
                }}
                className={`absolute z-10 transition-shadow ${
                  isEditLayout
                    ? 'cursor-grab active:cursor-grabbing'
                    : isMoveTarget
                    ? 'cursor-pointer hover:scale-110 active:scale-95 z-20'
                    : isMoveBlocked
                    ? 'cursor-not-allowed'
                    : 'cursor-pointer hover:scale-105 active:scale-95'
                }`}
              >
                {/* Visual Chairs positioned around the table perimeter (tables have no surrounding chairs) */}
                {renderChairs(table)}

                {/* The Table / Chair Surface Card */}
                <div
                  style={{
                    width: `${tableW}px`,
                    height: `${tableH}px`,
                  }}
                  className={`relative ${radiusClass} flex flex-col items-center justify-center p-1.5 text-center transition-all ${statusClass} ${
                    isSelected && isEditLayout ? 'ring-4 ring-amber-400 ring-offset-2' : ''
                  }`}
                >
                  {/* Standalone Chair rendering based on style */}
                  {shape === 'standalone_chair' ? (
                    <div className="flex flex-col items-center justify-center w-full h-full select-none pointer-events-none">
                      {table.chairStyle === 'stool' ? (
                        <div className="w-full h-full rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 border-2 border-dashed border-emerald-600/70 flex flex-col items-center justify-center shadow-xs">
                          <span className="text-[10px] font-black leading-none">{table.number}</span>
                          <span className="text-[8px] opacity-75 font-semibold">สตูล</span>
                        </div>
                      ) : table.chairStyle === 'sofa' ? (
                        <div className="w-full h-full rounded-xl bg-indigo-500/20 dark:bg-indigo-500/30 border-2 border-indigo-600/70 flex flex-col items-center justify-center shadow-xs">
                          <span className="text-[10px] font-black leading-none">{table.number}</span>
                          <span className="text-[8px] opacity-75 font-semibold">โซฟา</span>
                        </div>
                      ) : table.chairStyle === 'bar_stool' ? (
                        <div className="w-full h-full rounded-full bg-purple-500/20 dark:bg-purple-500/30 border-2 border-purple-600/70 flex flex-col items-center justify-center shadow-xs">
                          <span className="text-[10px] font-black leading-none">{table.number}</span>
                          <span className="text-[8px] opacity-75 font-semibold">บาร์</span>
                        </div>
                      ) : table.chairStyle === 'wood' ? (
                        <div className="w-full h-full rounded-lg bg-amber-800/20 dark:bg-amber-800/30 border-2 border-amber-800/70 flex flex-col items-center justify-center shadow-xs">
                          <span className="text-[10px] font-black leading-none">{table.number}</span>
                          <span className="text-[8px] opacity-75 font-semibold">ไม้</span>
                        </div>
                      ) : (
                        <div className="w-full h-full rounded-xl bg-amber-500/20 dark:bg-amber-500/30 border-2 border-amber-600/70 flex flex-col items-center justify-center shadow-xs">
                          <Armchair className="w-3.5 h-3.5 mb-0.5 opacity-80" />
                          <span className="text-[10px] font-black leading-none">{table.number}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Top Bar inside table: Reservation badge or Capacity */}
                      {table.status === 'reserved' ? (
                        <div className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                          <BookmarkCheck className="w-3 h-3" />
                          <span>จองแล้ว</span>
                        </div>
                      ) : (
                        <div className="text-[10px] opacity-85 font-semibold leading-tight">
                          {table.capacity} ที่นั่ง
                        </div>
                      )}

                      {/* Table Number */}
                      <div className="text-base font-black tracking-tight leading-tight">
                        {table.number}
                      </div>

                      {/* Bottom Info: Seated Time or Bill Grand Total */}
                      {table.status === 'occupied' && bill ? (
                        <div className="mt-0.5 leading-tight">
                          <div className="text-[11px] font-bold tabular-nums">
                            {formatBaht(bill.grandTotal)}
                          </div>
                          {table.seatedAt && (
                            <div className="text-[9px] opacity-85 flex items-center justify-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{formatElapsedTime(table.seatedAt).text}</span>
                            </div>
                          )}
                        </div>
                      ) : table.status === 'payment_pending' && bill ? (
                        <div className="mt-0.5 leading-tight">
                          <div className="text-[10px] font-bold">รอเช็คบิล</div>
                          <div className="text-[11px] font-extrabold tabular-nums">
                            {formatBaht(bill.grandTotal)}
                          </div>
                        </div>
                      ) : table.status === 'reserved' && table.reservation ? (
                        <div className="text-[10px] truncate max-w-[90%] font-medium">
                          {table.reservation.customerName} ({table.reservation.reservedTime})
                        </div>
                      ) : isMoveSource ? (
                        <div className="text-[10px] font-black text-slate-950 bg-amber-300 px-1.5 py-0.5 rounded shadow-xs">
                          โต๊ะต้นทาง
                        </div>
                      ) : isMoveTarget ? (
                        <div className="text-[10px] font-black text-emerald-950 dark:text-emerald-100 bg-emerald-300 dark:bg-emerald-800 px-1.5 py-0.5 rounded shadow-xs">
                          แตะเลือกย้ายมาที่นี่
                        </div>
                      ) : (
                        <div className="text-[10px] font-medium opacity-75">
                          {isEditLayout ? 'จัดวาง' : 'แตะเพื่อเปิด'}
                        </div>
                      )}
                    </>
                  )}

                  {/* Corner Resize Drag Handle (Shown when table is selected in Edit mode) */}
                  {isEditLayout && isSelected && (
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, table)}
                      className="absolute -bottom-2 -right-2 w-5 h-5 bg-amber-500 hover:bg-amber-600 border-2 border-white dark:border-slate-900 rounded-full cursor-nwse-resize z-20 flex items-center justify-center shadow-md active:scale-110 transition"
                      title="ลากเพื่อปรับขนาดโต๊ะ"
                    >
                      <Maximize2 className="w-2.5 h-2.5 text-slate-950" />
                    </div>
                  )}
                </div>

                {/* Edit Controls Tooltip (Shown when Table is Selected in Edit Layout Mode) */}
                {isEditLayout && isSelected && (
                  <div
                    className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-xs text-white px-2 py-1 rounded-2xl shadow-2xl z-30 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Rotate */}
                    <button
                      type="button"
                      onClick={(e) => handleRotate(table, e)}
                      className="p-1.5 hover:bg-white/20 rounded-xl transition cursor-pointer"
                      title="หมุน 90 องศา"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                    </button>

                    {/* Table / Chair Size Controls in Tooltip */}
                    {shape === 'standalone_chair' ? (
                      <div className="flex items-center bg-white/10 rounded-xl px-2 py-0.5 gap-1.5 text-[11px] font-bold">
                        <span className="opacity-70 text-[10px]">ขนาด:</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTable(table.id, { width: 36, height: 36, chairSize: 36 });
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition ${
                            table.width === 36 ? 'bg-amber-500 text-slate-950 font-black' : 'hover:bg-white/20 text-slate-200'
                          }`}
                          title="ขนาดเล็ก (36px)"
                        >
                          เล็ก
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTable(table.id, { width: 48, height: 48, chairSize: 48 });
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition ${
                            table.width === 48 || !table.width ? 'bg-amber-500 text-slate-950 font-black' : 'hover:bg-white/20 text-slate-200'
                          }`}
                          title="ขนาดกลาง (48px)"
                        >
                          กลาง
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTable(table.id, { width: 60, height: 60, chairSize: 60 });
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition ${
                            table.width === 60 ? 'bg-amber-500 text-slate-950 font-black' : 'hover:bg-white/20 text-slate-200'
                          }`}
                          title="ขนาดใหญ่ (60px)"
                        >
                          ใหญ่
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center bg-white/10 rounded-xl px-1.5 py-0.5 gap-1 text-[11px] font-bold">
                        <span className="opacity-70 text-[10px]">โต๊ะ:</span>
                        <button
                          type="button"
                          onClick={(e) => handleQuickResizeTable(table, -16, e)}
                          className="w-5 h-5 flex items-center justify-center hover:bg-white/20 rounded-lg cursor-pointer text-amber-300"
                          title="ลดขนาดโต๊ะ"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleQuickResizeTable(table, 16, e)}
                          className="w-5 h-5 flex items-center justify-center hover:bg-white/20 rounded-lg cursor-pointer text-amber-300"
                          title="เพิ่มขนาดโต๊ะ"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Edit Details (opens full modal with sliders) */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditTableModal(table, e)}
                      className="p-1.5 hover:bg-white/20 rounded-xl transition cursor-pointer"
                      title="แก้ไขรายละเอียด & ขนาดละเอียด"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteTablePrompt(table, e)}
                      className="p-1.5 hover:bg-white/20 rounded-xl transition cursor-pointer"
                      title="ลบโต๊ะ"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Open Table */}
      {showOpenModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowOpenModal(null)}
          title={`เปิดโต๊ะ ${showOpenModal.number}`}
        >
          <form onSubmit={handleConfirmOpenTable} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                จำนวนลูกค้า (ท่าน)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="40"
                  required
                  value={guestCountInput}
                  onChange={(e) => setGuestCountInput(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {[1, 2, 4, 6, 8].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setGuestCountInput(cnt)}
                    className="flex-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowOpenModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs"
              >
                เปิดโต๊ะและเริ่มสั่งอาหาร
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Reservation */}
      {showReserveModal && (
        <ReservationModal
          isOpen={true}
          tableNumber={showReserveModal.number}
          defaultCapacity={showReserveModal.capacity}
          onClose={() => setShowReserveModal(null)}
          onSaveReservation={handleSaveReservation}
        />
      )}

      {/* Modal: Table Details (Occupied, Bills, Move, Merge) */}
      {showDetailModal && (
        <TableDetailModal
          isOpen={true}
          table={showDetailModal}
          bill={getTableBill(showDetailModal)}
          onClose={() => setShowDetailModal(null)}
          onStartMoveTable={(tbl) => {
            setMovingSourceTable(tbl);
            setMergingSourceTable(null);
          }}
          onStartMergeTable={(tbl) => {
            setMergingSourceTable(tbl);
            setMovingSourceTable(null);
          }}
          onOpenPOS={() => {
            let billId = showDetailModal.currentBillId;
            if (!billId) {
              billId = openTable(
                showDetailModal.id,
                showDetailModal.guestCount || showDetailModal.capacity || 2
              );
            }
            setActiveBillId(billId);
            setActiveCategory('all');
            setActiveNav('pos');
          }}
          onOpenPayment={() => {
            const tableToPay = showDetailModal;
            setShowDetailModal(null);
            if (tableToPay) {
              const check = canPay(tableToPay, bills);
              if (!check.allowed) {
                setPayBlockReason(check.reason || 'unsaved_items');
                setTableForBlockedPay(tableToPay);
                setShowBlockedPayDialog(true);
                return;
              }
              setShowPaymentModal(tableToPay);
            }
          }}
        />
      )}

      {/* Blocked payment modal */}
      {showBlockedPayDialog && (
        <UnsavedItemsPaymentDialog
          isOpen={true}
          onClose={() => {
            setShowBlockedPayDialog(false);
            setTableForBlockedPay(null);
          }}
          reason={payBlockReason}
          onSaveAndGoToFloorPlan={() => {
            if (tableForBlockedPay?.currentBillId) {
              confirmOrder(tableForBlockedPay.currentBillId);
            }
            setShowBlockedPayDialog(false);
            setTableForBlockedPay(null);
          }}
        />
      )}

      {/* Modal: Payment directly from Table view */}
      {showPaymentModal && showPaymentModal.currentBillId && (
        <PaymentModal
          isOpen={true}
          bill={bills.find((b) => b.id === showPaymentModal.currentBillId)!}
          onClose={() => setShowPaymentModal(null)}
        />
      )}

      {/* Modal: Add / Edit Table or Chair with Size and Style Customization */}
      {isTableModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsTableModalOpen(false)}
          title={
            editingTable
              ? editingTable.shape === 'standalone_chair' || editingTable.isStandaloneChair
                ? `แก้ไขเก้าอี้ ${editingTable.number}`
                : `แก้ไขโต๊ะ ${editingTable.number}`
              : tableFormShape === 'standalone_chair'
              ? 'เพิ่มเก้าอี้ในผังร้าน'
              : 'เพิ่มโต๊ะในผังร้าน'
          }
        >
          <form onSubmit={handleSaveTableForm} className="space-y-4">
            {/* Type Switcher when adding new item: Table vs Chair */}
            {!editingTable && (
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setTableFormShape('square');
                    const d = getDefaultTableDimensions('square');
                    setTableFormWidth(d.width);
                    setTableFormHeight(d.height);
                    setTableFormCapacity(4);
                    setTableFormNumber(
                      `T${tables.filter((t) => !t.isStandaloneChair && t.shape !== 'standalone_chair').length + 1}`
                    );
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    tableFormShape !== 'standalone_chair'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>🍽️ โต๊ะอาหาร (Table)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTableFormShape('standalone_chair');
                    setTableFormChairStyle('standard');
                    setTableFormWidth(48);
                    setTableFormHeight(48);
                    setTableFormChairSize(48);
                    setTableFormCapacity(1);
                    setTableFormNumber(
                      `C${tables.filter((t) => t.isStandaloneChair || t.shape === 'standalone_chair').length + 1}`
                    );
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    tableFormShape === 'standalone_chair'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>🪑 เก้าอี้ (Chair)</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {tableFormShape === 'standalone_chair' ? 'หมายเลข/ชื่อเก้าอี้' : 'หมายเลข/ชื่อโต๊ะ'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={tableFormNumber}
                  onChange={(e) => setTableFormNumber(e.target.value)}
                  placeholder={tableFormShape === 'standalone_chair' ? 'เช่น C1, C02' : 'เช่น A1, T02'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  โซนที่ตั้ง
                </label>
                <select
                  value={tableFormZone}
                  onChange={(e) => setTableFormZone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                >
                  <option value="indoor">ในห้องแอร์ (Indoor)</option>
                  <option value="outdoor">รับลมด้านนอก (Outdoor)</option>
                  <option value="vip">ห้องพิเศษ (VIP)</option>
                </select>
              </div>
            </div>

            {/* If TABLE: Show table shapes & dimensions (NO chairs around table) */}
            {tableFormShape !== 'standalone_chair' ? (
              <>
                {/* Table Shape Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    รูปทรงโต๊ะ
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'square', label: 'สี่เหลี่ยม' },
                      { id: 'round', label: 'ทรงกลม' },
                      { id: 'rectangle', label: 'สี่เหลี่ยมยาว' },
                      { id: 'counter', label: 'เคาน์เตอร์บาร์' },
                    ].map((shp) => (
                      <button
                        key={shp.id}
                        type="button"
                        onClick={() => handleShapeChangeInModal(shp.id as TableShape)}
                        className={`py-2 px-1 text-center rounded-xl border text-xs font-semibold transition cursor-pointer ${
                          tableFormShape === shp.id
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-1 ring-amber-400'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {shp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Seat Capacity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    จำนวนที่นั่ง (ความจุ)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={tableFormCapacity}
                    onChange={(e) => setTableFormCapacity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>

                {/* Table Dimensions Adjustment Section */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>ขนาดของโต๊ะ</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                      {tableFormWidth} x {tableFormHeight} px
                    </span>
                  </div>

                  {/* Quick Scale Presets */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'กะทัดรัด (85%)', scale: 0.85 },
                      { label: 'ปกติ (100%)', scale: 1.0 },
                      { label: 'ใหญ่ (120%)', scale: 1.2 },
                      { label: 'ใหญ่พิเศษ (140%)', scale: 1.4 },
                    ].map((preset) => {
                      const defaults = getDefaultTableDimensions(tableFormShape);
                      const targetW = Math.round(defaults.width * preset.scale);
                      const isCurrent = Math.abs(tableFormWidth - targetW) <= 4;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setTableFormWidth(Math.round(defaults.width * preset.scale));
                            setTableFormHeight(Math.round(defaults.height * preset.scale));
                          }}
                          className={`py-1 px-1 text-[11px] rounded-lg border font-medium transition cursor-pointer ${
                            isCurrent
                              ? 'bg-amber-500 text-slate-950 font-bold border-amber-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Width and Height Sliders */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>ความกว้าง</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {tableFormWidth}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="64"
                        max="340"
                        step="4"
                        value={tableFormWidth}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setTableFormWidth(val);
                          if (tableFormShape === 'square' || tableFormShape === 'round') {
                            setTableFormHeight(val);
                          }
                        }}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>ความยาว / สูง</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {tableFormHeight}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="280"
                        step="4"
                        disabled={tableFormShape === 'square' || tableFormShape === 'round'}
                        value={tableFormHeight}
                        onChange={(e) => setTableFormHeight(Number(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  </div>
                </div>

                {/* Table's Assigned Chair Style and Size Options (Small, Medium, Large) */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Armchair className="w-4 h-4 text-indigo-500" />
                      <span>ตัวเลือกเก้าอี้ของโต๊ะ (หลายแบบ & 3 ขนาด)</span>
                    </label>
                  </div>

                  {/* Chair Styles */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      รูปแบบเก้าอี้
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {CHAIR_STYLE_OPTIONS.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setTableFormChairStyle(st.id)}
                          className={`p-2 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 text-left ${
                            tableFormChairStyle === st.id
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-1 ring-amber-400 font-bold'
                              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="text-base leading-none">{st.icon}</span>
                          <span className="truncate">{st.label.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3 Size Presets: Small (36px), Medium (48px), Large (60px) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      ขนาดเก้าอี้ (เล็ก / กลาง / ใหญ่)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {CHAIR_SIZE_OPTIONS.map((opt) => {
                        const isCurrent = tableFormChairSize === opt.size;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setTableFormChairSize(opt.size)}
                            className={`py-2 px-2 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                              isCurrent
                                ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400/50 shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span>{opt.label.split(' ')[0]}</span>
                            <span className="text-[10px] opacity-75 font-normal">{opt.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* If CHAIR: Show chair styles & size options (Small, Medium, Large) */
              <>
                {/* Chair Styles Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    รูปแบบเก้าอี้ (Chair Style)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CHAIR_STYLE_OPTIONS.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setTableFormChairStyle(st.id)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-2 text-left ${
                          tableFormChairStyle === st.id
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/50 font-bold'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-lg leading-none">{st.icon}</span>
                        <span className="truncate">{st.label.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chair Sizes Selection (Small, Medium, Large) */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Armchair className="w-4 h-4 text-indigo-500" />
                      <span>ตัวเลือกขนาดเก้าอี้ (Chair Size)</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                      {tableFormWidth} x {tableFormHeight} px
                    </span>
                  </div>

                  {/* 3 Size Presets: Small, Medium, Large */}
                  <div className="grid grid-cols-3 gap-2">
                    {CHAIR_SIZE_OPTIONS.map((opt) => {
                      const isCurrent = tableFormWidth === opt.size;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setTableFormWidth(opt.size);
                            setTableFormHeight(opt.size);
                            setTableFormChairSize(opt.size);
                          }}
                          className={`py-2 px-2 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                            isCurrent
                              ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400/50 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{opt.label.split(' ')[0]}</span>
                          <span className="text-[10px] opacity-75 font-normal">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Fine Size Slider */}
                  <div className="pt-1">
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>ปรับขนาดละเอียด</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {tableFormWidth} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="28"
                      max="84"
                      step="2"
                      value={tableFormWidth}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTableFormWidth(val);
                        setTableFormHeight(val);
                        setTableFormChairSize(val);
                      }}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Live Visual Preview */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                {tableFormShape === 'standalone_chair'
                  ? 'ตัวอย่างขนาดและรูปแบบเก้าอี้ (Live Preview)'
                  : 'ตัวอย่างขนาดโต๊ะ (Live Preview - ไม่มีเก้าอี้รอบโต๊ะ)'}
              </div>
              <div className="h-44 w-full flex items-center justify-center relative overflow-hidden">
                <div className="relative">
                  {tableFormShape === 'standalone_chair' ? (
                    <div
                      style={{ width: `${tableFormWidth}px`, height: `${tableFormHeight}px` }}
                      className={`border-2 border-emerald-500 flex flex-col items-center justify-center shadow-md transition-all ${
                        tableFormChairStyle === 'stool' || tableFormChairStyle === 'bar_stool'
                          ? 'rounded-full bg-emerald-500/20'
                          : tableFormChairStyle === 'sofa'
                          ? 'rounded-xl bg-indigo-500/20 border-indigo-500'
                          : tableFormChairStyle === 'wood'
                          ? 'rounded-lg bg-amber-800/20 border-amber-800'
                          : 'rounded-xl bg-amber-500/20 border-amber-500'
                      }`}
                    >
                      <span className="text-[11px] font-black leading-none">{tableFormNumber || 'C1'}</span>
                      <span className="text-[8px] opacity-75 font-semibold mt-0.5">
                        {CHAIR_STYLE_OPTIONS.find((s) => s.id === tableFormChairStyle)?.label.split(' ')[0] || 'เก้าอี้'}
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        width: `${tableFormWidth}px`,
                        height: `${tableFormHeight}px`,
                      }}
                      className={`relative ${
                        tableFormShape === 'round'
                          ? 'rounded-full'
                          : tableFormShape === 'counter'
                          ? 'rounded-xl'
                          : 'rounded-2xl'
                      } border-[3px] border-[#047857] bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 flex flex-col items-center justify-center p-2 text-center shadow-sm`}
                    >
                      <div className="text-base font-black leading-tight">
                        {tableFormNumber || 'T1'}
                      </div>
                      <div className="text-[10px] opacity-80 font-bold mt-0.5">
                        {tableFormCapacity} ที่นั่ง
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsTableModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs cursor-pointer"
              >
                {editingTable
                  ? 'บันทึกการแก้ไข'
                  : tableFormShape === 'standalone_chair'
                  ? 'เพิ่มเก้าอี้ในผัง'
                  : 'เพิ่มโต๊ะในผัง'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmation Dialog: Delete Table */}
      {tableToDelete && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setTableToDelete(null)}
          onConfirm={() => {
            deleteTable(tableToDelete.id);
            setTableToDelete(null);
            if (activeTableId === tableToDelete.id) {
              setActiveTableId(null);
            }
          }}
          title="ยืนยันการลบโต๊ะ"
          message={`ต้องการลบ ${tableToDelete.number} ออกจากผังร้านใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
        />
      )}
    </div>
  );
};
