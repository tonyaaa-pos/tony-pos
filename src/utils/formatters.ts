/**
 * Thai POS Formatting Utilities
 */

export function formatBaht(amount: number, showDecimals = true): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '฿0.00';
  }
  return '฿' + amount.toLocaleString('th-TH', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
}

export function formatNumber(val: number): string {
  return (val || 0).toLocaleString('th-TH');
}

export function formatThaiDateTime(dateInput: string | Date | undefined): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';

  const day = d.getDate();
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const month = thaiMonths[d.getMonth()];
  const thaiYear = d.getFullYear() + 543;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${thaiYear} ${hours}:${minutes} น.`;
}

export function formatThaiDateOnly(dateInput: string | Date | undefined): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';

  const day = d.getDate();
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const month = thaiMonths[d.getMonth()];
  const thaiYear = d.getFullYear() + 543;
  return `${day} ${month} ${thaiYear}`;
}

export function formatThaiTimeOnly(dateInput: string | Date | undefined): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} น.`;
}

export function formatElapsedTime(startTimeIso?: string): { minutes: number; text: string } {
  if (!startTimeIso) return { minutes: 0, text: '0 นาที' };
  const start = new Date(startTimeIso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - start);
  const totalMinutes = Math.floor(diffMs / (1000 * 60));

  if (totalMinutes < 60) {
    return { minutes: totalMinutes, text: `${totalMinutes} นาที` };
  }
  const hours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  return { minutes: totalMinutes, text: `${hours} ชม. ${remainingMins} นาที` };
}
