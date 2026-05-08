'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  Clock,
  History,
  LogOut,
  Tags,
  UtensilsCrossed,
  Wine,
} from 'lucide-react';

const navCards = [
  { title: 'Commandes en cours', description: 'Commandes recues a servir', href: '/admin/current_orders', icon: ClipboardList },
  { title: 'Historique', description: 'Commandes deja servies', href: '/admin/history', icon: History },
  { title: 'Categories', description: 'Gerer les categories', href: '/admin/categories', icon: Tags },
  { title: 'Plats', description: 'Gerer les plats et variantes', href: '/admin/dishes', icon: UtensilsCrossed },
  { title: 'Boissons', description: 'Gerer les boissons et tailles', href: '/admin/drinks', icon: Wine },
  { title: 'Allergenes', description: 'Matrice allergenes / plats', href: '/admin/allergens', icon: AlertTriangle },
  { title: 'Plats de la Semaine', description: 'Gerer les plats du jour', href: '/admin/weekly-specials', icon: Calendar },
  { title: 'Horaires', description: 'Services et heures d ouverture', href: '/admin/opening-hours', icon: Clock },
];

export default function AdminDashboard() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/admin/login');
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Administration</h1>
          <p className="text-sm text-gray-500">Cafe-Brasserie Millewee</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-gray-700">
          <LogOut className="h-4 w-4 mr-1" />
          Deconnexion
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {navCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-gray-200 bg-white">
              <CardHeader className="flex flex-row items-center gap-3 pb-3">
                <div className="p-2 rounded-md bg-[#fdf6e9]">
                  <card.icon className="h-5 w-5 text-[#d4a24e]" />
                </div>
                <div>
                  <CardTitle className="text-base text-gray-900">{card.title}</CardTitle>
                  <CardDescription className="text-xs">{card.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
