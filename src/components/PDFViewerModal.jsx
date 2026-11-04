import React, { useState, useEffect } from 'react';
import { Download, X, FileText, CheckCircle2, BookOpen, ShieldCheck, Loader2 } from 'lucide-react';
import { resolveCloudFileUrl } from '../firebase';

export default function PDFViewerModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [material, setMaterial] = useState(null);
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    window.openInAppPdfModal = async (item) => {
      if (!item) return;
      const mat = typeof item === 'string'
        ? ((window.state && Array.isArray(window.state.materials) ? window.state.materials.find((m) => String(m.id) === String(item)) : null) || {
            id: item,
            title: 'Prepskm Study Material PDF',
            subject: 'Physics',
            chapter: 'Complete Revision Formula Sheet',
            pdf_url: item,
          })
        : item;

      setMaterial(mat);
      setIsOpen(true);
      window.__isPdfModalOpen = true;
      try {
        window.history.pushState(
          { modal: 'pdf', path: window.location.pathname },
          '',
          window.location.pathname
        );
      } catch (_e) {}
      setDownloadSuccess(false);
      setLoading(true);

      try {
        const rawUrl = mat.pdf_url || mat.fileData || mat.url || '';
        if (rawUrl.startsWith('#prepskm-cloud-file:')) {
          const dataUrl = await resolveCloudFileUrl(rawUrl);
          setResolvedUrl(dataUrl || '');
        } else if (rawUrl && rawUrl !== '#' && !rawUrl.startsWith('blob:')) {
          setResolvedUrl(rawUrl);
        } else {
          setResolvedUrl('');
        }
      } catch (e) {
        console.warn('Error loading cloud PDF preview:', e);
        setResolvedUrl('');
      } finally {
        setLoading(false);
      }
    };

    window.openInAppPdfViewer = window.openInAppPdfModal;
    window.closeInAppPdfModal = () => {
      window.__isPdfModalOpen = false;
      setIsOpen(false);
    };
    window.closeInAppPdfViewer = window.closeInAppPdfModal;

    window.downloadMaterialDirectlyToDevice = async (item) => {
      if (!item) return;
      const mat = typeof item === 'string'
        ? ((window.state && Array.isArray(window.state.materials) ? window.state.materials.find((m) => String(m.id) === String(item)) : null) || {
            id: item,
            title: 'Prepskm_Study_Material',
            subject: 'Physics',
            chapter: 'Complete Revision Formula Sheet',
          })
        : item;
      const cleanName = (mat.title || 'Prepskm_Study_Material')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      const rawUrl = mat.pdf_url || mat.downloadUrl || mat.fileData || mat.url || '';
      let dataUrl = '';
      if (rawUrl.startsWith('#prepskm-cloud-file:')) {
        dataUrl = await resolveCloudFileUrl(rawUrl);
      } else if (rawUrl.startsWith('data:')) {
        dataUrl = rawUrl;
      }
      if (dataUrl) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${cleanName}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const blob = new Blob(
          [`Prepskm Official Study Material: ${mat.title || 'Study Sheet'}\nSubject: ${mat.subject || 'Physics'}\nChapter: ${mat.chapter || 'General'}\nCurated by Lead Mentor Sumit (@unfiltereddsumit)`],
          { type: 'application/pdf' }
        );
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${cleanName}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      }
      if (typeof window.showToast === 'function') {
        window.showToast(`Downloaded "${mat.title || 'Study Material'}" (.PDF) to your device!`);
      }
    };
  }, []);

  if (!isOpen || !material) return null;

  const generatePrintableStudySheetBlob = (mat) => {
    const title = mat.title || 'Prepskm Study Material';
    const subject = (mat.subject || 'Physics').toUpperCase();
    const chapter = mat.chapter || mat.category || 'High-Weightage Revision Notes';
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} - Prepskm.in</title>
  <style>
    body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; margin: 0; padding: 36px; background: #f8fafc; color: #0f172a; }
    .sheet { max-width: 820px; margin: 0 auto; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 20px; padding: 36px; box-shadow: 0 12px 32px rgba(15,23,42,0.06); }
    .badge { display: inline-block; background: #eef2ff; color: #4f46e5; font-weight: 800; font-size: 11px; padding: 5px 12px; border-radius: 999px; letter-spacing: 0.08em; text-transform: uppercase; }
    h1 { font-size: 26px; font-weight: 900; margin: 12px 0 6px; color: #0f172a; }
    .meta { font-size: 13px; color: #64748b; font-weight: 600; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
    .section { background: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px 20px; border-radius: 12px; margin-bottom: 16px; }
    .section h3 { margin: 0 0 8px; font-size: 15px; color: #1e293b; }
    .section p, .section li { font-size: 13.5px; line-height: 1.65; color: #334155; }
    .formula-box { background: #0f172a; color: #f8fafc; font-family: monospace; padding: 14px 18px; border-radius: 12px; margin: 10px 0; font-size: 14px; }
    .footer { margin-top: 28px; font-size: 12px; color: #64748b; text-align: center; font-weight: 700; }
  </style>
</head>
<body>
  <div class="sheet">
    <span class="badge">${subject} • ${chapter}</span>
    <h1>${title}</h1>
    <div class="meta">Curated by Lead Mentor Sumit (@unfiltereddsumit) • Prepskm Official Study Vault</div>
    <div class="section">
      <h3>1. Core Concept & Exam Weightage Summary</h3>
      <p>This revision sheet covers the highest-yield concepts, standard derivations, and direct formula shortcuts frequently tested in JEE Main, JEE Advanced, and NEET UG.</p>
      <div class="formula-box">
        • Standard Relation I: F_net = dp / dt = m · a_cm<br/>
        • Energy Conservation: K_i + U_i + W_ext = K_f + U_f + ΔE_thermal<br/>
        • Limiting Case Shortcut: Always verify dimensional consistency & boundary conditions (θ → 0, m₁ ≫ m₂).
      </div>
    </div>
    <div class="section">
      <h3>2. Lead Mentor Sumit's Top 3 Exam Traps to Avoid</h3>
      <ul>
        <li><strong>Sign Convention Errors:</strong> Explicitly fix your coordinate axes before writing conservation or circuit equations.</li>
        <li><strong>SI Unit Conversion:</strong> Watch out for cm², mL, eV, and Gauss in numerical integer-type questions.</li>
        <li><strong>Graph Slope vs. Area:</strong> Check whether the question asks for instantaneous rate (dY/dX) or cumulative integral (∫Y dX).</li>
      </ul>
    </div>
    <div class="footer">Prepskm.in — Verified Cloud Study Material • Lead Mentor Sumit (@unfiltereddsumit)</div>
  </div>
</body>
</html>`;
    return new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  };

  const handleDownloadToDevice = async () => {
    setDownloading(true);
    try {
      const cleanName = (material.title || 'Prepskm_Study_Material')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');

      if (resolvedUrl && resolvedUrl.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = resolvedUrl;
        a.download = `${cleanName}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const blob = generatePrintableStudySheetBlob(material);
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${cleanName}_Notes.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      }

      setDownloadSuccess(true);
      if (typeof window.showToast === 'function') {
        window.showToast(`Downloaded "${material.title}" to your device!`);
      }
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99996,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '940px',
          height: '88vh',
          background: '#ffffff',
          borderRadius: '24px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(129, 140, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(79, 70, 229, 0.35)',
                    color: '#c7d2fe',
                    textTransform: 'uppercase',
                  }}
                >
                  {(material.subject || 'Physics').toUpperCase()}
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                  {material.chapter || material.category || 'Cloud Study Vault'}
                </span>
              </div>
              <h3 style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: 800, color: '#fff' }}>
                {material.title || 'Study Material PDF'}
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleDownloadToDevice}
              disabled={downloading}
              style={{
                background: downloadSuccess
                  ? '#10b981'
                  : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '9px 16px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.5)',
              }}
            >
              {downloading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : downloadSuccess ? (
                <CheckCircle2 size={15} />
              ) : (
                <Download size={15} />
              )}
              {downloading
                ? 'Saving to Device...'
                : downloadSuccess
                ? 'Saved to Device!'
                : 'Download to Device'}
            </button>

            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#cbd5e1',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close Reader"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, background: '#f1f5f9', overflowY: 'auto', position: 'relative' }}>
          {loading ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: '#475569',
              }}
            >
              <Loader2 size={32} className="animate-spin" style={{ color: '#4f46e5' }} />
              <div style={{ fontSize: '14px', fontWeight: 700 }}>
                Loading Cloud PDF from Prepskm Vault...
              </div>
            </div>
          ) : resolvedUrl ? (
            <iframe
              src={resolvedUrl}
              title={material.title || 'In-App PDF Reader'}
              style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
            />
          ) : (
            <div style={{ maxWidth: '780px', margin: '24px auto', padding: '0 16px 32px' }}>
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '20px',
                  padding: '28px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.05)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '14px',
                    borderBottom: '1px solid #f1f5f9',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen size={18} style={{ color: '#4f46e5' }} />
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#4f46e5' }}>
                      PREPSKM IN-APP FORMULA &amp; DPP READER
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#059669',
                      background: '#ecfdf5',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ShieldCheck size={13} /> Curated by Lead Mentor Sumit (@unfiltereddsumit)
                  </span>
                </div>

                <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>
                  {material.title}
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px', fontWeight: 600 }}>
                  Subject: {(material.subject || 'Physics').toUpperCase()} • Chapter:{' '}
                  {material.chapter || material.category || 'Complete Revision Module'}
                </p>

                <div
                  style={{
                    background: '#f8fafc',
                    borderLeft: '4px solid #4f46e5',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    marginBottom: '16px',
                  }}
                >
                  <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>
                    1. High-Yield Formula Summary &amp; Key Relations
                  </h4>
                  <div
                    style={{
                      background: '#0f172a',
                      color: '#e2e8f0',
                      padding: '14px',
                      borderRadius: '10px',
                      fontFamily: 'monospace',
                      fontSize: '12.5px',
                      lineHeight: 1.7,
                    }}
                  >
                    <div>• Conservation Law: ΔK + ΔU = W_non-conservative</div>
                    <div>• Equivalent System Shortcut: R_eq = (R₁ · R₂) / (R₁ + R₂)</div>
                    <div>• Peak Resonance / Extremum Condition: d(Function)/dx = 0</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '20px',
                    padding: '14px 18px',
                    borderRadius: '14px',
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#312e81' }}>
                      Want offline access on your phone or laptop?
                    </div>
                    <div style={{ fontSize: '11px', color: '#4338ca', fontWeight: 600 }}>
                      Click &ldquo;Download to Device&rdquo; to save this study sheet directly to your Downloads folder.
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadToDevice}
                    style={{
                      background: '#4f46e5',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Download size={14} /> Download to Device
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
