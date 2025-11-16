import { Navigate, useParams } from 'react-router-dom';
import { routes } from '../routes';

export const pageConfig = {
  id: 'user-profile-legacy',
  label: 'Legacy User Profile',
  path: '/user/:userId?',
  showInNav: false,
  protected: true
};

function UserProfileRedirect() {
  const { userId } = useParams();
  const destination = userId ? routes.profile.byId(userId) : routes.profile.me;
  return <Navigate to={destination} replace />;
}

export default UserProfileRedirect;
