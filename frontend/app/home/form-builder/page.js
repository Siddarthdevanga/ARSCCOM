"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ChevronUp, ChevronDown, X, Plus } from "lucide-react";
import styles from "./style.module.css";

const MAX_CATEGORIES = 10;
const MAX_SUBCATEGORIES = 10;

/* ── Field catalogue — keys must match backend TOGGLEABLE_VISITOR_FIELDS ──
   Subtext only where the field isn't self-explanatory or has a side effect
   worth calling out (Person to Meet, ID Proof, Belongings). Everything else
   is label + toggle, nothing more.

   Flattened (not grouped into per-step cards): with only 1 field in Step 1
   and 1 in Step 3 versus 10 in Step 2, per-step cards left two columns
   mostly empty. Instead every field is its own compact tile carrying a
   small step tag, and a CSS multi-column layout balances tile heights
   across columns automatically regardless of screen size or how many
   fields any given step has. */
const STEP_TAGS = {
  1: { label: "Step 1", color: "#6200d6" },
  2: { label: "Step 2", color: "#0284c7" },
  3: { label: "Step 3", color: "#b45309" },
};

const FIELDS = [
  { key: "email",        label: "Email Address", step: 1 },
  { key: "fromCompany",  label: "From Company", step: 2 },
  { key: "department",   label: "Department", step: 2 },
  { key: "designation",  label: "Designation", step: 2 },
  { key: "address",      label: "Organization Address", step: 2 },
  { key: "city",         label: "City", step: 2 },
  { key: "state",        label: "State", step: 2 },
  { key: "postalCode",   label: "Postal Code", step: 2 },
  { key: "country",      label: "Country", step: 2 },
  { key: "personToMeet", label: "Person to Meet", step: 2, sub: "Disabling this also turns off the approval WhatsApp sent to that employee" },
  { key: "belongings",   label: "Belongings Checklist", step: 2, sub: "Laptop, bag, documents, mobile, camera, other" },
  { key: "idProof",      label: "ID Proof", step: 3, sub: "ID type and ID number together" },
];

export default function FormBuilderPage() {
  const router = useRouter();

  const [company, setCompany]   = useState(null);
  const [fields, setFields]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [toast, setToast]       = useState(null);

  // Purpose of Visit custom categories
  const [purposeCategories, setPurposeCategories] = useState([]);
  const [purposeLoading, setPurposeLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newSubName, setNewSubName] = useState({});   // { [categoryId]: string }
  const [busyId, setBusyId] = useState("");           // generic busy lock for any row action

  useEffect(() => {
    const stored = localStorage.getItem("company");
    if (!stored) { router.replace("/auth/login"); return; }
    try { setCompany(JSON.parse(stored)); } catch { router.replace("/auth/login"); return; }
    fetchFields();
    fetchPurposeCategories();
  }, [router]);

  const fetchPurposeCategories = async () => {
    try {
      setPurposeLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/purpose-categories`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.categories)) setPurposeCategories(data.categories);
    } catch {
      /* non-fatal — category manager just shows empty */
    } finally {
      setPurposeLoading(false);
    }
  };

  const purposeApi = async (path, options = {}) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/purpose-categories${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Request failed");
    return data;
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || addingCategory) return;
    setAddingCategory(true);
    try {
      await purposeApi("", { method: "POST", body: JSON.stringify({ name }) });
      setNewCategoryName("");
      await fetchPurposeCategories();
      showToast("Category added");
    } catch (err) {
      showToast(err.message || "Failed to add category", "error");
    } finally {
      setAddingCategory(false);
    }
  };

  const renameCategory = async (id, name) => {
    if (!name.trim()) return;
    setBusyId(`cat-${id}`);
    try {
      await purposeApi(`/${id}`, { method: "PUT", body: JSON.stringify({ name: name.trim() }) });
      await fetchPurposeCategories();
    } catch (err) {
      showToast(err.message || "Failed to rename category", "error");
      await fetchPurposeCategories();
    } finally {
      setBusyId("");
    }
  };

  const deleteCategory = async (id) => {
    setBusyId(`cat-${id}`);
    try {
      await purposeApi(`/${id}`, { method: "DELETE" });
      await fetchPurposeCategories();
      showToast("Category deleted");
    } catch (err) {
      showToast(err.message || "Failed to delete category", "error");
    } finally {
      setBusyId("");
    }
  };

  const moveCategory = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= purposeCategories.length) return;
    const reordered = [...purposeCategories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setPurposeCategories(reordered);
    setBusyId(`cat-${reordered[index].id}`);
    try {
      await purposeApi("/reorder", { method: "PUT", body: JSON.stringify({ order: reordered.map((c) => c.id) }) });
    } catch (err) {
      showToast(err.message || "Failed to reorder", "error");
      await fetchPurposeCategories();
    } finally {
      setBusyId("");
    }
  };

  const addSubcategory = async (categoryId) => {
    const name = (newSubName[categoryId] || "").trim();
    if (!name) return;
    setBusyId(`sub-add-${categoryId}`);
    try {
      await purposeApi(`/${categoryId}/subcategories`, { method: "POST", body: JSON.stringify({ name }) });
      setNewSubName((p) => ({ ...p, [categoryId]: "" }));
      await fetchPurposeCategories();
    } catch (err) {
      showToast(err.message || "Failed to add sub-purpose", "error");
    } finally {
      setBusyId("");
    }
  };

  const renameSubcategory = async (id, name) => {
    if (!name.trim()) return;
    setBusyId(`sub-${id}`);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/purpose-subcategories/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      await fetchPurposeCategories();
    } catch {
      await fetchPurposeCategories();
    } finally {
      setBusyId("");
    }
  };

  const deleteSubcategory = async (id) => {
    setBusyId(`sub-${id}`);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/purpose-subcategories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      await fetchPurposeCategories();
      showToast("Sub-purpose deleted");
    } catch (err) {
      showToast("Failed to delete sub-purpose", "error");
    } finally {
      setBusyId("");
    }
  };

  const moveSubcategory = async (category, index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= category.subcategories.length) return;
    const reordered = [...category.subcategories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setPurposeCategories((prev) =>
      prev.map((c) => (c.id === category.id ? { ...c, subcategories: reordered } : c))
    );
    setBusyId(`sub-${reordered[index].id}`);
    try {
      await purposeApi(`/${category.id}/subcategories/reorder`, {
        method: "PUT",
        body: JSON.stringify({ order: reordered.map((s) => s.id) }),
      });
    } catch (err) {
      showToast(err.message || "Failed to reorder", "error");
      await fetchPurposeCategories();
    } finally {
      setBusyId("");
    }
  };

  const fetchFields = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/visitor-fields`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load form settings");
      setFields(data.fields);
    } catch (err) {
      setError(err.message || "Unable to load form settings");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  };

  const toggleField = async (key) => {
    const nextValue = !fields[key];
    const prev = fields;
    setFields({ ...fields, [key]: nextValue });
    setSavingKey(key);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/visitor-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fields: { [key]: nextValue } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save");
      setFields(data.fields);
      showToast(nextValue ? "Field enabled" : "Field disabled");
    } catch (err) {
      setFields(prev); // revert on failure
      showToast(err.message || "Failed to save change", "error");
    } finally {
      setSavingKey("");
    }
  };

  if (loading || !company) {
    return <div className={styles.container}><div className={styles.loading}>Loading…</div></div>;
  }

  return (
    <div className={styles.container}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : ""}`}>
          {toast.msg}
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company?.name}</div>
        </div>
        <div className={styles.rightHeader}>
          {company?.id && (
            <img src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/logo/${company.id}`} alt="Logo"
              className={styles.companyLogo} onError={e => { e.currentTarget.style.display = "none"; }} />
          )}
          <button className={styles.backBtn} onClick={() => router.push("/home")}>← Back</button>
        </div>
      </header>

      <div className={styles.scrollBody}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Form <span>Builder</span></h1>
          <p className={styles.heroSub}>
            Choose which fields appear on your visitor registration form — for both the public
            check-in page and when your team registers a visitor manually.
          </p>
          <div className={styles.lockedNote}>
            <Lock size={12} />
            Name, WhatsApp Number, Photo, and Purpose of Visit are always collected and can&apos;t be turned off.
          </div>
        </section>

        {error && <div className={styles.errorBanner}>{error}</div>}

        {fields && (
          <main className={styles.fieldColumns}>
            {FIELDS.map((item) => {
              const tag = STEP_TAGS[item.step];
              return (
                <div key={item.key} className={styles.toggleTile}>
                  <span className={styles.stepTag} style={{ color: tag.color, borderColor: `${tag.color}33`, background: `${tag.color}14` }}>
                    {tag.label}
                  </span>
                  <div className={styles.toggleRow}>
                    <div>
                      <span className={styles.toggleLabel}>{item.label}</span>
                      {item.sub && <span className={styles.toggleSub}>{item.sub}</span>}
                    </div>
                    <label className={`${styles.toggle} ${savingKey === item.key ? styles.toggleBusy : ""}`}>
                      <input
                        type="checkbox"
                        checked={!!fields[item.key]}
                        disabled={savingKey === item.key}
                        onChange={() => toggleField(item.key)}
                      />
                      <span className={styles.toggleSlider} />
                    </label>
                  </div>
                </div>
              );
            })}
          </main>
        )}

        {/* ── PURPOSE OF VISIT — CUSTOM CATEGORIES ── */}
        <section className={styles.purposeSection}>
          <div className={styles.purposeSectionHeader}>
            <h2 className={styles.purposeSectionTitle}>Purpose of Visit — Custom Categories</h2>
            <p className={styles.purposeSectionSub}>
              Optional. Add your own categories (e.g. &ldquo;Classes &amp; Learning&rdquo;) and sub-purposes
              under each — visitors then pick from a dropdown instead of typing. Leave empty to keep
              the plain text field. An &ldquo;Others&rdquo; option with free text is always included automatically.
            </p>
          </div>

          {!purposeLoading && (
            <div className={styles.purposeCategoryList}>
              {purposeCategories.map((cat, index) => (
                <div key={cat.id} className={styles.purposeCategoryCard}>
                  <div className={styles.purposeCategoryHeaderRow}>
                    <div className={styles.reorderBtns}>
                      <button type="button" className={styles.reorderBtn} disabled={index === 0 || busyId === `cat-${cat.id}`}
                        onClick={() => moveCategory(index, -1)} aria-label="Move up">
                        <ChevronUp size={13} />
                      </button>
                      <button type="button" className={styles.reorderBtn} disabled={index === purposeCategories.length - 1 || busyId === `cat-${cat.id}`}
                        onClick={() => moveCategory(index, 1)} aria-label="Move down">
                        <ChevronDown size={13} />
                      </button>
                    </div>
                    <input
                      className={styles.purposeCategoryNameInput}
                      defaultValue={cat.name}
                      disabled={busyId === `cat-${cat.id}`}
                      onBlur={(e) => { if (e.target.value.trim() !== cat.name) renameCategory(cat.id, e.target.value); }}
                    />
                    <button type="button" className={styles.deleteBtn} disabled={busyId === `cat-${cat.id}`}
                      onClick={() => deleteCategory(cat.id)} aria-label="Delete category">
                      <X size={14} />
                    </button>
                  </div>

                  <div className={styles.purposeSubList}>
                    {cat.subcategories.map((sub, subIndex) => (
                      <div key={sub.id} className={styles.purposeSubRow}>
                        <div className={styles.reorderBtns}>
                          <button type="button" className={styles.reorderBtnSm} disabled={subIndex === 0 || busyId === `sub-${sub.id}`}
                            onClick={() => moveSubcategory(cat, subIndex, -1)} aria-label="Move up">
                            <ChevronUp size={11} />
                          </button>
                          <button type="button" className={styles.reorderBtnSm} disabled={subIndex === cat.subcategories.length - 1 || busyId === `sub-${sub.id}`}
                            onClick={() => moveSubcategory(cat, subIndex, 1)} aria-label="Move down">
                            <ChevronDown size={11} />
                          </button>
                        </div>
                        <input
                          className={styles.purposeSubNameInput}
                          defaultValue={sub.name}
                          disabled={busyId === `sub-${sub.id}`}
                          onBlur={(e) => { if (e.target.value.trim() !== sub.name) renameSubcategory(sub.id, e.target.value); }}
                        />
                        <button type="button" className={styles.deleteBtnSm} disabled={busyId === `sub-${sub.id}`}
                          onClick={() => deleteSubcategory(sub.id)} aria-label="Delete sub-purpose">
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    {cat.subcategories.length < MAX_SUBCATEGORIES && (
                      <div className={styles.purposeAddRow}>
                        <input
                          className={styles.purposeSubNameInput}
                          placeholder="Add sub-purpose…"
                          value={newSubName[cat.id] || ""}
                          disabled={busyId === `sub-add-${cat.id}`}
                          onChange={(e) => setNewSubName((p) => ({ ...p, [cat.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && addSubcategory(cat.id)}
                        />
                        <button type="button" className={styles.addBtnSm} disabled={busyId === `sub-add-${cat.id}` || !(newSubName[cat.id] || "").trim()}
                          onClick={() => addSubcategory(cat.id)} aria-label="Add sub-purpose">
                          <Plus size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {purposeCategories.length < MAX_CATEGORIES && (
                <div className={styles.purposeAddCategoryRow}>
                  <input
                    className={styles.purposeCategoryNameInput}
                    placeholder="Add category… (e.g. Classes & Learning)"
                    value={newCategoryName}
                    disabled={addingCategory}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCategory()}
                  />
                  <button type="button" className={styles.addBtn} disabled={addingCategory || !newCategoryName.trim()}
                    onClick={addCategory}>
                    <Plus size={14} /> Add Category
                  </button>
                </div>
              )}

              {purposeCategories.length >= MAX_CATEGORIES && (
                <p className={styles.purposeLimitNote}>Maximum {MAX_CATEGORIES} categories reached.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
