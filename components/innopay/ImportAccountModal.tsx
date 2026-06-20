/**
 * ImportAccountModal Component
 *
 * Multi-step modal for importing an existing Innopay account:
 * 1. Email input - request verification code
 * 2. Code verification - enter 6-digit code from email
 * 3. Account selection - if multiple accounts found
 *
 * Adapted from croque-bedaine with trilingual support (FR/EN/LB).
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { getInnopayUrl } from '@/lib/innopay/utils';
import { saveKeys } from '@/lib/innopay/keystore';

interface AccountInfo {
  accountName: string;
  euroBalance: number;
  creationDate: string;
}

interface ImportAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (accountName: string) => void;
  language?: 'fr' | 'en' | 'lb';
}

type ImportStep = 'email' | 'code' | 'select';

const MAX_ATTEMPTS = 5;
const ATTEMPT_STORAGE_KEY = 'innopay_import_attempts';

export default function ImportAccountModal({
  visible,
  onClose,
  onSuccess,
  language = 'fr',
}: ImportAccountModalProps) {
  const [step, setStep] = useState<ImportStep>('email');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [multipleAccounts, setMultipleAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(() => {
    if (typeof window === 'undefined') return MAX_ATTEMPTS;
    const saved = localStorage.getItem(ATTEMPT_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : MAX_ATTEMPTS;
  });
  const [disabled, setDisabled] = useState(false);

  const translations = {
    fr: {
      title: 'Importer un compte',
      emailPrompt: 'Entrez l\'adresse email que vous avez utilise pour creer le compte',
      emailPlaceholder: 'votre@email.com',
      attemptsLeft: 'tentative(s) restante(s)',
      retrieve: 'Recuperer',
      searching: 'Recherche...',
      invalidEmail: 'Format d\'email invalide',
      notFound: 'Rien dans la base de donnees, desole!',
      wrongEmail: 'Vous avez peut-etre utilise une adresse mail differente',
      codeSent: 'Un code de verification a ete envoye a',
      codePlaceholder: 'Code a 6 chiffres',
      verify: 'Verifier',
      verifying: 'Verification...',
      enterCode: 'Entrez un code a 6 chiffres',
      back: 'Retour',
      selectAccount: 'Plusieurs comptes trouves. Selectionnez celui a importer:',
      balance: 'Solde',
      created: 'Cree',
      networkError: 'Erreur de connexion au serveur',
    },
    en: {
      title: 'Import account',
      emailPrompt: 'Enter the email address you used to create the account',
      emailPlaceholder: 'your@email.com',
      attemptsLeft: 'attempt(s) left',
      retrieve: 'Retrieve',
      searching: 'Searching...',
      invalidEmail: 'Invalid email format',
      notFound: 'Nothing in the database, sorry!',
      wrongEmail: 'You may have used a different email address',
      codeSent: 'A verification code has been sent to',
      codePlaceholder: '6-digit code',
      verify: 'Verify',
      verifying: 'Verifying...',
      enterCode: 'Enter a 6-digit code',
      back: 'Back',
      selectAccount: 'Multiple accounts found. Select one to import:',
      balance: 'Balance',
      created: 'Created',
      networkError: 'Server connection error',
    },
    lb: {
      title: 'Kont import\u00e9ieren',
      emailPrompt: 'Gitt d\'E-Mail-Adress an, d\u00e9i Dir benotzt hutt fir de Kont z\'erstellen',
      emailPlaceholder: '\u00e4r@email.com',
      attemptsLeft: 'Versuch(\u00e9ng) iwwreg',
      retrieve: 'Ofruffen',
      searching: 'Sich l\u00e4ift...',
      invalidEmail: 'Ong\u00ebltege E-Mail-Format',
      notFound: 'N\u00e4ischt an der Datebank, sorry!',
      wrongEmail: 'Dir hutt vl\u00e4icht eng aner E-Mail-Adress benotzt',
      codeSent: 'E Verifikatiounscode gouf geschéckt un',
      codePlaceholder: '6-st\u00e4llege Code',
      verify: 'Iwwerpr\u00e9iwen',
      verifying: 'Iwwerpr\u00e9iwung...',
      enterCode: 'Gitt e 6-st\u00e4llege Code an',
      back: 'Zer\u00e9ck',
      selectAccount: 'Verschidde Konte fonnt. Wielt dee fir z\'import\u00e9ieren:',
      balance: 'Solde',
      created: 'Erstellt',
      networkError: 'Server Verbindungsfehler',
    },
  };

  const t = translations[language] || translations.fr;

  useEffect(() => {
    if (visible) {
      setStep('email');
      setEmail('');
      setVerificationCode('');
      setMultipleAccounts([]);
      setError('');
      setLoading(false);
    }
  }, [visible]);

  const showError = useCallback((message: string, duration = 3000) => {
    setError(message);
    setTimeout(() => setError(''), duration);
  }, []);

  const handleRequestCode = useCallback(async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const sanitizedEmail = email.trim().toLowerCase();

    if (!emailRegex.test(sanitizedEmail)) {
      showError(t.invalidEmail);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const innopayUrl = getInnopayUrl();
      console.log('[IMPORT] Requesting code for:', sanitizedEmail);

      const response = await fetch(`${innopayUrl}/api/verify/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sanitizedEmail, language })
      });

      const data = await response.json();
      console.log('[IMPORT] Request response:', data);

      if (data.found === true) {
        setStep('code');
        setLoading(false);
      } else if (data.found === false) {
        const newAttempts = attempts - 1;
        setAttempts(newAttempts);
        localStorage.setItem(ATTEMPT_STORAGE_KEY, newAttempts.toString());

        if (newAttempts <= 0) {
          showError(t.notFound);
          setDisabled(true);
          setTimeout(() => {
            setLoading(false);
            onClose();
          }, 3000);
        } else {
          showError(`${t.wrongEmail} (${newAttempts} ${t.attemptsLeft})`);
          setLoading(false);
        }
      } else if (data.error) {
        showError(data.error);
        setLoading(false);
      }
    } catch (error) {
      console.error('[IMPORT] Network error:', error);
      showError(t.networkError);
      setLoading(false);
    }
  }, [email, attempts, language, t, showError, onClose]);

  const handleVerifyCode = useCallback(async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showError(t.enterCode);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const innopayUrl = getInnopayUrl();
      console.log('[IMPORT] Checking code:', verificationCode);

      const response = await fetch(`${innopayUrl}/api/verify/check-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: verificationCode
        })
      });

      const data = await response.json();
      console.log('[IMPORT] Check response:', data);

      if (data.success === true) {
        if (data.single === true) {
          console.log('[IMPORT] Single account found:', data.accountName);
          saveCredentials(data);
          onSuccess?.(data.accountName);
          window.location.reload();
        } else {
          console.log('[IMPORT] Multiple accounts found:', data.accounts);
          setMultipleAccounts(data.accounts);
          setStep('select');
          setLoading(false);
        }
      } else if (data.error) {
        showError(data.error);
        setLoading(false);
      }
    } catch (error) {
      console.error('[IMPORT] Network error:', error);
      showError(t.networkError);
      setLoading(false);
    }
  }, [verificationCode, email, t, showError, onSuccess]);

  const handleSelectAccount = useCallback(async (accountName: string) => {
    setLoading(true);
    setError('');

    try {
      const innopayUrl = getInnopayUrl();
      console.log('[IMPORT] Selecting account:', accountName);

      const response = await fetch(`${innopayUrl}/api/verify/get-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName,
          email: email.trim().toLowerCase()
        })
      });

      const data = await response.json();
      console.log('[IMPORT] Credentials response:', data);

      if (data.accountName) {
        saveCredentials(data);
        onSuccess?.(data.accountName);
        window.location.reload();
      } else if (data.error) {
        showError(data.error);
        setLoading(false);
      }
    } catch (error) {
      console.error('[IMPORT] Network error:', error);
      showError(t.networkError);
      setLoading(false);
    }
  }, [email, t, showError, onSuccess]);

  const saveCredentials = (data: {
    accountName: string;
    masterPassword?: string;
    keys?: { active: string; posting: string; memo: string };
  }) => {
    // Flow 8 re-import persists ONLY active + memo (SPOKE-KEY-SECURITY.md §4) —
    // never the master password or posting key.
    saveKeys({
      accountName: data.accountName,
      activeKey: data.keys?.active,
      memoKey: data.keys?.memo,
    });
  };

  if (!visible) return null;

  const localeForDate = language === 'fr' ? 'fr-FR' : language === 'lb' ? 'lb-LU' : 'en-US';

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl font-bold"
        >
          x
        </button>

        <h3 className="text-xl font-bold mb-4 text-gray-800 text-center">{t.title}</h3>

        {error && step === 'email' && disabled ? (
          <div className="text-center py-8">
            <p className="text-red-600 font-semibold text-lg">{error}</p>
          </div>
        ) : (
          <>
            {step === 'email' && (
              <>
                <p className="text-sm text-gray-600 mb-4 text-center">
                  {t.emailPrompt}
                </p>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500 text-gray-800"
                  disabled={loading}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !loading) {
                      handleRequestCode();
                    }
                  }}
                />

                <p className="text-xs text-gray-500 mb-4 text-center">
                  {attempts} {t.attemptsLeft}
                </p>

                {error && (
                  <p className="text-xs text-red-600 mb-4 text-center">{error}</p>
                )}

                <button
                  onClick={handleRequestCode}
                  disabled={loading || !email || disabled}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? t.searching : t.retrieve}
                </button>
              </>
            )}

            {step === 'code' && (
              <>
                <p className="text-sm text-gray-600 mb-4 text-center">
                  {t.codeSent} <strong>{email}</strong>
                </p>

                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t.codePlaceholder}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500 text-gray-800 text-center text-2xl font-mono tracking-widest"
                  disabled={loading}
                  maxLength={6}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !loading && verificationCode.length === 6) {
                      handleVerifyCode();
                    }
                  }}
                />

                {error && (
                  <p className="text-xs text-red-600 mb-4 text-center">{error}</p>
                )}

                <button
                  onClick={handleVerifyCode}
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed mb-2"
                >
                  {loading ? t.verifying : t.verify}
                </button>

                <button
                  onClick={() => {
                    setStep('email');
                    setVerificationCode('');
                    setError('');
                  }}
                  className="w-full text-blue-600 hover:text-blue-800 text-sm"
                >
                  &larr; {t.back}
                </button>
              </>
            )}

            {step === 'select' && (
              <>
                <p className="text-sm text-gray-600 mb-4 text-center">
                  {t.selectAccount}
                </p>

                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  {multipleAccounts.map((account) => (
                    <button
                      key={account.accountName}
                      onClick={() => handleSelectAccount(account.accountName)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                      disabled={loading}
                    >
                      <div className="font-semibold text-gray-800">{account.accountName}</div>
                      <div className="text-sm text-gray-600">
                        {t.balance}: {account.euroBalance.toFixed(2)} EUR -
                        {t.created}: {new Date(account.creationDate).toLocaleDateString(localeForDate)}
                      </div>
                    </button>
                  ))}
                </div>

                {error && (
                  <p className="text-xs text-red-600 mb-4 text-center">{error}</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
