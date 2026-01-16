"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ======================================================
   TIME OPTIONS — 15-minute intervals (00, 15, 30, 45)
====================================================== */
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const totalMinutes = i * 15;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;

  return {
    label: `${hour}:${String(m).padStart(2, "0")} ${ampm}`,
    value: `${hour}:${String(m).padStart(2, "0")} ${ampm}`,
    minutes: totalMinutes
  };
});

/* Convert DB HH:MM:SS → "4:30 PM" */
const dbToAmPm = t => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const am = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${am}`;
};

/* Convert AM/PM → minutes for comparison */
const ampmToMinutes = str => {
  if (!str) return 0;
  const [time, suffix] = str.split(" ");
  let [h, m] = time.split(":").map(Number);

  if (suffix === "PM" && h !== 12) h += 12;
  if (suffix === "AM" && h === 12) h = 0;

  return h * 60 + m;
};

/* ======================================================
   ENHANCED TOAST NOTIFICATION
====================================================== */
const Toast = ({ message, type = "info", isVisible, onHide }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onHide, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case "success": return "✅";
      case "error": return "❌";
      case "warning": return "⚠️";
      case "info": return "ℹ️";
      default: return "ℹ️";
    }
  };

  return (
    <div className={`${styles.toast} ${styles[`toast${type.charAt(0).toUpperCase() + type.slice(1)}`]} ${isVisible ? styles.toastVisible : ''}`}>
      <span className={styles.toastIcon}>{getIcon()}</span>
      <span className={styles.toastMessage}>{message}</span>
      <button className={styles.toastClose} onClick={onHide}>×</button>
    </div>
  );
};

/* ======================================================
   MODAL COMPONENT WITH BETTER ACCESSIBILITY
====================================================== */
const Modal = ({ isOpen, onClose, title, children, type = "info", size = "medium" }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      
      // Focus management
      setTimeout(() => {
        const focusableElement = modalRef.current?.querySelector('button, input, select');
        focusableElement?.focus();
      }, 100);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "success": return "✅";
      case "warning": return "⚠️";
      case "error": return "❌";
      default: return "ℹ️";
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        ref={modalRef}
        className={`${styles.modal} ${styles[`modal${size.charAt(0).toUpperCase() + size.slice(1)}`]}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className={`${styles.modalHeader} ${styles[`modal${type.charAt(0).toUpperCase() + type.slice(1)}`]}`}>
          <span className={styles.modalIcon}>{getIcon()}</span>
          <h3 id="modal-title">{title}</h3>
          <button 
            className={styles.modalClose} 
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className={styles.modalBody}>
          {children}
        </div>
      </div>
    </div>
  );
};

/* ======================================================
   TIME SCROLLER WITH IMPROVED UX
====================================================== */
const TimeScroller = ({ value, onChange, label, minTime = null, disabled = false, currentDate = null, today = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const scrollContainerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Get current time in minutes (rounded up to next 15-min slot)
  const getCurrentMinutes = () => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return Math.ceil(currentMinutes / 15) * 15;
  };

  const filteredOptions = useMemo(() => {
    let options = TIME_OPTIONS;

    // Filter based on current time if it's today's date
    if (currentDate === today && !minTime) {
      const nowMinutes = getCurrentMinutes();
      options = options.filter(t => t.minutes >= nowMinutes);
    }

    // Filter based on minTime (for end time)
    if (minTime) {
      const minMinutes = ampmToMinutes(minTime);
      options = options.filter(t => t.minutes > minMinutes);
    }

    return options;
  }, [minTime, currentDate, today]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Auto-scroll to selected value
  useEffect(() => {
    if (isOpen && scrollContainerRef.current && value) {
      const selectedIndex = filteredOptions.findIndex(t => t.value === value);
      if (selectedIndex !== -1) {
        const itemHeight = 40;
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = selectedIndex * itemHeight - 80;
          }
        });
      }
    }
  }, [isOpen, value, filteredOptions]);

  const handleSelect = (timeValue) => {
    onChange(timeValue);
    setIsOpen(false);
  };

  const handleKeyDown = (e, timeValue) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(timeValue);
    }
  };

  return (
    <div className={styles.timeScroller} ref={dropdownRef}>
      <label>{label} {!disabled && <span className={styles.required}>*</span>}</label>
      <div 
        className={`${styles.timeInput} ${disabled ? styles.timeInputDisabled : ''} ${isOpen ? styles.timeInputOpen : ''}`}
        onClick={() => !disabled && setIsOpen(true)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        aria-label={`${label}. Current value: ${value || 'Not selected'}`}
      >
        <span className={value ? styles.timeSelected : styles.timePlaceholder}>
          {value || "Select time"}
        </span>
        <span className={styles.timeIcon}>🕒</span>
      </div>

      {isOpen && (
        <div className={styles.timeDropdown}>
          <div className={styles.timeDropdownHeader}>
            <span>Select {label}</span>
            <button onClick={() => setIsOpen(false)} aria-label="Close time picker">×</button>
          </div>
          <div 
            className={styles.timeList} 
            ref={scrollContainerRef}
            role="listbox"
          >
            {filteredOptions.length === 0 ? (
              <div className={styles.timeOptionEmpty}>No available times</div>
            ) : (
              filteredOptions.map(time => (
                <div
                  key={time.value}
                  className={`${styles.timeOption} ${value === time.value ? styles.timeOptionSelected : ""}`}
                  onClick={() => handleSelect(time.value)}
                  onKeyDown={(e) => handleKeyDown(e, time.value)}
                  role="option"
                  tabIndex={0}
                  aria-selected={value === time.value}
                >
                  {time.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ======================================================
   ENHANCED BANNER WITH SUBSCRIPTION ACTIONS
====================================================== */
const Banner = ({ message, type = "warning", onClose, actionLabel, onAction }) => {
  if (!message) return null;

  const getIcon = () => {
    switch (type) {
      case "warning": return "⚠️";
      case "error": return "❌";
      case "info": return "ℹ️";
      case "subscription": return "💳";
      default: return "ℹ️";
    }
  };

  return (
    <div className={`${styles.banner} ${styles[`banner${type.charAt(0).toUpperCase() + type.slice(1)}`]}`}>
      <div className={styles.bannerContent}>
        <span className={styles.bannerIcon}>{getIcon()}</span>
        <div className={styles.bannerText}>
          <p>{message}</p>
          {actionLabel && onAction && (
            <button onClick={onAction} className={styles.bannerAction}>
              {actionLabel}
            </button>
          )}
        </div>
      </div>
      {onClose && (
        <button className={styles.bannerClose} onClick={onClose} aria-label="Close banner">×</button>
      )}
    </div>
  );
};

/* ======================================================
   MAIN COMPONENT
====================================================== */
export default function PublicConferenceBooking() {
  const { slug } = useParams();
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [planInfo, setPlanInfo] = useState(null);

  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [department, setDepartment] = useState("");
  const [purpose, setPurpose] = useState("");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [subscriptionBanner, setSubscriptionBanner] = useState(null);

  // Enhanced state management
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const [formErrors, setFormErrors] = useState({});

  // Modal states
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, data: null });
  const [rescheduleModal, setRescheduleModal] = useState({ isOpen: false, data: null });
  const [cancelModal, setCancelModal] = useState({ isOpen: false, data: null });
  const [resultModal, setResultModal] = useState({ isOpen: false, type: "", message: "" });

  /* ================= ENHANCED TOAST MANAGEMENT ================= */
  const showToast = useCallback((message, type = "info") => {
    setToast({ show: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast({ show: false, message: "", type: "info" });
  }, []);

  /* ================= FORM VALIDATION ================= */
  const validateForm = () => {
    const errors = {};

    if (!roomId) errors.roomId = "Please select a room";
    if (!date) errors.date = "Please select a date";
    if (!startTime) errors.startTime = "Please select start time";
    if (!endTime) errors.endTime = "Please select end time";
    if (!department.trim()) errors.department = "Department is required";

    if (startTime && endTime && ampmToMinutes(endTime) <= ampmToMinutes(startTime)) {
      errors.endTime = "End time must be after start time";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ================= API ERROR HANDLER ================= */
  const handleApiError = async (response, defaultMessage) => {
    try {
      const data = await response.json();
      
      // Handle subscription-specific errors
      if (response.status === 403 && data.code) {
        switch (data.code) {
          case "SUBSCRIPTION_EXPIRED":
          case "TRIAL_EXPIRED":
            setSubscriptionBanner({
              type: "subscription",
              message: data.message,
              actionLabel: "Upgrade Plan",
              onAction: () => {
                if (data.redirectTo) {
                  window.open(`${window.location.origin}${data.redirectTo}`, '_blank');
                }
              }
            });
            break;
          case "BOOKING_LIMIT_REACHED":
          case "ROOM_LIMIT_REACHED":
            setSubscriptionBanner({
              type: "warning",
              message: data.message,
              actionLabel: "View Plans",
              onAction: () => {
                window.open(`${window.location.origin}/auth/subscription`, '_blank');
              }
            });
            break;
          default:
            showToast(data.message || defaultMessage, "error");
        }
        return;
      }

      showToast(data.message || defaultMessage, "error");
    } catch {
      showToast(defaultMessage, "error");
    }
  };

  /* ================= COMPANY DATA ================= */
  useEffect(() => {
    const loadCompany = async () => {
      try {
        const response = await fetch(`${API}/api/public/conference/company/${slug}`);
        
        if (!response.ok) {
          await handleApiError(response, "Invalid booking link");
          return;
        }

        const data = await response.json();
        setCompany(data);
        setPlanInfo(data.planInfo);
        
        console.log("[COMPANY_LOADED]", data);
      } catch (error) {
        console.error("[COMPANY_ERROR]", error);
        showToast("Failed to load company information", "error");
      }
    };

    loadCompany();
  }, [slug]);

  /* ================= ROOMS DATA ================= */
  useEffect(() => {
    if (!company) return;
    
    const loadRooms = async () => {
      try {
        const response = await fetch(`${API}/api/public/conference/company/${slug}/rooms`);
        
        if (!response.ok) {
          await handleApiError(response, "Failed to load rooms");
          return;
        }

        const data = await response.json();
        setRooms(data);
        
        console.log("[ROOMS_LOADED]", data.length, "rooms");
      } catch (error) {
        console.error("[ROOMS_ERROR]", error);
        setRooms([]);
      }
    };

    loadRooms();
  }, [company, slug]);

  /* ================= BOOKINGS DATA ================= */
  const loadBookings = useCallback(async () => {
    if (!roomId || !date) {
      setBookings([]);
      return;
    }

    try {
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/bookings?roomId=${roomId}&date=${date}&userEmail=${email || ""}`
      );

      if (!response.ok) {
        await handleApiError(response, "Failed to load bookings");
        return;
      }

      const data = await response.json();
      const formattedBookings = (Array.isArray(data) ? data : []).map(b => ({
        ...b,
        start_time: dbToAmPm(b.start_time),
        end_time: dbToAmPm(b.end_time)
      }));

      setBookings(formattedBookings);
      console.log("[BOOKINGS_LOADED]", formattedBookings.length, "bookings");
    } catch (error) {
      console.error("[BOOKINGS_ERROR]", error);
      setBookings([]);
    }
  }, [roomId, date, slug, email]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings, otpVerified]);

  /* ================= TIME VALIDATION ================= */
  useEffect(() => {
    if (date === today && startTime) {
      const nowMinutes = Math.ceil((new Date().getHours() * 60 + new Date().getMinutes()) / 15) * 15;
      const startMinutes = ampmToMinutes(startTime);
      
      if (startMinutes < nowMinutes) {
        setStartTime("");
        setEndTime("");
        showToast("Selected time has passed. Please choose a future time.", "warning");
      }
    }
  }, [date, today, startTime]);

  /* ================= SLOT VALIDATION ================= */
  const isSlotFree = useCallback((s, e, ignore = null) =>
    !bookings.some(
      b =>
        b.id !== ignore &&
        ampmToMinutes(b.start_time) < ampmToMinutes(e) &&
        ampmToMinutes(b.end_time) > ampmToMinutes(s)
    ), [bookings]);

  /* ================= AUTH FUNCTIONS ================= */
  const handleLogout = () => {
    setOtpVerified(false);
    setOtpSent(false);
    setOtp("");
    setEmail("");
    setBookings([]);
    setRoomId("");
    setDate(today);
    setStartTime("");
    setEndTime("");
    setDepartment("");
    setPurpose("");
    setFormErrors({});
    setSubscriptionBanner(null);
    hideToast();
    showToast("Logged out successfully", "info");
  };

  /* ================= OTP FUNCTIONS ================= */
  const sendOtp = async () => {
    if (!email.includes("@")) {
      showToast("Please enter a valid email address", "error");
      return;
    }

    setLoading(true);
    hideToast();

    try {
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/send-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );

      if (!response.ok) {
        await handleApiError(response, "Failed to send OTP");
        return;
      }

      setOtpSent(true);
      showToast("OTP sent to your email", "success");
      setResendTimer(30);
    } catch (error) {
      console.error("[OTP_SEND_ERROR]", error);
      showToast("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!resendTimer) return;
    const timer = setInterval(() => setResendTimer(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  const resendOtp = async () => {
    hideToast();
    
    try {
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/send-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );

      if (!response.ok) {
        await handleApiError(response, "Failed to resend OTP");
        return;
      }

      showToast("OTP resent to your email", "success");
      setResendTimer(30);
    } catch (error) {
      console.error("[OTP_RESEND_ERROR]", error);
      showToast("Network error. Please try again.", "error");
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) {
      showToast("Please enter the OTP", "error");
      return;
    }
    
    setLoading(true);
    hideToast();
    
    try {
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp })
        }
      );

      if (!response.ok) {
        await handleApiError(response, "Invalid or expired OTP");
        return;
      }

      setOtpVerified(true);
      showToast("Email verified successfully", "success");
      loadBookings();
    } catch (error) {
      console.error("[OTP_VERIFY_ERROR]", error);
      showToast("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  /* ================= BOOKING FUNCTIONS ================= */
  const initiateBooking = () => {
    hideToast();
    
    if (!validateForm()) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    if (!isSlotFree(startTime, endTime)) {
      showToast("Selected time slot conflicts with existing booking", "error");
      return;
    }

    const selectedRoom = rooms.find(r => r.id === Number(roomId));
    
    setConfirmModal({
      isOpen: true,
      data: {
        room: selectedRoom?.room_name || "Unknown Room",
        roomNumber: selectedRoom?.room_number || "",
        date,
        startTime,
        endTime,
        department,
        purpose: purpose || "—"
      }
    });
  };

  const confirmBooking = async () => {
    setConfirmModal({ isOpen: false, data: null });
    setLoading(true);

    try {
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/book`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: roomId,
            booked_by: email,
            department,
            purpose,
            booking_date: date,
            start_time: startTime,
            end_time: endTime
          })
        }
      );

      if (!response.ok) {
        await handleApiError(response, "Booking failed");
        return;
      }

      setResultModal({
        isOpen: true,
        type: "success",
        message: "Your conference room has been booked successfully! A confirmation email has been sent to you."
      });

      // Reset form
      setStartTime("");
      setEndTime("");
      setDepartment("");
      setPurpose("");
      setFormErrors({});
      
      loadBookings();
    } catch (error) {
      console.error("[BOOKING_ERROR]", error);
      setResultModal({
        isOpen: true,
        type: "error",
        message: "Network error occurred. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  /* ================= EDIT FUNCTIONS ================= */
  const initiateEdit = (booking) => {
    setEditingId(booking.id);
    setEditStart(booking.start_time);
    setEditEnd(booking.end_time);
    hideToast();
  };

  const showRescheduleConfirmation = () => {
    hideToast();
    
    if (!editStart || !editEnd) {
      showToast("Please select both start and end times", "error");
      return;
    }

    if (ampmToMinutes(editEnd) <= ampmToMinutes(editStart)) {
      showToast("End time must be after start time", "error");
      return;
    }

    if (!isSlotFree(editStart, editEnd, editingId)) {
      showToast("Selected time slot is not available", "error");
      return;
    }

    const booking = bookings.find(b => b.id === editingId);
    const selectedRoom = rooms.find(r => r.id === booking.room_id);

    setRescheduleModal({
      isOpen: true,
      data: {
        id: editingId,
        room: selectedRoom?.room_name || "Unknown Room",
        roomNumber: selectedRoom?.room_number || "",
        date: booking.booking_date,
        oldStart: booking.start_time,
        oldEnd: booking.end_time,
        newStart: editStart,
        newEnd: editEnd
      }
    });
  };

  const confirmReschedule = async () => {
    const { id } = rescheduleModal.data;
    setRescheduleModal({ isOpen: false, data: null });
    setLoading(true);

    try {
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/bookings/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_time: editStart,
            end_time: editEnd,
            email
          })
        }
      );

      if (!response.ok) {
        await handleApiError(response, "Failed to reschedule booking");
        return;
      }

      setResultModal({
        isOpen: true,
        type: "success",
        message: "Your booking has been rescheduled successfully! A confirmation email has been sent to you."
      });

      setEditingId(null);
      setEditStart("");
      setEditEnd("");
      loadBookings();
    } catch (error) {
      console.error("[RESCHEDULE_ERROR]", error);
      setResultModal({
        isOpen: true,
        type: "error",
        message: "Network error occurred. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditStart("");
    setEditEnd("");
    hideToast();
  };

  /* ================= CANCEL FUNCTIONS ================= */
  const initiateCancellation = (booking) => {
    const selectedRoom = rooms.find(r => r.id === booking.room_id);
    
    setCancelModal({
      isOpen: true,
      data: {
        id: booking.id,
        room: selectedRoom?.room_name || "Unknown Room",
        roomNumber: selectedRoom?.room_number || "",
        date: booking.booking_date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        department: booking.department
      }
    });
  };

  const confirmCancellation = async () => {
    const { id } = cancelModal.data;
    setCancelModal({ isOpen: false, data: null });
    setLoading(true);

    try {
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/bookings/${id}/cancel`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );

      if (!response.ok) {
        await handleApiError(response, "Failed to cancel booking");
        return;
      }

      setResultModal({
        isOpen: true,
        type: "success",
        message: "Your booking has been cancelled successfully. A confirmation email has been sent to you."
      });

      loadBookings();
    } catch (error) {
      console.error("[CANCELLATION_ERROR]", error);
      setResultModal({
        isOpen: true,
        type: "error",
        message: "Network error occurred. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  /* ================= LOADING STATE ================= */
  if (!company) return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner}></div>
      <p>Loading conference booking system...</p>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Enhanced Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onHide={hideToast}
      />

      {/* Subscription Banner */}
      {subscriptionBanner && (
        <Banner 
          message={subscriptionBanner.message}
          type={subscriptionBanner.type}
          onClose={() => setSubscriptionBanner(null)}
          actionLabel={subscriptionBanner.actionLabel}
          onAction={subscriptionBanner.onAction}
        />
      )}

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <h1>{company.name}</h1>
            <p className={styles.subtitle}>Conference Room Booking</p>
            {planInfo && (
              <p className={styles.planInfo}>
                {planInfo.plan} Plan - {planInfo.limits.bookings} Bookings, {planInfo.limits.rooms} Rooms
              </p>
            )}
          </div>

          <div className={styles.headerRight}>
            {otpVerified && (
              <>
                <span className={styles.userEmail}>{email}</span>
                <button 
                  className={styles.logoutBtn} 
                  onClick={handleLogout} 
                  title="Logout"
                  aria-label="Logout"
                >
                  <span>⎋</span>
                </button>
              </>
            )}

            {company.logo_url && (
              <img 
                src={company.logo_url} 
                alt={`${company.name} logo`} 
                className={styles.logo} 
              />
            )}
          </div>
        </div>
      </header>

      {/* ================= OTP VERIFICATION SECTION ================= */}
      {!otpVerified ? (
        <div className={styles.container}>
          <div className={styles.authCard}>
            <div className={styles.authHeader}>
              <h2>Email Verification</h2>
              <p>Enter your email to receive a one-time password for booking confirmation</p>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email">Email Address <span className={styles.required}>*</span></label>
              <input
                id="email"
                type="email"
                value={email}
                placeholder="your.email@company.com"
                onChange={e => setEmail(e.target.value)}
                className={styles.input}
                disabled={otpSent}
                autoComplete="email"
              />
            </div>

            {!otpSent ? (
              <button 
                onClick={sendOtp} 
                disabled={loading}
                className={styles.primaryBtn}
              >
                {loading ? "Sending..." : "Send OTP"}
              </button>
            ) : (
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="otp">Enter OTP <span className={styles.required}>*</span></label>
                  <input
                    id="otp"
                    type="text"
                    value={otp}
                    placeholder="000000"
                    onChange={e => setOtp(e.target.value)}
                    className={styles.input}
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                </div>

                <button 
                  onClick={verifyOtp} 
                  disabled={loading}
                  className={styles.primaryBtn}
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                </button>

                <button 
                  onClick={resendOtp} 
                  disabled={loading || resendTimer > 0}
                  className={styles.secondaryBtn}
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.container}>
          <div className={styles.layout}>
            {/* ================= BOOKING FORM ================= */}
            <div className={styles.card}>
              <h2>Book a Conference Room</h2>

              <div className={styles.formGroup}>
                <label htmlFor="date">Date <span className={styles.required}>*</span></label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  min={today}
                  onChange={e => setDate(e.target.value)}
                  className={`${styles.input} ${formErrors.date ? styles.inputError : ''}`}
                />
                {formErrors.date && <span className={styles.errorText}>{formErrors.date}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="room">Room <span className={styles.required}>*</span></label>
                <select 
                  id="room"
                  value={roomId} 
                  onChange={e => setRoomId(e.target.value)}
                  className={`${styles.select} ${formErrors.roomId ? styles.inputError : ''}`}
                >
                  <option value="">Select a room</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.room_name} (#{r.room_number})
                    </option>
                  ))}
                </select>
                {formErrors.roomId && <span className={styles.errorText}>{formErrors.roomId}</span>}
              </div>

              <div className={formErrors.startTime ? styles.formGroupError : styles.formGroup}>
                <TimeScroller
                  value={startTime}
                  onChange={setStartTime}
                  label="Start Time"
                  disabled={!roomId || !date}
                  currentDate={date}
                  today={today}
                />
                {formErrors.startTime && <span className={styles.errorText}>{formErrors.startTime}</span>}
              </div>

              <div className={formErrors.endTime ? styles.formGroupError : styles.formGroup}>
                <TimeScroller
                  value={endTime}
                  onChange={setEndTime}
                  label="End Time"
                  minTime={startTime}
                  disabled={!startTime}
                  currentDate={date}
                  today={today}
                />
                {formErrors.endTime && <span className={styles.errorText}>{formErrors.endTime}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="department">Department <span className={styles.required}>*</span></label>
                <input
                  id="department"
                  type="text"
                  value={department}
                  placeholder="e.g., Engineering, Sales, Marketing"
                  onChange={e => setDepartment(e.target.value)}
                  className={`${styles.input} ${formErrors.department ? styles.inputError : ''}`}
                />
                {formErrors.department && <span className={styles.errorText}>{formErrors.department}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="purpose">Purpose (Optional)</label>
                <input
                  id="purpose"
                  type="text"
                  value={purpose}
                  placeholder="e.g., Team Meeting, Client Call, Training"
                  onChange={e => setPurpose(e.target.value)}
                  className={styles.input}
                />
              </div>

              <button
                onClick={initiateBooking}
                disabled={loading || !roomId || !date}
                className={styles.primaryBtn}
              >
                {loading ? "Processing..." : "Book Room"}
              </button>
            </div>

            {/* ================= BOOKINGS LIST ================= */}
            <div className={styles.card}>
              <h2>Current Bookings</h2>
              
              {!roomId || !date ? (
                <p className={styles.emptyState}>Select a room and date to view bookings</p>
              ) : !bookings.length ? (
                <p className={styles.emptyState}>No bookings for this date</p>
              ) : (
                <div className={styles.bookingsList}>
                  {bookings.map(b => (
                    <div key={b.id} className={styles.bookingItem}>
                      {editingId === b.id ? (
                        <>
                          <div className={styles.bookingHeader}>
                            <h4>Reschedule Booking</h4>
                          </div>
                          
                          <div className={styles.bookingDetails}>
                            <p><strong>Department:</strong> {b.department}</p>
                          </div>

                          <TimeScroller
                            value={editStart}
                            onChange={setEditStart}
                            label="New Start Time"
                            currentDate={b.booking_date}
                            today={today}
                          />

                          <TimeScroller
                            value={editEnd}
                            onChange={setEditEnd}
                            label="New End Time"
                            minTime={editStart}
                            currentDate={b.booking_date}
                            today={today}
                          />

                          <div className={styles.bookingActions}>
                            <button 
                              onClick={showRescheduleConfirmation}
                              className={styles.primaryBtn}
                              disabled={loading}
                            >
                              {loading ? "Saving..." : "Save Changes"}
                            </button>
                            <button 
                              onClick={cancelEdit}
                              className={styles.secondaryBtn}
                              disabled={loading}
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={styles.bookingHeader}>
                            <div className={styles.bookingTime}>
                              <span className={styles.timeIcon}>🕒</span>
                              <strong>{b.start_time} – {b.end_time}</strong>
                            </div>
                            {b.can_modify && (
                              <span className={styles.bookingBadge}>Your Booking</span>
                            )}
                          </div>

                          <div className={styles.bookingDetails}>
                            <p><strong>Department:</strong> {b.department}</p>
                            {b.purpose && <p><strong>Purpose:</strong> {b.purpose}</p>}
                            <p className={styles.bookedBy}>
                              <span>👤</span> {b.booked_by}
                            </p>
                          </div>

                          {b.can_modify && (
                            <div className={styles.bookingActions}>
                              <button
                                onClick={() => initiateEdit(b)}
                                className={styles.editBtn}
                                disabled={loading}
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => initiateCancellation(b)}
                                className={styles.cancelBtn}
                                disabled={loading}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}
      
      {/* Booking Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, data: null })}
        title="Confirm Booking"
        type="info"
      >
        {confirmModal.data && (
          <>
            <div className={styles.modalInfo}>
              <p><strong>Room:</strong> {confirmModal.data.room} {confirmModal.data.roomNumber && `(#${confirmModal.data.roomNumber})`}</p>
              <p><strong>Date:</strong> {confirmModal.data.date}</p>
              <p><strong>Time:</strong> {confirmModal.data.startTime} – {confirmModal.data.endTime}</p>
              <p><strong>Department:</strong> {confirmModal.data.department}</p>
              <p><strong>Purpose:</strong> {confirmModal.data.purpose}</p>
            </div>
            <div className={styles.modalActions}>
              <button onClick={confirmBooking} className={styles.primaryBtn} disabled={loading}>
                {loading ? "Booking..." : "Confirm Booking"}
              </button>
              <button 
                onClick={() => setConfirmModal({ isOpen: false, data: null })}
                className={styles.secondaryBtn}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Reschedule Confirmation Modal */}
      <Modal
        isOpen={rescheduleModal.isOpen}
        onClose={() => setRescheduleModal({ isOpen: false, data: null })}
        title="Confirm Reschedule"
        type="warning"
      >
        {rescheduleModal.data && (
          <>
            <div className={styles.modalInfo}>
              <p><strong>Room:</strong> {rescheduleModal.data.room} {rescheduleModal.data.roomNumber && `(#${rescheduleModal.data.roomNumber})`}</p>
              <p><strong>Date:</strong> {rescheduleModal.data.date}</p>
              <div className={styles.modalTimeComparison}>
                <div className={styles.modalTimeOld}>
                  <span className={styles.modalTimeLabel}>Current Time:</span>
                  <span>{rescheduleModal.data.oldStart} – {rescheduleModal.data.oldEnd}</span>
                </div>
                <div className={styles.modalTimeArrow}>→</div>
                <div className={styles.modalTimeNew}>
                  <span className={styles.modalTimeLabel}>New Time:</span>
                  <span>{rescheduleModal.data.newStart} – {rescheduleModal.data.newEnd}</span>
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button onClick={confirmReschedule} className={styles.primaryBtn} disabled={loading}>
                {loading ? "Rescheduling..." : "Confirm Reschedule"}
              </button>
              <button 
                onClick={() => setRescheduleModal({ isOpen: false, data: null })}
                className={styles.secondaryBtn}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Cancellation Confirmation Modal */}
      <Modal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal({ isOpen: false, data: null })}
        title="Cancel Booking"
        type="error"
      >
        {cancelModal.data && (
          <>
            <div className={styles.modalInfo}>
              <p className={styles.modalWarning}>Are you sure you want to cancel this booking?</p>
              <p><strong>Room:</strong> {cancelModal.data.room} {cancelModal.data.roomNumber && `(#${cancelModal.data.roomNumber})`}</p>
              <p><strong>Date:</strong> {cancelModal.data.date}</p>
              <p><strong>Time:</strong> {cancelModal.data.startTime} – {cancelModal.data.endTime}</p>
              <p><strong>Department:</strong> {cancelModal.data.department}</p>
            </div>
            <div className={styles.modalActions}>
              <button onClick={confirmCancellation} className={styles.dangerBtn} disabled={loading}>
                {loading ? "Cancelling..." : "Yes, Cancel Booking"}
              </button>
              <button 
                onClick={() => setCancelModal({ isOpen: false, data: null })}
                className={styles.secondaryBtn}
                disabled={loading}
              >
                No, Keep Booking
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Result Modal (Success/Error) */}
      <Modal
        isOpen={resultModal.isOpen}
        onClose={() => setResultModal({ isOpen: false, type: "", message: "" })}
        title={resultModal.type === "success" ? "Success" : "Error"}
        type={resultModal.type}
      >
        <div className={styles.modalInfo}>
          <p>{resultModal.message}</p>
        </div>
        <div className={styles.modalActions}>
          <button 
            onClick={() => setResultModal({ isOpen: false, type: "", message: "" })}
            className={styles.primaryBtn}
          >
            Close
          </button>
        </div>
      </Modal>
    </div>
  );
}
