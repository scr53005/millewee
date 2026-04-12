'use client';

import { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';

function LoginForm() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Use ref value to handle browser autofill (onChange may not fire)
    const submittedPassword = passwordRef.current?.value || password;

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: submittedPassword }),
      });

      if (response.ok) {
        router.push(returnUrl);
      } else {
        setError('Mot de passe incorrect');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password" className="text-[#2a1f17]">
          Mot de passe
        </Label>
        <div className="relative">
          <Input
            id="password"
            ref={passwordRef}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Entrez le mot de passe"
            className="pr-10 bg-white border-[#ddd5c8] text-[#2a1f17]"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6e63] hover:text-[#2a1f17]"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-[#d4a24e] text-[#1a1310] hover:bg-[#c4922e] font-semibold"
      >
        {loading ? 'Connexion...' : 'Se connecter'}
      </Button>
    </form>
  );
}

export default function AdminLogin() {
  return (
    <div className="min-h-screen bg-[#faf6f0] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-[#ddd5c8] bg-white">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold text-[#2a1f17]">
            Administration
          </CardTitle>
          <p className="text-sm text-[#7a6e63]">Café-Brasserie Millewee</p>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
