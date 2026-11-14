import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { acceptQuotation, createBooking, createQuotation, getQuotation, sendQuotation } from '../api/endpoints';
import type { Quotation } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadState } from '../components/LoadState';
import { OfferDocument } from '../components/OfferDocument';
import { PageHeader } from '../components/PageHeader';
import { QuotationStatusTag } from '../components/StatusTag';
import { formatDate, formatRupees, QUOTATION_STATUS_LABEL, UNIT_STATUS_LABEL } from '../lib/format';
import { useLoad } from '../lib/useLoad';

type Step = 'send' | 'accept' | 'book' | 'renew';

/**
 * The one next step for a quotation, or none.
 * Draft -> Sent -> Accepted -> booked. An expired quotation can only be replaced by a new one.
 */
function nextStep(quotation: Quotation): Step | undefined {
  if (quotation.booking_id !== null) {
    return undefined;
  }
  if (quotation.unit_status !== 'AVAILABLE') {
    return undefined;
  }
  switch (quotation.status) {
    case 'DRAFT':
      return 'send';
    case 'SENT':
      return 'accept';
    case 'ACCEPTED':
      return 'book';
    case 'EXPIRED':
      return 'renew';
  }
}

const STEP_LABEL: Record<Step, string> = {
  send: 'Mark as sent',
  accept: 'Mark as accepted',
  book: 'Confirm booking',
  renew: 'Create new quotation',
};

/** One quotation, laid out as the printable document, with its single next step as the main button. */
export function QuotationPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState<Step | undefined>(undefined);
  const quotation = useLoad(() => getQuotation(id), [id]);

  return (
    <LoadState state={quotation}>
      {(quote) => {
        const step = nextStep(quote);
        const closeAndReload = () => {
          setConfirming(undefined);
          quotation.reload();
        };

        return (
          <>
            <PageHeader
              title={quote.quotation_number}
              aside={<QuotationStatusTag status={quote.status} />}
              back={{ to: '/quotations', label: 'quotations' }}
              actions={
                <>
                  <button type="button" className="button" onClick={() => window.print()}>
                    Print or save as PDF
                  </button>
                  {quote.booking_id !== null && (
                    <Link to={`/bookings/${quote.booking_id}`} className="button button-primary">
                      View booking {quote.booking_number}
                    </Link>
                  )}
                  {step && (
                    <button type="button" className="button button-primary" onClick={() => setConfirming(step)}>
                      {STEP_LABEL[step]}
                    </button>
                  )}
                </>
              }
            />

            {quote.status === 'EXPIRED' && (
              <p className="notice screen-only">
                This quotation expired after {formatDate(quote.valid_until)}. It can no longer be sent, accepted or
                booked.
              </p>
            )}
            {quote.booking_id === null && quote.unit_status !== 'AVAILABLE' && (
              <p className="notice screen-only">
                Unit {quote.unit_code} is now {UNIT_STATUS_LABEL[quote.unit_status].toLowerCase()} through another
                quotation, so this one can no longer move forward.
              </p>
            )}

            <OfferDocument
              kind="Quotation"
              number={quote.quotation_number}
              facts={[
                { label: 'Issue date', value: formatDate(quote.issue_date) },
                { label: 'Valid until', value: formatDate(quote.valid_until) },
                { label: 'Status', value: QUOTATION_STATUS_LABEL[quote.status] },
              ]}
              customer={{ name: quote.customer_name, mobile: quote.customer_mobile, email: quote.customer_email }}
              unit={{
                project: quote.project_name,
                code: quote.unit_code,
                type: quote.unit_type,
                areaSqft: quote.area_sqft,
              }}
              money={quote}
              footnote={`This quotation is valid for 7 days, until the end of ${formatDate(quote.valid_until)}.`}
            />

            <p className="muted screen-only">
              Created from cost sheet <Link to={`/cost-sheets/${quote.cost_sheet_id}`}>{quote.cost_sheet_number}</Link>.
            </p>

            {confirming === 'send' && (
              <ConfirmDialog
                title="Mark as sent"
                confirmLabel="Mark as sent"
                onClose={() => setConfirming(undefined)}
                onConfirm={async () => {
                  await sendQuotation(quote.id);
                  closeAndReload();
                }}
              >
                <p>
                  Mark {quote.quotation_number} as sent to {quote.customer_name}? This records that you have shared it.
                  It cannot be moved back to Draft.
                </p>
              </ConfirmDialog>
            )}

            {confirming === 'accept' && (
              <ConfirmDialog
                title="Mark as accepted"
                confirmLabel="Mark as accepted"
                onClose={() => setConfirming(undefined)}
                onConfirm={async () => {
                  await acceptQuotation(quote.id);
                  closeAndReload();
                }}
              >
                <p>
                  Mark {quote.quotation_number} as accepted by {quote.customer_name}? The unit is not booked until you
                  confirm the booking, which must happen by {formatDate(quote.valid_until)}.
                </p>
              </ConfirmDialog>
            )}

            {confirming === 'book' && (
              <ConfirmDialog
                title="Confirm booking"
                confirmLabel="Confirm booking"
                onClose={() => setConfirming(undefined)}
                onConfirm={async () => {
                  const booking = await createBooking(quote.id);
                  navigate(`/bookings/${booking.id}`);
                }}
              >
                <p>
                  Book {quote.project_name}, {quote.unit_code} for {quote.customer_name} at{' '}
                  {formatRupees(quote.final_price_paise)}?
                </p>
                <p>
                  The unit becomes Booked and four payment milestones are created: Booking 10%, Foundation 20%,
                  Structure 30% and Handover 40%.
                </p>
              </ConfirmDialog>
            )}

            {confirming === 'renew' && (
              <ConfirmDialog
                title="Create new quotation"
                confirmLabel="Create new quotation"
                onClose={() => setConfirming(undefined)}
                onConfirm={async () => {
                  const fresh = await createQuotation(quote.cost_sheet_id);
                  setConfirming(undefined);
                  navigate(`/quotations/${fresh.id}`);
                }}
              >
                <p>
                  Create a fresh quotation from cost sheet {quote.cost_sheet_number}, with the same figures, valid for 7
                  days from today?
                </p>
              </ConfirmDialog>
            )}
          </>
        );
      }}
    </LoadState>
  );
}
