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
import { TemplateCardBody } from '@/components/site/template-card';
import { PRO_OFFER } from '@/lib/pro-teaser';
import { PRO_ORIGIN } from '@/lib/site-links';
import { PRO_CARDS, type ProCard } from '@/lib/template-gallery';

const price = PRO_OFFER.earlyBirdOpen ? PRO_OFFER.earlyBirdPrice : PRO_OFFER.regularPrice;

const refund = `Full refund up to ${PRO_OFFER.refundDays} days after your first template arrives.`;

const firstRelease = PRO_CARDS.filter((card) => card.status === 'first-release');

const planned = PRO_CARDS.filter((card) => card.status === 'planned');

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
  card,
  onOpen,
  sizes,
}: {
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
        action={
          <>
            Get it first with Pro<span aria-hidden> ›</span>
          </>
        }
        card={card}
        chip={card.chip}
        sizes={sizes}
        tier="pro"
      />
    </a>
  );
}

export function ProTemplates() {
  const [open, setOpen] = useState(false);
  // Separate from open, so the dialog keeps its template while it closes.
  const [shown, setShown] = useState(PRO_CARDS[0]);
  const opener = useRef<HTMLAnchorElement>(null);
  const cta = useRef<HTMLAnchorElement>(null);
  const stripLabel = useId();

  const show = (event: MouseEvent<HTMLAnchorElement>, card: ProCard) => {
    // A modified click keeps the link, so the Pro site still opens in a new tab or window.
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    event.preventDefault();
    opener.current = event.currentTarget;
    setShown(card);
    setOpen(true);
  };

  return (
    <div className="template-group">
      <header className="template-group-header">
        <h3 className="template-group-title">Coming soon to Pro</h3>
        <p className="template-group-lead">
          Pre-order once and get each template the day it ships.
        </p>
      </header>
      <div className="template-grid" data-status="first-release">
        {firstRelease.map((card) => (
          <ProTemplateCard
            card={card}
            key={card.slug}
            onOpen={show}
            sizes="(min-width: 1024px) 390px, 50vw"
          />
        ))}
        <a className="template-pro-tile" data-analytics-source="template" href={PRO_ORIGIN}>
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
      <div className="template-grid" data-status="planned">
        {planned.map((card) => (
          <ProTemplateCard
            card={card}
            key={card.slug}
            onOpen={show}
            sizes="(min-width: 1024px) 290px, 50vw"
          />
        ))}
      </div>
      <p className="template-gallery-note">
        Pro images are design previews. Planned templates have no date yet.
      </p>
      <GlassDialog onOpenChange={setOpen} open={open}>
        <GlassDialogContent
          className="template-dialog"
          closeLabel="Close"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          onOpenAutoFocus={(event) => {
            // Radix never gives a link the first focus, and the call to action is one.
            event.preventDefault();
            cta.current?.focus();
          }}
        >
          <p className="template-dialog-eyebrow">{shown.chip}</p>
          <div className="template-dialog-poster">
            <Image
              alt={`${shown.name} design preview`}
              height={800}
              sizes="(min-width: 768px) 500px, 92vw"
              src={shown.poster}
              width={1280}
            />
          </div>
          <div className="template-dialog-details">
            <GlassDialogTitle className="template-dialog-title">{shown.name}</GlassDialogTitle>
            <p className="template-dialog-kind">{shown.kind}</p>
            <p className="template-dialog-timing">{shown.timing}</p>
            <GlassDialogDescription className="template-dialog-description">
              Pre-order Glassy UI Pro and get {shown.name} the day it ships.
            </GlassDialogDescription>
            <ul className="template-dialog-benefits">
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
              {PRO_OFFER.earlyBirdOpen ? (
                <>
                  <span className="template-dialog-amount">${PRO_OFFER.earlyBirdPrice}</span>
                  <s className="template-dialog-regular">
                    <span className="lg-visually-hidden">Regular price </span>$
                    {PRO_OFFER.regularPrice}
                  </s>
                  <span className="template-dialog-terms">
                    Early bird for the first {PRO_OFFER.earlyBirdCap}
                  </span>
                </>
              ) : (
                <>
                  <span className="template-dialog-amount">${PRO_OFFER.regularPrice}</span>
                  <span className="template-dialog-terms">Paid once</span>
                </>
              )}
            </p>
            <GlassButton asChild className="template-dialog-cta" size="lg" variant="prominent">
              <a data-analytics-source="template" href={PRO_ORIGIN} ref={cta}>
                Pre-order for ${price}
                <span aria-hidden> ↗</span>
              </a>
            </GlassButton>
          </div>
          <div className="template-dialog-strip">
            <p className="template-dialog-strip-label" id={stripLabel}>
              Included with Pro
            </p>
            <div aria-labelledby={stripLabel} className="template-dialog-thumbs" role="group">
              {PRO_CARDS.map((card) => (
                <button
                  aria-current={card === shown || undefined}
                  aria-label={`Show ${card.name}`}
                  className="template-dialog-thumb"
                  key={card.slug}
                  onClick={() => setShown(card)}
                  type="button"
                >
                  <Image alt="" height={800} sizes="96px" src={card.poster} width={1280} />
                </button>
              ))}
            </div>
            <p className="template-dialog-note">Images are design previews.</p>
          </div>
        </GlassDialogContent>
      </GlassDialog>
    </div>
  );
}
