'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  MessageSquare,
  Settings,
  LayoutDashboard,
} from 'lucide-react';

const navItems = [
  {
    label: 'Contacts',
    href: '/contacts',
    icon: Users,
  },
  {
    label: 'Conversations',
    href: '/conversations',
    icon: MessageSquare,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <Link href="/contacts" className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-sidebar-primary" />
          <span className="font-semibold text-sidebar-foreground">
            CRM Assistant
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
