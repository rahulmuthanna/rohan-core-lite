import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <p>
        This address does not match any page. <Link to="/">Go to the dashboard</Link>.
      </p>
    </>
  );
}
