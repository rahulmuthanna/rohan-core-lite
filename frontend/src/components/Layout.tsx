import { NavLink, Outlet } from 'react-router';

// The menu follows the order of the sales workflow.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/inventory', label: 'Inventory', end: false },
  { to: '/customers', label: 'Customers', end: false },
  { to: '/cost-sheets', label: 'Cost sheets', end: false },
  { to: '/quotations', label: 'Quotations', end: false },
  { to: '/bookings', label: 'Bookings', end: false },
];

/** The frame around every screen: the menu on the left, the current page on the right. */
export function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <p className="brand">Rohan Core Lite</p>
        <nav aria-label="Main">
          <ul className="nav">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className="nav-link">
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
