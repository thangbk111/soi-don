'use client';

import {
  addMonthsYmd,
  type DateRange,
  formatYmd,
  MAX_RANGE_MONTHS,
  presetRange,
  RANGE_PRESETS,
  type RangePresetKey,
  rangeDays,
  todayVn,
  validateRange,
} from '@soi-don/shared';
import { io } from 'next/cache';
import { use, useEffect, useRef, useState } from 'react';

/* Lịch làm việc trên chuỗi "YYYY-MM-DD" theo lịch VN, nên không bị lệch múi giờ của trình duyệt. */

interface YearMonth {
  y: number;
  m: number; // 1..12
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const ymOf = (s: string): YearMonth => ({ y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)) });
const ymIndex = ({ y, m }: YearMonth) => y * 12 + m - 1;
const addYm = (ym: YearMonth, n: number): YearMonth => {
  const t = ymIndex(ym) + n;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
};

/** Các ô của một tháng, tuần bắt đầu từ thứ Hai; null = ô trống. */
function monthCells({ y, m }: YearMonth): (string | null)[] {
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(ymd(y, m, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function formatRange(r: DateRange) {
  return r.from === r.to ? formatYmd(r.from) : `${formatYmd(r.from)} – ${formatYmd(r.to)}`;
}

function matchingPreset(r: DateRange, presets: typeof RANGE_PRESETS) {
  return presets.find((p) => {
    const pr = presetRange(p.key);
    return pr.from === r.from && pr.to === r.to;
  });
}

/** Tháng hiển thị bên trái khi mở: tháng của ngày bắt đầu, hoặc tháng trước ngày cuối nếu khoảng dài. */
function initialView(r: DateRange): YearMonth {
  const from = ymOf(r.from);
  const to = ymOf(r.to);
  return ymIndex(to) - ymIndex(from) <= 1 ? from : addYm(to, -1);
}

interface Draft {
  from: string;
  to: string | null; // null = đang chờ chọn ngày cuối
}

export function RangePicker({
  value,
  onChange,
  disabled,
  align = 'right',
  presetKeys,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  disabled?: boolean;
  /** Canh bảng lịch theo mép nào của nút (desktop). Mobile luôn canh trái. */
  align?: 'left' | 'right';
  /** Các nút chọn nhanh hiển thị; mặc định tất cả. */
  presetKeys?: RangePresetKey[];
}) {
  // Đọc ngày hôm nay → không được đóng băng vào HTML prerender (Next 16, xem docs `io`).
  use(io());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(value);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState<YearMonth>(() => initialView(value));
  const rootRef = useRef<HTMLDivElement>(null);

  const today = todayVn();
  const minDate = addMonthsYmd(today, -MAX_RANGE_MONTHS);
  const presets = presetKeys
    ? RANGE_PRESETS.filter((p) => presetKeys.includes(p.key))
    : RANGE_PRESETS;
  const preset = matchingPreset(value, presets);

  // Đóng khi bấm ra ngoài hoặc nhấn Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      setDraft(value);
      setHover(null);
      setView(initialView(value));
    }
    setOpen(!open);
  }

  function pickDay(d: string) {
    // Đang chờ ngày cuối và bấm ngày sau ngày đầu → chốt khoảng; còn lại → bắt đầu khoảng mới.
    if (draft.to === null && d >= draft.from) setDraft({ from: draft.from, to: d });
    else setDraft({ from: d, to: null });
  }

  function applyPreset(r: DateRange) {
    onChange(r);
    setOpen(false);
  }

  const complete: DateRange | null = draft.to ? { from: draft.from, to: draft.to } : null;
  const error = complete ? validateRange(complete) : null;
  // Khi đang chọn ngày cuối, rê chuột để xem trước khoảng.
  const previewEnd = draft.to ?? (hover && hover >= draft.from ? hover : null);

  const todayYm = ymOf(today);
  const canPrev = ymIndex(view) > ymIndex(ymOf(minDate));
  const canNext = ymIndex(view) < ymIndex(todayYm);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex max-w-full items-center gap-2 whitespace-nowrap rounded-lg border border-stone-300 px-3 py-2 text-sm hover:border-stone-500 disabled:opacity-50 dark:border-stone-700 dark:hover:border-stone-500"
      >
        <CalendarIcon />
        {preset && <span className="font-semibold">{preset.label}</span>}
        {/* Mobile: có nút nhanh khớp thì chỉ hiện tên nút cho gọn. */}
        <span
          className={`tabular-nums text-stone-600 dark:text-stone-300 ${preset ? 'hidden sm:inline' : ''}`}
        >
          {formatRange(value)}
        </span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-stone-400" fill="currentColor" aria-hidden>
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        // Mobile: nền tối phía sau bottom sheet; bấm vào để đóng.
        <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setOpen(false)} />
      )}
      {open && (
        <div
          role="dialog"
          aria-label="Chọn khoảng ngày"
          className={`fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl border border-stone-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:mt-2 sm:max-h-none sm:w-max sm:overflow-visible sm:rounded-xl dark:border-stone-800 dark:bg-stone-950 ${
            align === 'right' ? 'sm:right-0' : 'sm:left-0'
          }`}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-stone-300 sm:hidden dark:bg-stone-700" />
          <div className="flex flex-col sm:flex-row">
            {/* Chọn nhanh: áp dụng ngay */}
            <div className="flex gap-1 overflow-x-auto border-b border-stone-200 p-2 sm:w-36 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0 dark:border-stone-800">
              {presets.map((p) => {
                const r = presetRange(p.key);
                const active = preset?.key === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(r)}
                    className={`shrink-0 rounded-md px-3 py-2 text-left text-sm ${
                      active
                        ? 'bg-orange-50 font-semibold text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                        : 'hover:bg-stone-100 dark:hover:bg-stone-900'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
              <div className="flex gap-6">
                {[view, addYm(view, 1)].map((ym, idx) => (
                  <div key={ymIndex(ym)} className={`flex-1 ${idx === 1 ? 'hidden sm:block' : ''}`}>
                    <div className="mb-2 flex h-8 items-center justify-between">
                      <NavButton
                        label="Tháng trước"
                        onClick={() => setView(addYm(view, -1))}
                        disabled={!canPrev}
                        className={idx === 0 ? '' : 'invisible'}
                        dir="prev"
                      />
                      <span className="text-sm font-semibold">
                        Tháng {ym.m}, {ym.y}
                      </span>
                      <NavButton
                        label="Tháng sau"
                        onClick={() => setView(addYm(view, 1))}
                        disabled={!canNext}
                        // Mobile chỉ có 1 tháng nên nút "sau" nằm ở tháng đầu; desktop nằm ở tháng thứ hai.
                        className={idx === 0 ? 'sm:invisible' : ''}
                        dir="next"
                      />
                    </div>
                    <div className="grid grid-cols-7 text-center text-xs text-stone-500">
                      {WEEKDAYS.map((w) => (
                        <div key={w} className="py-1">
                          {w}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7" onMouseLeave={() => setHover(null)}>
                      {monthCells(ym).map((d, i) =>
                        d === null ? (
                          <div key={`e${i}`} className="h-9 w-full sm:w-9" />
                        ) : (
                          <DayCell
                            key={d}
                            day={d}
                            disabled={d > today || d < minDate}
                            isToday={d === today}
                            isStart={d === draft.from}
                            isEnd={d === previewEnd}
                            inRange={previewEnd !== null && d > draft.from && d < previewEnd}
                            onPick={pickDay}
                            onHover={setHover}
                          />
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3 dark:border-stone-800">
                <p className="text-sm">
                  {complete ? (
                    <>
                      <span className="font-semibold tabular-nums">{formatRange(complete)}</span>
                      <span className="text-stone-500"> · {rangeDays(complete)} ngày</span>
                    </>
                  ) : (
                    <span className="text-stone-500">
                      Từ{' '}
                      <span className="tabular-nums text-stone-900 dark:text-stone-100">
                        {formatYmd(draft.from)}
                      </span>{' '}
                      · chọn ngày kết thúc
                    </span>
                  )}
                  {error && <span className="block text-xs text-red-600">{error}</span>}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-900"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={!complete || error !== null}
                    onClick={() => complete && applyPreset(complete)}
                    className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-40"
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DayCell({
  day,
  disabled,
  isToday,
  isStart,
  isEnd,
  inRange,
  onPick,
  onHover,
}: {
  day: string;
  disabled: boolean;
  isToday: boolean;
  isStart: boolean;
  isEnd: boolean;
  inRange: boolean;
  onPick: (d: string) => void;
  onHover: (d: string) => void;
}) {
  const edge = isStart || isEnd;
  // Dải nền nối liền các ngày trong khoảng; hai đầu được bo tròn.
  const band = inRange
    ? 'bg-orange-100 dark:bg-orange-950'
    : isStart && isEnd
      ? ''
      : isStart
        ? 'bg-gradient-to-r from-transparent from-50% to-orange-100 to-50% dark:to-orange-950'
        : isEnd
          ? 'bg-gradient-to-l from-transparent from-50% to-orange-100 to-50% dark:to-orange-950'
          : '';
  const hasBand = inRange || (isStart !== isEnd && edge);
  return (
    <div className={`flex h-9 items-center justify-center ${hasBand ? band : ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick(day)}
        onMouseEnter={() => onHover(day)}
        onFocus={() => onHover(day)}
        aria-label={formatYmd(day)}
        aria-pressed={edge}
        className={`h-9 w-9 rounded-full text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:text-stone-300 dark:disabled:text-stone-700 ${
          edge
            ? 'bg-orange-600 font-semibold text-white'
            : `hover:bg-stone-200 dark:hover:bg-stone-800 ${isToday ? 'font-semibold text-orange-600' : ''}`
        }`}
      >
        {Number(day.slice(8))}
      </button>
    </div>
  );
}

function NavButton({
  label,
  onClick,
  disabled,
  className,
  dir,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  className: string;
  dir: 'prev' | 'next';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-900 ${className}`}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
        <path
          d={dir === 'prev' ? 'M12.5 5 7.5 10l5 5' : 'M7.5 5l5 5-5 5'}
          stroke="currentColor"
          strokeWidth="1.75"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-stone-500" aria-hidden>
      <rect
        x="3"
        y="4.5"
        width="14"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M3 8.5h14M7 3v3M13 3v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
