import { type FormEvent, useState } from 'react';
import { type ApiError, toApiError } from '../api/client';
import { createCustomer, updateCustomer } from '../api/endpoints';
import type { Customer } from '../api/types';
import { Dialog } from './Dialog';
import { Field } from './Field';

interface CustomerFormDialogProps {
  /** The customer being edited. Leave out to add a new customer. */
  customer?: Customer | undefined;
  onSaved: (customer: Customer) => void;
  onClose: () => void;
}

/**
 * The one form for adding and editing a customer.
 * It is used on the Customers page and inside the cost sheet builder.
 * All checking is done by the server; its messages appear under the matching box.
 */
export function CustomerFormDialog({ customer, onSaved, onClose }: CustomerFormDialogProps) {
  const [fullName, setFullName] = useState(customer?.full_name ?? '');
  const [mobile, setMobile] = useState(customer?.mobile ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | undefined>(undefined);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const input = { full_name: fullName, mobile, email };
      const saved = customer ? await updateCustomer(customer.id, input) : await createCustomer(input);
      onSaved(saved);
    } catch (failure) {
      setError(toApiError(failure));
      setBusy(false);
    }
  }

  // Show the general message only when the server did not point at a specific box.
  const generalError = error && error.details.length === 0 ? error.message : undefined;

  return (
    <Dialog title={customer ? 'Edit customer' : 'Add customer'} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <Field
          label="Full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={error?.fieldMessage('full_name')}
          autoComplete="off"
          autoFocus
        />
        <Field
          label="Mobile number"
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          error={error?.fieldMessage('mobile')}
          hint="10 digits, without country code."
          inputMode="numeric"
          autoComplete="off"
        />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error?.fieldMessage('email')}
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
            {busy ? 'Saving…' : customer ? 'Save changes' : 'Add customer'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
