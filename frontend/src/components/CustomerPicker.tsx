import { useId, useState } from 'react';
import { listCustomers } from '../api/endpoints';
import type { Customer } from '../api/types';
import { useDebounced, useLoad } from '../lib/useLoad';
import { CustomerFormDialog } from './CustomerFormDialog';

interface CustomerPickerProps {
  selected: Customer | undefined;
  onSelect: (customer: Customer | undefined) => void;
}

/**
 * Choose a customer for a cost sheet: search for an existing one, or add a new one on the spot.
 * Once chosen, the customer is shown with a "Change" button.
 */
export function CustomerPicker({ selected, onSelect }: CustomerPickerProps) {
  const inputId = useId();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const debouncedSearch = useDebounced(search.trim(), 250);

  const results = useLoad(
    () => (debouncedSearch === '' ? Promise.resolve(undefined) : listCustomers({ search: debouncedSearch, page_size: 6 })),
    [debouncedSearch],
  );

  if (selected) {
    return (
      <div className="field">
        <span className="field-label">Customer</span>
        <div className="picked">
          <div>
            <p className="picked-name">{selected.full_name}</p>
            <p className="muted">
              {selected.mobile}, {selected.email}
            </p>
          </div>
          <button type="button" className="button" onClick={() => onSelect(undefined)}>
            Change
          </button>
        </div>
      </div>
    );
  }

  const matches = debouncedSearch === '' ? undefined : results.data?.data;

  return (
    <div className="field">
      <label htmlFor={inputId}>Customer</label>
      <input
        id={inputId}
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by name, mobile or email"
        autoComplete="off"
      />
      {results.error && <p className="field-error">{results.error.message}</p>}
      {matches && matches.length > 0 && (
        <ul className="picker-results">
          {matches.map((customer) => (
            <li key={customer.id}>
              <button type="button" className="picker-option" onClick={() => onSelect(customer)}>
                <span>{customer.full_name}</span>
                <span className="muted">{customer.mobile}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {matches && matches.length === 0 && <p className="field-hint">No customer matches “{debouncedSearch}”.</p>}
      <button type="button" className="link-button" onClick={() => setAdding(true)}>
        Add a new customer
      </button>
      {adding && (
        <CustomerFormDialog
          onClose={() => setAdding(false)}
          onSaved={(customer) => {
            setAdding(false);
            onSelect(customer);
          }}
        />
      )}
    </div>
  );
}
