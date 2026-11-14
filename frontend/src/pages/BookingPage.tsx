import { type FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router';
import { type ApiError, toApiError } from '../api/client';
import { getBooking, recordPayment } from '../api/endpoints';
import type { BookingDetail, Milestone } from '../api/types';
import { Dialog } from '../components/Dialog';
import { Field } from '../components/Field';
import { Figure } from '../components/Figure';
import { LoadState } from '../components/LoadState';
import { PageHeader } from '../components/PageHeader';
import { MilestoneStateTag, UnitStatusTag } from '../components/StatusTag';
import {
  formatArea,
  formatDate,
  formatPercent,
  formatRupees,
  formatTimestamp,
  MILESTONE_STAGE_LABEL,
  parseRupeesToPaise,
  todayInIndia,
} from '../lib/format';
import { useLoad } from '../lib/useLoad';

/**
 * One booking: the price, the four milestones in the order they are paid, and the payment history.
 * Payments always go to the earliest milestone that still has a balance, so only that
 * milestone offers "Record payment".
 */
export function BookingPage() {
  const id = Number(useParams().id);
  const [paying, setPaying] = useState(false);
  const booking = useLoad(() => getBooking(id), [id]);

  return (
    <LoadState state={booking}>
      {(detail) => {
        const current = detail.milestones.find((milestone) => milestone.is_current);

        return (
          <>
            <PageHeader
              title={detail.booking_number}
              aside={<UnitStatusTag status={detail.unit_status} />}
              back={{ to: '/bookings', label: 'bookings' }}
              actions={
                current && (
                  <button type="button" className="button button-primary" onClick={() => setPaying(true)}>
                    Record payment
                  </button>
                )
              }
            />

            <p className="summary-line">
              {detail.customer_name}, {detail.customer_mobile}. {detail.project_name}, {detail.unit_code},{' '}
              {detail.unit_type}, {formatArea(detail.area_sqft)}. Booked on {formatTimestamp(detail.booked_at)} from
              quotation <Link to={`/quotations/${detail.quotation_id}`}>{detail.quotation_number}</Link>.
            </p>

            <section className="section" aria-labelledby="totals-heading">
              <h2 id="totals-heading" className="visually-hidden">
                Totals
              </h2>
              <dl className="figures">
                <Figure label="Final price" value={formatRupees(detail.final_price_paise)} />
                <Figure label="Total collected" value={formatRupees(detail.collected_paise)} />
                <Figure label="Outstanding" value={formatRupees(detail.outstanding_paise)} strong />
              </dl>
              <p className="muted">
                Listed price {formatRupees(detail.listed_price_paise)}, less {formatPercent(detail.discount_bps)}{' '}
                discount of {formatRupees(detail.discount_amount_paise)}.
              </p>
            </section>

            <section className="section" aria-labelledby="milestones-heading">
              <h2 id="milestones-heading">Payment milestones</h2>
              {!current && <p className="notice notice-good">This booking is fully paid. The unit is sold.</p>}
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Milestone</th>
                      <th scope="col" className="num">
                        Share
                      </th>
                      <th scope="col" className="num">
                        Amount due
                      </th>
                      <th scope="col" className="num">
                        Collected
                      </th>
                      <th scope="col" className="num">
                        Balance
                      </th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.milestones.map((milestone) => (
                      <tr key={milestone.id} className={milestone.is_current ? 'row-current' : undefined}>
                        <th scope="row">
                          {milestone.sequence_no}. {MILESTONE_STAGE_LABEL[milestone.stage]}
                          {milestone.is_current && <span className="current-mark">Next payment goes here</span>}
                        </th>
                        <td className="num">{milestone.percent}%</td>
                        <td className="num">{formatRupees(milestone.amount_due_paise)}</td>
                        <td className="num">{formatRupees(milestone.collected_paise)}</td>
                        <td className="num">{formatRupees(milestone.balance_paise)}</td>
                        <td>
                          <MilestoneStateTag state={milestone.state} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="section" aria-labelledby="payments-heading">
              <h2 id="payments-heading">Payment history</h2>
              {detail.payments.length === 0 ? (
                <p className="empty">No payments recorded yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Reference</th>
                        <th scope="col">Milestone</th>
                        <th scope="col" className="num">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.payments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{formatDate(payment.payment_date)}</td>
                          <td>{payment.payment_reference}</td>
                          <td>{MILESTONE_STAGE_LABEL[payment.stage]}</td>
                          <td className="num">{formatRupees(payment.amount_paise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {paying && current && (
              <RecordPaymentDialog
                booking={detail}
                milestone={current}
                onClose={() => setPaying(false)}
                onSaved={() => {
                  setPaying(false);
                  booking.reload();
                }}
              />
            )}
          </>
        );
      }}
    </LoadState>
  );
}

interface RecordPaymentDialogProps {
  booking: BookingDetail;
  milestone: Milestone;
  onClose: () => void;
  onSaved: () => void;
}

function RecordPaymentDialog({ booking, milestone, onClose, onSaved }: RecordPaymentDialogProps) {
  const [amountText, setAmountText] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayInIndia());
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [amountError, setAmountError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<ApiError | undefined>(undefined);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    const amountPaise = parseRupeesToPaise(amountText);
    if (amountPaise === null) {
      setAmountError('Enter the amount in rupees, for example 500000.');
      return;
    }
    setAmountError(undefined);
    setBusy(true);
    try {
      await recordPayment(booking.id, {
        amount_paise: amountPaise,
        payment_date: paymentDate,
        payment_reference: reference,
      });
      onSaved();
    } catch (failure) {
      setError(toApiError(failure));
      setBusy(false);
    }
  }

  // The server's message for the amount box covers both invalid amounts and overpayments.
  const serverAmountError = error?.code === 'OVERPAYMENT' ? error.message : error?.fieldMessage('amount_paise');
  const generalError = error && error.details.length === 0 ? error.message : undefined;

  return (
    <Dialog title="Record payment" onClose={onClose}>
      <form onSubmit={save} noValidate>
        <p className="dialog-body">
          This payment goes to the <strong>{MILESTONE_STAGE_LABEL[milestone.stage]}</strong> milestone, which has{' '}
          <strong>{formatRupees(milestone.balance_paise)}</strong> remaining.
        </p>
        <Field
          label="Amount (₹)"
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          error={amountError ?? serverAmountError}
          hint={`Up to ${formatRupees(milestone.balance_paise)}.`}
          inputMode="decimal"
          autoComplete="off"
          autoFocus
        />
        <Field
          label="Payment date"
          type="date"
          value={paymentDate}
          max={todayInIndia()}
          onChange={(event) => setPaymentDate(event.target.value)}
          error={error?.fieldMessage('payment_date')}
        />
        <Field
          label="Payment reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          error={error?.fieldMessage('payment_reference')}
          hint="The bank transaction or cheque number. Each reference can be used once."
          autoComplete="off"
        />
        {generalError && (
          <p className="form-error" role="alert">
            {generalError}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Record payment'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
