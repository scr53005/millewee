/**
 * BottomBanner Component
 *
 * A fixed footer banner that provides contact information and legal links.
 * Expands on tap to show more details.
 * Adapted from croque-bedaine with trilingual support (FR/EN/LB).
 */

'use client';

import React, { useState } from 'react';

interface BottomBannerProps {
  language?: 'fr' | 'en' | 'lb';
}

export default function BottomBanner({ language = 'fr' }: BottomBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const translations = {
    fr: {
      contact: 'Pour toute question ou signalement, veuillez nous ecrire a',
      email: 'contact@innopay.lu',
      privacy: 'Politique de confidentialite',
      terms: 'Conditions generales',
      tapToExpand: 'Appuyez pour plus d\'informations',
      tapToCollapse: 'Appuyez pour reduire',
    },
    en: {
      contact: 'For any questions or reports, please write to us at',
      email: 'contact@innopay.lu',
      privacy: 'Privacy Policy',
      terms: 'Terms and Conditions',
      tapToExpand: 'Tap for more information',
      tapToCollapse: 'Tap to collapse',
    },
    lb: {
      contact: 'Fir all Froen oder Meldungen, schreift eis w.e.g. op',
      email: 'contact@innopay.lu',
      privacy: 'Dateschutzrichtlinn',
      terms: 'Allgemeng Konditiounen',
      tapToExpand: 'Dr\u00e9ckt fir m\u00e9i Informatiounen',
      tapToCollapse: 'Dr\u00e9ckt fir z\u00e9i zesummen ze klappen',
    },
  };

  const t = translations[language] || translations.fr;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-gradient-to-t from-gray-800 to-gray-700 text-white transition-all duration-300 ease-in-out shadow-2xl"
      style={{
        height: isExpanded ? '200px' : '30px',
      }}
    >
      <div
        className="flex items-center justify-center h-[30px] cursor-pointer hover:bg-gray-600 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isExpanded ? t.tapToCollapse : t.tapToExpand}
          </span>
          <span className="text-lg">
            {isExpanded ? 'v' : '^'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 py-4 overflow-y-auto" style={{ height: 'calc(100% - 30px)' }}>
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="text-center">
              <p className="text-sm mb-2">{t.contact}</p>
              <a
                href={`mailto:${t.email}`}
                className="text-blue-300 hover:text-blue-200 underline font-medium"
              >
                {t.email}
              </a>
            </div>

            <div className="flex justify-center gap-6 pt-2 border-t border-gray-600">
              <a
                href="https://www.innopay.lu/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-300 hover:text-white underline transition-colors"
              >
                {t.privacy}
              </a>
              <a
                href="https://www.innopay.lu/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-300 hover:text-white underline transition-colors"
              >
                {t.terms}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
