import { useState } from 'react';
import { Link } from 'react-router';
import { listBookings } from '../api/endpoints';
import { EmptyState, LoadState } from '../components/LoadState';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { UnitStatusTag } from '../components/StatusTag';
import { formatRupees, formatTimestamp } from '../lib/format';
import { useLoad } from '../lib/useLoad';

/** Every booking, newest first, with what has been collected and what is still owed. */
export function BookingsPage() {
  const [page, setPage] = useState(1);
  const bookings = useLoad(() => listBookings({ page }), [page]);

  return (
    <>
      <PageHeader title="Bookings" />

      <LoadState state={bookings}>
        {(result) =>
          result.data.length === 0 ? (
            <EmptyState>No bookings yet. Open an accepted quotation and choose “Confirm booking”.</EmptyState>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Number</th>
                      <th scope="col">Booked</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Unit</th>
                      <th scope="col" className="num">
                        Final price
                      </th>
                      <th scope="col" className="num">
                        Collected
                      </th>
                      <th scope="col" className="num">
                        Outstanding
                      </th>
                      <th scope="col">Unit status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((booking) => (
                      <tr key={booking.id}>
                        <th scope="row">
                          <Link to={`/bookings/${booking.id}`}>{booking.booking_number}</Link>
                        </th>
                        <td>{formatTimestamp(booking.booked_at)}</td>
                        <td>{booking.customer_name}</td>
                        <td>{booking.unit_code}</td>
                        <td className="num">{formatRupees(booking.final_price_paise)}</td>
                        <td className="num">{formatRupees(booking.collected_paise)}</td>
                        <td className="num">{formatRupees(booking.outstanding_paise)}</td>
                        <td>
                          <UnitStatusTag status={booking.unit_status} />
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
