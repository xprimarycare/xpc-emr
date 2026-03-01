'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Video, Clock, User, MapPin, X } from 'lucide-react';
import { AppAppointment } from '@/lib/types/appointment';
import { searchFhirAppointments, createFhirAppointment } from '@/lib/services/fhir-appointment-service';
import { usePatient } from '@/lib/context/PatientContext';
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  useClick,
  useDismiss,
  useInteractions,
  FloatingPortal,
  FloatingFocusManager,
} from '@floating-ui/react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
];

const VISIT_MODE_OPTIONS = [
  { value: 'patient-visit' as const, label: 'In-Person', icon: MapPin },
  { value: 'telehealth' as const, label: 'Virtual', icon: Video },
];

const START_HOUR = 7;  // 7 AM
const END_HOUR = 19;   // 7 PM
const HOUR_HEIGHT = 60; // px per hour
const TOTAL_HOURS = END_HOUR - START_HOUR;
const MIN_EVENT_HEIGHT = 28; // minimum px so text is always readable

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatHourLabel(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h} ${ampm}`;
}

function formatSlotTime(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:00 ${ampm}`;
}

function formatEndTime(hour: number, durationMin: number): string {
  const endMinutes = hour * 60 + durationMin;
  const endHour = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;
  const ampm = endHour >= 12 ? 'PM' : 'AM';
  const h = endHour % 12 || 12;
  if (endMin === 0) return `${h}:00 ${ampm}`;
  return `${h}:${String(endMin).padStart(2, '0')} ${ampm}`;
}

function formatTime(isoString: string): string {
  const { hours, minutes } = parseTimeComponents(isoString);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  if (minutes === 0) return `${h} ${ampm}`;
  return `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** Parse hours and minutes from an ISO-ish string without going through Date (avoids UTC offset issues) */
function parseTimeComponents(iso: string): { hours: number; minutes: number } {
  const timePart = iso.split('T')[1] || '00:00';
  const [h, m] = timePart.split(':').map(Number);
  return { hours: h || 0, minutes: m || 0 };
}

/** Convert an appointment's start/end into pixel position, height, and duration */
function getEventLayout(apt: AppAppointment): { top: number; height: number; durationMin: number } {
  const start = parseTimeComponents(apt.start);
  const end = parseTimeComponents(apt.end);
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  const durationMinutes = Math.max(endMinutes - startMinutes, 15);
  const offsetMinutes = startMinutes - START_HOUR * 60;
  const rawHeight = (durationMinutes / 60) * HOUR_HEIGHT;

  return {
    top: (offsetMinutes / 60) * HOUR_HEIGHT,
    height: Math.max(rawHeight, MIN_EVENT_HEIGHT),
    durationMin: durationMinutes,
  };
}

interface CalendarDay {
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasEvent: boolean;
  dateKey: string;
}

interface BookingForm {
  hour: number;
  duration: number;
  description: string;
  mode: 'patient-visit' | 'telehealth';
}

export function CalendarPanel() {
  const today = useMemo(() => new Date(), []);
  const { activePatient } = usePatient();
  const [viewDate, setViewDate] = useState(() => new Date(today));
  const [selectedDate, setSelectedDate] = useState(() => new Date(today));
  const [appointments, setAppointments] = useState<AppAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingSlot, setBookingSlot] = useState<number | null>(null);
  const [bookingForm, setBookingForm] = useState<BookingForm>({
    hour: 0, duration: 30, description: '', mode: 'patient-visit',
  });
  const [saving, setSaving] = useState(false);

  // Ghost block ref — used as the Floating UI anchor
  const ghostRef = useRef<HTMLDivElement>(null);

  // Floating UI — popover anchored to the ghost block
  const { refs, floatingStyles, context } = useFloating({
    open: bookingSlot !== null,
    onOpenChange: (open) => { if (!open) setBookingSlot(null); },
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [
      offset(4),
      flip({ fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Sync ghost ref as the floating reference whenever bookingSlot changes
  useEffect(() => {
    if (bookingSlot !== null && ghostRef.current) {
      refs.setReference(ghostRef.current);
    }
  }, [bookingSlot, refs]);

  // Dismiss on click outside or Escape
  const dismiss = useDismiss(context, { outsidePress: true, escapeKey: true });
  const { getFloatingProps } = useInteractions([dismiss]);

  const fetchAppointments = useCallback(async (date: Date) => {
    setLoading(true);
    const year = date.getFullYear();
    const month = date.getMonth();
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const result = await searchFhirAppointments(start, end);
    setAppointments(result.appointments);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAppointments(viewDate);
  }, [viewDate.getFullYear(), viewDate.getMonth(), fetchAppointments]);

  // Group appointments by date key
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, AppAppointment[]> = {};
    for (const apt of appointments) {
      if (!apt.start) continue;
      const key = apt.start.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(apt);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.start.localeCompare(b.start));
    }
    return map;
  }, [appointments]);

  // Build calendar grid
  const calendarDays = useMemo((): CalendarDay[] => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: CalendarDay[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const dateKey = formatDateKey(new Date(year, month - 1, d));
      days.push({ day: d, isCurrentMonth: false, isToday: false, isSelected: false, hasEvent: !!appointmentsByDate[dateKey], dateKey });
    }

    for (let d = 1; d <= numDays; d++) {
      const date = new Date(year, month, d);
      const dateKey = formatDateKey(date);
      days.push({ day: d, isCurrentMonth: true, isToday: isSameDay(date, today), isSelected: isSameDay(date, selectedDate), hasEvent: !!appointmentsByDate[dateKey], dateKey });
    }

    const totalCells = days.length;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
      const dateKey = formatDateKey(new Date(year, month + 1, d));
      days.push({ day: d, isCurrentMonth: false, isToday: false, isSelected: false, hasEvent: !!appointmentsByDate[dateKey], dateKey });
    }

    return days;
  }, [viewDate, selectedDate, today, appointmentsByDate]);

  const selectedDateKey = formatDateKey(selectedDate);
  const dayAppointments = appointmentsByDate[selectedDateKey] || [];

  const goToPrevMonth = () => {
    setViewDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() - 1); return d; });
  };

  const goToNextMonth = () => {
    setViewDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + 1); return d; });
  };

  const handleDayClick = (day: CalendarDay) => {
    if (!day.isCurrentMonth) return;
    setSelectedDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day.day));
    setBookingSlot(null);
  };

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const clickedHour = Math.floor(y / HOUR_HEIGHT) + START_HOUR;
    if (clickedHour >= START_HOUR && clickedHour < END_HOUR) {
      // Don't open booking if clicking on an existing appointment
      const target = e.target as HTMLElement;
      if (target.closest('[data-appointment]')) return;

      if (bookingSlot === clickedHour) {
        setBookingSlot(null);
      } else {
        setBookingSlot(clickedHour);
        setBookingForm({ hour: clickedHour, duration: 30, description: '', mode: 'patient-visit' });
      }
    }
  };

  const handleBook = async () => {
    if (!activePatient) return;
    setSaving(true);

    const dateKey = formatDateKey(selectedDate);
    const startHour = String(bookingForm.hour).padStart(2, '0');
    const endMinutes = bookingForm.hour * 60 + bookingForm.duration;
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
    const endM = String(endMinutes % 60).padStart(2, '0');

    const newAppointment: AppAppointment = {
      id: `apt-${Date.now()}`,
      status: 'booked',
      description: bookingForm.description || (bookingForm.mode === 'telehealth' ? 'Virtual Visit' : 'Office Visit'),
      start: `${dateKey}T${startHour}:00:00`,
      end: `${dateKey}T${endH}:${endM}:00`,
      appointmentType: bookingForm.mode,
      patientFhirId: activePatient.fhirId,
      patientName: activePatient.name,
    };

    // Optimistically add to local state so it shows immediately
    setAppointments(prev => [...prev, newAppointment]);
    setBookingSlot(null);
    setSaving(false);

    // Persist to FHIR in the background, then patch in the real FHIR ID
    const result = await createFhirAppointment(newAppointment);
    if (result.success && result.fhirId) {
      setAppointments(prev =>
        prev.map(apt =>
          apt.id === newAppointment.id ? { ...apt, fhirId: result.fhirId } : apt
        )
      );
    }
  };

  const eventTypeStyles: Record<AppAppointment['appointmentType'], { bg: string; border: string; text: string }> = {
    'patient-visit': { bg: 'bg-blue-100', border: 'border-l-blue-500', text: 'text-blue-900' },
    'telehealth': { bg: 'bg-green-100', border: 'border-l-green-500', text: 'text-green-900' },
    'meeting': { bg: 'bg-gray-100', border: 'border-l-gray-400', text: 'text-gray-700' },
  };

  // Ghost block layout for the selected booking slot
  const ghostLayout = useMemo(() => {
    if (bookingSlot === null) return null;
    const top = (bookingSlot - START_HOUR) * HOUR_HEIGHT;
    const height = (bookingForm.duration / 60) * HOUR_HEIGHT;
    return { top, height: Math.max(height, MIN_EVENT_HEIGHT) };
  }, [bookingSlot, bookingForm.duration]);

  const selectedDayOfWeek = WEEKDAY_SHORT[selectedDate.getDay()];
  const selectedMonthName = MONTHS[selectedDate.getMonth()];

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-base font-semibold text-gray-800">
          {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
        </span>
        <div className="flex gap-1">
          <button
            onClick={goToPrevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToNextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 text-center mb-2">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-xs font-medium text-gray-400 py-2">
            {d}
          </span>
        ))}
      </div>

      {/* Day Grid */}
      <div className="grid grid-cols-7 gap-0.5 mb-5">
        {calendarDays.map((day, i) => {
          let className =
            'relative aspect-square flex items-center justify-center text-[13px] rounded-full cursor-pointer transition-colors';

          if (!day.isCurrentMonth) {
            className += ' text-gray-300';
          } else if (day.isSelected) {
            className += ' bg-blue-500 text-white font-semibold';
          } else if (day.isToday) {
            className += ' bg-blue-100 text-blue-600 font-semibold';
          } else {
            className += ' text-gray-700 hover:bg-gray-100';
          }

          return (
            <div key={i} className={className} onClick={() => handleDayClick(day)}>
              {day.day}
              {day.hasEvent && !day.isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full" />
              )}
            </div>
          );
        })}
      </div>

      {/* Time Grid — Google Cal style */}
      <div className="border-t border-gray-200 pt-2">
        {loading ? (
          <div className="text-center py-6 text-gray-400 text-sm">Loading...</div>
        ) : (
          <div>
            {/* Grid container */}
            <div
              className="relative cursor-pointer"
              style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
              onClick={handleGridClick}
            >
              {/* Hour lines & labels */}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                const hour = START_HOUR + i;
                return (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 flex items-start"
                    style={{ top: i * HOUR_HEIGHT }}
                  >
                    <div className="text-[11px] font-medium text-gray-400 w-[46px] shrink-0 text-right pr-2 -mt-[7px]">
                      {i > 0 && formatHourLabel(hour)}
                    </div>
                    <div className="flex-1 border-t border-gray-100 h-0" />
                  </div>
                );
              })}
              {/* Bottom line */}
              <div
                className="absolute left-0 right-0 flex items-start"
                style={{ top: TOTAL_HOURS * HOUR_HEIGHT }}
              >
                <div className="text-[11px] font-medium text-gray-400 w-[46px] shrink-0 text-right pr-2 -mt-[7px]">
                  {formatHourLabel(END_HOUR)}
                </div>
                <div className="flex-1 border-t border-gray-100 h-0" />
              </div>

              {/* Appointment blocks — positioned absolutely */}
              {dayAppointments.map((apt) => {
                const { top, height, durationMin } = getEventLayout(apt);
                const styles = eventTypeStyles[apt.appointmentType];
                const isCompact = durationMin <= 15;

                return (
                  <div
                    key={apt.id}
                    data-appointment
                    className={`absolute left-[50px] right-1 rounded-md border-l-[3px] ${styles.bg} ${styles.border} overflow-hidden cursor-default`}
                    style={{ top, height }}
                  >
                    {isCompact ? (
                      <div className="px-2 h-full flex items-center gap-1.5 overflow-hidden">
                        <span className={`text-[12px] font-semibold ${styles.text} truncate`}>
                          {apt.patientName || apt.description}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {formatTime(apt.start)}
                        </span>
                      </div>
                    ) : (
                      <div className="px-2 py-1.5 h-full flex flex-col">
                        <div className={`text-[12px] font-semibold ${styles.text} leading-tight truncate`}>
                          {apt.patientName || apt.description}
                        </div>
                        {apt.patientName && apt.description && (
                          <div className="text-[10px] text-gray-500 leading-tight truncate mt-0.5">
                            {apt.description}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400 leading-tight mt-auto">
                          {formatTime(apt.start)} – {formatTime(apt.end)}
                          {apt.appointmentType === 'telehealth' && (
                            <span className="inline-flex items-center gap-0.5 ml-1 text-blue-500">
                              <Video size={9} /> Virtual
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Ghost placeholder block — Google Cal style blue highlight at selected slot */}
              {bookingSlot !== null && ghostLayout && (
                <div
                  ref={ghostRef}
                  className="absolute left-[50px] right-1 rounded-md bg-blue-500/20 border border-blue-400/40 border-dashed pointer-events-none"
                  style={{ top: ghostLayout.top, height: ghostLayout.height }}
                >
                  <div className="px-2 py-1 text-[11px] text-blue-600 font-medium">
                    {formatSlotTime(bookingForm.hour)} – {formatEndTime(bookingForm.hour, bookingForm.duration)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating booking popover — rendered via portal, no scroll side-effects */}
      {bookingSlot !== null && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className="z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-4"
            >
              {/* Header with close */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-[13px] text-gray-700">
                  <Clock size={14} className="text-gray-400" />
                  <span className="font-medium">
                    {selectedDayOfWeek}, {selectedMonthName} {selectedDate.getDate()}
                  </span>
                  <span className="text-gray-300">|</span>
                  <span>
                    {formatSlotTime(bookingForm.hour)} – {formatEndTime(bookingForm.hour, bookingForm.duration)}
                  </span>
                </div>
                <button
                  onClick={() => setBookingSlot(null)}
                  className="p-0.5 hover:bg-gray-100 rounded"
                >
                  <X size={14} className="text-gray-400" />
                </button>
              </div>

              {/* Patient from active tab */}
              <div className="flex items-center gap-2 mb-3 px-0.5">
                <User size={14} className="text-gray-400 shrink-0" />
                {activePatient ? (
                  <span className="text-[13px] font-medium text-gray-800">
                    {activePatient.name}
                  </span>
                ) : (
                  <span className="text-[13px] text-gray-400 italic">
                    No patient selected
                  </span>
                )}
              </div>

              {/* Duration pills */}
              <div className="mb-3">
                <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1.5 px-0.5">Duration</div>
                <div className="flex items-center gap-1.5">
                  {DURATION_OPTIONS.map((opt) => {
                    const isActive = bookingForm.duration === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setBookingForm(f => ({ ...f, duration: opt.value }))}
                        className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors ${
                          isActive
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* In-Person / Virtual */}
              <div className="mb-3">
                <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1.5 px-0.5">Type</div>
                <div className="flex items-center gap-1.5">
                  {VISIT_MODE_OPTIONS.map((opt) => {
                    const isActive = bookingForm.mode === opt.value;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setBookingForm(f => ({ ...f, mode: opt.value }))}
                        className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full border transition-colors ${
                          isActive
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <Icon size={12} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional note */}
              <input
                type="text"
                placeholder="Add note (optional)..."
                value={bookingForm.description}
                onChange={(e) => setBookingForm(f => ({ ...f, description: e.target.value }))}
                className="w-full text-[13px] border border-gray-200 rounded-md px-2.5 py-1.5 mb-3 focus:outline-none focus:border-blue-400 placeholder:text-gray-300"
              />

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleBook}
                  disabled={!activePatient || saving}
                  className="text-[13px] font-medium bg-blue-500 text-white px-4 py-1.5 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Booking...' : 'Book'}
                </button>
                <button
                  onClick={() => setBookingSlot(null)}
                  className="text-[13px] text-gray-500 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </div>
  );
}
