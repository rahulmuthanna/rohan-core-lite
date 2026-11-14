import { useId, useState } from 'react';
import { Link } from 'react-router';
import { listCustomers } from '../api/endpoints';
import type { Customer } from '../api/types';
import { CustomerFormDialog } from '../components/CustomerFormDialog';
import { EmptyState, LoadState } from '../components/LoadState';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { useDebounced, useLoad } from '../lib/useLoad';

/** Everyone we can sell to: search, add and edit. */
export function CustomersPage() {
  const searchId = useId();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Customer | undefined>(undefined);
  const debouncedSearch = useDebounced(search.trim(), 250);

  const customers = useLoad(() => listCustomers({ search: debouncedSearch, page }), [debouncedSearch, page]);

  function closeAndReload() {
    setAdding(false);
    setEditing(undefined);
    customers.reload();
  }

  return (
    <>
      <PageHeader
        title="Customers"
        actions={
          <button type="button" className="button button-primary" onClick={() => setAdding(true)}>
            Add customer
          </button>
        }
      />

      <div className="filters">
        <div className="field field-wide">
          <label htmlFor={searchId}>Search</label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Name, mobile or email"
            autoComplete="off"
          />
        </div>
      </div>

      <LoadState state={customers}>
        {(result) =>
          result.data.length === 0 ? (
            <EmptyState>
              {debouncedSearch === ''
                ? 'No customers yet. Add the first one to start a cost sheet.'
                : `No customer matches “${debouncedSearch}”.`}
            </EmptyState>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Mobile</th>
                      <th scope="col">Email</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((customer) => (
                      <tr key={customer.id}>
                        <th scope="row">{customer.full_name}</th>
                        <td>{customer.mobile}</td>
                        <td>{customer.email}</td>
                        <td className="row-actions">
                          <Link to={`/cost-sheets/new?customer_id=${customer.id}`}>Create cost sheet</Link>
                          <button type="button" className="link-button" onClick={() => setEditing(customer)}>
                            Edit
                          </button>
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

      {adding && <CustomerFormDialog onClose={() => setAdding(false)} onSaved={closeAndReload} />}
      {editing && (
        <CustomerFormDialog customer={editing} onClose={() => setEditing(undefined)} onSaved={closeAndReload} />
      )}
    </>
  );
}
