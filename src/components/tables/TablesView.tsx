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
} from 'lucide-react';
import { formatBaht, formatElapsedTime } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { ReservationModal } from './ReservationModal';
import { TableDetailModal } from './TableDetailModal';
import { PaymentModal } from '../pos/PaymentModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ZoneBar } from '../common/ZoneBar';

export const getDefaultTableDimensions = (shape: TableShape = 'square') => {
  switch (shape) {
    case 'round':
      return { width: 112, height: 112 };
    case 'rectangle':
      return { width: 180, height: 112 };
    case 'counter':
      return { width: 220, height: 80 };
    case 'standalone_chair':
      return { width: 56, height: 56 };
    case 'square':
    default:
      return { width: 112, height: 112 };
  }
};

export const DEFAULT_CHAIR_SIZE = 20;

export const TablesView: React.FC = () => {
  const {
    tables,
    bills,
    openTable,
    reserveTable,
    setActiveNav,
    setActiveBillId,
    updateTablePosition,
    addTable,
    updateTable,
    deleteTable,
    selectedZone,
    setSelectedZone,
  } = usePOS();

  const [isEditLayout, setIsEditLayout] = useState<boolean>(false);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);

  // Modals
  const [showOpenModal, setShowOpenModal] = useState<Table | null>(null);
  const [guestCountInput, setGuestCountInput] = useState<number>(2);
  const [showReserveModal, setShowReserveModal] = useState<Table | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<Table | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<Table | null>(null);

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

  // Quick stats summary
  const availableCount = tables.filter((t) => t.status === 'available').length;
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;
  const pendingCount = tables.filter((t) => t.status === 'payment_pending').length;
  const reservedCount = tables.filter((t) => t.status === 'reserved').length;

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

    if (table.status === 'available') {
      setGuestCountInput(Math.min(2, table.capacity));
      setShowOpenModal(table);
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

  const handleOpenAddTableModal = (standaloneChair = false) => {
    setEditingTable(null);
    const shape: TableShape = standaloneChair ? 'standalone_chair' : 'square';
    const defaults = getDefaultTableDimensions(shape);

    if (standaloneChair) {
      setTableFormNumber(`C${currentZoneTables.length + 1}`);
      setTableFormCapacity(1);
      setTableFormShape('standalone_chair');
      setTableFormChairStyle('stool');
      setTableFormChairSize(24);
    } else {
      setTableFormNumber(`T${tables.length + 1}`);
      setTableFormCapacity(4);
      setTableFormShape('square');
      setTableFormChairStyle('standard');
      setTableFormChairSize(DEFAULT_CHAIR_SIZE);
    }
    setTableFormWidth(defaults.width);
    setTableFormHeight(defaults.height);
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
    setTableFormChairSize(table.chairSize || DEFAULT_CHAIR_SIZE);
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

  // Helper to render chairs around table with custom dimensions and chair sizes
  const renderChairs = (table: Table) => {
    const shape = table.shape || (table.isStandaloneChair ? 'standalone_chair' : 'square');
    const chairStyle = table.chairStyle || 'standard';
    const seats = table.capacity || 2;
    const defaults = getDefaultTableDimensions(shape);
    const tableW = table.width || defaults.width;
    const tableH = table.height || defaults.height;
    const chairSize = table.chairSize || DEFAULT_CHAIR_SIZE;

    if (shape === 'standalone_chair') return null;

    const getChairElement = (key: string, customClass = '') => {
      const isSofa = chairStyle === 'sofa';
      const w = isSofa ? Math.round(chairSize * 1.6) : chairSize;
      const h = chairSize;

      if (chairStyle === 'stool') {
        return (
          <div
            key={key}
            style={{ width: `${w}px`, height: `${h}px` }}
            className={`rounded-full bg-slate-300 dark:bg-slate-700 border border-slate-400 dark:border-slate-500 shadow-2xs ${customClass}`}
          />
        );
      }
      if (chairStyle === 'sofa') {
        return (
          <div
            key={key}
            style={{ width: `${w}px`, height: `${h}px` }}
            className={`rounded-md bg-indigo-200 dark:bg-indigo-950 border border-indigo-400 dark:border-indigo-600 shadow-2xs ${customClass}`}
          />
        );
      }
      return (
        <div
          key={key}
          style={{ width: `${w}px`, height: `${h}px` }}
          className={`rounded-md bg-amber-100 dark:bg-amber-950 border border-amber-600/40 shadow-2xs flex items-center justify-center text-[8px] text-amber-900 dark:text-amber-300 font-semibold ${customClass}`}
        />
      );
    };

    const chairs: React.ReactNode[] = [];
    const chairOffset = Math.round(chairSize * 0.7);

    if (shape === 'round') {
      const radius = (Math.min(tableW, tableH) / 2) + (chairSize / 2) + 2;
      const angleStep = (2 * Math.PI) / seats;
      for (let i = 0; i < seats; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = Math.round(radius * Math.cos(angle));
        const y = Math.round(radius * Math.sin(angle));
        chairs.push(
          <div
            key={`chair-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
          >
            {getChairElement(`chair-item-${i}`)}
          </div>
        );
      }
      return chairs;
    }

    if (shape === 'counter') {
      for (let i = 0; i < seats; i++) {
        const leftPercent = ((i + 1) / (seats + 1)) * 100;
        chairs.push(
          <div
            key={`counter-chair-${i}`}
            className="absolute -translate-x-1/2 pointer-events-none"
            style={{ left: `${leftPercent}%`, bottom: `-${chairOffset}px` }}
          >
            {getChairElement(`c-${i}`)}
          </div>
        );
      }
      return chairs;
    }

    if (shape === 'rectangle') {
      const topBottomCount = Math.max(1, Math.floor((seats - 2) / 2));
      for (let i = 0; i < topBottomCount; i++) {
        const leftP = ((i + 1) / (topBottomCount + 1)) * 100;
        chairs.push(
          <div
            key={`rect-top-${i}`}
            className="absolute -translate-x-1/2 pointer-events-none"
            style={{ left: `${leftP}%`, top: `-${chairOffset}px` }}
          >
            {getChairElement(`rt-${i}`)}
          </div>
        );
        chairs.push(
          <div
            key={`rect-bot-${i}`}
            className="absolute -translate-x-1/2 pointer-events-none"
            style={{ left: `${leftP}%`, bottom: `-${chairOffset}px` }}
          >
            {getChairElement(`rb-${i}`)}
          </div>
        );
      }
      chairs.push(
        <div
          key="rect-left"
          className="absolute -translate-y-1/2 pointer-events-none"
          style={{ left: `-${chairOffset}px`, top: '50%' }}
        >
          {getChairElement('rl')}
        </div>
      );
      chairs.push(
        <div
          key="rect-right"
          className="absolute -translate-y-1/2 pointer-events-none"
          style={{ right: `-${chairOffset}px`, top: '50%' }}
        >
          {getChairElement('rr')}
        </div>
      );
      return chairs;
    }

    // Square table
    if (seats >= 1) {
      chairs.push(
        <div
          key="sq-top"
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ top: `-${chairOffset}px` }}
        >
          {getChairElement('st')}
        </div>
      );
    }
    if (seats >= 2) {
      chairs.push(
        <div
          key="sq-bot"
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ bottom: `-${chairOffset}px` }}
        >
          {getChairElement('sb')}
        </div>
      );
    }
    if (seats >= 3) {
      chairs.push(
        <div
          key="sq-left"
          className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `-${chairOffset}px` }}
        >
          {getChairElement('sl')}
        </div>
      );
    }
    if (seats >= 4) {
      chairs.push(
        <div
          key="sq-right"
          className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ right: `-${chairOffset}px` }}
        >
          {getChairElement('sr')}
        </div>
      );
    }
    return chairs;
  };

  const handleDeleteTablePrompt = (table: Table, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTableToDelete(table);
  };

  return (
    <div className="p-3 sm:p-5 md:p-6 space-y-4 max-w-7xl mx-auto pb-32">
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Zone Selector Tabs */}
        <div className="flex-1 min-w-0">
          <ZoneBar />
        </div>

        {/* Status Indicators */}
        <div className="flex items-center flex-wrap gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>ว่าง ({availableCount})</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>มีลูกค้า ({occupiedCount})</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>รอเช็คบิล ({pendingCount})</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>จอง ({reservedCount})</span>
          </div>
        </div>

        {/* Edit Layout Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsEditLayout(!isEditLayout);
              setActiveTableId(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
              isEditLayout
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/50'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
            }`}
          >
            {isEditLayout ? <Check className="w-4 h-4" /> : <Move className="w-4 h-4" />}
            <span>{isEditLayout ? 'เสร็จสิ้นการจัดผัง' : 'แก้ไขผังร้าน'}</span>
          </button>
        </div>
      </div>

      {/* Edit Mode Toolbar */}
      {isEditLayout && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>โหมดแก้ไขผัง: ลากย้ายตำแหน่ง, ดึงมุมขวาล่างหรือกดปุ่มเพื่อปรับขนาดโต๊ะและเก้าอี้</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoGrid}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>จัดเรียงระเบียบ</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddTableModal(true)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Armchair className="w-3.5 h-3.5 text-indigo-500" />
              <span>+ เพิ่มเก้าอี้เดี่ยว</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddTableModal(false)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-600 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
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
        className={`relative w-full h-[640px] rounded-3xl border transition select-none overflow-hidden ${
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
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-xs hover:bg-amber-600 transition"
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
            if (shape === 'round') {
              radiusClass = 'rounded-full';
            } else if (shape === 'counter' || shape === 'standalone_chair') {
              radiusClass = 'rounded-xl';
            }

            // Status Styling
            let statusClass = 'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200';
            if (table.status === 'occupied') {
              statusClass = 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/20';
            } else if (table.status === 'payment_pending') {
              statusClass = 'border-rose-500 bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/20';
            } else if (table.status === 'reserved') {
              statusClass = 'border-sky-500 bg-sky-500 text-white shadow-md shadow-sky-500/20';
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
                  isEditLayout ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer hover:scale-105 active:scale-95'
                }`}
              >
                {/* Visual Chairs positioned around the table perimeter */}
                {renderChairs(table)}

                {/* The Table Surface Card */}
                <div
                  style={{
                    width: `${tableW}px`,
                    height: `${tableH}px`,
                  }}
                  className={`relative ${radiusClass} border-2 flex flex-col items-center justify-center p-2 text-center transition-all ${statusClass} ${
                    isSelected && isEditLayout ? 'ring-4 ring-amber-400 ring-offset-2' : ''
                  }`}
                >
                  {/* Standalone Chair simple rendering */}
                  {shape === 'standalone_chair' ? (
                    <div className="flex flex-col items-center justify-center w-full h-full">
                      <Armchair className="w-5 h-5 mb-0.5" />
                      <span className="text-[10px] font-bold">{table.number}</span>
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

                    {/* Table Size Step +/- */}
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

                    {/* Chair Size Step +/- (for non-standalone chairs) */}
                    {shape !== 'standalone_chair' && (
                      <div className="flex items-center bg-white/10 rounded-xl px-1.5 py-0.5 gap-1 text-[11px] font-bold">
                        <span className="opacity-70 text-[10px]">เก้าอี้:</span>
                        <button
                          type="button"
                          onClick={(e) => handleQuickResizeChair(table, -3, e)}
                          className="w-5 h-5 flex items-center justify-center hover:bg-white/20 rounded-lg cursor-pointer text-sky-300"
                          title="ลดขนาดเก้าอี้"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleQuickResizeChair(table, 3, e)}
                          className="w-5 h-5 flex items-center justify-center hover:bg-white/20 rounded-lg cursor-pointer text-sky-300"
                          title="เพิ่มขนาดเก้าอี้"
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
          onOpenPOS={() => {
            if (showDetailModal.currentBillId) {
              setActiveBillId(showDetailModal.currentBillId);
              setActiveNav('pos');
            }
          }}
          onOpenPayment={() => {
            setShowDetailModal(null);
            setShowPaymentModal(showDetailModal);
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

      {/* Modal: Add / Edit Table with Size and Chair Size Customization */}
      {isTableModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsTableModalOpen(false)}
          title={editingTable ? `แก้ไข ${editingTable.number}` : 'เพิ่มโต๊ะในผังร้าน'}
        >
          <form onSubmit={handleSaveTableForm} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  หมายเลข/ชื่อโต๊ะ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={tableFormNumber}
                  onChange={(e) => setTableFormNumber(e.target.value)}
                  placeholder="เช่น A1, T02"
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

            {/* Seat Count and Chair Style */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  จำนวนที่นั่ง
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  รูปแบบเก้าอี้
                </label>
                <select
                  value={tableFormChairStyle}
                  onChange={(e) => setTableFormChairStyle(e.target.value as ChairStyle)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                >
                  <option value="standard">เก้าอี้มาตรฐาน (Standard)</option>
                  <option value="stool">เก้าอี้สตูลกลม (Stool)</option>
                  <option value="sofa">โซฟา / เบาะยาว (Sofa)</option>
                </select>
              </div>
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
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{tableFormWidth}px</span>
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
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{tableFormHeight}px</span>
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

            {/* Chair Size Adjustment Section */}
            {tableFormShape !== 'standalone_chair' && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white">
                    ขนาดของเก้าอี้
                  </label>
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                    {tableFormChairSize} px
                  </span>
                </div>

                {/* Quick Chair Presets */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'เล็ก (16px)', size: 16 },
                    { label: 'ปกติ (20px)', size: 20 },
                    { label: 'ใหญ่ (26px)', size: 26 },
                    { label: 'ใหญ่มาก (32px)', size: 32 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setTableFormChairSize(preset.size)}
                      className={`py-1 px-1 text-[11px] rounded-lg border font-medium transition cursor-pointer ${
                        tableFormChairSize === preset.size
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-600 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Slider for Chair Size */}
                <input
                  type="range"
                  min="14"
                  max="38"
                  step="1"
                  value={tableFormChairSize}
                  onChange={(e) => setTableFormChairSize(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            )}

            {/* Live Visual Preview of Table & Chairs */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                ตัวอย่างขนาดโต๊ะและเก้าอี้ (Live Preview)
              </div>
              <div className="h-44 w-full flex items-center justify-center relative overflow-hidden">
                <div className="relative">
                  {renderChairs({
                    id: 'preview',
                    number: tableFormNumber || 'T1',
                    zone: tableFormZone,
                    capacity: Number(tableFormCapacity),
                    status: 'available',
                    shape: tableFormShape,
                    chairStyle: tableFormChairStyle,
                    width: tableFormWidth,
                    height: tableFormHeight,
                    chairSize: tableFormChairSize,
                  })}
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
                    } border-2 border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 flex flex-col items-center justify-center p-2 text-center shadow-sm`}
                  >
                    <div className="text-xs font-bold leading-tight">
                      {tableFormNumber || 'T1'}
                    </div>
                    <div className="text-[10px] opacity-75 font-semibold">
                      {tableFormCapacity} ที่นั่ง
                    </div>
                  </div>
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
                {editingTable ? 'บันทึกการแก้ไข' : 'เพิ่มโต๊ะในผัง'}
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
