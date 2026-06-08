"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtYen } from "@/lib/format";

type OrderStatus = "draft" | "issued" | "partial_delivered" | "delivered" | "completed";

const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "未発注",
  issued: "発注済",
  partial_delivered: "一部納品",
  delivered: "納品済",
  completed: "支払済",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  draft: "#94a3b8",
  issued: "#3b82f6",
  partial_delivered: "#d97706",
  delivered: "#22c55e",
  completed: "#6d28d9",
};

interface OrderItem {
  id: string;
  row_no: number;
  item_name: string;
  spec: string | null;
  unit: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
  delivered_quantity: number;
  delivery_status: string;
}

interface PurchaseOrder {
  id: string;
  project_id: string;
  vendor_id: string;
  vendor_name: string | null;
  order_number: string | null;
  order_date: string | null;
  delivery_date: string | null;
  payment_due_date: string | null;
  paid_at: string | null;
  delivery_address: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: OrderStatus;
  issued_at: string | null;
  items: OrderItem[];
}

interface Vendor {
  id: string;
  vendor_name: string;
}

interface PriceHistory {
  id: string;
  item_name: string;
  item_spec: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
}

interface FormItem {
  item_name: string;
  spec: string;
  unit: string;
  quantity: string;
  unit_price: string;
  amount: string;
}

const emptyItem = (): FormItem => ({
  item_name: "",
  spec: "",
  unit: "式",
  quantity: "1",
  unit_price: "0",
  amount: "0",
});

function orderToFormItems(order: PurchaseOrder): FormItem[] {
  if (!order.items.length) return [emptyItem()];
  return order.items.map((i) => ({
    item_name: i.item_name,
    spec: i.spec || "",
    unit: i.unit || "式",
    quantity: String(i.quantity),
    unit_price: String(i.unit_price),
    amount: String(i.amount),
  }));
}

export default function PurchasePage() {
  const { id } = useParams<{ id: string }>();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // フォーム状態: null=非表示, "new"=新規, string=編集中orderのID
  const [formMode, setFormMode] = useState<"new" | string | null>(null);
  const editingOrder = formMode && formMode !== "new" ? orders.find((o) => o.id === formMode) ?? null : null;

  const [form, setForm] = useState({
    vendor_id: "",
    order_date: new Date().toISOString().slice(0, 10),
    delivery_date: "",
    payment_due_date: "",
    delivery_address: "",
  });
  const [items, setItems] = useState<FormItem[]>([emptyItem()]);

  // D&D スキャン状態
  const [dragOver, setDragOver] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  // 工事台帳連動フィードバック
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ords, vends] = await Promise.all([
        apiFetch<PurchaseOrder[]>(`/api/v1/projects/${id}/purchase-orders`),
        apiFetch<{ items: Vendor[] }>("/api/v1/vendors?limit=200").then((d) => d.items),
      ]);
      setOrders(ords);
      setVendors(vends);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function openNew() {
    setForm({ vendor_id: "", order_date: new Date().toISOString().slice(0, 10), delivery_date: "", payment_due_date: "", delivery_address: "" });
    setItems([emptyItem()]);
    setScanMsg("");
    setFormMode("new");
  }

  function openEdit(order: PurchaseOrder) {
    setForm({
      vendor_id: order.vendor_id,
      order_date: order.order_date ?? new Date().toISOString().slice(0, 10),
      delivery_date: order.delivery_date ?? "",
      payment_due_date: order.payment_due_date ?? "",
      delivery_address: order.delivery_address ?? "",
    });
    setItems(orderToFormItems(order));
    setScanMsg("");
    setFormMode(order.id);
  }

  function closeForm() {
    setFormMode(null);
    setScanMsg("");
    setFormError(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }

  function updateItem(idx: number, field: string, value: string) {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "quantity" || field === "unit_price") {
      const q = parseFloat(updated[idx].quantity) || 0;
      const p = parseFloat(updated[idx].unit_price) || 0;
      updated[idx].amount = String(Math.round(q * p));
    }
    setItems(updated);
  }

  async function handleVendorChange(vendorId: string) {
    setForm({ ...form, vendor_id: vendorId });
    if (!vendorId || formMode !== "new") return;
    try {
      const res = await apiFetch<{ items: PriceHistory[] }>(`/api/v1/vendors/${vendorId}/price-history?limit=50`);
      const history = res.items;
      if (!history.length) return;
      const ok = confirm(`業者の見積履歴が ${history.length} 件あります。明細に自動追加しますか？`);
      if (!ok) return;
      const newItems: FormItem[] = history.map((h) => ({
        item_name: h.item_name,
        spec: h.item_spec || "",
        unit: h.unit || "式",
        quantity: String(h.quantity ?? 1),
        unit_price: String(h.unit_price ?? 0),
        amount: String(h.amount ?? Math.round((h.quantity ?? 1) * (h.unit_price ?? 0))),
      }));
      setItems((prev) => {
        const hasContent = prev.some((i) => i.item_name.trim() !== "");
        return hasContent ? [...prev, ...newItems] : newItems;
      });
    } catch { /* ignore */ }
  }

  async function handleScanFile(file: File) {
    setScanning(true);
    setScanMsg("アップロード中…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("cmv3_access_token");
      const res = await fetch(`/api/v1/scan/upload?project_id=${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setScanMsg(`エラー: ${(err as { detail?: string }).detail ?? res.statusText}`);
        setScanning(false);
        return;
      }
      const job = await res.json() as { id: string };
      setScanMsg("AI解析中… しばらくお待ちください");
      pollRef.current = setInterval(async () => {
        try {
          const j = await apiFetch<{ id: string; status: string }>(`/api/v1/scan/jobs/${job.id}`);
          if (j.status === "succeeded") {
            clearInterval(pollRef.current!);
            setScanning(false);
            setScanMsg("");
            await importScanItems(j.id);
          } else if (j.status === "failed") {
            clearInterval(pollRef.current!);
            setScanning(false);
            setScanMsg("解析に失敗しました");
          }
        } catch {
          clearInterval(pollRef.current!);
          setScanning(false);
          setScanMsg("解析状態の確認に失敗しました");
        }
      }, 2500);
    } catch {
      setScanning(false);
      setScanMsg("アップロードに失敗しました");
    }
  }

  async function importScanItems(jobId: string) {
    try {
      const job = await apiFetch<{
        results?: Array<{
          items?: Array<{ item_name: string | null; spec?: string | null; unit?: string | null; quantity?: number | null; unit_price?: number | null; amount?: number | null }>
        }>
      }>(`/api/v1/scan/jobs/${jobId}`);
      const rawItems = (job.results?.[0]?.items ?? []).filter((i) => i.item_name);
      if (!rawItems.length) { setScanMsg("明細が見つかりませんでした"); return; }
      const newItems: FormItem[] = rawItems.map((i) => ({
        item_name: i.item_name ?? "",
        spec: i.spec || "",
        unit: i.unit || "式",
        quantity: String(i.quantity ?? 1),
        unit_price: String(i.unit_price ?? 0),
        amount: String(i.amount ?? Math.round((i.quantity ?? 1) * (i.unit_price ?? 0))),
      }));
      const ok = confirm(`スキャン結果から ${newItems.length} 件の明細を追加しますか？`);
      if (!ok) return;
      setItems((prev) => prev.some((i) => i.item_name.trim()) ? [...prev, ...newItems] : newItems);
      setScanMsg(`✅ ${newItems.length} 件の明細を追加しました`);
    } catch {
      setScanMsg("スキャン結果の読み込みに失敗しました");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleScanFile(file);
  }

  function buildBody() {
    return JSON.stringify({
      ...form,
      delivery_date: form.delivery_date || null,
      payment_due_date: form.payment_due_date || null,
      delivery_address: form.delivery_address || null,
      items: items.filter((i) => i.item_name).map((i, idx) => ({
        item_name: i.item_name,
        spec: i.spec || null,
        unit: i.unit,
        quantity: parseFloat(i.quantity),
        unit_price: parseFloat(i.unit_price),
        amount: parseFloat(i.amount),
        row_no: idx + 1,
      })),
    });
  }

  async function handleSave(issueAfter = false) {
    setSaving(true);
    setFormError(null);
    try {
      let created: PurchaseOrder;
      if (formMode === "new") {
        created = await apiFetch<PurchaseOrder>(`/api/v1/projects/${id}/purchase-orders`, {
          method: "POST",
          body: buildBody(),
        });
      } else {
        created = await apiFetch<PurchaseOrder>(`/api/v1/purchase-orders/${formMode}`, {
          method: "PUT",
          body: buildBody(),
        });
      }
      if (issueAfter) {
        await apiFetch(`/api/v1/purchase-orders/${created.id}/issue`, { method: "POST" });
      }
      closeForm();
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "保存に失敗しました";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(orderId: string, isDraft: boolean) {
    if (!confirm(isDraft ? "この発注書を削除しますか？" : "発行済の発注書を削除します。本当によろしいですか？")) return;
    await apiFetch(`/api/v1/purchase-orders/${orderId}`, { method: "DELETE" });
    await load();
  }

  const showSyncMsg = (msg: string) => {
    setSyncMsg(msg);
    setTimeout(() => setSyncMsg(null), 4000);
  };

  async function handleIssue(orderId: string) {
    if (!confirm("発注書を発行しますか？\n工事台帳の取決金額が自動更新されます。")) return;
    await apiFetch(`/api/v1/purchase-orders/${orderId}/issue`, { method: "POST" });
    await load();
    showSyncMsg("✓ 発注済に変更しました。取決金額を工事台帳に反映しました。");
  }

  async function handleMarkDelivered(orderId: string) {
    if (!confirm("納品済にしますか？")) return;
    await apiFetch(`/api/v1/purchase-orders/${orderId}/mark-delivered`, { method: "POST" });
    await load();
    showSyncMsg("✓ 納品済に変更しました。取決金額を工事台帳に反映しました。");
  }

  async function handleMarkPaid(orderId: string) {
    if (!confirm("支払済にしますか？")) return;
    await apiFetch(`/api/v1/purchase-orders/${orderId}/mark-paid`, { method: "POST" });
    await load();
    showSyncMsg("✓ 支払済に変更しました。");
  }

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const tax = Math.round(subtotal * 0.1);

  const formTitle = formMode === "new" ? "新規発注書" : `発注書を編集${editingOrder?.order_number ? ` #${editingOrder.order_number}` : ""}`;

  return (
    <AppShell
      breadcrumbs={[{ label: "案件", href: `/projects/${id}` }, { label: "発注書" }]}
      action={syncMsg ? (
        <span style={{ fontSize: 12, color: "var(--c-success)", fontWeight: 600, padding: "4px 10px",
          background: "color-mix(in oklab, var(--c-success) 10%, var(--c-surface))",
          borderRadius: "var(--r-pill)", border: "1px solid color-mix(in oklab, var(--c-success) 25%, transparent)" }}>
          {syncMsg}
        </span>
      ) : undefined}
    >
      <div style={{ padding: "var(--sp-4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
          <h2 style={{ fontWeight: 700, fontSize: "var(--fs-lg)" }}>発注書</h2>
          {!formMode && <Button onClick={openNew}>+ 発注書作成</Button>}
        </div>

        {/* 作成・編集フォーム */}
        {formMode && (
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--radius)", padding: "var(--sp-4)", marginBottom: "var(--sp-4)" }}>
            <h3 style={{ fontWeight: 600, marginBottom: "var(--sp-3)" }}>{formTitle}</h3>

            {/* D&D スキャンゾーン */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "var(--c-brand, #3b82f6)" : "var(--c-border)"}`,
                borderRadius: "var(--radius-sm)",
                padding: "var(--sp-6) var(--sp-4)",
                minHeight: 120,
                marginBottom: "var(--sp-3)",
                textAlign: "center",
                cursor: scanning ? "wait" : "pointer",
                background: dragOver ? "#eff6ff" : "var(--c-surface-2)",
                color: "var(--c-text-muted)",
                fontSize: "var(--fs-sm)",
                transition: "all 0.15s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--sp-1)",
              }}
            >
              {scanning ? (
                <>
                  <span style={{ fontSize: 28 }}>⏳</span>
                  <span>{scanMsg}</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 32 }}>📎</span>
                  <span style={{ fontWeight: 600 }}>業者の発注書をここにドラッグ＆ドロップ</span>
                  <span style={{ fontSize: "var(--fs-xs)" }}>PDF / Excel (.xlsx) / 画像 — またはクリックしてファイル選択</span>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScanFile(f); e.target.value = ""; }}
            />
            {scanMsg && !scanning && (
              <div style={{ fontSize: "var(--fs-xs)", color: scanMsg.startsWith("✅") ? "#22c55e" : "#ef4444", marginBottom: "var(--sp-2)" }}>
                {scanMsg}
              </div>
            )}

            {/* 基本情報 */}
            <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", marginBottom: "var(--sp-3)" }}>
              <div style={{ flex: "1 0 200px" }}>
                <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>発注先業者 *</div>
                <select
                  value={form.vendor_id}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--c-border)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-sm)", background: "var(--c-surface)", color: "var(--c-text)" }}
                >
                  <option value="">業者を選択</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 140px" }}>
                <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>発注日</div>
                <Input type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} />
              </div>
              <div style={{ flex: "0 0 140px" }}>
                <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>納期</div>
                <Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
              </div>
              <div style={{ flex: "0 0 140px" }}>
                <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>支払期日</div>
                <Input type="date" value={form.payment_due_date} onChange={(e) => setForm({ ...form, payment_due_date: e.target.value })} />
              </div>
              <div style={{ flex: "1 0 200px" }}>
                <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>納品先</div>
                <Input value={form.delivery_address} onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} placeholder="現場住所" />
              </div>
            </div>

            {/* 明細テーブル */}
            <div style={{ marginBottom: "var(--sp-3)" }}>
              <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", marginBottom: "var(--sp-2)" }}>明細</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-sm)" }}>
                  <thead>
                    <tr style={{ background: "var(--c-surface-2)" }}>
                      {["品名", "仕様", "単位", "数量", "単価", "金額"].map((h) => (
                        <th key={h} style={{ padding: "4px 8px", textAlign: "left", fontWeight: 600, fontSize: "var(--fs-xs)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: "2px 4px" }}><Input value={item.item_name} onChange={(e) => updateItem(idx, "item_name", e.target.value)} placeholder="品名" /></td>
                        <td style={{ padding: "2px 4px" }}><Input value={item.spec} onChange={(e) => updateItem(idx, "spec", e.target.value)} placeholder="仕様" /></td>
                        <td style={{ padding: "2px 4px" }}><Input value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} style={{ width: 50 }} /></td>
                        <td style={{ padding: "2px 4px" }}><Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} style={{ width: 70 }} /></td>
                        <td style={{ padding: "2px 4px" }}><Input type="number" value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", e.target.value)} style={{ width: 100 }} /></td>
                        <td style={{ padding: "2px 4px", fontWeight: 600 }}>{fmtYen(parseFloat(item.amount) || 0)}</td>
                        <td>
                          <button onClick={() => setItems(items.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)" }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => setItems([...items, emptyItem()])}
                style={{ marginTop: "var(--sp-2)", background: "none", border: "1px dashed var(--c-border)", borderRadius: "var(--radius-sm)", width: "100%", padding: "var(--sp-1)", cursor: "pointer", color: "var(--c-text-muted)", fontSize: "var(--fs-sm)" }}
              >
                + 明細追加
              </button>
            </div>

            {/* 合計 */}
            <div style={{ textAlign: "right", fontSize: "var(--fs-sm)", marginBottom: "var(--sp-3)" }}>
              <div>小計: {fmtYen(subtotal)}</div>
              <div>消費税: {fmtYen(tax)}</div>
              <div style={{ fontWeight: 700, fontSize: "var(--fs-base)" }}>合計: {fmtYen(subtotal + tax)}</div>
            </div>

            {formError && (
              <div style={{ marginBottom: "var(--sp-2)", padding: "var(--sp-2) var(--sp-3)", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "var(--radius-sm)", color: "#dc2626", fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                ⚠️ {formError}
              </div>
            )}
            <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "center" }}>
              <Button onClick={() => handleSave(false)} disabled={saving || !form.vendor_id}>
                {saving ? "保存中…" : "下書き保存"}
              </Button>
              {formMode === "new" && (
                <Button onClick={() => handleSave(true)} disabled={saving || !form.vendor_id} style={{ background: "#2563eb", color: "#fff" }}>
                  {saving ? "保存中…" : "発行して保存"}
                </Button>
              )}
              <Button variant="ghost" onClick={closeForm}>キャンセル</Button>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)" }}>
                ※ 下書きは後から「発行する」で発行できます
              </span>
            </div>
          </div>
        )}

        {/* 一覧 */}
        {loading ? (
          <p style={{ color: "var(--c-text-muted)" }}>読み込み中…</p>
        ) : orders.length === 0 ? (
          <div style={{ padding: "var(--sp-8)", textAlign: "center", color: "var(--c-text-muted)", border: "2px dashed var(--c-border)", borderRadius: "var(--radius)" }}>
            発注書がまだありません。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            {orders.map((order) => (
              <div key={order.id} style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                <div style={{ padding: "var(--sp-2) var(--sp-3)", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--c-border)" }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{order.vendor_name || "業者不明"}</span>
                    {order.order_number && <span style={{ color: "var(--c-text-muted)", marginLeft: 8, fontSize: "var(--fs-sm)" }}>#{order.order_number}</span>}
                    {order.order_date && <span style={{ color: "var(--c-text-muted)", marginLeft: 8, fontSize: "var(--fs-sm)" }}>{order.order_date}</span>}
                  </div>
                  <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "var(--fs-sm)", padding: "2px 8px", borderRadius: 4, background: STATUS_COLOR[order.status] + "22", color: STATUS_COLOR[order.status], fontWeight: 600 }}>
                      {STATUS_LABEL[order.status]}
                    </span>
                    <span style={{ fontWeight: 700 }}>{fmtYen(order.total_amount)}</span>
                    {/* ステータス遷移ボタン */}
                    {order.status === "draft" && !formMode && (
                      <button onClick={() => handleIssue(order.id)} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "3px 10px", cursor: "pointer", fontSize: "var(--fs-xs)" }}>発注する</button>
                    )}
                    {order.status === "issued" && !formMode && (
                      <button onClick={() => handleMarkDelivered(order.id)} style={{ background: "#22c55e", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "3px 10px", cursor: "pointer", fontSize: "var(--fs-xs)" }}>納品済にする</button>
                    )}
                    {(order.status === "delivered" || order.status === "partial_delivered") && !formMode && (
                      <button onClick={() => handleMarkPaid(order.id)} style={{ background: "#6d28d9", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "3px 10px", cursor: "pointer", fontSize: "var(--fs-xs)" }}>支払済にする</button>
                    )}
                    {!formMode && order.status === "draft" && (
                      <button onClick={() => openEdit(order)} style={{ background: "none", border: "1px solid var(--c-border)", borderRadius: "var(--radius-sm)", padding: "3px 10px", cursor: "pointer", fontSize: "var(--fs-xs)", color: "var(--c-text)" }}>✏️ 修正</button>
                    )}
                    {!formMode && (
                      <button onClick={() => handleDelete(order.id, order.status === "draft")} style={{ background: "none", border: "1px solid #fca5a5", borderRadius: "var(--radius-sm)", padding: "3px 10px", cursor: "pointer", fontSize: "var(--fs-xs)", color: "#dc2626" }}>🗑 削除</button>
                    )}
                  </div>
                </div>
                <div style={{ padding: "var(--sp-2) var(--sp-3)" }}>
                  {order.payment_due_date && (
                    <div style={{ fontSize: "var(--fs-xs)", marginBottom: 4, display: "flex", gap: 8 }}>
                      <span style={{ color: "var(--c-text-muted)" }}>支払期日:</span>
                      <span style={{ fontWeight: 600, color: new Date(order.payment_due_date) < new Date() && order.status !== "completed" ? "#dc2626" : "var(--c-text)" }}>
                        {order.payment_due_date}
                        {new Date(order.payment_due_date) < new Date() && order.status !== "completed" && " ⚠️期限超過"}
                      </span>
                    </div>
                  )}
                  {order.items.slice(0, 3).map((item) => (
                    <div key={item.id} style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)", display: "flex", justifyContent: "space-between" }}>
                      <span>{item.item_name}{item.spec ? ` (${item.spec})` : ""}</span>
                      <span>{fmtYen(item.amount)}</span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)" }}>他 {order.items.length - 3} 件</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
