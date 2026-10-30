import { useEffect, useState } from 'react';
import type { ExportFormat } from './types';
import { StoreProvider, useStore } from './state/store';
import { buildExport, runExport, type BuiltFile } from './lib/exporter';
import { saveBlob } from './lib/download';
import { Header } from './components/Header';
import { Calendar } from './components/Calendar';
import { Summary } from './components/Summary';
import { Editor } from './components/Editor';
import { SettingsDialog } from './components/SettingsDialog';
import { ExportDialog } from './components/ExportDialog';
import { PdfPreview } from './components/PdfPreview';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Toast } from './components/Toast';

function Shell() {
  const s = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<BuiltFile | null>(null);

  // Keep sticky bars below the header (its height changes with wrapping).
  useEffect(() => {
    const measure = () => {
      const bar = document.querySelector<HTMLElement>('.bar');
      if (bar) document.documentElement.style.setProperty('--barh', `${bar.offsetHeight}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const doExport = async (fmt: ExportFormat, only: string[] | null, suffix: string) => {
    setBusy(true);
    try {
      const name = await runExport(fmt, s.settings, s.curYM, s.month, only, suffix);
      s.showToast(`Saved ${name}`);
    } catch {
      s.showToast(`Couldn’t build the ${fmt === 'pdf' ? 'PDF' : 'Excel file'}. Try again, or reload the page.`);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => document.getElementById('download')?.focus());
    }
  };

  const doPreview = async (only: string[] | null, suffix: string) => {
    setBusy(true);
    try {
      setPreview(await buildExport('pdf', s.settings, s.curYM, s.month, only, suffix));
    } catch {
      s.showToast('Couldn’t build the PDF preview. Try again, or reload the page.');
      requestAnimationFrame(() => document.getElementById('download')?.focus());
    } finally {
      setBusy(false);
    }
  };

  const closePreview = () => {
    setPreview(null);
    requestAnimationFrame(() => document.getElementById('download')?.focus());
  };

  return (
    <>
      <Header busy={busy} onDownload={() => setExportOpen(true)} onSettings={() => setSettingsOpen(true)} />
      <main>
        <div className="col">
          <Calendar />
          <Summary />
        </div>
        <Editor />
      </main>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} onExport={doExport} onPreview={doPreview} />
      <PdfPreview
        file={preview}
        onClose={closePreview}
        onBack={() => {
          setPreview(null);
          setExportOpen(true);
        }}
        onDownload={(f) => {
          saveBlob(f.name, f.blob);
          s.showToast(`Saved ${f.name}`);
          closePreview();
        }}
      />
      <ConfirmDialog />
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
