"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ChevronUp, ChevronDown, X, Plus } from "lucide-react";
import styles from "./style.module.css";

const MAX_CATEGORIES = 10;
const MAX_SUBCATEGORIES = 10;
const MAX_CUSTOM_FIELDS = 5;
const MAX_CUSTOM_FIELD_OPTIONS = 20;
const CUSTOM_FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "dropdown", label: "Dropdown" },
];

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
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [newSubName, setNewSubName] = useState({});   // { [categoryId]: string }
  const [showAddSubForm, setShowAddSubForm] = useState({}); // { [categoryId]: boolean }
  const [busyId, setBusyId] = useState("");           // generic busy lock for any row action

  // Custom fields
  const [customFields, setCustomFields] = useState([]);
  const [customFieldsLoading, setCustomFieldsLoading] = useState(true);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [addingField, setAddingField] = useState(false);
  const [showAddFieldForm, setShowAddFieldForm] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState({});   // { [fieldId]: string }
  const [showAddOptionForm, setShowAddOptionForm] = useState({}); // { [fieldId]: boolean }
  const [busyFieldId, setBusyFieldId] = useState("");

  const [activeTab, setActiveTab] = useState("toggles"); // "toggles" | "purpose" | "custom"

  useEffect(() => {
    const stored = localStorage.getItem("company");
    if (!stored) { router.replace("/auth/login"); return; }
    try { setCompany(JSON.parse(stored)); } catch { router.replace("/auth/login"); return; }
    fetchFields();
    fetchPurposeCategories();
    fetchCustomFields();
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
      setShowAddCategoryForm(false);
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
      setShowAddSubForm((p) => ({ ...p, [categoryId]: false }));
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

  const fetchCustomFields = async () => {
    try {
      setCustomFieldsLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/custom-fields`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.fields)) setCustomFields(data.fields);
    } catch {
      /* non-fatal — custom fields manager just shows empty */
    } finally {
      setCustomFieldsLoading(false);
    }
  };

  const customFieldApi = async (path, options = {}) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/custom-fields${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Request failed");
    return data;
  };

  const addCustomField = async () => {
    const label = newFieldLabel.trim();
    if (!label || addingField) return;
    setAddingField(true);
    try {
      await customFieldApi("", { method: "POST", body: JSON.stringify({ label, fieldType: newFieldType, isRequired: false }) });
      setNewFieldLabel("");
      setNewFieldType("text");
      setShowAddFieldForm(false);
      await fetchCustomFields();
      showToast("Custom field added");
    } catch (err) {
      showToast(err.message || "Failed to add custom field", "error");
    } finally {
      setAddingField(false);
    }
  };

  // label/fieldType/isRequired are always sent together — the backend
  // update is a full replace, not a partial merge, so every change
  // (rename, type switch, required toggle) carries the field's other
  // current values along with it.
  const updateCustomField = async (field, patch) => {
    setBusyFieldId(`field-${field.id}`);
    try {
      await customFieldApi(`/${field.id}`, {
        method: "PUT",
        body: JSON.stringify({
          label: patch.label ?? field.label,
          fieldType: patch.fieldType ?? field.fieldType,
          isRequired: patch.isRequired ?? field.isRequired,
        }),
      });
      await fetchCustomFields();
    } catch (err) {
      showToast(err.message || "Failed to update custom field", "error");
      await fetchCustomFields();
    } finally {
      setBusyFieldId("");
    }
  };

  const deleteCustomField = async (id) => {
    setBusyFieldId(`field-${id}`);
    try {
      await customFieldApi(`/${id}`, { method: "DELETE" });
      await fetchCustomFields();
      showToast("Custom field deleted");
    } catch (err) {
      showToast(err.message || "Failed to delete custom field", "error");
    } finally {
      setBusyFieldId("");
    }
  };

  const moveCustomField = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= customFields.length) return;
    const reordered = [...customFields];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setCustomFields(reordered);
    setBusyFieldId(`field-${reordered[index].id}`);
    try {
      await customFieldApi("/reorder", { method: "PUT", body: JSON.stringify({ order: reordered.map((f) => f.id) }) });
    } catch (err) {
      showToast(err.message || "Failed to reorder", "error");
      await fetchCustomFields();
    } finally {
      setBusyFieldId("");
    }
  };

  const addCustomFieldOption = async (fieldId) => {
    const label = (newOptionLabel[fieldId] || "").trim();
    if (!label) return;
    setBusyFieldId(`opt-add-${fieldId}`);
    try {
      await customFieldApi(`/${fieldId}/options`, { method: "POST", body: JSON.stringify({ label }) });
      setNewOptionLabel((p) => ({ ...p, [fieldId]: "" }));
      setShowAddOptionForm((p) => ({ ...p, [fieldId]: false }));
      await fetchCustomFields();
    } catch (err) {
      showToast(err.message || "Failed to add option", "error");
    } finally {
      setBusyFieldId("");
    }
  };

  const renameCustomFieldOption = async (id, label) => {
    if (!label.trim()) return;
    setBusyFieldId(`opt-${id}`);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/custom-field-options/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      });
      await fetchCustomFields();
    } catch {
      await fetchCustomFields();
    } finally {
      setBusyFieldId("");
    }
  };

  const deleteCustomFieldOption = async (id) => {
    setBusyFieldId(`opt-${id}`);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/custom-field-options/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      await fetchCustomFields();
      showToast("Option deleted");
    } catch {
      showToast("Failed to delete option", "error");
    } finally {
      setBusyFieldId("");
    }
  };

  const moveCustomFieldOption = async (field, index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= field.options.length) return;
    const reordered = [...field.options];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setCustomFields((prev) =>
      prev.map((f) => (f.id === field.id ? { ...f, options: reordered } : f))
    );
    setBusyFieldId(`opt-${reordered[index].id}`);
    try {
      await customFieldApi(`/${field.id}/options/reorder`, {
        method: "PUT",
        body: JSON.stringify({ order: reordered.map((o) => o.id) }),
      });
    } catch (err) {
      showToast(err.message || "Failed to reorder", "error");
      await fetchCustomFields();
    } finally {
      setBusyFieldId("");
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

        <nav className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "toggles" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("toggles")}
          >
            Field Toggles
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "purpose" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("purpose")}
          >
            Purpose of Visit
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "custom" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("custom")}
          >
            Custom Fields
          </button>
        </nav>

        {activeTab === "toggles" && fields && (
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
        {activeTab === "purpose" && (
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
                      showAddSubForm[cat.id] ? (
                        <div className={styles.purposeAddRow}>
                          <input
                            className={styles.purposeSubNameInput}
                            placeholder="Sub-purpose name…"
                            autoFocus
                            value={newSubName[cat.id] || ""}
                            disabled={busyId === `sub-add-${cat.id}`}
                            onChange={(e) => setNewSubName((p) => ({ ...p, [cat.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addSubcategory(cat.id);
                              if (e.key === "Escape") setShowAddSubForm((p) => ({ ...p, [cat.id]: false }));
                            }}
                          />
                          <button type="button" className={styles.addBtnSm} disabled={busyId === `sub-add-${cat.id}` || !(newSubName[cat.id] || "").trim()}
                            onClick={() => addSubcategory(cat.id)} aria-label="Confirm add sub-purpose">
                            <Plus size={13} />
                          </button>
                          <button type="button" className={styles.deleteBtnSm}
                            onClick={() => { setShowAddSubForm((p) => ({ ...p, [cat.id]: false })); setNewSubName((p) => ({ ...p, [cat.id]: "" })); }}
                            aria-label="Cancel">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button type="button" className={styles.addSubTriggerBtn}
                          onClick={() => setShowAddSubForm((p) => ({ ...p, [cat.id]: true }))}>
                          <Plus size={12} /> Add sub-purpose
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}

              {purposeCategories.length < MAX_CATEGORIES && (
                showAddCategoryForm ? (
                  <div className={styles.purposeAddCategoryRow}>
                    <input
                      className={styles.purposeCategoryNameInput}
                      placeholder="Category name… (e.g. Classes & Learning)"
                      autoFocus
                      value={newCategoryName}
                      disabled={addingCategory}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addCategory();
                        if (e.key === "Escape") setShowAddCategoryForm(false);
                      }}
                    />
                    <button type="button" className={styles.addBtn} disabled={addingCategory || !newCategoryName.trim()}
                      onClick={addCategory}>
                      <Plus size={14} /> Add
                    </button>
                    <button type="button" className={styles.cancelBtn}
                      onClick={() => { setShowAddCategoryForm(false); setNewCategoryName(""); }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button type="button" className={styles.addCategoryTriggerBtn}
                    onClick={() => setShowAddCategoryForm(true)}>
                    <Plus size={16} /> Add Category
                  </button>
                )
              )}

              {purposeCategories.length >= MAX_CATEGORIES && (
                <p className={styles.purposeLimitNote}>Maximum {MAX_CATEGORIES} categories reached.</p>
              )}
            </div>
          )}
        </section>
        )}

        {/* ── CUSTOM FIELDS ── */}
        {activeTab === "custom" && (
        <section className={styles.purposeSection}>
          <div className={styles.purposeSectionHeader}>
            <h2 className={styles.purposeSectionTitle}>Custom Fields</h2>
            <p className={styles.purposeSectionSub}>
              Add up to {MAX_CUSTOM_FIELDS} fields specific to your business (e.g. &ldquo;Vehicle Number&rdquo;,
              &ldquo;Vendor ID&rdquo;) — text, number, or a dropdown with your own options. Mark a field
              required to block submission until it&apos;s filled in. Appears on both the public
              registration page and when your team adds a visitor manually.
            </p>
          </div>

          {!customFieldsLoading && (
            <div className={styles.purposeCategoryList}>
              {customFields.map((field, index) => (
                <div key={field.id} className={styles.purposeCategoryCard}>
                  <div className={styles.purposeCategoryHeaderRow}>
                    <div className={styles.reorderBtns}>
                      <button type="button" className={styles.reorderBtn} disabled={index === 0 || busyFieldId === `field-${field.id}`}
                        onClick={() => moveCustomField(index, -1)} aria-label="Move up">
                        <ChevronUp size={13} />
                      </button>
                      <button type="button" className={styles.reorderBtn} disabled={index === customFields.length - 1 || busyFieldId === `field-${field.id}`}
                        onClick={() => moveCustomField(index, 1)} aria-label="Move down">
                        <ChevronDown size={13} />
                      </button>
                    </div>
                    <input
                      className={styles.purposeCategoryNameInput}
                      defaultValue={field.label}
                      disabled={busyFieldId === `field-${field.id}`}
                      onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== field.label) updateCustomField(field, { label: e.target.value.trim() }); }}
                    />
                    <button type="button" className={styles.deleteBtn} disabled={busyFieldId === `field-${field.id}`}
                      onClick={() => deleteCustomField(field.id)} aria-label="Delete custom field">
                      <X size={14} />
                    </button>
                  </div>

                  <div className={styles.customFieldMetaRow}>
                    <select
                      className={styles.customFieldTypeSelect}
                      value={field.fieldType}
                      disabled={busyFieldId === `field-${field.id}`}
                      onChange={(e) => updateCustomField(field, { fieldType: e.target.value })}
                    >
                      {CUSTOM_FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <label className={styles.customFieldRequiredLabel}>
                      <span className={`${styles.toggle} ${busyFieldId === `field-${field.id}` ? styles.toggleBusy : ""}`}>
                        <input
                          type="checkbox"
                          checked={field.isRequired}
                          disabled={busyFieldId === `field-${field.id}`}
                          onChange={(e) => updateCustomField(field, { isRequired: e.target.checked })}
                        />
                        <span className={styles.toggleSlider} />
                      </span>
                      Required
                    </label>
                  </div>

                  {field.fieldType === "dropdown" && (
                    <div className={styles.purposeSubList}>
                      {field.options.map((opt, optIndex) => (
                        <div key={opt.id} className={styles.purposeSubRow}>
                          <div className={styles.reorderBtns}>
                            <button type="button" className={styles.reorderBtnSm} disabled={optIndex === 0 || busyFieldId === `opt-${opt.id}`}
                              onClick={() => moveCustomFieldOption(field, optIndex, -1)} aria-label="Move up">
                              <ChevronUp size={11} />
                            </button>
                            <button type="button" className={styles.reorderBtnSm} disabled={optIndex === field.options.length - 1 || busyFieldId === `opt-${opt.id}`}
                              onClick={() => moveCustomFieldOption(field, optIndex, 1)} aria-label="Move down">
                              <ChevronDown size={11} />
                            </button>
                          </div>
                          <input
                            className={styles.purposeSubNameInput}
                            defaultValue={opt.label}
                            disabled={busyFieldId === `opt-${opt.id}`}
                            onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== opt.label) renameCustomFieldOption(opt.id, e.target.value); }}
                          />
                          <button type="button" className={styles.deleteBtnSm} disabled={busyFieldId === `opt-${opt.id}`}
                            onClick={() => deleteCustomFieldOption(opt.id)} aria-label="Delete option">
                            <X size={12} />
                          </button>
                        </div>
                      ))}

                      {field.options.length < MAX_CUSTOM_FIELD_OPTIONS && (
                        showAddOptionForm[field.id] ? (
                          <div className={styles.purposeAddRow}>
                            <input
                              className={styles.purposeSubNameInput}
                              placeholder="Option label…"
                              autoFocus
                              value={newOptionLabel[field.id] || ""}
                              disabled={busyFieldId === `opt-add-${field.id}`}
                              onChange={(e) => setNewOptionLabel((p) => ({ ...p, [field.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") addCustomFieldOption(field.id);
                                if (e.key === "Escape") setShowAddOptionForm((p) => ({ ...p, [field.id]: false }));
                              }}
                            />
                            <button type="button" className={styles.addBtnSm} disabled={busyFieldId === `opt-add-${field.id}` || !(newOptionLabel[field.id] || "").trim()}
                              onClick={() => addCustomFieldOption(field.id)} aria-label="Confirm add option">
                              <Plus size={13} />
                            </button>
                            <button type="button" className={styles.deleteBtnSm}
                              onClick={() => { setShowAddOptionForm((p) => ({ ...p, [field.id]: false })); setNewOptionLabel((p) => ({ ...p, [field.id]: "" })); }}
                              aria-label="Cancel">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button type="button" className={styles.addSubTriggerBtn}
                            onClick={() => setShowAddOptionForm((p) => ({ ...p, [field.id]: true }))}>
                            <Plus size={12} /> Add option
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              ))}

              {customFields.length < MAX_CUSTOM_FIELDS && (
                showAddFieldForm ? (
                  <div className={styles.purposeAddCategoryRow}>
                    <input
                      className={styles.purposeCategoryNameInput}
                      placeholder="Field name… (e.g. Vehicle Number)"
                      autoFocus
                      value={newFieldLabel}
                      disabled={addingField}
                      onChange={(e) => setNewFieldLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addCustomField();
                        if (e.key === "Escape") setShowAddFieldForm(false);
                      }}
                    />
                    <select
                      className={styles.customFieldTypeSelect}
                      value={newFieldType}
                      disabled={addingField}
                      onChange={(e) => setNewFieldType(e.target.value)}
                    >
                      {CUSTOM_FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <button type="button" className={styles.addBtn} disabled={addingField || !newFieldLabel.trim()}
                      onClick={addCustomField}>
                      <Plus size={14} /> Add
                    </button>
                    <button type="button" className={styles.cancelBtn}
                      onClick={() => { setShowAddFieldForm(false); setNewFieldLabel(""); setNewFieldType("text"); }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button type="button" className={styles.addCategoryTriggerBtn}
                    onClick={() => setShowAddFieldForm(true)}>
                    <Plus size={16} /> Add Custom Field
                  </button>
                )
              )}

              {customFields.length >= MAX_CUSTOM_FIELDS && (
                <p className={styles.purposeLimitNote}>Maximum {MAX_CUSTOM_FIELDS} custom fields reached.</p>
              )}
            </div>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
