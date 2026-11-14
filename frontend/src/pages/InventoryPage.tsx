import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { type ApiError, toApiError } from '../api/client';
import { changeUnitPrice, listProjects, listUnits } from '../api/endpoints';
import type { Unit, UnitStatus, UnitType } from '../api/types';
import { Dialog } from '../components/Dialog';
import { Field, SelectField } from '../components/Field';
import { EmptyState, LoadState } from '../components/LoadState';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { UnitStatusTag } from '../components/StatusTag';
import { formatArea, formatRupees, paiseToInputText, parseRupeesToPaise, UNIT_STATUS_LABEL } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const UNIT_TYPES: UnitType[] = ['1 BHK', '2 BHK', '3 BHK'];
const UNIT_STATUSES: UnitStatus[] = ['AVAILABLE', 'BOOKED', 'SOLD'];

/** Every unit, with filters for project, type and status. The starting point of a sale. */
export function InventoryPage() {
  const [projectId, setProjectId] = useState('');
  const [unitType, setUnitType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [repricing, setRepricing] = useState<Unit | undefined>(undefined);

  const projects = useLoad(listProjects, []);
  const units = useLoad(
    () =>
      listUnits({
        project_id: projectId === '' ? undefined : Number(projectId),
        unit_type: unitType === '' ? undefined : (unitType as UnitType),
        status: status === '' ? undefined : (status as UnitStatus),
        page,
      }),
    [projectId, unitType, status, page],
  );

  // Changing a filter always goes back to the first page.
  function changeFilter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <>
      <PageHeader title="Inventory" />

      <div className="filters">
        <SelectField
          label="Project"
          value={projectId}
          onChange={changeFilter(setProjectId)}
          emptyLabel="All projects"
          options={(projects.data ?? []).map((project) => ({ value: String(project.id), label: project.name }))}
        />
        <SelectField
          label="Type"
          value={unitType}
          onChange={changeFilter(setUnitType)}
          emptyLabel="All types"
          options={UNIT_TYPES.map((type) => ({ value: type, label: type }))}
        />
        <SelectField
          label="Status"
          value={status}
          onChange={changeFilter(setStatus)}
          emptyLabel="All statuses"
          options={UNIT_STATUSES.map((value) => ({ value, label: UNIT_STATUS_LABEL[value] }))}
        />
      </div>

      <LoadState state={units}>
        {(result) =>
          result.data.length === 0 ? (
            <EmptyState>No units match these filters.</EmptyState>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Unit</th>
                      <th scope="col">Project</th>
                      <th scope="col">Type</th>
                      <th scope="col" className="num">
                        Area
                      </th>
                      <th scope="col" className="num">
                        Listed price
                      </th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((unit) => (
                      <tr key={unit.id}>
                        <th scope="row">{unit.unit_code}</th>
                        <td>{unit.project_name}</td>
                        <td>{unit.unit_type}</td>
                        <td className="num">{formatArea(unit.area_sqft)}</td>
                        <td className="num">{formatRupees(unit.listed_price_paise)}</td>
                        <td>
                          <UnitStatusTag status={unit.status} />
                        </td>
                        <td className="row-actions">
                          {unit.status === 'AVAILABLE' && (
                            <>
                              <Link to={`/cost-sheets/new?unit_id=${unit.id}`}>Create cost sheet</Link>
                              <button type="button" className="link-button" onClick={() => setRepricing(unit)}>
                                Change price
                              </button>
                            </>
                          )}
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

      {repricing && (
        <ChangePriceDialog
          unit={repricing}
          onClose={() => setRepricing(undefined)}
          onSaved={() => {
            setRepricing(undefined);
            units.reload();
          }}
        />
      )}
    </>
  );
}

function ChangePriceDialog({ unit, onClose, onSaved }: { unit: Unit; onClose: () => void; onSaved: () => void }) {
  const [priceText, setPriceText] = useState(paiseToInputText(unit.listed_price_paise));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function save(event: FormEvent) {
    event.preventDefault();
    const pricePaise = parseRupeesToPaise(priceText);
    if (pricePaise === null) {
      setMessage('Enter the price in rupees, for example 6800000.');
      return;
    }
    setBusy(true);
    setMessage(undefined);
    try {
      await changeUnitPrice(unit.id, pricePaise);
      onSaved();
    } catch (failure) {
      const error: ApiError = toApiError(failure);
      setMessage(error.fieldMessage('listed_price_paise') ?? error.message);
      setBusy(false);
    }
  }

  return (
    <Dialog title={`Change price of ${unit.unit_code}`} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <p className="dialog-body">
          The current listed price is {formatRupees(unit.listed_price_paise)}. Cost sheets and quotations that were
          already saved keep the price they were created with.
        </p>
        <Field
          label="New listed price (₹)"
          value={priceText}
          onChange={(event) => setPriceText(event.target.value)}
          error={message}
          inputMode="decimal"
          autoComplete="off"
          autoFocus
        />
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save price'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
