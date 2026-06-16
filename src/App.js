import NyumbaFind from './nyumbafind-final';
import AdminApp   from './nyumbafind-admin';

// If URL contains /admin → show admin panel
// Otherwise → show main site
function App() {
  const isAdmin = window.location.pathname.startsWith('/admin');
  return isAdmin ? <AdminApp /> : <NyumbaFind />;
}

export default App;
