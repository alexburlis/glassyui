'use client';

import Image from 'next/image';
import { useId, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  GlassButton,
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@/components/liquid';
import { TemplateCardBody, TemplateWindow } from '@/components/site/template-card';
import { captureAction } from '@/lib/analytics/browser';
import { PRO_OFFER } from '@/lib/pro-teaser';
import { PRO_CHECKOUT_URL, PRO_ORIGIN } from '@/lib/site-links';
import { PRO_CARDS, type ProCard } from '@/lib/template-gallery';

const price = PRO_OFFER.earlyBirdOpen ? PRO_OFFER.earlyBirdPrice : PRO_OFFER.regularPrice;

const refund = `Full refund up to ${PRO_OFFER.refundDays} days after your first template arrives.`;

const firstRelease = PRO_CARDS.filter((card) => card.status === 'first-release');

const planned = PRO_CARDS.filter((card) => card.status === 'planned');

// The Pro tile fans out three of the planned templates, the first in the middle: every one of
// them comes with Pro.
const fan = planned.length >= 3 ? [planned[1], planned[0], planned[2]] : planned;

/** The dialog's way through the collection: a chevron pointing back or on. */
function StepGlyph({ direction }: { direction: 'previous' | 'next' }) {
  return (
    <svg aria-hidden className="template-dialog-step-glyph" viewBox="0 0 16 16">
      <path
        d={direction === 'previous' ? 'm10 3.5-4.5 4.5 4.5 4.5' : 'm6 3.5 4.5 4.5L6 12.5'}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg aria-hidden className="template-dialog-check" viewBox="0 0 16 16">
      <path
        d="m3.5 8.5 3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function ProTemplateCard({
  backdrop,
  card,
  onOpen,
  sizes,
}: {
  backdrop: number;
  card: ProCard;
  onOpen: (event: MouseEvent<HTMLAnchorElement>, card: ProCard) => void;
  sizes: string;
}) {
  return (
    <a
      aria-haspopup="dialog"
      className="template-card"
      data-analytics-ignore
      data-template={card.slug}
      href={card.href}
      onClick={(event) => onOpen(event, card)}
    >
      <TemplateCardBody
        backdrop={backdrop}
        card={card}
        sizes={sizes}
        // The planned templates share one label above them rather than one each.
        tag={card.status === 'first-release' ? card.chip : undefined}
        tier="pro"
      />
    </a>
  );
}

export function ProTemplates({ backdropOffset }: { backdropOffset: number }) {
  const [open, setOpen] = useState(false);
  // Separate from open, so the dialog keeps its template while it closes.
  const [shown, setShown] = useState(PRO_CARDS[0]);
  // The template just paged away from, which fades out under the one shown.
  const [previous, setPrevious] = useState<ProCard | null>(null);
  const opener = useRef<HTMLAnchorElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const stripLabel = useId();
  const position = PRO_CARDS.indexOf(shown);

  const show = (event: MouseEvent<HTMLAnchorElement>, card: ProCard) => {
    // A modified click keeps the link, so the Pro site still opens in a new tab or window.
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    event.preventDefault();
    opener.current = event.currentTarget;
    setPrevious(null);
    setShown(card);
    setOpen(true);
    captureAction({
      source: 'template',
      action: 'pro_preview',
      outcome: 'opened',
      template: card.slug,
    });
  };

  const pick = (card: ProCard) => {
    if (card === shown) return;

    setPrevious(shown);
    setShown(card);
    captureAction({
      source: 'template',
      action: 'pro_preview',
      outcome: 'selected',
      template: card.slug,
    });
  };

  // The collection runs round: on from the last template comes back to the first.
  const neighbour = (by: 1 | -1) =>
    PRO_CARDS[(position + by + PRO_CARDS.length) % PRO_CARDS.length];

  const step = (by: 1 | -1) => pick(neighbour(by));

  // The frame holds the poster shown, the one fading out and the two a step away, already loaded
  // so a step crossfades at once; a jump from the strip loads its poster as it fades in.
  const framed = PRO_CARDS.filter(
    (card) =>
      card === shown || card === previous || card === neighbour(1) || card === neighbour(-1),
  );

  return (
    <div className="template-group">
      <header className="template-group-header">
        <h3 className="template-group-title">Coming soon to Pro</h3>
        <span className="template-group-count">
          {PRO_CARDS.length}
          <span className="sr-only"> templates</span>
        </span>
      </header>
      <div className="template-row">
        <div className="template-grid" data-status="first-release">
          {firstRelease.map((card, index) => (
            <ProTemplateCard
              backdrop={backdropOffset + index}
              card={card}
              key={card.slug}
              onOpen={show}
              sizes="(min-width: 1024px) 340px, (min-width: 640px) 45vw, 80vw"
            />
          ))}
        </div>
        <a className="template-pro-tile" data-analytics-source="template" href={PRO_ORIGIN}>
          <div aria-hidden className="template-pro-fan">
            {fan.map((card) => (
              <TemplateWindow
                alt=""
                className="template-pro-fan-window"
                key={card.slug}
                sizes="200px"
                src={card.poster}
              />
            ))}
          </div>
          <span className="template-pro-tile-copy">
            <span className="template-pro-tile-title">Every Pro template, one price</span>
            <span className="template-pro-tile-text">
              {PRO_OFFER.earlyBirdOpen
                ? `$${PRO_OFFER.earlyBirdPrice} for the first ${PRO_OFFER.earlyBirdCap}, then $${PRO_OFFER.regularPrice}.`
                : `$${PRO_OFFER.regularPrice}, paid once.`}{' '}
              {refund}
            </span>
            <span className="template-pro-tile-action">
              Pre-order for ${price}
              <span aria-hidden> ↗</span>
            </span>
          </span>
        </a>
      </div>
      {planned.length > 0 ? (
        <>
          <p className="template-subgroup">{planned[0].chip}</p>
          <div className="template-grid" data-status="planned">
            {planned.map((card, index) => (
              <ProTemplateCard
                backdrop={backdropOffset + firstRelease.length + index}
                card={card}
                key={card.slug}
                onOpen={show}
                sizes="(min-width: 1024px) 250px, (min-width: 640px) 45vw, 64vw"
              />
            ))}
          </div>
        </>
      ) : null}
      <p className="template-gallery-note">Pro images are design previews.</p>
      <GlassDialog onOpenChange={setOpen} open={open}>
        <GlassDialogContent
          className="template-dialog"
          closeLabel="Close"
          // The arrow keys page through the collection from anywhere in the dialog.
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

            event.preventDefault();
            step(event.key === 'ArrowRight' ? 1 : -1);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          onOpenAutoFocus={(event) => {
            // The dialog itself takes focus, so a short screen opens on the poster rather than
            // scrolled down to the call to action, which is the first stop for Tab.
            event.preventDefault();

            if (event.currentTarget instanceof HTMLElement) {
              event.currentTarget.focus({ preventScroll: true });
            }
          }}
        >
          <div className="template-dialog-body">
            <p className="template-dialog-eyebrow">{shown.chip}</p>
            <div className="template-dialog-poster">
              <span aria-hidden className="template-window-bar">
                <i />
                <i />
                <i />
              </span>
              {/* A swipe across the poster pages too. The buttons are for a pointer; the keyboard
                  has the arrow keys and the strip. */}
              <div
                className="template-card-poster"
                onPointerCancel={() => {
                  swipe.current = null;
                }}
                onPointerDown={(event) => {
                  if (event.pointerType === 'touch') {
                    swipe.current = { x: event.clientX, y: event.clientY };
                  }
                }}
                onPointerUp={(event) => {
                  const start = swipe.current;

                  swipe.current = null;

                  if (!start) return;

                  const across = event.clientX - start.x;

                  if (
                    Math.abs(across) > 40 &&
                    Math.abs(across) > 1.5 * Math.abs(event.clientY - start.y)
                  ) {
                    step(across < 0 ? 1 : -1);
                  }
                }}
              >
                {framed.map((card) => (
                  <Image
                    alt={card === shown ? `${card.name} design preview` : ''}
                    aria-hidden={card === shown ? undefined : true}
                    data-shown={card === shown || undefined}
                    height={800}
                    key={card.slug}
                    sizes="(min-width: 768px) 500px, 92vw"
                    src={card.poster}
                    width={1280}
                  />
                ))}
                <GlassButton
                  aria-label="Previous template"
                  className="template-dialog-step"
                  data-direction="previous"
                  onClick={() => step(-1)}
                  size="sm"
                  tabIndex={-1}
                  variant="primary"
                >
                  <StepGlyph direction="previous" />
                </GlassButton>
                <GlassButton
                  aria-label="Next template"
                  className="template-dialog-step"
                  data-direction="next"
                  onClick={() => step(1)}
                  size="sm"
                  tabIndex={-1}
                  variant="primary"
                >
                  <StepGlyph direction="next" />
                </GlassButton>
              </div>
            </div>
            <div className="template-dialog-details">
              <GlassDialogTitle className="template-dialog-title">{shown.name}</GlassDialogTitle>
              <p className="template-dialog-kind">{shown.kind}</p>
              {shown.timing ? <p className="template-dialog-timing">{shown.timing}</p> : null}
              <GlassDialogDescription className="template-dialog-description">
                Pre-order Glassy UI Pro and get {shown.name} the day it ships.
              </GlassDialogDescription>
              <ul className="template-dialog-benefits">
                <li>
                  <CheckGlyph />A complete Next.js site built from Glassy UI.
                </li>
                <li>
                  <CheckGlyph />
                  One purchase covers every Pro template and update, including later ones.
                </li>
                <li>
                  <CheckGlyph />
                  {refund}
                </li>
              </ul>
              <p className="template-dialog-price">
                <span className="template-dialog-amount">${price}</span>
                <span className="template-dialog-terms">
                  {PRO_OFFER.earlyBirdOpen
                    ? `Early bird for the first ${PRO_OFFER.earlyBirdCap}, then $${PRO_OFFER.regularPrice}`
                    : 'Paid once'}
                </span>
              </p>
              <GlassButton asChild className="template-dialog-cta" size="lg" variant="prominent">
                <a data-analytics-checkout data-analytics-source="template" href={PRO_CHECKOUT_URL}>
                  Pre-order for ${price}
                  <span aria-hidden> ↗</span>
                </a>
              </GlassButton>
              <p className="template-dialog-tax">Plus any tax</p>
            </div>
            <div className="template-dialog-strip">
              <div className="template-dialog-strip-header">
                <p className="template-dialog-strip-label" id={stripLabel}>
                  Included with Pro
                </p>
                <p aria-live="polite" className="template-dialog-count">
                  {position + 1} of {PRO_CARDS.length}
                </p>
              </div>
              <div aria-labelledby={stripLabel} className="template-dialog-thumbs" role="group">
                {PRO_CARDS.map((card) => (
                  <button
                    aria-current={card === shown || undefined}
                    aria-label={`Show ${card.name}`}
                    className="template-dialog-thumb"
                    key={card.slug}
                    onClick={() => pick(card)}
                    type="button"
                  >
                    <Image alt="" height={800} sizes="96px" src={card.poster} width={1280} />
                  </button>
                ))}
              </div>
              <p className="template-dialog-note">Images are design previews.</p>
            </div>
          </div>
        </GlassDialogContent>
      </GlassDialog>
    </div>
  );
}
