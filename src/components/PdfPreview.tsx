import { useEffect, useState } from 'react';
import type { BuiltFile } from '../lib/exporter';
import { Modal } from './Modal';
import { Icon, IconButton } from './Icon';

interface PdfPreviewProps {
  file: BuiltFile | null;
  onClose: () => void;
  onBack: () => void;
  onDownload: (file: BuiltFile) => void;
}

/** Shows the generated PDF in the browser's viewer before it's saved. */
export function PdfPreview({ file, onClose, onBack, onDownload }: PdfPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file.blob);
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [file]);

  return (
    <Modal open={!!file} onClose={onClose} labelledBy="pvTitle" wide>
      <header>
        <div className="pvtitle">
          <h2 id="pvTitle">Preview</h2>
          <small>{file?.name}</small>
        </div>
        <IconButton icon="x" label="Close preview" onClick={onClose} />
      </header>
      <div className="pvbody">
        {url && (
          <object data={`${url}#view=FitH&toolbar=0`} type="application/pdf" className="pvframe" aria-label={`Preview of ${file?.name}`}>
            <div className="pvfallback">
              <p>This browser can’t show the PDF here.</p>
              <a className="btn" href={url} target="_blank" rel="noopener">
                <Icon name="external" />
                Open in a new tab
              </a>
            </div>
          </object>
        )}
      </div>
      <footer>
        <button className="btn quiet2 pvback" type="button" onClick={onBack}>Change options</button>
        <button className="btn" type="button" onClick={onClose}>Close</button>
        <button className="btn primary" type="button" onClick={() => file && onDownload(file)}>
          <Icon name="download" />
          Download PDF
        </button>
      </footer>
    </Modal>
  );
}
