import { PRO_OFFER, PRO_TEMPLATE_NAMES } from '@/lib/pro-teaser';
import { PRO_ORIGIN } from '@/lib/site-links';

export function TemplatesSection() {
  return (
    <section
      aria-labelledby="templates-title"
      className="docs-section components-templates"
      id="templates"
    >
      <h2 id="templates-title">Coming in Pro</h2>
      <div className="template-cards">
        <a className="template-card" href={PRO_ORIGIN}>
          <span className="template-card-window">
            <span aria-hidden className="home-template-bar">
              <i />
              <i />
              <i />
            </span>
            <span aria-hidden className="template-card-pro">
              <span className="template-card-pro-pane">
                {PRO_TEMPLATE_NAMES.map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </span>
            </span>
          </span>
          <span className="template-card-meta">
            <span className="template-card-title">
              Glassy UI Pro{' '}
              <span className="template-tag template-tag--pro">
                {PRO_OFFER.earlyBirdOpen ? `$${PRO_OFFER.earlyBirdPrice} early bird` : 'Pre-order'}
              </span>
            </span>
            <span className="template-card-text">
              Complete Next.js sites in Glassy UI. Pre-order once. Get every Pro template and
              update.
            </span>
          </span>
        </a>
      </div>
    </section>
  );
}
