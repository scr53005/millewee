'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, UtensilsCrossed, Wine, Tags, AlertTriangle, Calendar, Clock } from 'lucide-react';

const navItems = [
  { title: 'Accueil', href: '/admin', icon: Home, exact: true },
  { title: 'Commandes', href: '/admin/current_orders', icon: ClipboardList },
  { title: 'Catégories', href: '/admin/categories', icon: Tags },
  { title: 'Plats', href: '/admin/dishes', icon: UtensilsCrossed },
  { title: 'Boissons', href: '/admin/drinks', icon: Wine },
  { title: 'Allergènes', href: '/admin/allergens', icon: AlertTriangle },
  { title: 'Spéciaux', href: '/admin/weekly-specials', icon: Calendar },
  { title: 'Horaires', href: '/admin/opening-hours', icon: Clock },
];

export function AdminHeader() {
  const pathname = usePathname();

  return (
    <div className="bg-white border-b border-gray-200 px-3">
      <nav className="flex items-center gap-2 overflow-x-auto py-1.5">
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname === item.href;
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
  );
}
