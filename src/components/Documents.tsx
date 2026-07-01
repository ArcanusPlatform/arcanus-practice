import { useEffect, useMemo, useState } from 'react';
import {
  contactsAPI,
  documentsAPI,
  type PracticeDocumentRecord,
  type PracticeDocumentVersionRecord,
} from '@/lib/api-service';
import UniversalPageHeader from '@/components/ui/UniversalPageHeader';
import UniversalPageLayout, { ContentSection, KPIGrid } from '@/components/ui/UniversalPageLayout';
import type { Contact } from '@/types';

function formatBytes(value?: number): string {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export default function Documents() {
  const [documents, setDocuments] = useState<PracticeDocumentRecord[]>([]);
  const [clients, setClients] = useState<Contact[]>([]);
  const [stats, setStats] = useState<{
    totalDocuments: number;
    totalSize: number;
    documentsByCategory?: Record<string, number>;
    recentUploads?: PracticeDocumentRecord[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [category, setCategory] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [uploadClientId, setUploadClientId] = useState('');
  const [uploadCategory, setUploadCategory] = useState('General');
  const [uploadDocumentType, setUploadDocumentType] = useState('general');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [documentVersions, setDocumentVersions] = useState<PracticeDocumentVersionRecord[]>([]);
  const [isVersionsLoading, setIsVersionsLoading] = useState(false);

  const loadClients = async () => {
    const response = await contactsAPI.getContacts({
      type: ['business', 'individual'],
      limit: 1000,
    });
    setClients(response.contacts || []);
  };

  const loadDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [documentResponse, statsResponse] = await Promise.all([
        documentsAPI.listDocuments({
          clientId: clientId || undefined,
          category: category || undefined,
          search: search || undefined,
          includeArchived,
        }),
        documentsAPI.getStats({ clientId: clientId || undefined }),
      ]);
      setDocuments(documentResponse.documents || []);
      setStats(statsResponse as any);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to load documents.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadClients();
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [search, clientId, category, includeArchived]);

  const categories = useMemo(() => {
    const values = new Set<string>();
    documents.forEach((document) => {
      if (document.category) values.add(document.category);
    });
    return Array.from(values).sort();
  }, [documents]);

  const recentUploadCount = stats?.recentUploads?.length ?? 0;

  const handlePreview = async (document: PracticeDocumentRecord) => {
    try {
      const blob = await documentsAPI.previewDocument(document.document_id);
      openBlob(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to preview document.');
    }
  };

  const handleDownload = async (document: PracticeDocumentRecord) => {
    try {
      const blob = await documentsAPI.downloadDocument(document.document_id);
      downloadBlob(blob, document.file_name || `${document.document_type}.bin`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download document.');
    }
  };

  const handleToggleArchive = async (document: PracticeDocumentRecord) => {
    try {
      if (document.is_archived) {
        await documentsAPI.restoreDocument(document.document_id);
      } else {
        await documentsAPI.archiveDocument(document.document_id);
      }
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update document.');
    }
  };

  const handleOpenVersions = async (document: PracticeDocumentRecord) => {
    setSelectedDocumentId(document.document_id);
    setIsVersionsLoading(true);
    setError(null);
    try {
      const response = await documentsAPI.listDocumentVersions(document.document_id);
      setDocumentVersions(response.versions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load document versions.');
    } finally {
      setIsVersionsLoading(false);
    }
  };

  const handleUploadVersion = (document: PracticeDocumentRecord) => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setError(null);
        await documentsAPI.uploadDocumentVersion(document.document_id, {
          file,
          documentType: document.document_type,
          category: document.category,
        });
        await loadDocuments();
        await handleOpenVersions(document);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to upload document version.');
      }
    };
    input.click();
  };

  const handleDelete = async (documentId: string) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await documentsAPI.deleteDocument(documentId);
      if (selectedDocumentId === documentId) {
        setSelectedDocumentId('');
        setDocumentVersions([]);
      }
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete document.');
    }
  };

  const handleUpload = async () => {
    if (!uploadClientId || files.length === 0) return;
    setIsUploading(true);
    setError(null);
    try {
      for (const file of files) {
        await documentsAPI.uploadDocument({
          clientId: uploadClientId,
          file,
          documentType: uploadDocumentType,
          category: uploadCategory,
        });
      }
      setFiles([]);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload documents.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <UniversalPageLayout>
      <UniversalPageHeader
        title="Documents"
        subtitle="Global document management, uploads, archive control, and version history across the practice."
        actions={
          <button className="btn-secondary" onClick={() => void loadDocuments()} disabled={isLoading}>
            Refresh
          </button>
        }
      />

      <KPIGrid>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{stats?.totalDocuments ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stored Size</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatBytes(stats?.totalSize)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Uploads</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{recentUploadCount}</p>
        </div>
      </KPIGrid>

      <ContentSection>
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upload</p>
            <h2 className="text-xl font-semibold text-foreground">Upload Documents</h2>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select className="authInput" value={uploadClientId} onChange={(e) => setUploadClientId(e.target.value)}>
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.client_ref || client.company_number || client.id})
                </option>
              ))}
            </select>
            <select className="authInput" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
              <option value="General">General</option>
              <option value="Identity">Identity</option>
              <option value="Finance">Finance</option>
              <option value="Compliance">Compliance</option>
              <option value="Reports">Reports</option>
            </select>
            <input
              className="authInput"
              value={uploadDocumentType}
              onChange={(e) => setUploadDocumentType(e.target.value)}
              placeholder="Document type"
            />
            <input
              className="authInput"
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              {files.length > 0
                ? `${files.length} file${files.length === 1 ? '' : 's'} ready to upload`
                : 'Select one or more files to upload against a client.'}
            </p>
            <button
              className="btn-primary btn-templates"
              disabled={!uploadClientId || files.length === 0 || isUploading}
              onClick={() => void handleUpload()}
            >
              {isUploading ? 'Uploading…' : 'Upload Documents'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Register</p>
            <h2 className="text-xl font-semibold text-foreground">Document Register</h2>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              className="authInput"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search file name or type"
            />
            <select className="authInput" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <select className="authInput" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              Show archived
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-6 overflow-x-auto">
            {isLoading ? (
              <p className="py-6 text-sm text-muted-foreground">Loading documents…</p>
            ) : documents.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No documents found.</p>
            ) : (
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-3 font-semibold text-muted-foreground">Client</th>
                    <th className="px-3 py-3 font-semibold text-muted-foreground">Type</th>
                    <th className="px-3 py-3 font-semibold text-muted-foreground">Category</th>
                    <th className="px-3 py-3 font-semibold text-muted-foreground">File</th>
                    <th className="px-3 py-3 font-semibold text-muted-foreground">Version</th>
                    <th className="px-3 py-3 font-semibold text-muted-foreground">Size</th>
                    <th className="px-3 py-3 font-semibold text-muted-foreground">Uploaded</th>
                    <th className="px-3 py-3 font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => {
                    const client = clients.find((entry) => entry.id === document.client_id);
                    return (
                      <tr key={document.document_id} className="border-b border-border align-top">
                        <td className="px-3 py-4 text-foreground">{client?.name || document.client_id}</td>
                        <td className="px-3 py-4 text-muted-foreground">{document.document_type}</td>
                        <td className="px-3 py-4 text-muted-foreground">{document.category || 'General'}</td>
                        <td className="px-3 py-4 text-foreground">{document.file_name || 'File'}</td>
                        <td className="px-3 py-4 text-muted-foreground">
                          v{document.version}
                          {document.version_count && document.version_count > 1 ? ` / ${document.version_count}` : ''}
                        </td>
                        <td className="px-3 py-4 text-muted-foreground">{formatBytes(document.file_size)}</td>
                        <td className="px-3 py-4 text-muted-foreground">
                          {new Date(document.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button className="btn-secondary" onClick={() => void handleOpenVersions(document)}>
                              Versions
                            </button>
                            <button className="btn-secondary" onClick={() => handleUploadVersion(document)}>
                              New Version
                            </button>
                            <button className="btn-secondary" onClick={() => void handlePreview(document)}>
                              Preview
                            </button>
                            <button className="btn-secondary" onClick={() => void handleDownload(document)}>
                              Download
                            </button>
                            <button className="btn-secondary" onClick={() => void handleToggleArchive(document)}>
                              {document.is_archived ? 'Restore' : 'Archive'}
                            </button>
                            <button
                              className="inline-flex items-center rounded-lg border border-rose-200 px-4 py-2 font-semibold text-rose-600 transition hover:bg-rose-50"
                              onClick={() => void handleDelete(document.document_id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {selectedDocumentId && (
            <div className="mt-6 border-t border-border pt-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Version History</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {documents.find((document) => document.document_id === selectedDocumentId)?.file_name || 'Document'}
                  </p>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSelectedDocumentId('');
                    setDocumentVersions([]);
                  }}
                >
                  Close
                </button>
              </div>

              {isVersionsLoading ? (
                <p className="mt-4 text-sm text-muted-foreground">Loading versions…</p>
              ) : documentVersions.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No versions found.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {documentVersions.map((version) => (
                    <div
                      key={version.version_id}
                      className="grid gap-3 rounded-xl border border-border bg-muted px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto]"
                    >
                      <div>
                        <p className="font-semibold text-foreground">Version {version.version}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{version.file_name || 'Document'}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(version.created_at).toLocaleDateString('en-GB')}
                      </p>
                      <p className="text-sm text-muted-foreground">{formatBytes(version.file_size)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </ContentSection>
    </UniversalPageLayout>
  );
}
