"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const categories = [
  "Cement", "Steel", "Sand", "Blocks/Bricks", "Labour", "Electrical",
  "Plumbing", "Tiles", "Paint", "Wood", "Doors", "Windows",
  "Transport", "Other"
];

const paymentModes = ["Cash", "UPI", "Bank Transfer", "Cheque", "Other"];

const emptyProject = { name: "", location: "", total_budget: "", start_date: "", notes: "" };
const emptyAllocation = { category: "Cement", allocated_amount: "", notes: "" };
const emptyExpense = { allocation_id: "", supplier: "", description: "", bill_amount: "", expense_date: "", notes: "" };
const emptyPayment = { expense_id: "", amount: "", payment_mode: "UPI", recipient: "", reference_number: "", payment_date: "", notes: "" };

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function errText(error) {
  return error?.message || "Something went wrong";
}

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [pf, setPf] = useState(emptyProject);
  const [af, setAf] = useState(emptyAllocation);
  const [ef, setEf] = useState({ ...emptyExpense, expense_date: today() });
  const [payf, setPayf] = useState({ ...emptyPayment, payment_date: today() });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const project = useMemo(() => projects.find((p) => p.id === projectId) || null, [projects, projectId]);
  const projectAllocations = useMemo(() => allocations.filter((a) => a.project_id === projectId), [allocations, projectId]);
  const projectExpenses = useMemo(() => expenses.filter((e) => e.project_id === projectId), [expenses, projectId]);
  const projectPayments = useMemo(() => payments.filter((p) => p.project_id === projectId), [payments, projectId]);

  const totalAllocated = projectAllocations.reduce((s, a) => s + Number(a.allocated_amount || 0), 0);
  const totalExpense = projectExpenses.reduce((s, e) => s + Number(e.bill_amount || 0), 0);
  const totalPaid = projectPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const pending = Math.max(0, totalExpense - totalPaid);
  const remainingBudget = Math.max(0, Number(project?.total_budget || 0) - totalExpense);

  const expensePaid = (expenseId) => projectPayments.filter((p) => p.expense_id === expenseId).reduce((s, p) => s + Number(p.amount || 0), 0);
  const expensePending = (expense) => Math.max(0, Number(expense.bill_amount || 0) - expensePaid(expense.id));
  const allocationExpense = (allocationId) => projectExpenses.filter((e) => e.allocation_id === allocationId).reduce((s, e) => s + Number(e.bill_amount || 0), 0);
  const allocationRemaining = (allocation) => Math.max(0, Number(allocation.allocated_amount || 0) - allocationExpense(allocation.id));

  async function loadAll(selectedId = projectId) {
    setLoading(true);
    setError("");
    try {
      const [{ data: ps, error: pe }, { data: as, error: ae }, { data: es, error: ee }, { data: pays, error: pye }] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("allocations").select("*").order("created_at", { ascending: false }),
        supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
        supabase.from("payments").select("*").order("payment_date", { ascending: false }),
      ]);
      if (pe) throw pe;
      if (ae) throw ae;
      if (ee) throw ee;
      if (pye) throw pye;
      setProjects(ps || []);
      setAllocations(as || []);
      setExpenses(es || []);
      setPayments(pays || []);
      const nextId = selectedId && (ps || []).some((p) => p.id === selectedId) ? selectedId : (ps?.[0]?.id || "");
      setProjectId(nextId);
      setMessage("Data refreshed successfully.");
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(""); }, []);

  async function createProject(e) {
    e.preventDefault();
    setMessage(""); setError("");
    if (!pf.name.trim() || !pf.total_budget) return setError("Project name and total budget are required.");
    setLoading(true);
    try {
      const { data, error: insertError } = await supabase.from("projects").insert({
        name: pf.name.trim(), location: pf.location.trim(), total_budget: Number(pf.total_budget),
        start_date: pf.start_date || null, notes: pf.notes.trim(),
      }).select().single();
      if (insertError) throw insertError;
      setPf(emptyProject);
      await loadAll(data.id);
      setMessage("Project saved successfully to Supabase.");
    } catch (e) { setError(errText(e)); setLoading(false); }
  }

  async function deleteProject() {
    if (!projectId || !project) return;
    if (!window.confirm(`Delete project "${project.name}" and all its allocations, bills and payments?`)) return;
    setLoading(true); setError("");
    try {
      const { error: e } = await supabase.from("projects").delete().eq("id", projectId);
      if (e) throw e;
      setProjectId(""); await loadAll(""); setMessage("Project deleted.");
    } catch (e) { setError(errText(e)); setLoading(false); }
  }

  async function addAllocation(e) {
    e.preventDefault();
    if (!projectId) return setError("Select a project first.");
    if (!af.allocated_amount) return setError("Enter an allocation amount.");
    setLoading(true); setError("");
    try {
      const { error: e } = await supabase.from("allocations").insert({ project_id: projectId, category: af.category, allocated_amount: Number(af.allocated_amount), notes: af.notes });
      if (e) throw e;
      setAf(emptyAllocation); await loadAll(projectId); setMessage("Budget allocation saved.");
    } catch (e) { setError(errText(e)); setLoading(false); }
  }

  async function deleteRow(table, id) {
    if (!window.confirm("Delete this record?")) return;
    setLoading(true); setError("");
    try {
      const { error: e } = await supabase.from(table).delete().eq("id", id);
      if (e) throw e;
      await loadAll(projectId); setMessage("Record deleted.");
    } catch (e) { setError(errText(e)); setLoading(false); }
  }

  async function addExpense(e) {
    e.preventDefault();
    if (!projectId) return setError("Select a project first.");
    const allocation = projectAllocations.find((a) => a.id === ef.allocation_id);
    if (!allocation) return setError("Select an allocation.");
    if (!ef.bill_amount) return setError("Enter bill amount.");
    setLoading(true); setError("");
    try {
      const { error: e } = await supabase.from("expenses").insert({
        project_id: projectId, allocation_id: allocation.id, category: allocation.category,
        supplier: ef.supplier.trim(), description: ef.description.trim(), bill_amount: Number(ef.bill_amount),
        expense_date: ef.expense_date || today(), notes: ef.notes.trim(),
      });
      if (e) throw e;
      setEf({ ...emptyExpense, expense_date: today() }); await loadAll(projectId); setMessage("Expense/bill saved.");
    } catch (e) { setError(errText(e)); setLoading(false); }
  }

  async function addPayment(e) {
    e.preventDefault();
    if (!projectId) return setError("Select a project first.");
    const expense = projectExpenses.find((x) => x.id === payf.expense_id);
    if (!expense) return setError("Select a bill.");
    if (!payf.amount) return setError("Enter payment amount.");
    if (Number(payf.amount) > expensePending(expense)) return setError("Payment cannot be greater than the bill's pending amount.");
    setLoading(true); setError("");
    try {
      const { error: e } = await supabase.from("payments").insert({
        project_id: projectId, expense_id: expense.id, amount: Number(payf.amount), payment_mode: payf.payment_mode,
        recipient: payf.recipient.trim(), reference_number: payf.reference_number.trim(), payment_date: payf.payment_date || today(), notes: payf.notes.trim(),
      });
      if (e) throw e;
      setPayf({ ...emptyPayment, payment_date: today() }); await loadAll(projectId); setMessage("Payment record saved.");
    } catch (e) { setError(errText(e)); setLoading(false); }
  }

  function statusFor(expense) {
    const paid = expensePaid(expense.id);
    if (paid >= Number(expense.bill_amount)) return "Paid";
    if (paid > 0) return "Partially Paid";
    return "Pending";
  }

  const input = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-amber-400";
  const card = "rounded-2xl border border-slate-800 bg-slate-900 p-5";
  const button = "rounded-xl bg-amber-500 px-4 py-2 font-bold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50";
  const danger = "rounded-xl border border-red-900/50 px-3 py-2 text-sm text-red-400 hover:bg-red-950/30";

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <header className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-black md:text-3xl">🏗️ Construction Budget Manager</h1>
            <p className="mt-1 text-sm text-slate-400">Cloud-saved projects, budgets, expenses and payments using Supabase.</p>
          </div>
          <button type="button" onClick={() => loadAll(projectId)} disabled={loading} className="rounded-xl bg-slate-800 px-4 py-2 hover:bg-slate-700">↻ {loading ? "Working..." : "Refresh"}</button>
        </header>

        {error && <div className="mb-4 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>}
        {message && <div className="mb-4 rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300">{message}</div>}

        <section className="grid gap-4 lg:grid-cols-3">
          <form onSubmit={createProject} className={card + " space-y-3"}>
            <h2 className="text-lg font-bold">＋ Create Project</h2>
            <input className={input} placeholder="Project name" value={pf.name} onChange={(e) => setPf({ ...pf, name: e.target.value })} required />
            <input className={input} placeholder="Location" value={pf.location} onChange={(e) => setPf({ ...pf, location: e.target.value })} />
            <input className={input} type="number" min="1" placeholder="Total project budget" value={pf.total_budget} onChange={(e) => setPf({ ...pf, total_budget: e.target.value })} required />
            <input className={input} type="date" value={pf.start_date} onChange={(e) => setPf({ ...pf, start_date: e.target.value })} />
            <textarea className={input} rows="2" placeholder="Notes (optional)" value={pf.notes} onChange={(e) => setPf({ ...pf, notes: e.target.value })} />
            <button type="submit" disabled={loading} className={button}>{loading ? "Saving..." : "Save Project"}</button>
          </form>

          <div className={card + " lg:col-span-2"}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="w-full">
                <label className="text-xs text-slate-400">SELECT PROJECT</label>
                <select className={input + " mt-2"} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">Select a project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {project && <button type="button" onClick={deleteProject} className={danger}>Delete Project</button>}
            </div>
            {project ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Budget" value={money(project.total_budget)} />
                <Stat label="Expenses" value={money(totalExpense)} />
                <Stat label="Paid" value={money(totalPaid)} />
                <Stat label="Pending" value={money(pending)} />
              </div>
            ) : <p className="mt-6 text-slate-500">No projects yet. Enter your first project manually.</p>}
          </div>
        </section>

        <div className="mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-2">
          {[['overview','Overview'],['allocations','Budget Allocation'],['expenses','Bills / Expenses'],['payments','Payments'],['history','History']].map(([id,label]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm ${activeTab === id ? 'bg-amber-500 font-bold text-slate-950' : 'hover:bg-slate-800'}`}>{label}</button>)}
        </div>

        {!project ? <div className="mt-5 rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-500">Create or select a project to manage its budget.</div> : (
          <div className="mt-5 space-y-5">
            {activeTab === 'overview' && <>
              <section className="grid gap-4 md:grid-cols-3">
                <div className={card}><p className="text-sm text-slate-400">Allocated</p><p className="mt-2 text-2xl font-black">{money(totalAllocated)}</p></div>
                <div className={card}><p className="text-sm text-slate-400">Remaining Project Budget</p><p className="mt-2 text-2xl font-black text-emerald-400">{money(remainingBudget)}</p></div>
                <div className={card}><p className="text-sm text-slate-400">Collection of Pending Bills</p><p className="mt-2 text-2xl font-black text-red-400">{money(pending)}</p></div>
              </section>
              <section className={card}><h2 className="mb-4 text-lg font-bold">Recent Bills</h2><TableExpenses expenses={projectExpenses.slice(0, 8)} expensePaid={expensePaid} statusFor={statusFor} money={money} onDelete={(id) => deleteRow('expenses', id)} /></section>
            </>}

            {activeTab === 'allocations' && <section className="grid gap-5 lg:grid-cols-3">
              <form onSubmit={addAllocation} className={card + " space-y-3"}><h2 className="text-lg font-bold">Add Budget Allocation</h2><select className={input} value={af.category} onChange={(e) => setAf({ ...af, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</select><input className={input} type="number" min="0" placeholder="Allocated amount" value={af.allocated_amount} onChange={(e) => setAf({ ...af, allocated_amount: e.target.value })} required /><textarea className={input} rows="3" placeholder="Notes" value={af.notes} onChange={(e) => setAf({ ...af, notes: e.target.value })} /><button className={button} disabled={loading}>Save Allocation</button></form>
              <div className={card + " lg:col-span-2 overflow-x-auto"}><h2 className="mb-4 text-lg font-bold">Item-wise Budget</h2><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-slate-400"><tr><th className="p-2">Item</th><th className="p-2">Allocated</th><th className="p-2">Expense</th><th className="p-2">Remaining</th><th className="p-2"></th></tr></thead><tbody>{projectAllocations.map((a) => <tr key={a.id} className="border-t border-slate-800"><td className="p-2 font-semibold">{a.category}</td><td className="p-2">{money(a.allocated_amount)}</td><td className="p-2">{money(allocationExpense(a.id))}</td><td className="p-2 text-emerald-400">{money(allocationRemaining(a))}</td><td className="p-2 text-right"><button className={danger} onClick={() => deleteRow('allocations', a.id)}>Delete</button></td></tr>)}{projectAllocations.length === 0 && <tr><td colSpan="5" className="p-5 text-center text-slate-500">No allocations yet.</td></tr>}</tbody></table></div>
            </section>}

            {activeTab === 'expenses' && <section className="grid gap-5 lg:grid-cols-3">
              <form onSubmit={addExpense} className={card + " space-y-3"}><h2 className="text-lg font-bold">Add Bill / Expense</h2><select className={input} value={ef.allocation_id} onChange={(e) => setEf({ ...ef, allocation_id: e.target.value })}><option value="">Select budget item</option>{projectAllocations.map((a) => <option key={a.id} value={a.id}>{a.category} — {money(a.allocated_amount)}</option>)}</select><input className={input} placeholder="Supplier" value={ef.supplier} onChange={(e) => setEf({ ...ef, supplier: e.target.value })} /><input className={input} placeholder="Description" value={ef.description} onChange={(e) => setEf({ ...ef, description: e.target.value })} /><input className={input} type="number" min="0" placeholder="Bill amount" value={ef.bill_amount} onChange={(e) => setEf({ ...ef, bill_amount: e.target.value })} required /><input className={input} type="date" value={ef.expense_date} onChange={(e) => setEf({ ...ef, expense_date: e.target.value })} /><textarea className={input} rows="2" placeholder="Notes" value={ef.notes} onChange={(e) => setEf({ ...ef, notes: e.target.value })} /><button className={button} disabled={loading}>Save Bill</button></form>
              <div className={card + " lg:col-span-2 overflow-x-auto"}><h2 className="mb-4 text-lg font-bold">Bills</h2><TableExpenses expenses={projectExpenses} expensePaid={expensePaid} statusFor={statusFor} money={money} onDelete={(id) => deleteRow('expenses', id)} /></div>
            </section>}

            {activeTab === 'payments' && <section className="grid gap-5 lg:grid-cols-3">
              <form onSubmit={addPayment} className={card + " space-y-3"}><h2 className="text-lg font-bold">Record Payment</h2><select className={input} value={payf.expense_id} onChange={(e) => setPayf({ ...payf, expense_id: e.target.value })}><option value="">Select bill</option>{projectExpenses.map((e) => <option key={e.id} value={e.id}>{e.category} — {money(e.bill_amount)} — {statusFor(e)}</option>)}</select><input className={input} type="number" min="0" placeholder="Payment amount" value={payf.amount} onChange={(e) => setPayf({ ...payf, amount: e.target.value })} required /><select className={input} value={payf.payment_mode} onChange={(e) => setPayf({ ...payf, payment_mode: e.target.value })}>{paymentModes.map((m) => <option key={m}>{m}</option>)}</select><input className={input} placeholder="Recipient / supplier" value={payf.recipient} onChange={(e) => setPayf({ ...payf, recipient: e.target.value })} /><input className={input} placeholder="Reference number" value={payf.reference_number} onChange={(e) => setPayf({ ...payf, reference_number: e.target.value })} /><input className={input} type="date" value={payf.payment_date} onChange={(e) => setPayf({ ...payf, payment_date: e.target.value })} /><textarea className={input} rows="2" placeholder="Notes" value={payf.notes} onChange={(e) => setPayf({ ...payf, notes: e.target.value })} /><button className={button} disabled={loading}>Save Payment</button></form>
              <div className={card + " lg:col-span-2 overflow-x-auto"}><h2 className="mb-4 text-lg font-bold">Payment History</h2><table className="w-full min-w-[750px] text-left text-sm"><thead className="text-slate-400"><tr><th className="p-2">Date</th><th className="p-2">Bill</th><th className="p-2">Mode</th><th className="p-2">Amount</th><th className="p-2">Reference</th><th className="p-2"></th></tr></thead><tbody>{projectPayments.map((p) => { const e = projectExpenses.find((x) => x.id === p.expense_id); return <tr key={p.id} className="border-t border-slate-800"><td className="p-2">{p.payment_date}</td><td className="p-2">{e?.description || e?.category || 'Bill'}</td><td className="p-2">{p.payment_mode}</td><td className="p-2 font-semibold">{money(p.amount)}</td><td className="p-2">{p.reference_number || '-'}</td><td className="p-2 text-right"><button className={danger} onClick={() => deleteRow('payments', p.id)}>Delete</button></td></tr>; })}{projectPayments.length === 0 && <tr><td colSpan="6" className="p-5 text-center text-slate-500">No payments yet.</td></tr>}</tbody></table></div>
            </section>}

            {activeTab === 'history' && <section className={card + " overflow-x-auto"}><h2 className="mb-4 text-lg font-bold">Project History</h2><div className="space-y-3">{[
              ...projectAllocations.map((a) => ({ date: a.created_at, type: 'Allocation', text: `${a.category} allocation`, amount: a.allocated_amount })),
              ...projectExpenses.map((e) => ({ date: e.created_at, type: 'Bill', text: `${e.supplier || 'Supplier'} — ${e.description || e.category}`, amount: e.bill_amount })),
              ...projectPayments.map((p) => ({ date: p.created_at, type: 'Payment', text: `${p.payment_mode}${p.reference_number ? ` — ${p.reference_number}` : ''}`, amount: p.amount })),
            ].sort((a,b) => new Date(b.date)-new Date(a.date)).map((h, i) => <div key={i} className="flex flex-col gap-2 rounded-xl border border-slate-800 p-3 md:flex-row md:items-center md:justify-between"><div><span className="mr-2 rounded-lg bg-slate-800 px-2 py-1 text-xs">{h.type}</span><span>{h.text}</span></div><div className="font-bold">{money(h.amount)}</div></div>)}{projectAllocations.length + projectExpenses.length + projectPayments.length === 0 && <p className="text-slate-500">No history yet.</p>}</div></section>}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }) { return <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-black">{value}</p></div>; }

function TableExpenses({ expenses, expensePaid, statusFor, money, onDelete }) {
  return <table className="w-full min-w-[760px] text-left text-sm"><thead className="text-slate-400"><tr><th className="p-2">Date</th><th className="p-2">Item</th><th className="p-2">Supplier</th><th className="p-2">Bill</th><th className="p-2">Paid</th><th className="p-2">Pending</th><th className="p-2">Status</th><th className="p-2"></th></tr></thead><tbody>{expenses.map((e) => <tr key={e.id} className="border-t border-slate-800"><td className="p-2">{e.expense_date}</td><td className="p-2">{e.category}<div className="text-xs text-slate-500">{e.description}</div></td><td className="p-2">{e.supplier || '-'}</td><td className="p-2">{money(e.bill_amount)}</td><td className="p-2 text-emerald-400">{money(expensePaid(e.id))}</td><td className="p-2 text-red-400">{money(Math.max(0, Number(e.bill_amount)-expensePaid(e.id)))}</td><td className="p-2">{statusFor(e)}</td><td className="p-2 text-right"><button className="text-red-400 hover:text-red-300" onClick={() => onDelete(e.id)}>Delete</button></td></tr>)}{expenses.length === 0 && <tr><td colSpan="8" className="p-5 text-center text-slate-500">No bills yet.</td></tr>}</tbody></table>;
}
