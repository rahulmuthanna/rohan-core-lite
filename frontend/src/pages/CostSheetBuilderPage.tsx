import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { type ApiError, toApiError } from '../api/client';
import {
  createCostSheet,
  getCustomer,
  getUnit,
  listProjects,
  listUnits,
  previewCostSheet,
} from '../api/endpoints';
import type { CostSheetPreview, Customer } from '../api/types';
import { CustomerPicker } from '../components/CustomerPicker';
import { Field, SelectField } from '../components/Field';
import { MoneyLines } from '../components/OfferDocument';
import { PageHeader } from '../components/PageHeader';
import { formatArea, formatRupees, parsePercentToBps } from '../lib/format';
import { useDebounced, useLoad } from '../lib/useLoad';

const DISCOUNT_HELP = 'Between 0 and 2, with at most two decimal places.';

/** Reads a whole-number id from the page address, such as ?unit_id=3. */
function idFromQuery(value: string | null): number | undefined {
  const id = Number(value);
  return value !== null && Number.isInteger(id) && id > 0 ? id : undefined;
}

/**
 * Build a cost sheet: choose a project, a unit and a customer, set the discount, then save.
 * The figures on the right come from the server each time something changes,
 * so what you see is exactly what will be saved.
 *
 * The page can open with choices already made, through the address:
 *   /cost-sheets/new?unit_id=3            from the Inventory page
 *   /cost-sheets/new?customer_id=5        from the Customers page
 *   ...&discount_bps=125                  from "Duplicate and adjust"
 */
export function CostSheetBuilderPage() {
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const startUnitId = idFromQuery(query.get('unit_id'));
  const startCustomerId = idFromQuery(query.get('customer_id'));
  const startDiscountBps = Number(query.get('discount_bps') ?? '0');

  const [projectId, setProjectId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [customer, setCustomer] = useState<Customer | undefined>(undefined);
  const [discountText, setDiscountText] = useState(
    Number.isInteger(startDiscountBps) && startDiscountBps >= 0 && startDiscountBps <= 200
      ? String(startDiscountBps / 100)
      : '0',
  );
  const [preview, setPreview] = useState<CostSheetPreview | undefined>(undefined);
  const [previewError, setPreviewError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | undefined>(undefined);
  const [startError, setStartError] = useState<string | undefined>(undefined);

  const projects = useLoad(listProjects, []);
  const units = useLoad(
    () =>
      projectId === ''
        ? Promise.resolve(undefined)
        : listUnits({ project_id: Number(projectId), status: 'AVAILABLE', page_size: 100 }),
    [projectId],
  );

  // Fill in the unit and customer named in the address, once, when the page opens.
  useEffect(() => {
    if (startUnitId !== undefined) {
      getUnit(startUnitId)
        .then((unit) => {
          if (unit.status !== 'AVAILABLE') {
            setStartError(`Unit ${unit.unit_code} is no longer available. Choose another unit.`);
            return;
          }
          setProjectId(String(unit.project_id));
          setUnitId(String(unit.id));
        })
        .catch((failure: unknown) => setStartError(toApiError(failure).message));
    }
    if (startCustomerId !== undefined) {
      getCustomer(startCustomerId)
        .then(setCustomer)
        .catch((failure: unknown) => setStartError(toApiError(failure).message));
    }
  }, [startUnitId, startCustomerId]);

  const discountBps = parsePercentToBps(discountText);
  const discountIsValid = discountBps !== null && discountBps <= 200;
  const debouncedDiscountBps = useDebounced(discountIsValid ? discountBps : undefined, 250);

  // Ask the server for the figures whenever the unit or the discount changes.
  useEffect(() => {
    if (unitId === '' || debouncedDiscountBps === undefined) {
      setPreview(undefined);
      setPreviewError(undefined);
      return;
    }
    let cancelled = false;
    previewCostSheet(Number(unitId), debouncedDiscountBps)
      .then((result) => {
        if (!cancelled) {
          setPreview(result);
          setPreviewError(undefined);
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setPreview(undefined);
          setPreviewError(toApiError(failure).message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [unitId, debouncedDiscountBps]);

  const selectedUnit = units.data?.data.find((unit) => String(unit.id) === unitId);
  const canSave = unitId !== '' && customer !== undefined && discountIsValid && preview !== undefined && !saving;

  async function save() {
    if (!customer || discountBps === null) {
      return;
    }
    setSaving(true);
    setSaveError(undefined);
    try {
      const saved = await createCostSheet({
        unit_id: Number(unitId),
        customer_id: customer.id,
        discount_bps: discountBps,
      });
      navigate(`/cost-sheets/${saved.id}`);
    } catch (failure) {
      setSaveError(toApiError(failure));
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="New cost sheet" back={{ to: '/cost-sheets', label: 'cost sheets' }} />

      {startError && (
        <p className="notice notice-error" role="alert">
          {startError}
        </p>
      )}

      <div className="builder">
        <section className="builder-form" aria-label="Cost sheet details">
          <SelectField
            label="Project"
            value={projectId}
            onChange={(value) => {
              setProjectId(value);
              setUnitId('');
            }}
            emptyLabel="Choose a project"
            options={(projects.data ?? []).map((project) => ({ value: String(project.id), label: project.name }))}
          />
          <SelectField
            label="Unit"
            value={unitId}
            onChange={setUnitId}
            emptyLabel={projectId === '' ? 'Choose a project first' : 'Choose a unit'}
            disabled={projectId === ''}
            options={(units.data?.data ?? []).map((unit) => ({
              value: String(unit.id),
              label: `${unit.unit_code}, ${unit.unit_type}, ${formatArea(unit.area_sqft)}, ${formatRupees(unit.listed_price_paise)}`,
            }))}
          />
          {projectId !== '' && units.data && units.data.data.length === 0 && (
            <p className="field-hint">No units are available in this project.</p>
          )}

          <CustomerPicker selected={customer} onSelect={setCustomer} />

          <Field
            label="Discount (%)"
            value={discountText}
            onChange={(event) => setDiscountText(event.target.value)}
            error={discountIsValid ? saveError?.fieldMessage('discount_bps') : `Discount must be ${DISCOUNT_HELP.toLowerCase()}`}
            hint={DISCOUNT_HELP}
            inputMode="decimal"
            autoComplete="off"
          />
        </section>

        <section className="builder-preview" aria-label="Cost sheet preview" aria-live="polite">
          <h2>Cost sheet</h2>
          {preview ? (
            <>
              <p className="muted">
                {selectedUnit ? `${selectedUnit.project_name}, ${selectedUnit.unit_code}` : preview.unit_code}
                {customer ? ` for ${customer.full_name}` : ''}
              </p>
              <MoneyLines money={preview} />
            </>
          ) : (
            <p className="muted">{previewError ?? 'Choose a unit to see the price, discount and final offered price.'}</p>
          )}

          {saveError && saveError.details.length === 0 && (
            <p className="form-error" role="alert">
              {saveError.message}
            </p>
          )}
          <button type="button" className="button button-primary button-block" onClick={save} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save cost sheet'}
          </button>
          {!canSave && !saving && (
            <p className="field-hint">
              {unitId === '' ? 'Choose a unit' : customer === undefined ? 'Choose a customer' : 'Fix the discount'} to
              save.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
