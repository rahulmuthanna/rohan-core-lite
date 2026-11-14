import type { ReactNode } from 'react';
import type { OfferMoney, UnitType } from '../api/types';
import { formatArea, formatPercent, formatRupees } from '../lib/format';

interface OfferDocumentProps {
  /** 'Cost sheet' or 'Quotation'. */
  kind: string;
  number: string;
  /** Label and value pairs shown under the number, such as the issue date. */
  facts: { label: string; value: ReactNode }[];
  customer: { name: string; mobile: string; email: string };
  unit: { project: string; code: string; type: UnitType; areaSqft: number };
  money: OfferMoney;
  /** A closing line, such as how long the quotation is valid. */
  footnote?: string;
}

/**
 * The printable page shared by cost sheets and quotations.
 * Reading order, top to bottom: what this is, who it is for, which unit, then the money,
 * ending on the one figure that matters most: the final offered price.
 */
export function OfferDocument({ kind, number, facts, customer, unit, money, footnote }: OfferDocumentProps) {
  return (
    <article className="document">
      <header className="document-header">
        <div>
          <p className="document-company">Rohan Corporation</p>
          <h2 className="document-kind">{kind}</h2>
        </div>
        <dl className="document-facts">
          <div>
            <dt>Number</dt>
            <dd>{number}</dd>
          </div>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="document-parties">
        <section>
          <h3>Customer</h3>
          <p className="document-strong">{customer.name}</p>
          <p>{customer.mobile}</p>
          <p>{customer.email}</p>
        </section>
        <section>
          <h3>Unit</h3>
          <p className="document-strong">
            {unit.project}, {unit.code}
          </p>
          <p>{unit.type}</p>
          <p>{formatArea(unit.areaSqft)}</p>
        </section>
      </div>

      <MoneyLines money={money} />

      <p className="document-note">
        All amounts are in Indian rupees. The price excludes GST, stamp duty, registration fees and other charges.
      </p>
      {footnote && <p className="document-note">{footnote}</p>}
    </article>
  );
}

/** The itemised price: listed price, less discount, equals final offered price. */
export function MoneyLines({ money }: { money: OfferMoney }) {
  return (
    <table className="money-lines">
      <tbody>
        <tr>
          <th scope="row">Listed price</th>
          <td>{formatRupees(money.listed_price_paise)}</td>
        </tr>
        <tr>
          <th scope="row">Discount ({formatPercent(money.discount_bps)})</th>
          <td>− {formatRupees(money.discount_amount_paise)}</td>
        </tr>
        <tr className="money-total">
          <th scope="row">Final offered price</th>
          <td>{formatRupees(money.final_price_paise)}</td>
        </tr>
      </tbody>
    </table>
  );
}
