import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, AtSign, ArrowRight } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';

export const SignUpPage: React.FC = () => {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect
  React.useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: signUpErr } = await signUp(email, password, fullName, username);
    if (signUpErr) {
      setError(signUpErr.message || 'Could not register account. Please try again.');
      setIsLoading(false);
    } else {
      navigate('/', { replace: true });
    }
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

      {/* Sign Up Card */}
      <div className="w-full max-w-sm bg-[#15161B] border border-[#292B34] rounded-[20px] p-6 sm:p-8 shadow-elevated flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold text-[#F5F5F7]">Create an account</h2>
          <p className="text-xs text-[#858995] mt-1">
            Join the peer learning network. Showcase your work and access free materials.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-[10px] bg-[#FF6269]/10 border border-[#FF6269]/30 text-xs text-[#FF6269]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <Input
            label="Full Name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Rivers"
            leftIcon={<User className="w-4 h-4" />}
          />

          <Input
            label="Username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="alex_rivers"
            leftIcon={<AtSign className="w-4 h-4" />}
          />

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
            placeholder="At least 6 characters"
            leftIcon={<Lock className="w-4 h-4" />}
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            className="w-full mt-2"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Create Account
          </Button>
        </form>

        <div className="text-center text-xs text-[#858995]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#E5484D] font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
