import { Link } from 'react-router';
import { getDashboard } from '../api/endpoints';
import { Figure } from '../components/Figure';
import { LoadState } from '../components/LoadState';
import { PageHeader } from '../components/PageHeader';
import { formatRupees } from '../lib/format';
import { useLoad } from '../lib/useLoad';

/** The overview: how many units are left, and how much money is booked, collected and still owed. */
export function DashboardPage() {
  const dashboard = useLoad(getDashboard, []);

  return (
    <>
      <PageHeader title="Dashboard" />
      <LoadState state={dashboard}>
        {(data) => (
          <>
            <section className="section" aria-labelledby="units-heading">
              <h2 id="units-heading">Units</h2>
              <dl className="figures">
                <Figure label="Available" value={data.units.available} strong />
                <Figure label="Booked" value={data.units.booked} />
                <Figure label="Sold" value={data.units.sold} />
                <Figure label="Total" value={data.units.total} />
              </dl>
            </section>

            <section className="section" aria-labelledby="money-heading">
              <h2 id="money-heading">Bookings and collections</h2>
              <dl className="figures">
                <Figure label="Booking value" value={formatRupees(data.booking_value_paise)} />
                <Figure label="Collected" value={formatRupees(data.collected_paise)} />
                <Figure label="Outstanding" value={formatRupees(data.outstanding_paise)} strong />
              </dl>
              <p className="muted">
                {data.bookings_count === 0 ? (
                  'No bookings yet.'
                ) : (
                  <>
                    Across {data.bookings_count} {data.bookings_count === 1 ? 'booking' : 'bookings'}.{' '}
                    <Link to="/bookings">View bookings</Link>
                  </>
                )}
              </p>
            </section>

            <section className="section" aria-labelledby="projects-heading">
              <h2 id="projects-heading">Units by project</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Project</th>
                      <th scope="col" className="num">
                        Available
                      </th>
                      <th scope="col" className="num">
                        Booked
                      </th>
                      <th scope="col" className="num">
                        Sold
                      </th>
                      <th scope="col" className="num">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_project.map((project) => (
                      <tr key={project.project_id}>
                        <th scope="row">{project.project_name}</th>
                        <td className="num">{project.available}</td>
                        <td className="num">{project.booked}</td>
                        <td className="num">{project.sold}</td>
                        <td className="num">{project.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </LoadState>
    </>
  );
}
