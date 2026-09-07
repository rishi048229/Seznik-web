import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import { AnimatedThemeToggler } from '../components/AnimatedThemeToggler';
import {
  fetchSupportAccessCodes,
  issueSupportAccessCode,
} from '../services/authService';
import type { AccessCodeRecord, SupportAgentRecord } from '../types/support';
import { SUPPORT_PRINTERS } from '../utils/printers';

interface HomePageProps {
  agent: SupportAgentRecord;
  onLogout: () => void;
}

type FormState = {
  customerName: string;
  phone: string;
  invoiceNumber: string;
  printer: string;
};

const emptyForm: FormState = {
  customerName: '',
  phone: '',
  invoiceNumber: '',
  printer: '',
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return iso;
  }
}

function validateForm(form: FormState): string | null {
  if (!form.customerName.trim()) return 'Customer name is required';
  if (!form.phone.trim()) return 'Phone number is required';
  if (form.phone.replace(/\D/g, '').length < 10) return 'Phone number must be at least 10 digits';
  if (!form.invoiceNumber.trim()) return 'Invoice number is required';
  if (!form.printer) return 'Select a printer';
  return null;
}

export const HomePage: React.FC<HomePageProps> = ({ agent, onLogout }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastIssued, setLastIssued] = useState<AccessCodeRecord | null>(null);
  const [copied, setCopied] = useState(false);

  const [entries, setEntries] = useState<AccessCodeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetchSupportAccessCodes({ page: 1, limit: 100 });
      setEntries(res.items);
      setTotal(res.total);
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const openForm = () => {
    setShowForm(true);
    setForm(emptyForm);
    setDetailsSaved(false);
    setFormError(null);
    setLastIssued(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
    setDetailsSaved(false);
    setFormError(null);
  };

  const handleSaveDetails = (event: React.FormEvent) => {
    event.preventDefault();
    const error = validateForm(form);
    if (error) {
      setFormError(error);
      setDetailsSaved(false);
      return;
    }
    setFormError(null);
    setDetailsSaved(true);
  };

  const handleGenerate = async () => {
    const error = validateForm(form);
    if (error) {
      setFormError(error);
      setDetailsSaved(false);
      return;
    }
    if (!detailsSaved) {
      setFormError('Save the details first, then generate the code');
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const result = await issueSupportAccessCode({
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        printer: form.printer,
      });
      setLastIssued(result.record);
      setForm(emptyForm);
      setDetailsSaved(false);
      await loadEntries();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to generate code');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (detailsSaved) setDetailsSaved(false);
    if (formError) setFormError(null);
  };

  return (
    <div className="support-home-shell">
      <header className="support-home-bar">
        <div className="support-home-brand">
          <img src="/seznik_logo.png" alt="Seznik" className="navbar-logo" />
          <div>
            <strong>Seznik Support</strong>
            <span>{agent.name} · @{agent.username}</span>
          </div>
        </div>
        <div className="support-home-actions">
          <AnimatedThemeToggler variant="circle" duration={500} />
          <button type="button" className="support-home-logout" onClick={onLogout}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </header>

      <main className="support-portal-main">
        <div className="support-portal-toolbar">
          <div>
            <h1>Access codes</h1>
            <p>Issue a customer access code after saving sale details.</p>
          </div>
          {!showForm && (
            <button type="button" className="support-btn support-btn-primary" onClick={openForm}>
              <Plus size={16} />
              Add Access
            </button>
          )}
        </div>

        {showForm && (
          <section className="support-card">
            <div className="support-card-head">
              <div className="support-card-title">
                <div className="support-card-icon">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h2>Add access</h2>
                  <p>Save customer details first, then generate the code.</p>
                </div>
              </div>
              <button type="button" className="support-icon-btn" onClick={closeForm} aria-label="Close form">
                <X size={16} />
              </button>
            </div>

            <form className="support-access-form" onSubmit={handleSaveDetails}>
              <label className="support-field">
                Shop / Business name
                <input
                  value={form.customerName}
                  onChange={(e) => updateField('customerName', e.target.value)}
                  placeholder="e.g. Sharma Kirana Store"
                  maxLength={160}
                  required
                  disabled={detailsSaved}
                />
              </label>

              <label className="support-field">
                Phone number
                <input
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="10-digit mobile"
                  maxLength={40}
                  inputMode="tel"
                  required
                  disabled={detailsSaved}
                />
              </label>

              <label className="support-field">
                Invoice number
                <input
                  value={form.invoiceNumber}
                  onChange={(e) => updateField('invoiceNumber', e.target.value)}
                  placeholder="INV-…"
                  maxLength={120}
                  required
                  disabled={detailsSaved}
                />
              </label>

              <label className="support-field">
                Printer
                <select
                  value={form.printer}
                  onChange={(e) => updateField('printer', e.target.value)}
                  required
                  disabled={detailsSaved}
                >
                  <option value="">Select printer</option>
                  {SUPPORT_PRINTERS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="support-field">
                Generated by
                <input value={agent.username} readOnly />
              </label>

              {detailsSaved && (
                <div className="support-saved-banner" role="status">
                  <CheckCircle2 size={16} />
                  Details saved. You can generate the access code now.
                </div>
              )}

              {formError && (
                <div className="support-form-error" role="alert">
                  <AlertTriangle size={16} />
                  {formError}
                </div>
              )}

              <div className="support-form-actions">
                {!detailsSaved ? (
                  <button type="submit" className="support-btn support-btn-primary">
                    <Save size={15} />
                    Save details
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="support-btn support-btn-secondary"
                      onClick={() => setDetailsSaved(false)}
                    >
                      Edit details
                    </button>
                    <button
                      type="button"
                      className="support-btn support-btn-primary"
                      onClick={() => void handleGenerate()}
                      disabled={submitting}
                    >
                      {submitting ? <Loader2 size={15} className="spin" /> : <KeyRound size={15} />}
                      {submitting ? 'Generating…' : 'Generate code'}
                    </button>
                  </>
                )}
              </div>
            </form>

            {lastIssued && (
              <div className="support-issued-banner">
                <div className="support-issued-copy">
                  <CheckCircle2 size={18} color="#10B981" />
                  <div>
                    <strong>Code generated</strong>
                    <div className="support-issued-code">{lastIssued.code}</div>
                    <div className="support-issued-meta">
                      Date generated on {formatWhen(lastIssued.createdAt)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="support-btn support-btn-secondary"
                  onClick={() => void copyCode(lastIssued.code)}
                >
                  <Copy size={13} />
                  {copied ? 'Copied!' : 'Copy code'}
                </button>
              </div>
            )}
          </section>
        )}

        <section className="support-card">
          <div className="support-card-head">
            <div>
              <h2>Your entries</h2>
              <p>
                {total} code{total === 1 ? '' : 's'} generated by {agent.username}
              </p>
            </div>
            <button
              type="button"
              className="support-btn support-btn-secondary"
              onClick={() => void loadEntries()}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          {listError && (
            <div className="support-form-error" role="alert">
              <AlertTriangle size={16} />
              {listError}
            </div>
          )}

          <div className="support-table-wrap">
            <table className="support-table">
              <thead>
                <tr>
                  <th>Shop name</th>
                  <th>Phone</th>
                  <th>Invoice</th>
                  <th>Printer</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Date generated on</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="support-table-empty">
                      <Loader2 size={16} className="spin" /> Loading…
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="support-table-empty">
                      No codes issued yet. Click Add Access to create one.
                    </td>
                  </tr>
                ) : (
                  entries.map((row) => (
                    <tr key={row.id}>
                      <td>{row.customerName || '—'}</td>
                      <td>{row.phone || '—'}</td>
                      <td>{row.invoiceNumber || '—'}</td>
                      <td>{row.printer || '—'}</td>
                      <td className="support-code-cell">{row.code}</td>
                      <td>
                        {row.isUsed ? (
                          <span
                            title={`Redeemed by ${row.customerEmail || row.usedByUserId || 'User'}${row.usedAt ? ` on ${formatWhen(row.usedAt)}` : ''}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#059669',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ✓ Redeemed
                          </span>
                        ) : (
                          <span
                            title="Available / Not yet redeemed"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              background: 'rgba(59, 130, 246, 0.1)',
                              color: '#2563eb',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Available
                          </span>
                        )}
                      </td>
                      <td className="support-date-cell">{formatWhen(row.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};
