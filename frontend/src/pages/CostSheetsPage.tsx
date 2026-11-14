import { useState } from 'react';
import { Link } from 'react-router';
import { listCostSheets } from '../api/endpoints';
import { EmptyState, LoadState } from '../components/LoadState';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { formatPercent, formatRupees, formatTimestamp } from '../lib/format';
import { useLoad } from '../lib/useLoad';

/** Every saved cost sheet, newest first. */
export function CostSheetsPage() {
  const [page, setPage] = useState(1);
  const costSheets = useLoad(() => listCostSheets({ page }), [page]);

  return (
    <>
      <PageHeader
        title="Cost sheets"
        actions={
          <Link to="/cost-sheets/new" className="button button-primary">
            New cost sheet
          </Link>
        }
      />

      <LoadState state={costSheets}>
        {(result) =>
          result.data.length === 0 ? (
            <EmptyState>No cost sheets yet. Create one for a unit and a customer to begin a sale.</EmptyState>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Number</th>
                      <th scope="col">Created</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Unit</th>
                      <th scope="col" className="num">
                        Listed price
                      </th>
                      <th scope="col" className="num">
                        Discount
                      </th>
                      <th scope="col" className="num">
                        Final price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((costSheet) => (
                      <tr key={costSheet.id}>
                        <th scope="row">
                          <Link to={`/cost-sheets/${costSheet.id}`}>{costSheet.cost_sheet_number}</Link>
                        </th>
                        <td>{formatTimestamp(costSheet.created_at)}</td>
                        <td>{costSheet.customer_name}</td>
                        <td>{costSheet.unit_code}</td>
                        <td className="num">{formatRupees(costSheet.listed_price_paise)}</td>
                        <td className="num">{formatPercent(costSheet.discount_bps)}</td>
                        <td className="num">{formatRupees(costSheet.final_price_paise)}</td>
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
