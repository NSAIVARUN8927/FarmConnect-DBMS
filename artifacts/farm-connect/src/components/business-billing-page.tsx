import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, FileText, Mail, MapPin, Pencil, Phone, Plus, ReceiptText, ShieldCheck, Trash2, X } from "lucide-react";
import {
  getListBillingFarmerDetailsQueryKey,
  useCreateBillingFarmerDetails,
  useDeleteBillingFarmerDetails,
  useListBillingFarmerDetails,
  useUpdateBillingFarmerDetails,
} from "@workspace/api-client-react";
import type { BillingFarmerDetails, BillingFarmerDetailsInput } from "@workspace/api-client-react";

const fieldClass = "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelClass = "grid gap-1.5 text-sm font-semibold text-foreground";

function billingInput(form: HTMLFormElement): BillingFarmerDetailsInput {
  const values = new FormData(form);
  const optional = (name: string) => String(values.get(name) ?? "").trim() || null;
  return {
    farmerName: String(values.get("farmerName") ?? "").trim(),
    farmName: optional("farmName"),
    gstin: optional("gstin")?.toUpperCase() ?? null,
    billingAddress: String(values.get("billingAddress") ?? "").trim(),
    state: String(values.get("state") ?? "").trim(),
    postalCode: String(values.get("postalCode") ?? "").trim(),
    contactPhone: optional("contactPhone"),
    contactEmail: optional("contactEmail"),
    notes: optional("notes"),
  };
}

export default function BusinessBillingPage() {
  const details = useListBillingFarmerDetails();
  const create = useCreateBillingFarmerDetails();
  const update = useUpdateBillingFarmerDetails();
  const remove = useDeleteBillingFarmerDetails();
  const client = useQueryClient();
  const [editing, setEditing] = useState<BillingFarmerDetails | "new" | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  function refresh() {
    void client.invalidateQueries({ queryKey: getListBillingFarmerDetailsQueryKey() });
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = billingInput(form);
    const onSuccess = () => {
      refresh();
      setEditing(null);
      setNotice({ text: editing === "new" ? "Farmer billing details saved." : "Billing details updated." });
    };
    const onError = () => setNotice({ text: "We couldn’t save these details. Check the form and try again.", error: true });
    if (editing === "new") create.mutate({ data }, { onSuccess, onError });
    else if (editing) update.mutate({ billingDetailsId: editing.id, data }, { onSuccess, onError });
  }

  const busy = create.isPending || update.isPending;
  const formKey = editing === "new" ? "new" : editing?.id ?? "closed";

  return (
    <div className="animate-rise">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-type mb-2 text-[10px] font-semibold uppercase tracking-[.22em] text-accent">Business workspace · billing</p>
          <h1 className="display-type text-4xl leading-[1.05] text-foreground sm:text-5xl">Farmer billing details.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Save the legal and contact details you need when preparing billing records for your farmer partners.</p>
        </div>
        {!editing && <button type="button" onClick={() => { setNotice(null); setEditing("new"); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><Plus size={16} />Add farmer details</button>}
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[.045] p-4">
        <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={18} />
        <p className="text-xs leading-5 text-muted-foreground">These records are visible only to your signed-in business account. They are not published on farmer listings or shared with other businesses.</p>
      </div>

      {notice && <div role={notice.error ? "alert" : "status"} className={`mb-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${notice.error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-primary"}`}><span>{notice.text}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)} className="rounded p-1 hover:bg-black/5"><X size={15} /></button></div>}

      {editing && <section className="mb-7 rounded-2xl border border-primary/20 bg-card p-5 shadow-sm sm:p-7" aria-labelledby="billing-form-title">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><p className="mono-type text-[9px] uppercase tracking-[.2em] text-accent">{editing === "new" ? "New billing contact" : "Edit saved record"}</p><h2 id="billing-form-title" className="display-type mt-1 text-2xl">{editing === "new" ? "Add farmer details" : editing.farmerName}</h2></div>
          <button type="button" aria-label="Close form" onClick={() => setEditing(null)} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X size={17} /></button>
        </div>
        <form key={formKey} onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>Farmer’s legal name<input className={fieldClass} name="farmerName" minLength={2} maxLength={120} required defaultValue={editing === "new" ? "" : editing.farmerName} placeholder="Name for billing documents" /></label>
          <label className={labelClass}>Farm or trading name<input className={fieldClass} name="farmName" maxLength={120} defaultValue={editing === "new" ? "" : editing.farmName ?? ""} placeholder="Optional" /></label>
          <label className={labelClass}>GSTIN <span className="text-xs font-normal text-muted-foreground">Optional · 15 characters</span><input className={fieldClass} name="gstin" maxLength={15} minLength={15} pattern="[A-Za-z0-9]{15}" title="Enter a 15-character GSTIN, or leave blank." defaultValue={editing === "new" ? "" : editing.gstin ?? ""} placeholder="15-character GSTIN" /></label>
          <label className={labelClass}>Contact phone<input className={fieldClass} name="contactPhone" maxLength={24} defaultValue={editing === "new" ? "" : editing.contactPhone ?? ""} placeholder="Optional" /></label>
          <label className={`${labelClass} sm:col-span-2`}>Billing address<textarea className="min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" name="billingAddress" minLength={5} maxLength={500} required defaultValue={editing === "new" ? "" : editing.billingAddress} placeholder="Street, village, district" /></label>
          <label className={labelClass}>State<input className={fieldClass} name="state" minLength={2} maxLength={80} required defaultValue={editing === "new" ? "" : editing.state} placeholder="State or union territory" /></label>
          <label className={labelClass}>PIN code<input className={fieldClass} name="postalCode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} required defaultValue={editing === "new" ? "" : editing.postalCode} placeholder="6 digits" /></label>
          <label className={labelClass}>Email<input className={fieldClass} name="contactEmail" type="email" maxLength={254} defaultValue={editing === "new" ? "" : editing.contactEmail ?? ""} placeholder="Optional" /></label>
          <label className={`${labelClass} sm:col-span-2`}>Billing notes<textarea className="min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" name="notes" maxLength={500} defaultValue={editing === "new" ? "" : editing.notes ?? ""} placeholder="Optional reference or billing instructions" /></label>
          <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
            <button type="button" onClick={() => setEditing(null)} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-secondary px-4 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80">Cancel</button>
            <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{busy ? "Saving…" : <><FileText size={15} />Save billing details</>}</button>
          </div>
        </form>
      </section>}

      {details.isLoading ? <div className="grid gap-4 md:grid-cols-2"><div className="h-48 animate-pulse rounded-2xl bg-muted" /><div className="h-48 animate-pulse rounded-2xl bg-muted" /></div>
        : details.isError ? <section className="rounded-2xl border border-destructive/25 bg-card p-6" role="alert"><p className="font-semibold">Billing contacts could not be loaded.</p><button type="button" onClick={() => { void details.refetch(); }} className="mt-3 text-sm font-semibold text-primary underline underline-offset-4">Try again</button></section>
          : details.data?.length ? <div className="grid gap-4 xl:grid-cols-2">{details.data.map((item) => <article key={item.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><ReceiptText size={19} /></span>
              <div className="min-w-0 flex-1"><p className="display-type text-2xl leading-tight">{item.farmerName}</p><p className="mt-1 text-sm text-muted-foreground">{item.farmName || "Farmer billing contact"}</p></div>
              <div className="flex gap-1"><button type="button" aria-label={`Edit ${item.farmerName}`} onClick={() => { setNotice(null); setEditing(item); }} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={15} /></button><button type="button" aria-label={`Delete ${item.farmerName}`} disabled={remove.isPending} onClick={() => { if (window.confirm(`Delete billing details for ${item.farmerName}?`)) remove.mutate({ billingDetailsId: item.id }, { onSuccess: () => { refresh(); setNotice({ text: "Billing record deleted." }); }, onError: () => setNotice({ text: "This billing record could not be deleted.", error: true }) }); }} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"><Trash2 size={15} /></button></div>
            </div>
            <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <div className="flex gap-2 text-sm"><MapPin size={15} className="mt-0.5 shrink-0 text-primary" /><span className="leading-5">{item.billingAddress}<br />{item.state} · {item.postalCode}</span></div>
              <div className="grid content-start gap-2 text-xs text-muted-foreground">
                {item.gstin && <p className="flex gap-2"><Building2 size={14} className="shrink-0 text-primary" />GSTIN <span className="font-semibold text-foreground">{item.gstin}</span></p>}
                {item.contactPhone && <p className="flex gap-2"><Phone size={14} className="shrink-0 text-primary" />{item.contactPhone}</p>}
                {item.contactEmail && <p className="flex min-w-0 gap-2"><Mail size={14} className="shrink-0 text-primary" /><span className="truncate">{item.contactEmail}</span></p>}
              </div>
            </div>
            {item.notes && <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{item.notes}</p>}
          </article>)}</div>
            : !editing && <section className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><ReceiptText size={21} /></span><h2 className="display-type mt-4 text-2xl">No farmer billing contacts yet</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Add the legal name, address and optional GSTIN you need for your business records.</p><button type="button" onClick={() => setEditing("new")} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus size={15} />Add first contact</button></div></section>}
    </div>
  );
}