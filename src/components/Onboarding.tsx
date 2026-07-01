import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronDown, Layers, Send, ShieldCheck, UploadCloud } from 'lucide-react';
import { onboardingAPI } from '@/lib/api-service';
import type { OnboardingClientEntry } from '@/types/onboarding';
import UniversalPageLayout, { ContentSection, KPIGrid } from '@/components/ui/UniversalPageLayout';
import UniversalPageHeader from '@/components/ui/UniversalPageHeader';
import OnboardingForm from './OnboardingForm';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'info_submitted', label: 'Info Submitted' },
  { value: 'documents_pending', label: 'Documents Pending' },
  { value: 'verification_required', label: 'Verification Required' },
  { value: 'ready_for_services', label: 'Ready for Services' },
  { value: 'live', label: 'Live' },
];

function statusTone(status: string): string {
  if (status === 'live' || status === 'ready_for_services') return 'bg-emerald-100 text-emerald-700';
  if (status === 'verification_required') return 'bg-amber-100 text-amber-700';
  if (status === 'documents_pending') return 'bg-blue-100 text-blue-700';
  return 'bg-muted text-muted-foreground';
}

function renderEmptyState(
  title: string,
  message: string,
  onAction?: () => void
) {
  return (
    <div className="px-6 py-12 text-center">
      <Layers className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {onAction && (
        <button className="btn-primary btn-onboarding mt-5" onClick={onAction}>
          <UploadCloud size={18} />
          Start Onboarding
        </button>
      )}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<OnboardingClientEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showOnboardingForm, setShowOnboardingForm] = useState(false);
  const [showOnboardingList, setShowOnboardingList] = useState(true);
  const [showOnboardedList, setShowOnboardedList] = useState(true);

  const loadClients = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await onboardingAPI.getClients();
      setClients(response.clients || []);
    } catch (err) {
      console.error('Onboarding API not available:', err);
      setError(err instanceof Error ? err.message : 'Unable to load onboarding clients');
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadClients();
  }, []);

  const filtered = useMemo(() => {
    let data = [...clients];
    if (statusFilter) data = data.filter((client) => client.status === statusFilter);
    if (search.trim()) {
      const query = search.toLowerCase();
      data = data.filter(
        (client) =>
          client.clientRef?.toLowerCase().includes(query) ||
          client.name?.toLowerCase().includes(query) ||
          client.vat?.toLowerCase().includes(query)
      );
    }
    return data;
  }, [clients, statusFilter, search]);

  const onboardingClients = useMemo(
    () => filtered.filter((client) => Number(client.progress) < 100),
    [filtered]
  );

  const onboardedClients = useMemo(
    () => filtered.filter((client) => Number(client.progress) >= 100),
    [filtered]
  );

  const pipelineSummary = useMemo(() => {
    const inProgress = clients.filter((client) => Number(client.progress) < 100);
    const onboarded = clients.filter((client) => Number(client.progress) >= 100);
    const avgProgress = inProgress.length
      ? Math.round(inProgress.reduce((sum, client) => sum + Number(client.progress || 0), 0) / inProgress.length)
      : 100;
    const verificationRequired = clients.filter(
      (client) => client.status === 'verification_required' || client.status === 'ready_for_services'
    ).length;

    return {
      inProgress: inProgress.length,
      onboarded: onboarded.length,
      avgProgress,
      verificationRequired,
    };
  }, [clients]);

  const toggleSelect = (clientId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === onboardingClients.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(onboardingClients.map((client) => client.clientId)));
  };

  const handleBulkVerify = async () => {
    await Promise.all(
      Array.from(selected).map((clientId) =>
        onboardingAPI.updateClientSummary(clientId, { status: 'ready_for_services', progress: 100 })
      )
    );
    setSelected(new Set());
    void loadClients();
  };

  const handleBulkReminder = () => {
    void (async () => {
      if (selected.size === 0) return;

      const clientIds = Array.from(selected);
      let sent = 0;
      const failures: string[] = [];

      for (const clientId of clientIds) {
        const client = clients.find((entry) => entry.clientId === clientId);
        try {
          await onboardingAPI.sendReminder(clientId);
          sent += 1;
        } catch (err) {
          const label = client?.name || client?.clientRef || clientId;
          const message = err instanceof Error ? err.message : 'Failed to send reminder';
          failures.push(`${label}: ${message}`);
        }
      }

      if (failures.length === 0) {
        alert(`Reminder emails sent to ${sent} client${sent === 1 ? '' : 's'}.`);
        return;
      }

      alert(
        [
          `Sent ${sent} reminder${sent === 1 ? '' : 's'}.`,
          `${failures.length} failed:`,
          ...failures.slice(0, 5),
        ].join('\n')
      );
    })();
  };

  const handleOnboardingSuccess = () => {
    setShowOnboardingForm(false);
    void loadClients();
  };

  const renderTable = (entries: OnboardingClientEntry[], includeSelection: boolean) => {
    if (isLoading) {
      return (
        <div className="px-6 py-12 text-center text-sm text-muted-foreground">
          Loading onboarding data…
        </div>
      );
    }

    if (entries.length === 0) {
      return renderEmptyState(
        includeSelection ? 'No onboarding clients' : 'No onboarded clients',
        includeSelection
          ? 'No clients currently match the onboarding filters.'
          : 'No clients have reached 100% onboarding yet.',
        includeSelection && clients.length === 0 ? () => setShowOnboardingForm(true) : undefined
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-muted">
            <tr className="border-b border-border text-left">
              {includeSelection && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === onboardingClients.length}
                    onChange={selectAll}
                  />
                </th>
              )}
              <th className="px-3 py-3 font-semibold text-muted-foreground">Ref</th>
              <th className="px-3 py-3 font-semibold text-muted-foreground">Client</th>
              <th className="px-3 py-3 font-semibold text-muted-foreground">Contact</th>
              <th className="px-3 py-3 font-semibold text-muted-foreground">VAT</th>
              <th className="px-3 py-3 font-semibold text-muted-foreground">Progress</th>
              <th className="px-3 py-3 font-semibold text-muted-foreground">Missing Items</th>
              <th className="px-3 py-3 font-semibold text-muted-foreground">Status</th>
              <th className="px-3 py-3 font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((client) => (
              <tr key={client.clientId} className="border-b border-border">
                {includeSelection && (
                  <td className="px-3 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(client.clientId)}
                      onChange={() => toggleSelect(client.clientId)}
                    />
                  </td>
                )}
                <td className="px-3 py-4 font-mono font-semibold text-foreground">
                  {client.clientRef || '—'}
                </td>
                <td className="px-3 py-4 font-semibold text-foreground">
                  {client.name || client.clientId}
                </td>
                <td className="px-3 py-4 text-muted-foreground">{client.contact || '—'}</td>
                <td className="px-3 py-4 font-mono text-muted-foreground">{client.vat || '—'}</td>
                <td className="px-3 py-4">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${client.progress >= 100 ? 'bg-emerald-500' : client.progress >= 80 ? 'bg-cyan-500' : 'bg-amber-500'}`}
                      style={{ width: `${client.progress}%` }}
                    />
                  </div>
                  <span className="mt-2 inline-block text-xs font-medium text-muted-foreground">
                    {client.progress}% complete
                  </span>
                </td>
                <td className="px-3 py-4 text-muted-foreground">
                  {client.missingItems.slice(0, 2).join(', ') || '—'}
                  {client.missingItems.length > 2 && ` +${client.missingItems.length - 2} more`}
                </td>
                <td className="px-3 py-4">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(client.status)}`}>
                    {client.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-secondary"
                      onClick={() => navigate(`/clients/${client.clientId}?tab=engagement`)}
                    >
                      View
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => navigate(`/clients/${client.clientId}?tab=documents`)}
                    >
                      Documents
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <UniversalPageLayout>
      <UniversalPageHeader
        title="Client Onboarding"
        subtitle="Track onboarding progress, missing information, and readiness for service delivery."
        actions={
          <button className="btn-primary btn-onboarding" onClick={() => setShowOnboardingForm(true)}>
            <UploadCloud size={20} />
            Start Onboarding
          </button>
        }
      />

      <KPIGrid>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">In Progress</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{pipelineSummary.inProgress}</p>
          <p className="mt-3 text-sm text-muted-foreground">Clients still completing onboarding requirements</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Onboarded</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{pipelineSummary.onboarded}</p>
          <p className="mt-3 text-sm text-muted-foreground">Clients at 100% completion and ready for service delivery</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Average Progress</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{pipelineSummary.avgProgress}%</p>
          <p className="mt-3 text-sm text-muted-foreground">Across clients still in the onboarding pipeline</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verification Queue</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">{pipelineSummary.verificationRequired}</p>
          <p className="mt-3 text-sm text-muted-foreground">Clients awaiting verification or service activation</p>
        </div>
      </KPIGrid>

      <ContentSection>
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="authInput"
              placeholder="Search clients"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="authInput"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <button
            className="flex w-full items-center justify-between px-6 py-5 text-left"
            onClick={() => setShowOnboardingList((prev) => !prev)}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline</p>
              <h2 className="text-xl font-semibold text-foreground">Onboarding</h2>
              <p className="mt-1 text-sm text-muted-foreground">{onboardingClients.length} client{onboardingClients.length === 1 ? '' : 's'} in progress</p>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${showOnboardingList ? 'rotate-180' : ''}`} />
          </button>

          {showOnboardingList && (
            <>
              <div className="flex flex-col gap-3 border-t border-border px-6 py-4 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">{selected.size} selected</div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" disabled={selected.size === 0} onClick={handleBulkReminder}>
                    <Send size={16} />
                    Send Reminder
                  </button>
                  <button className="btn-primary btn-onboarding" disabled={selected.size === 0} onClick={handleBulkVerify}>
                    <ShieldCheck size={16} />
                    Mark Verified
                  </button>
                </div>
              </div>
              {renderTable(onboardingClients, true)}
            </>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <button
            className="flex w-full items-center justify-between px-6 py-5 text-left"
            onClick={() => setShowOnboardedList((prev) => !prev)}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
              <h2 className="text-xl font-semibold text-foreground">Onboarded</h2>
              <p className="mt-1 text-sm text-muted-foreground">{onboardedClients.length} client{onboardedClients.length === 1 ? '' : 's'} at 100%</p>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${showOnboardedList ? 'rotate-180' : ''}`} />
          </button>

          {showOnboardedList && renderTable(onboardedClients, false)}
        </section>
      </ContentSection>

      {showOnboardingForm && (
        <OnboardingForm
          onClose={() => setShowOnboardingForm(false)}
          onSuccess={handleOnboardingSuccess}
        />
      )}
    </UniversalPageLayout>
  );
}
