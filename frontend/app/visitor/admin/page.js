"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./style.module.css";

const EMPTY_FORM = { name: "", email: "", department: "", is_active: true };

export default function AdminEmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState(null); // null | "add" | "edit"
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const getToken = () => localStorage.getItem("token");

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch {
      showToast("Failed to load employees", "error");
    }
  };

  useEffect(() => {
    const token = getToken();
    const stored = localStorage.getItem("company");
    if (!token) { router.replace("/"); return; }
    if (stored) {
      try { setCompany(JSON.parse(stored)); } catch {}
    }
    fetchEmployees().finally(() => setLoading(false));
  }, []);

  /* Filter */
  useEffect(() => {
    let list = employees;
    if (statusFilter === "active") list = list.filter(e => e.is_active);
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

  /* Avatar initials */
  const initials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    return parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0][0];
  };

  /* Open add modal */
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setEditTarget(null);
    setModal("add");
  };

  /* Open edit modal */
  const openEdit = (emp) => {
    setForm({ name: emp.name, email: emp.email, department: emp.department || "", is_active: !!emp.is_active });
    setFormError("");
    setEditTarget(emp);
    setModal("edit");
  };

  /* Save (add or edit) */
  const handleSave = async () => {
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (!form.email.trim()) { setFormError("Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setFormError("Enter a valid email."); return; }
    setSaving(true); setFormError("");
    try {
      const method = modal === "edit" ? "PUT" : "POST";
      const url = modal === "edit" ? `/api/employees/${editTarget.id}` : "/api/employees";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.message || "Failed to save."); return; }
      showToast(modal === "edit" ? "Employee updated!" : "Employee added!");
      setModal(null);
      await fetchEmployees();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  /* Delete */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/employees/${deleteTarget.id}`, {
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
          <button className={styles.backBtn} onClick={() => router.push("/home")}>← Back</button>
          <button className={styles.addBtn} onClick={openAdd}>
            + <span>Add Employee</span>
          </button>
        </div>
      </header>

      {/* HERO */}
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Employee <span>Directory</span></h1>
        <p className={styles.heroSub}>Manage the employees visitors can be assigned to meet</p>
      </div>

      <div className={styles.scrollBody}>
        <div className={styles.mainContent}>

          {/* TOOLBAR */}
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>🔍</span>
              <input className={styles.searchInput} type="text"
                placeholder="Search by name, email or department…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className={styles.filterSelect} value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
            <span className={styles.countBadge}>{filtered.length} employee{filtered.length !== 1 ? "s" : ""}</span>
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
                          <div className={styles.emptyIcon}>👥</div>
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
                            <div className={styles.empAvatar}>{initials(emp.name).toUpperCase()}</div>
                            <div className={styles.nameInfo}>
                              <span className={styles.empName}>{emp.name}</span>
                              <span className={styles.empEmail}>{emp.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>{emp.department || <span style={{ color: "#b8a8d8" }}>—</span>}</td>
                        <td>
                          <span className={`${styles.badge} ${emp.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                            {emp.is_active ? "● Active" : "● Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actionCell}>
                            <button className={styles.editBtn} onClick={() => openEdit(emp)}>Edit</button>
                            <button className={styles.deleteBtn}
                              onClick={() => setDeleteTarget(emp)} disabled={deleting}>
                              Remove
                            </button>
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
              <h2 className={styles.modalTitle}>{modal === "edit" ? "Edit Employee" : "Add Employee"}</h2>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>

            {formError && <div className={styles.errorMsg}>⚠ {formError}</div>}

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Full Name *</label>
                <input className={styles.formInput} type="text" placeholder="Jane Smith"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email *</label>
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
              <span className={styles.toggleLabel}>Active Employee</span>
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
            <div className={styles.deleteIcon}>🗑️</div>
            <h2 className={styles.deleteTitle}>Remove Employee?</h2>
            <p className={styles.deleteText}>
              Are you sure you want to remove <strong>{deleteTarget.name}</strong>?
              This will unlink them from any existing visitor records.
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

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
