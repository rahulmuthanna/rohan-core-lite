import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { createQuotation, deleteCostSheet, getCostSheet, listQuotations } from '../api/endpoints';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadState } from '../components/LoadState';
import { OfferDocument } from '../components/OfferDocument';
import { PageHeader } from '../components/PageHeader';
import { QuotationStatusTag } from '../components/StatusTag';
import { formatDate, formatRupees, formatTimestamp, UNIT_STATUS_LABEL } from '../lib/format';
import { useLoad } from '../lib/useLoad';

/**
 * One saved cost sheet, laid out as the printable document.
 * A saved cost sheet never changes. The next step from here is "Create quotation".
 */
export function CostSheetPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState<'quotation' | 'delete' | undefined>(undefined);

  const costSheet = useLoad(() => getCostSheet(id), [id]);
  const quotations = useLoad(() => listQuotations({ cost_sheet_id: id, page_size: 100 }), [id]);

  return (
    <LoadState state={costSheet}>
      {(sheet) => {
        const unitAvailable = sheet.unit_status === 'AVAILABLE';
        const duplicateLink = `/cost-sheets/new?unit_id=${sheet.unit_id}&customer_id=${sheet.customer_id}&discount_bps=${sheet.discount_bps}`;

        return (
          <>
            <PageHeader
              title={sheet.cost_sheet_number}
              back={{ to: '/cost-sheets', label: 'cost sheets' }}
              actions={
                <>
                  <button type="button" className="button" onClick={() => window.print()}>
                    Print or save as PDF
                  </button>
                  {unitAvailable && (
                    <Link to={duplicateLink} className="button">
                      Duplicate and adjust
                    </Link>
                  )}
                  {sheet.quotation_count === 0 && (
                    <button type="button" className="button" onClick={() => setConfirming('delete')}>
                      Delete
                    </button>
                  )}
                  {unitAvailable && (
                    <button type="button" className="button button-primary" onClick={() => setConfirming('quotation')}>
                      Create quotation
                    </button>
                  )}
                </>
              }
            />

            {!unitAvailable && (
              <p className="notice screen-only">
                Unit {sheet.unit_code} is now {UNIT_STATUS_LABEL[sheet.unit_status].toLowerCase()}, so no new quotation
                can be created from this cost sheet.
              </p>
            )}
            {sheet.price_changed && (
              <p className="notice screen-only">
                The listed price of {sheet.unit_code} is now {formatRupees(sheet.current_listed_price_paise)}, which is{' '}
                {formatRupees(Math.abs(sheet.price_difference_paise))}{' '}
                {sheet.price_difference_paise > 0 ? 'higher' : 'lower'} than on this cost sheet. This cost sheet keeps
                the price it was saved with.
              </p>
            )}

            <OfferDocument
              kind="Cost sheet"
              number={sheet.cost_sheet_number}
              facts={[{ label: 'Date', value: formatTimestamp(sheet.created_at) }]}
              customer={{ name: sheet.customer_name, mobile: sheet.customer_mobile, email: sheet.customer_email }}
              unit={{
                project: sheet.project_name,
                code: sheet.unit_code,
                type: sheet.unit_type,
                areaSqft: sheet.area_sqft,
              }}
              money={sheet}
            />

            {quotations.data && quotations.data.data.length > 0 && (
              <section className="section screen-only" aria-labelledby="quotations-heading">
                <h2 id="quotations-heading">Quotations from this cost sheet</h2>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Number</th>
                        <th scope="col">Issued</th>
                        <th scope="col">Valid until</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotations.data.data.map((quotation) => (
                        <tr key={quotation.id}>
                          <th scope="row">
                            <Link to={`/quotations/${quotation.id}`}>{quotation.quotation_number}</Link>
                          </th>
                          <td>{formatDate(quotation.issue_date)}</td>
                          <td>{formatDate(quotation.valid_until)}</td>
                          <td>
                            <QuotationStatusTag status={quotation.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {confirming === 'quotation' && (
              <ConfirmDialog
                title="Create quotation"
                confirmLabel="Create quotation"
                onClose={() => setConfirming(undefined)}
                onConfirm={async () => {
                  const quotation = await createQuotation(sheet.id);
                  navigate(`/quotations/${quotation.id}`);
                }}
              >
                <p>
                  This creates a quotation for {sheet.customer_name} at {formatRupees(sheet.final_price_paise)}, valid
                  for 7 days from today.
                </p>
                {sheet.price_changed && (
                  <p>
                    <strong>
                      The unit price has changed to {formatRupees(sheet.current_listed_price_paise)} since this cost
                      sheet was saved.
                    </strong>{' '}
                    The quotation will still use the saved figures. To quote the new price, use “Duplicate and adjust”
                    instead.
                  </p>
                )}
              </ConfirmDialog>
            )}

            {confirming === 'delete' && (
              <ConfirmDialog
                title="Delete cost sheet"
                confirmLabel="Delete cost sheet"
                danger
                onClose={() => setConfirming(undefined)}
                onConfirm={async () => {
                  await deleteCostSheet(sheet.id);
                  navigate('/cost-sheets');
                }}
              >
                <p>Delete {sheet.cost_sheet_number}? This cannot be undone.</p>
              </ConfirmDialog>
            )}
          </>
        );
      }}
    </LoadState>
  );
}
