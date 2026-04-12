'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { UtensilsCrossed, Wine, Tags, AlertTriangle, Calendar } from 'lucide-react';

const navItems = [
  { title: 'Catégories', href: '/admin/categories', icon: Tags },
  { title: 'Plats', href: '/admin/dishes', icon: UtensilsCrossed },
  { title: 'Boissons', href: '/admin/drinks', icon: Wine },
  { title: 'Allergènes', href: '/admin/allergens', icon: AlertTriangle },
  { title: 'Spéciaux', href: '/admin/weekly-specials', icon: Calendar },
];

export function AdminHeader() {
  const pathname = usePathname();

  return (
    <div className="bg-white border-b border-gray-200 px-3 py-3">
      <div className="flex items-center gap-2">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-700 h-8 w-8 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <nav className="flex items-center gap-2 overflow-visible">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-nowrap transition-colors ${
                    isActive
                      ? 'bg-[#fdf6e9] text-gray-900 font-semibold text-base ring-[1.5px] ring-[#d4a24e]'
                      : 'text-gray-900 hover:bg-gray-50 text-sm'
                  }`}
                >
                  <item.icon className={`shrink-0 ${isActive ? 'h-4.5 w-4.5' : 'h-3.5 w-3.5'}`} />
                  {item.title}
                </button>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
