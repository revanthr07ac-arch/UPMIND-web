import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, Mail, Lock, ArrowRight } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect
  React.useEffect(() => {
    if (user) {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error: signInErr } = await signIn(email, password);
    if (signInErr) {
      setError(signInErr.message || 'Invalid email or password.');
      setIsLoading(false);
    } else {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  };

  const fillDemoAccount = () => {
    setEmail('revanth@upmind.dev');
    setPassword('Upmind123!@#');
  };

  return (
    <div className="min-h-screen bg-[#0B0C0F] text-[#F5F5F7] flex flex-col justify-center items-center p-4 selection:bg-[#E5484D] selection:text-white">
      {/* Brand Header */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="w-12 h-12 rounded-[14px] bg-[#15161B] border border-[#292B34] flex items-center justify-center text-white shadow-xl shadow-black/50">
          <span className="font-black text-2xl text-white">
            U<span className="text-[#E5484D]">.</span>
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-[#F5F5F7]">UPMIND</h1>
        <p className="text-xs text-[#858995] font-medium tracking-wide uppercase">
          Learn • Create • Connect
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-[#15161B] border border-[#292B34] rounded-[20px] p-6 sm:p-8 shadow-elevated flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold text-[#F5F5F7]">Welcome back</h2>
          <p className="text-xs text-[#858995] mt-1">
            Sign in to continue sharing skills and learning from peers.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-[10px] bg-[#FF6269]/10 border border-[#FF6269]/30 text-xs text-[#FF6269]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            leftIcon={<Mail className="w-4 h-4" />}
          />

          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            leftIcon={<Lock className="w-4 h-4" />}
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            className="w-full mt-1"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Sign In
          </Button>
        </form>

        {/* Demo Account Quick-Fill */}
        <div className="pt-2 border-t border-[#292B34]/60">
          <button
            type="button"
            onClick={fillDemoAccount}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px] bg-[#1B1D24] hover:bg-[#282A32] text-xs font-semibold text-[#E5484D] border border-[#292B34] transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Use Demo Creator Account</span>
          </button>
        </div>

        {/* Sign Up Link */}
        <div className="text-center text-xs text-[#858995]">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-[#E5484D] font-semibold hover:underline">
            Sign up for free
          </Link>
        </div>
      </div>
    </div>
  );
};
