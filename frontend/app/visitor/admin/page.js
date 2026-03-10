"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import * as XLSX from "xlsx";
import styles from "./style.module.css";

const EMPTY_FORM = { name: "", email: "", department: "", is_active: true };

export default function AdminEmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees]         = useState([]);
  const [filtered, setFiltered]           = useState([]);
  const [company, setCompany]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState("all");
  const [modal, setModal]                 = useState(null);
  const [editTarget, setEditTarget]       = useState(null);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [formError, setFormError]         = useState("");
  const [saving, setSaving]               = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [deleting, setDeleting]           = useState(false);
  const [toast, setToast]                 = useState(null);
  const [bulkModal, setBulkModal]         = useState(false);
  const [bulkRows, setBulkRows]           = useState([]);
  const [bulkErrors, setBulkErrors]       = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkFileName, setBulkFileName]   = useState("");
  const fileInputRef                      = useRef(null);
  const toastTimer                        = useRef(null);

  const showToast = (msg, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const getToken = () => localStorage.getItem("token");

  const fetchEmployees = async () => {
    try {
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : (data.employees || []));
    } catch {
      showToast("Failed to load employees", "error");
    }
  };

  useEffect(() => {
    const token  = getToken();
    const stored = localStorage.getItem("company");
    if (!token) { router.replace("/"); return; }
    if (stored) { try { setCompany(JSON.parse(stored)); } catch {} }
    fetchEmployees().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let list = employees;
    if (statusFilter === "active")   list = list.filter(e => e.is_active);
    if (statusFilter === "inactive") list = list.filter(e => !e.is_active);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [employees, search, statusFilter]);

  const initials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0][0]).toUpperCase();
  };

  const openAdd = () => {
    setForm(EMPTY_FORM); setFormError(""); setEditTarget(null); setModal("add");
  };
  const openEdit = (emp) => {
    setForm({ name: emp.name, email: emp.email, department: emp.department || "", is_active: !!emp.is_active });
    setFormError(""); setEditTarget(emp); setModal("edit");
  };

  const handleSave = async () => {
    if (!form.name.trim())  { setFormError("Name is required."); return; }
    if (!form.email.trim()) { setFormError("Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setFormError("Enter a valid email."); return; }
    setSaving(true); setFormError("");
    try {
      const method = modal === "edit" ? "PUT" : "POST";
      const base   = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      const url    = modal === "edit" ? `${base}/api/employees/${editTarget.id}` : `${base}/api/employees`;
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.message || "Failed to save."); return; }
      showToast(modal === "edit" ? "Employee updated." : "Employee added.");
      setModal(null);
      await fetchEmployees();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/employees/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      showToast("Employee removed.");
      setDeleteTarget(null);
      await fetchEmployees();
    } catch {
      showToast("Failed to delete employee.", "error");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const REQUIRED_COLS = ["name", "email"];
  const ALLOWED_COLS  = ["name", "email", "department", "is_active"];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    setBulkErrors([]);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb  = XLSX.read(evt.target.result, { type: "array" });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (raw.length === 0) {
          setBulkErrors([{ row: "-", reason: "The sheet appears to be empty." }]);
          setBulkRows([]); setBulkModal(true); return;
        }
        const normalised = raw.map((r) => {
          const obj = {};
          for (const k of Object.keys(r)) {
            const key = k.toLowerCase().trim().replace(/\s+/g, "_");
            if (ALLOWED_COLS.includes(key)) obj[key] = r[k];
          }
          return obj;
        });
        const firstRow = normalised[0] || {};
        const missing  = REQUIRED_COLS.filter(c => !(c in firstRow));
        if (missing.length > 0) {
          setBulkErrors([{ row: "header", reason: `Missing required column(s): ${missing.join(", ")}` }]);
          setBulkRows([]); setBulkModal(true); return;
        }
        const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const errs = [];
        normalised.forEach((row, i) => {
          const rowNum = i + 2;
          if (!row.name?.toString().trim())  errs.push({ row: rowNum, email: row.email, reason: "Name is required" });
          if (!row.email?.toString().trim()) errs.push({ row: rowNum, email: row.email, reason: "Email is required" });
          else if (!EMAIL_RE.test(row.email?.toString().trim().toLowerCase()))
            errs.push({ row: rowNum, email: row.email, reason: "Invalid email format" });
        });
        setBulkRows(normalised); setBulkErrors(errs); setBulkModal(true);
      } catch {
        setBulkErrors([{ row: "-", reason: "Could not parse file. Ensure it is a valid .xlsx or .xls file." }]);
        setBulkRows([]); setBulkModal(true);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleBulkConfirm = async () => {
    if (bulkErrors.length > 0 || bulkRows.length === 0) return;
    setBulkUploading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      const res  = await fetch(`${base}/api/employees/bulk`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ employees: bulkRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors?.length) { setBulkErrors(data.errors); return; }
        showToast(data.message || "Bulk upload failed.", "error");
        setBulkModal(false); return;
      }
      showToast(`${data.total} employee(s) uploaded successfully.`);
      setBulkModal(false); setBulkRows([]); setBulkErrors([]); setBulkFileName("");
      await fetchEmployees();
    } catch {
      showToast("Bulk upload failed. Please try again.", "error");
    } finally {
      setBulkUploading(false);
    }
  };

  const closeBulkModal = () => {
    setBulkModal(false); setBulkRows([]); setBulkErrors([]); setBulkFileName("");
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["name", "email", "department", "is_active"],
      ["Jane Smith", "jane@company.com", "Engineering", "true"],
      ["John Doe",   "john@company.com", "HR",          "true"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "employees_template.xlsx");
  };

  if (loading) return (
    <div className={styles.loading}><div className={styles.spinner} /></div>
  );

  return (
    <div className={styles.container}>

      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {company?.logo && (
            <Image src={company.logo} alt="Logo" width={38} height={38}
              className={styles.companyLogo} unoptimized />
          )}
          <span className={styles.logoText}>{company?.name || "Dashboard"}</span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.backBtn} onClick={() => router.push("/home")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls"
            style={{ display: "none" }} onChange={handleFileChange} />
          <button className={styles.templateBtn} onClick={downloadTemplate}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v8M4 6l3 3 3-3M2 12v.5A1.5 1.5 0 003.5 14h7A1.5 1.5 0 0012 12.5V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Template</span>
          </button>
          <button className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v8M4 4L7 1l3 3M2 11v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Import Excel</span>
          </button>
          <button className={styles.addBtn} onClick={openAdd}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <span>Add Employee</span>
          </button>
        </div>
      </header>

      {/* HERO */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div>
            <h1 className={styles.heroTitle}>Employee <span>Directory</span></h1>
            <p className={styles.heroSub}>Manage the employees visitors can be assigned to meet</p>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.statPill}>
              <span className={styles.statNum}>{employees.filter(e => e.is_active).length}</span>
              <span className={styles.statLabel}>Active</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statPill}>
              <span className={styles.statNum}>{employees.length}</span>
              <span className={styles.statLabel}>Total</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.scrollBody}>
        <div className={styles.mainContent}>

          {/* TOOLBAR */}
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 15 15" fill="none">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <input className={styles.searchInput} type="text"
                placeholder="Search name, email or department…"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && (
                <button className={styles.clearSearch} onClick={() => setSearch("")}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
            <div className={styles.filterGroup}>
              <button className={`${styles.filterBtn} ${statusFilter === "all" ? styles.filterActive : ""}`}
                onClick={() => setStatusFilter("all")}>All</button>
              <button className={`${styles.filterBtn} ${statusFilter === "active" ? styles.filterActive : ""}`}
                onClick={() => setStatusFilter("active")}>Active</button>
              <button className={`${styles.filterBtn} ${statusFilter === "inactive" ? styles.filterActive : ""}`}
                onClick={() => setStatusFilter("inactive")}>Inactive</button>
            </div>
            <span className={styles.countBadge}>
              {filtered.length} {filtered.length !== 1 ? "employees" : "employee"}
            </span>
          </div>

          {/* TABLE */}
          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className={styles.emptyState}>
                          <div className={styles.emptyIcon}>
                            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                              <circle cx="15" cy="10" r="5" stroke="currentColor" strokeWidth="1.8"/>
                              <path d="M5 27c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <div className={styles.emptyTitle}>No employees found</div>
                          <div className={styles.emptyText}>
                            {search || statusFilter !== "all"
                              ? "Try adjusting your search or filter."
                              : "Add your first employee to get started."}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map(emp => (
                      <tr key={emp.id}>
                        <td>
                          <div className={styles.nameCell}>
                            <div className={styles.empAvatar}>{initials(emp.name)}</div>
                            <div className={styles.nameInfo}>
                              <span className={styles.empName}>{emp.name}</span>
                              <span className={styles.empEmail}>{emp.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {emp.department
                            ? <span className={styles.deptTag}>{emp.department}</span>
                            : <span className={styles.noDept}>—</span>}
                        </td>
                        <td>
                          <span className={`${styles.badge} ${emp.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                            <span className={styles.badgeDot} />
                            {emp.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actionCell}>
                            <button className={styles.editBtn} onClick={() => openEdit(emp)}>Edit</button>
                            <button className={styles.deleteBtn}
                              onClick={() => setDeleteTarget(emp)} disabled={deleting}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {modal && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalEyebrow}>{modal === "edit" ? "Editing record" : "New record"}</p>
                <h2 className={styles.modalTitle}>{modal === "edit" ? "Edit Employee" : "Add Employee"}</h2>
              </div>
              <button className={styles.modalClose} onClick={() => setModal(null)}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            {formError && <div className={styles.errorMsg}>{formError}</div>}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Full Name <span className={styles.req}>*</span></label>
                <input className={styles.formInput} type="text" placeholder="Jane Smith"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email <span className={styles.req}>*</span></label>
                <input className={styles.formInput} type="email" placeholder="jane@company.com"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Department</label>
              <input className={styles.formInput} type="text" placeholder="e.g. Engineering, HR, Sales"
                value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
            </div>
            <div className={styles.toggleRow}>
              <div>
                <span className={styles.toggleLabel}>Active Employee</span>
                <span className={styles.toggleSub}>Inactive employees won't appear in visitor flows</span>
              </div>
              <label className={styles.toggle}>
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <span className={styles.toggleSlider} />
              </label>
            </div>
            <div className={styles.modalBtns}>
              <button className={styles.modalCancelBtn} onClick={() => setModal(null)}>Cancel</button>
              <button className={styles.modalSaveBtn} onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : modal === "edit" ? "Save Changes" : "Add Employee"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className={styles.deleteModal}>
            <div className={styles.deleteIconWrap}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M8 5V3h4v2M17 5l-1 12a2 2 0 01-2 2H6a2 2 0 01-2-2L3 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 9v5M12 9v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className={styles.deleteTitle}>Remove Employee?</h2>
            <p className={styles.deleteText}>
              You are about to remove <strong>{deleteTarget.name}</strong>. This will unlink them from any existing visitor records.
            </p>
            <div className={styles.deleteBtns}>
              <button className={styles.deleteCancelBtn} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className={styles.deleteConfirmBtn} onClick={handleDelete} disabled={deleting}>
                {deleting ? "Removing…" : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK UPLOAD MODAL */}
      {bulkModal && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && closeBulkModal()}>
          <div className={styles.bulkModal}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalEyebrow}>Bulk import</p>
                <h2 className={styles.modalTitle}>
                  Upload Preview
                  {bulkFileName && <span className={styles.bulkFileName}>{bulkFileName}</span>}
                </h2>
              </div>
              <button className={styles.modalClose} onClick={closeBulkModal}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {bulkErrors.length > 0 && (
              <div className={styles.bulkErrorBox}>
                <div className={styles.bulkErrorTitle}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M7 4v3.5M7 9v.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  {bulkErrors.length} validation error{bulkErrors.length !== 1 ? "s" : ""} — fix the file and re-upload
                </div>
                <ul className={styles.bulkErrorList}>
                  {bulkErrors.slice(0, 10).map((e, i) => (
                    <li key={i}>Row {e.row}{e.email ? ` · ${e.email}` : ""} — {e.reason}</li>
                  ))}
                  {bulkErrors.length > 10 && (
                    <li className={styles.moreErrors}>+{bulkErrors.length - 10} more errors</li>
                  )}
                </ul>
              </div>
            )}

            {bulkRows.length > 0 && bulkErrors.length === 0 && (
              <>
                <div className={styles.bulkReadyBanner}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {bulkRows.length} row{bulkRows.length !== 1 ? "s" : ""} ready — existing emails will be updated
                </div>
                <div className={styles.bulkTableWrap}>
                  <table className={styles.bulkTable}>
                    <thead>
                      <tr><th>#</th><th>Name</th><th>Email</th><th>Department</th><th>Active</th></tr>
                    </thead>
                    <tbody>
                      {bulkRows.slice(0, 50).map((r, i) => (
                        <tr key={i}>
                          <td className={styles.bulkRowNum}>{i + 2}</td>
                          <td>{r.name || <span className={styles.missing}>missing</span>}</td>
                          <td>{r.email || <span className={styles.missing}>missing</span>}</td>
                          <td>{r.department || <span className={styles.noDept}>—</span>}</td>
                          <td>
                            <span className={`${styles.badge} ${
                              ["true","1","yes","active"].includes(String(r.is_active ?? "true").toLowerCase())
                                ? styles.badgeActive : styles.badgeInactive}`}>
                              <span className={styles.badgeDot} />
                              {["true","1","yes","active"].includes(String(r.is_active ?? "true").toLowerCase()) ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {bulkRows.length > 50 && (
                        <tr><td colSpan={5} className={styles.moreRows}>
                          +{bulkRows.length - 50} more rows not shown
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className={styles.bulkModalBtns}>
              <button className={styles.templateBtn} onClick={downloadTemplate}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1v8M3.5 6l3 3 3-3M1 11v.5A1.5 1.5 0 002.5 13h8A1.5 1.5 0 0012 11.5V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Download Template
              </button>
              <div style={{ flex: 1 }} />
              <button className={styles.modalCancelBtn} onClick={closeBulkModal}>Cancel</button>
              <button className={styles.modalSaveBtn} onClick={handleBulkConfirm}
                disabled={bulkErrors.length > 0 || bulkRows.length === 0 || bulkUploading}>
                {bulkUploading ? "Uploading…" : `Upload ${bulkRows.length} Employee${bulkRows.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.type === "success"
            ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M7 4v3.5M7 9v.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
}
