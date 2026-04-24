import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-[#f7faf9] lg:grid-cols-[1fr_1.1fr]">
      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <p className="text-sm font-semibold uppercase text-teal-700">Hospital Pharmacy</p>
          <h1 className="mt-2 text-3xl font-bold text-stone-950">
            {isLogin ? 'Sign in to manage inventory' : 'Create your pharmacy account'}
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Track medicines, suppliers, prescriptions, batches, and customer records from one workspace.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 rounded-md border border-stone-200 bg-white p-5">
            <Alert type="error" message={error} />

            {!isLogin && (
              <label className="mb-4 block text-sm font-medium text-stone-700">
                Name
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-teal-600"
                />
              </label>
            )}

            <label className="mb-4 block text-sm font-medium text-stone-700">
              Email
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-teal-600"
              />
            </label>

            <label className="mb-5 block text-sm font-medium text-stone-700">
              Password
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength="6"
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-teal-600"
              />
            </label>

            <button
              disabled={loading}
              className="w-full rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {loading ? 'Please wait...' : isLogin ? 'Login' : 'Register'}
            </button>

            <p className="mt-4 text-center text-sm text-stone-600">
              {isLogin ? 'New here?' : 'Already registered?'}{' '}
              <Link className="font-semibold text-teal-700" to={isLogin ? '/register' : '/login'}>
                {isLogin ? 'Create account' : 'Login'}
              </Link>
            </p>
          </form>
        </div>
      </section>

      <section className="hidden min-h-screen items-center justify-center bg-[#dbece7] p-8 lg:flex">
        <img
          src="https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1100&q=80"
          alt="Hospital pharmacy shelves"
          className="h-[82vh] w-full rounded-md object-cover"
        />
      </section>
    </main>
  );
}

export default AuthPage;

