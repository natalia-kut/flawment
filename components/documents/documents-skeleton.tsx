import PageHeader from "@/components/page-header";
import "./documents.css";

/**
 * What Documents shows while its data loads: the real heading, and soft
 * placeholders where the template list and the preview will appear, so the
 * page fills in instead of jumping from a line of text to the full layout.
 */
export default function DocumentsSkeleton() {
  return <div className="documents-page" aria-busy="true">
    <PageHeader title="Documents" />
    <p className="visually-hidden" role="status">Loading documents…</p>
    <div className="documents-layout" aria-hidden="true">
      <div className="template-sidebar skeleton-stack">
        <span className="skeleton-block skeleton-label" />
        <span className="skeleton-block skeleton-field" />
        <span className="skeleton-block skeleton-label" />
        {[0, 1, 2, 3].map((item) => <span key={item} className="skeleton-block skeleton-card" />)}
      </div>
      <div className="document-preview-area skeleton-stack">
        <span className="skeleton-block skeleton-toolbar" />
        <span className="skeleton-block skeleton-sheet" />
      </div>
    </div>
  </div>;
}
