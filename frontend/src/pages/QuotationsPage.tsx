import { useState } from 'react';
import { Link } from 'react-router';
import { listQuotations } from '../api/endpoints';
import type { QuotationStatus } from '../api/types';
import { SelectField } from '../components/Field';
import { EmptyState, LoadState } from '../components/LoadState';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { QuotationStatusTag } from '../components/StatusTag';
import { formatDate, formatRupees, QUOTATION_STATUS_LABEL } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const STATUSES: QuotationStatus[] = ['DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED'];

/** Every quotation, newest first, with a filter for status. */
export function QuotationsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const quotations = useLoad(
    () => listQuotations({ status: status === '' ? undefined : (status as QuotationStatus), page }),
    [status, page],
  );

  return (
    <>
      <PageHeader title="Quotations" />

      <div className="filters">
        <SelectField
          label="Status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          emptyLabel="All statuses"
          options={STATUSES.map((value) => ({ value, label: QUOTATION_STATUS_LABEL[value] }))}
        />
      </div>

      <LoadState state={quotations}>
        {(result) =>
          result.data.length === 0 ? (
            <EmptyState>
              {status === ''
                ? 'No quotations yet. Open a cost sheet and choose “Create quotation”.'
                : 'No quotations have this status.'}
            </EmptyState>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Number</th>
                      <th scope="col">Issued</th>
                      <th scope="col">Valid until</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Unit</th>
                      <th scope="col" className="num">
                        Final price
                      </th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((quotation) => (
                      <tr key={quotation.id}>
                        <th scope="row">
                          <Link to={`/quotations/${quotation.id}`}>{quotation.quotation_number}</Link>
                        </th>
                        <td>{formatDate(quotation.issue_date)}</td>
                        <td>{formatDate(quotation.valid_until)}</td>
                        <td>{quotation.customer_name}</td>
                        <td>{quotation.unit_code}</td>
                        <td className="num">{formatRupees(quotation.final_price_paise)}</td>
                        <td>
                          <QuotationStatusTag status={quotation.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination pagination={result.pagination} onPageChange={setPage} />
            </>
          )
        }
      </LoadState>
    </>
  );
}
